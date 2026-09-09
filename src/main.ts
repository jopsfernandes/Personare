import path from "node:path";
import { app, BrowserWindow, Menu, Notification, Tray } from "electron";
import { ipcMain } from "electron/main";
import {
  installExtension,
  REACT_DEVELOPER_TOOLS,
} from "electron-devtools-installer";
import { UpdateSourceType, updateElectronApp } from "update-electron-app";
import { createDatabaseClient } from "@/database/client";
import { resolveMigrationsFolder, runMigrations } from "@/database/migrate";
import { ipcContext } from "@/ipc/context";
import { getDatabaseClient, setDatabaseClient } from "@/ipc/database/state";
import { getOrCreateAppSettings } from "@/ipc/settings/handlers";
import { countDueReviews } from "@/main/due-reviews";
import { createPlaceholderTrayIcon } from "@/main/tray-icon";
import { IPC_CHANNELS, inDevelopment } from "./constants";
import { getBasePath } from "./utils/path";

let mainWindow: BrowserWindow | undefined;
let tray: Tray | undefined;

// Only true inside the Tray's "Sair" handler, right before app.quit() --
// distinguishes a real quit from the window's own close button, which
// should minimize to the Tray instead (docs/specs/issue-20-notificacao-boot.md).
let isQuitting = false;

function createWindow() {
  const basePath = getBasePath();
  const preload = path.join(basePath, "preload.js");
  const window = new BrowserWindow({
    height: 600,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    trafficLightPosition:
      process.platform === "darwin" ? { x: 5, y: 5 } : undefined,
    webPreferences: {
      contextIsolation: true,
      devTools: inDevelopment,
      nodeIntegration: true,
      nodeIntegrationInSubFrames: false,

      preload,
    },
    width: 800,
  });
  ipcContext.setMainWindow(window);
  mainWindow = window;

  window.on("close", (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    window.hide();
  });

  window.on("closed", () => {
    mainWindow = undefined;
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    window.loadFile(
      path.join(basePath, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  return window;
}

function showMainWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
}

function createTray() {
  tray = new Tray(createPlaceholderTrayIcon());
  tray.setToolTip("Personare");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { click: showMainWindow, label: "Abrir Personare" },
      {
        click: () => {
          isQuitting = true;
          app.quit();
        },
        label: "Sair",
      },
    ])
  );
  tray.on("click", showMainWindow);
}

function notifyDueReviewsIfAny() {
  const db = getDatabaseClient();

  if (!db) {
    return;
  }

  const count = countDueReviews(db, new Date());

  if (count > 0) {
    new Notification({
      body: `Você tem ${count} revisões pendentes hoje`,
      title: "Personare",
    }).show();
  }
}

function syncLoginItemSettingsWithSavedPreference() {
  const db = getDatabaseClient();

  if (!db) {
    return;
  }

  const { autoStartEnabled } = getOrCreateAppSettings(db);
  app.setLoginItemSettings({ openAtLogin: autoStartEnabled });
}

async function installExtensions() {
  try {
    const result = await installExtension(REACT_DEVELOPER_TOOLS);
    console.log(`Extensions installed successfully: ${result.name}`);
  } catch {
    console.error("Failed to install extensions");
  }
}

function checkForUpdates() {
  updateElectronApp({
    updateSource: {
      repo: "jopsfernandes/Personare",
      type: UpdateSourceType.ElectronPublicUpdateService,
    },
  });
}

async function setupORPC() {
  const { rpcHandler } = await import("./ipc/handler");

  ipcMain.on(IPC_CHANNELS.START_ORPC_SERVER, (event) => {
    const [serverPort] = event.ports;

    serverPort.start();
    rpcHandler.upgrade(serverPort);
  });
}

function setupDatabase() {
  const dbPath = path.join(app.getPath("userData"), "personare.sqlite");
  const db = createDatabaseClient(dbPath);
  const migrationsFolder = resolveMigrationsFolder({
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
  });

  runMigrations(db, migrationsFolder);
  setDatabaseClient(db);
}

app.whenReady().then(async () => {
  try {
    const { wasOpenedAtLogin } = app.getLoginItemSettings();

    setupDatabase();
    syncLoginItemSettingsWithSavedPreference();
    createTray();

    if (wasOpenedAtLogin) {
      notifyDueReviewsIfAny();
    } else {
      createWindow();
    }

    await installExtensions();
    checkForUpdates();
    await setupORPC();
  } catch (error) {
    console.error("Error during app initialization:", error);
  }
});

//osX only
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    showMainWindow();
  }
});
//osX only ends
