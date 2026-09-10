import { ipc } from "@/ipc/manager";

export function exportBackup(filePath: string, passphrase: string) {
  return ipc.client.backup.exportBackup({ filePath, passphrase });
}

export function importBackup(filePath: string, passphrase: string) {
  return ipc.client.backup.importBackup({ filePath, passphrase });
}
