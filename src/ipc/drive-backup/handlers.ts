import { os } from "@orpc/server";
import { app, shell } from "electron";
import { z } from "zod";
import { DRIVE_CONNECT_REDIRECT_URI } from "@/constants";
import { getAuthToken } from "@/ipc/auth/state";
import { getDatabaseClient } from "@/ipc/database/state";
import {
  downloadDriveBackup,
  fetchDriveAuthorizationUrl,
  uploadDriveBackup,
} from "@/main/backend-client";
import { deserializeBackup, serializeBackup } from "@/utils/backup-codec";
import { decryptBackup, encryptBackup } from "@/utils/backup-crypto";
import { collectBackupData, restoreBackupData } from "@/utils/backup-data";
import { getDriveConnected } from "./state";

function requireDatabaseClient() {
  const db = getDatabaseClient();

  if (!db) {
    throw new Error("Database client is not initialized");
  }

  return db;
}

export const connect = os.handler(async () => {
  const token = getAuthToken();

  if (!token) {
    return;
  }

  const authorizationUrl = await fetchDriveAuthorizationUrl(
    token,
    DRIVE_CONNECT_REDIRECT_URI
  );

  if (authorizationUrl) {
    await shell.openExternal(authorizationUrl);
  }
});

export const getConnectionStatus = os.handler(() => getDriveConnected());

const passphraseInputSchema = z.object({ passphrase: z.string().min(1) });

export const backup = os
  .input(passphraseInputSchema)
  .handler(async ({ input }) => {
    const token = getAuthToken();

    if (!token) {
      return { error: "not_logged_in" };
    }

    const db = requireDatabaseClient();
    const json = serializeBackup({
      ...collectBackupData(db),
      exportedAt: new Date(),
      version: 1,
    });
    const encrypted = encryptBackup(json, input.passphrase);

    return await uploadDriveBackup(token, encrypted.toString("base64"));
  });

export const restore = os
  .input(passphraseInputSchema)
  .handler(async ({ input }) => {
    const token = getAuthToken();

    if (!token) {
      return { error: "not_logged_in" };
    }

    const result = await downloadDriveBackup(token);

    if ("error" in result) {
      return result;
    }

    const db = requireDatabaseClient();
    const json = decryptBackup(
      Buffer.from(result.data, "base64"),
      input.passphrase
    );
    const data = deserializeBackup(json);

    restoreBackupData(db, data);

    app.releaseSingleInstanceLock();
    app.relaunch();
    app.exit(0);
  });
