import { ipc } from "@/ipc/manager";

export function openExternalLink(url: string) {
  return ipc.client.shell.openExternalLink({ url });
}

export function openActivityFile(path: string) {
  return ipc.client.shell.openPath({ path });
}
