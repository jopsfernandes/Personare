import fs from "node:fs";
import { os } from "@orpc/server";
import { app } from "electron";
import { getDatabaseClient } from "@/ipc/database/state";
import { deserializeBackup, serializeBackup } from "@/utils/backup-codec";
import { decryptBackup, encryptBackup } from "@/utils/backup-crypto";
import { collectBackupData, restoreBackupData } from "@/utils/backup-data";
import { exportBackupInputSchema, importBackupInputSchema } from "./schemas";

function requireDatabaseClient() {
  const db = getDatabaseClient();

  if (!db) {
    throw new Error("Database client is not initialized");
  }

  return db;
}

export const exportBackup = os
  .input(exportBackupInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    const json = serializeBackup({
      ...collectBackupData(db),
      exportedAt: new Date(),
      version: 1,
    });
    const encrypted = encryptBackup(json, input.passphrase);

    fs.writeFileSync(input.filePath, encrypted);
  });

export const importBackup = os
  .input(importBackupInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    const encrypted = fs.readFileSync(input.filePath);
    const json = decryptBackup(encrypted, input.passphrase);
    const data = deserializeBackup(json);

    restoreBackupData(db, data);

    /**
     * Without this, the new process's own requestSingleInstanceLock() can
     * lose the race against this process still holding it (Windows in
     * particular), silently quitting itself with no window ever shown --
     * the app looks like it "didn't reopen" after import.
     */
    app.releaseSingleInstanceLock();
    app.relaunch();
    app.exit(0);
  });
