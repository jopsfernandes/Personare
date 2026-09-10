import { ipc } from "@/ipc/manager";

export function selectPdfFile() {
  return ipc.client.dialog.selectPdfFile();
}

export function selectBackupExportPath() {
  return ipc.client.dialog.selectBackupExportPath();
}

export function selectBackupImportFile() {
  return ipc.client.dialog.selectBackupImportFile();
}
