import { os } from "@orpc/server";
import { getDatabaseClient } from "./state";

export const getDatabaseStatus = os.handler(() => {
  const db = getDatabaseClient();

  if (!db) {
    return { connected: false };
  }

  try {
    db.$client.prepare("SELECT 1").get();
    return { connected: true };
  } catch {
    return { connected: false };
  }
});
