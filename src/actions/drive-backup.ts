import { ipc } from "@/ipc/manager";

export function connectDrive() {
  return ipc.client.driveBackup.connect();
}

export function getDriveConnectionStatus() {
  return ipc.client.driveBackup.getConnectionStatus();
}

export function backupToDrive(passphrase: string) {
  return ipc.client.driveBackup.backup({ passphrase });
}

export function restoreFromDrive(passphrase: string) {
  return ipc.client.driveBackup.restore({ passphrase });
}
