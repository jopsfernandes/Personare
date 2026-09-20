import { ipc } from "@/ipc/manager";

export function listActivityCounts() {
  return ipc.client.review.listActivityCounts();
}
