import { ipc } from "@/ipc/manager";

export function selectPdfFile() {
  return ipc.client.dialog.selectPdfFile();
}
