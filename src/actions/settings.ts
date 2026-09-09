import { ipc } from "@/ipc/manager";

export function getSettings() {
  return ipc.client.settings.get();
}

export function setAutoStart(enabled: boolean) {
  return ipc.client.settings.setAutoStart({ enabled });
}
