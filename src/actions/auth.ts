import { ipc } from "@/ipc/manager";

export function getSession() {
  return ipc.client.auth.getSession();
}

export function login() {
  return ipc.client.auth.login();
}

export function logout() {
  return ipc.client.auth.logout();
}

export function exportAccountData(filePath: string) {
  return ipc.client.auth.exportAccountData({ filePath });
}

export function deleteAccount() {
  return ipc.client.auth.deleteAccount();
}
