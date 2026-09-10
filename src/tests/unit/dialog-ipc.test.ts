import fs from "node:fs";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * RED phase (Issue #13, Spec Driven TDD): src/ipc/dialog does not exist yet.
 * Every test below is expected to fail until Serralheria (Developer)
 * implements the "dialog" oRPC namespace, mirroring the pattern already used
 * by src/ipc/shell (Issue #12).
 *
 * dialog.showOpenDialog() is only available in Electron's main process --
 * the renderer cannot touch the filesystem directly. The "selectPdfFile"
 * procedure below runs in the main process and is exercised here through
 * `createRouterClient`, oRPC's in-process server-side client, with
 * Electron's "dialog" module mocked (criterio de aceite 5: "pode mockar
 * dialog.showOpenDialog do Electron nos testes").
 *
 * RED phase (Issue #21, Spec Driven TDD): selectBackupExportPath/
 * selectBackupImportFile do not exist yet either -- see
 * docs/specs/issue-21-backup-local.md AC-4.
 */

const showOpenDialogMock = vi.fn();
const showSaveDialogMock = vi.fn();

vi.mock("electron", () => ({
  dialog: {
    showOpenDialog: (...args: unknown[]) => showOpenDialogMock(...args),
    showSaveDialog: (...args: unknown[]) => showSaveDialogMock(...args),
  },
}));

const DIALOG_ROUTER_REGISTRATION_PATTERN = /\bdialog\b/;

describe("dialog IPC namespace (Issue #13)", () => {
  beforeEach(() => {
    showOpenDialogMock.mockReset();
    showSaveDialogMock.mockReset();
  });

  it("is registered on the root oRPC router in src/ipc/router.ts", () => {
    const routerSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/ipc/router.ts"),
      "utf-8"
    );

    expect(routerSource).toMatch(DIALOG_ROUTER_REGISTRATION_PATTERN);
  });

  it("exposes a selectPdfFile procedure", async () => {
    const { dialog } = await import("@/ipc/dialog");

    expect(dialog.selectPdfFile).toBeDefined();
  });

  it("opens a native file picker restricted to a single local PDF file", async () => {
    showOpenDialogMock.mockResolvedValue({
      canceled: false,
      filePaths: ["C:\\Users\\aluno\\Documents\\apostila.pdf"],
    });
    const { dialog } = await import("@/ipc/dialog");
    const dialogClient = createRouterClient(dialog);

    await dialogClient.selectPdfFile();

    expect(showOpenDialogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [{ extensions: ["pdf"], name: "PDF" }],
        properties: ["openFile"],
      })
    );
  });

  it("returns the selected file path when the user picks a file", async () => {
    showOpenDialogMock.mockResolvedValue({
      canceled: false,
      filePaths: ["C:\\Users\\aluno\\Documents\\apostila.pdf"],
    });
    const { dialog } = await import("@/ipc/dialog");
    const dialogClient = createRouterClient(dialog);

    await expect(dialogClient.selectPdfFile()).resolves.toBe(
      "C:\\Users\\aluno\\Documents\\apostila.pdf"
    );
  });

  it("returns null when the user cancels the dialog", async () => {
    showOpenDialogMock.mockResolvedValue({ canceled: true, filePaths: [] });
    const { dialog } = await import("@/ipc/dialog");
    const dialogClient = createRouterClient(dialog);

    await expect(dialogClient.selectPdfFile()).resolves.toBeNull();
  });

  describe("selectBackupExportPath (Issue #21)", () => {
    it("exposes a selectBackupExportPath procedure", async () => {
      const { dialog } = await import("@/ipc/dialog");

      expect(dialog.selectBackupExportPath).toBeDefined();
    });

    it("opens a native save dialog restricted to the .personare-backup extension", async () => {
      showSaveDialogMock.mockResolvedValue({
        canceled: false,
        filePath: "C:\\Users\\aluno\\Documents\\backup.personare-backup",
      });
      const { dialog } = await import("@/ipc/dialog");
      const dialogClient = createRouterClient(dialog);

      await dialogClient.selectBackupExportPath();

      expect(showSaveDialogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [
            { extensions: ["personare-backup"], name: "Personare Backup" },
          ],
        })
      );
    });

    it("returns the chosen path when the user picks a location", async () => {
      showSaveDialogMock.mockResolvedValue({
        canceled: false,
        filePath: "C:\\Users\\aluno\\Documents\\backup.personare-backup",
      });
      const { dialog } = await import("@/ipc/dialog");
      const dialogClient = createRouterClient(dialog);

      await expect(dialogClient.selectBackupExportPath()).resolves.toBe(
        "C:\\Users\\aluno\\Documents\\backup.personare-backup"
      );
    });

    it("returns null when the user cancels the dialog", async () => {
      showSaveDialogMock.mockResolvedValue({
        canceled: true,
        filePath: undefined,
      });
      const { dialog } = await import("@/ipc/dialog");
      const dialogClient = createRouterClient(dialog);

      await expect(dialogClient.selectBackupExportPath()).resolves.toBeNull();
    });
  });

  describe("selectBackupImportFile (Issue #21)", () => {
    it("exposes a selectBackupImportFile procedure", async () => {
      const { dialog } = await import("@/ipc/dialog");

      expect(dialog.selectBackupImportFile).toBeDefined();
    });

    it("opens a native file picker restricted to the .personare-backup extension", async () => {
      showOpenDialogMock.mockResolvedValue({
        canceled: false,
        filePaths: ["C:\\Users\\aluno\\Documents\\backup.personare-backup"],
      });
      const { dialog } = await import("@/ipc/dialog");
      const dialogClient = createRouterClient(dialog);

      await dialogClient.selectBackupImportFile();

      expect(showOpenDialogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: [
            { extensions: ["personare-backup"], name: "Personare Backup" },
          ],
          properties: ["openFile"],
        })
      );
    });

    it("returns the chosen path when the user picks a file", async () => {
      showOpenDialogMock.mockResolvedValue({
        canceled: false,
        filePaths: ["C:\\Users\\aluno\\Documents\\backup.personare-backup"],
      });
      const { dialog } = await import("@/ipc/dialog");
      const dialogClient = createRouterClient(dialog);

      await expect(dialogClient.selectBackupImportFile()).resolves.toBe(
        "C:\\Users\\aluno\\Documents\\backup.personare-backup"
      );
    });

    it("returns null when the user cancels the dialog", async () => {
      showOpenDialogMock.mockResolvedValue({ canceled: true, filePaths: [] });
      const { dialog } = await import("@/ipc/dialog");
      const dialogClient = createRouterClient(dialog);

      await expect(dialogClient.selectBackupImportFile()).resolves.toBeNull();
    });
  });
});
