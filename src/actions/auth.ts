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
