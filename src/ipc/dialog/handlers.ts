import { os } from "@orpc/server";
import { dialog as electronDialog } from "electron";

const BACKUP_FILTERS = [
  { extensions: ["personare-backup"], name: "Personare Backup" },
];

export const selectPdfFile = os.handler(async () => {
  const { canceled, filePaths } = await electronDialog.showOpenDialog({
    filters: [{ extensions: ["pdf"], name: "PDF" }],
    properties: ["openFile"],
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  return filePaths[0];
});

export const selectBackupExportPath = os.handler(async () => {
  const { canceled, filePath } = await electronDialog.showSaveDialog({
    defaultPath: `personare-backup-${new Date().toISOString().slice(0, 10)}.personare-backup`,
    filters: BACKUP_FILTERS,
  });

  if (canceled || !filePath) {
    return null;
  }

  return filePath;
});

export const selectBackupImportFile = os.handler(async () => {
  const { canceled, filePaths } = await electronDialog.showOpenDialog({
    filters: BACKUP_FILTERS,
    properties: ["openFile"],
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  return filePaths[0];
});
