import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import { programs } from "@/database/schema";
import { setDatabaseClient } from "@/ipc/database/state";

/**
 * RED phase (Issue #27, Spec Driven TDD): src/ipc/drive-backup does not
 * exist yet. Every test below is expected to fail until the Developer
 * implements the "driveBackup" oRPC namespace per
 * docs/specs/issue-27-google-drive-backup.md AC-10.
 *
 * Mirrors the combination of calendar-sync-ipc.test.ts (connect/status,
 * mocking @/main/backend-client and electron's shell) and backup-ipc.test.ts
 * (real DB round-trip through the existing backup-codec/crypto/data
 * primitives, mocking electron's app.relaunch/exit for the restore path).
 */

const openExternalMock = vi.fn();
const relaunchMock = vi.fn();
const exitMock = vi.fn();
const releaseSingleInstanceLockMock = vi.fn();

vi.mock("electron", () => ({
  app: {
    exit: (...args: unknown[]) => exitMock(...args),
    relaunch: (...args: unknown[]) => relaunchMock(...args),
    releaseSingleInstanceLock: (...args: unknown[]) =>
      releaseSingleInstanceLockMock(...args),
  },
  shell: {
    openExternal: (...args: unknown[]) => openExternalMock(...args),
  },
}));

vi.mock("@/main/backend-client", () => ({
  downloadDriveBackup: vi.fn(),
  fetchDriveAuthorizationUrl: vi.fn(),
  uploadDriveBackup: vi.fn(),
}));

const { fetchDriveAuthorizationUrl, uploadDriveBackup, downloadDriveBackup } =
  await import("@/main/backend-client");

const DRIVE_BACKUP_ROUTER_REGISTRATION_PATTERN = /\bdriveBackup\b/;

describe("driveBackup IPC namespace (Issue #27)", () => {
  let tmpDir: string;
  let db: DatabaseClient;
  let client: Awaited<ReturnType<typeof loadClient>>;

  async function loadClient() {
    const { driveBackup } = await import("@/ipc/drive-backup");
    return createRouterClient(driveBackup);
  }

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-drive-ipc-"));
    db = createDatabaseClient(path.join(tmpDir, "test.sqlite"));
    runMigrations(db);
    setDatabaseClient(db);
    openExternalMock.mockReset().mockResolvedValue(undefined);
    relaunchMock.mockReset();
    exitMock.mockReset();
    releaseSingleInstanceLockMock.mockReset();
    vi.mocked(fetchDriveAuthorizationUrl).mockReset();
    vi.mocked(uploadDriveBackup).mockReset();
    vi.mocked(downloadDriveBackup).mockReset();

    const { setAuthToken } = await import("@/ipc/auth/state");
    setAuthToken(null);
    const { setDriveConnected } = await import("@/ipc/drive-backup/state");
    setDriveConnected(false);

    client = await loadClient();
  });

  it("is registered on the root oRPC router in src/ipc/router.ts", () => {
    const routerSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/ipc/router.ts"),
      "utf-8"
    );

    expect(routerSource).toMatch(DRIVE_BACKUP_ROUTER_REGISTRATION_PATTERN);
  });

  describe("connect", () => {
    it("opens the backend's authorization URL when logged in", async () => {
      const { setAuthToken } = await import("@/ipc/auth/state");
      setAuthToken("the-jwt-token");
      vi.mocked(fetchDriveAuthorizationUrl).mockResolvedValue(
        "https://accounts.google.com/x"
      );

      await client.connect();

      expect(fetchDriveAuthorizationUrl).toHaveBeenCalledWith(
        "the-jwt-token",
        "personare://drive-connect-callback"
      );
      expect(openExternalMock).toHaveBeenCalledWith(
        "https://accounts.google.com/x"
      );
    });

    it("does not open a browser when logged out", async () => {
      await client.connect();

      expect(fetchDriveAuthorizationUrl).not.toHaveBeenCalled();
      expect(openExternalMock).not.toHaveBeenCalled();
    });

    it("does not open a browser when the backend refuses to return an authorization URL", async () => {
      const { setAuthToken } = await import("@/ipc/auth/state");
      setAuthToken("the-jwt-token");
      vi.mocked(fetchDriveAuthorizationUrl).mockResolvedValue(null);

      await client.connect();

      expect(openExternalMock).not.toHaveBeenCalled();
    });
  });

  describe("getConnectionStatus", () => {
    it("reflects whatever the drive-connect callback last set", async () => {
      const { setDriveConnected } = await import("@/ipc/drive-backup/state");

      await expect(client.getConnectionStatus()).resolves.toBe(false);

      setDriveConnected(true);

      await expect(client.getConnectionStatus()).resolves.toBe(true);
    });
  });

  describe("backup", () => {
    it("returns not_logged_in when there is no session", async () => {
      const result = await client.backup({ passphrase: "abc123" });

      expect(result).toEqual({ error: "not_logged_in" });
      expect(uploadDriveBackup).not.toHaveBeenCalled();
    });

    it("uploads the currently encrypted data and returns the backend's result", async () => {
      const { setAuthToken } = await import("@/ipc/auth/state");
      setAuthToken("the-jwt-token");
      const now = new Date();
      db.insert(programs)
        .values({
          createdAt: now,
          id: randomUUID(),
          name: "Pos I",
          updatedAt: now,
        })
        .run();
      vi.mocked(uploadDriveBackup).mockResolvedValue({ success: true });

      const result = await client.backup({ passphrase: "abc123" });

      expect(result).toEqual({ success: true });
      expect(uploadDriveBackup).toHaveBeenCalledWith(
        "the-jwt-token",
        expect.any(String)
      );
    });

    it("propagates a drive_not_connected error from the backend", async () => {
      const { setAuthToken } = await import("@/ipc/auth/state");
      setAuthToken("the-jwt-token");
      vi.mocked(uploadDriveBackup).mockResolvedValue({
        error: "drive_not_connected",
      });

      const result = await client.backup({ passphrase: "abc123" });

      expect(result).toEqual({ error: "drive_not_connected" });
    });
  });

  describe("restore", () => {
    it("returns not_logged_in when there is no session", async () => {
      const result = await client.restore({ passphrase: "abc123" });

      expect(result).toEqual({ error: "not_logged_in" });
      expect(downloadDriveBackup).not.toHaveBeenCalled();
    });

    it("propagates a drive_not_connected error without touching the database", async () => {
      const { setAuthToken } = await import("@/ipc/auth/state");
      setAuthToken("the-jwt-token");
      vi.mocked(downloadDriveBackup).mockResolvedValue({
        error: "drive_not_connected",
      });

      const result = await client.restore({ passphrase: "abc123" });

      expect(result).toEqual({ error: "drive_not_connected" });
      expect(relaunchMock).not.toHaveBeenCalled();
    });

    it("propagates a no_backup_found error without touching the database", async () => {
      const { setAuthToken } = await import("@/ipc/auth/state");
      setAuthToken("the-jwt-token");
      vi.mocked(downloadDriveBackup).mockResolvedValue({
        error: "no_backup_found",
      });

      const result = await client.restore({ passphrase: "abc123" });

      expect(result).toEqual({ error: "no_backup_found" });
      expect(relaunchMock).not.toHaveBeenCalled();
    });

    it("throws and does not modify current data when the passphrase is wrong", async () => {
      const { setAuthToken } = await import("@/ipc/auth/state");
      setAuthToken("the-jwt-token");
      const now = new Date();
      db.insert(programs)
        .values({
          createdAt: now,
          id: randomUUID(),
          name: "Original",
          updatedAt: now,
        })
        .run();
      vi.mocked(uploadDriveBackup).mockResolvedValue({ success: true });
      let uploadedData = "";
      vi.mocked(uploadDriveBackup).mockImplementation((_token, data) => {
        uploadedData = data;
        return Promise.resolve({ success: true });
      });
      await client.backup({ passphrase: "right" });
      vi.mocked(downloadDriveBackup).mockResolvedValue({ data: uploadedData });

      await expect(client.restore({ passphrase: "wrong" })).rejects.toThrow();

      const current = db.select().from(programs).all();
      expect(current.map((p) => p.name)).toEqual(["Original"]);
      expect(relaunchMock).not.toHaveBeenCalled();
    });

    it("restores the data and relaunches the app on success", async () => {
      const { setAuthToken } = await import("@/ipc/auth/state");
      setAuthToken("the-jwt-token");
      const now = new Date();
      db.insert(programs)
        .values({
          createdAt: now,
          id: randomUUID(),
          name: "Pos I",
          updatedAt: now,
        })
        .run();
      let uploadedData = "";
      vi.mocked(uploadDriveBackup).mockImplementation((_token, data) => {
        uploadedData = data;
        return Promise.resolve({ success: true });
      });
      await client.backup({ passphrase: "abc123" });
      db.delete(programs).run();
      vi.mocked(downloadDriveBackup).mockResolvedValue({ data: uploadedData });

      await client.restore({ passphrase: "abc123" });

      const restored = db.select().from(programs).all();
      expect(restored.map((p) => p.name)).toEqual(["Pos I"]);
      expect(relaunchMock).toHaveBeenCalledTimes(1);
      expect(exitMock).toHaveBeenCalledTimes(1);
      expect(releaseSingleInstanceLockMock).toHaveBeenCalledTimes(1);
    });
  });
});
