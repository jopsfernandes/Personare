import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import { programs } from "@/database/schema";
import { setDatabaseClient } from "@/ipc/database/state";

/**
 * RED phase (Issue #21, Spec Driven TDD): src/ipc/backup does not exist yet.
 * Every test below is expected to fail until the Developer implements the
 * "backup" oRPC namespace per docs/specs/issue-21-backup-local.md AC-5.
 *
 * app.relaunch()/app.exit() only make sense inside the real Electron main
 * process -- mirroring the precedent of dialog-ipc.test.ts/settings-ipc.test.ts,
 * this suite mocks electron's `app`. The backup file itself is written to a
 * real temp directory rather than mocking node:fs, since no production
 * handler in this codebase mocks the filesystem directly.
 */

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
}));

const BACKUP_ROUTER_REGISTRATION_PATTERN = /\bbackup\b/;

describe("backup IPC namespace (Issue #21)", () => {
  let tmpDir: string;
  let dbPath: string;
  let backupPath: string;
  let db: DatabaseClient;
  let client: Awaited<ReturnType<typeof loadClient>>;

  async function loadClient() {
    const { backup } = await import("@/ipc/backup");
    return createRouterClient(backup);
  }

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-backup-ipc-"));
    dbPath = path.join(tmpDir, "test.sqlite");
    backupPath = path.join(tmpDir, "backup.personare-backup");
    db = createDatabaseClient(dbPath);
    runMigrations(db);
    setDatabaseClient(db);
    relaunchMock.mockReset();
    exitMock.mockReset();
    releaseSingleInstanceLockMock.mockReset();
    client = await loadClient();
  });

  afterEach(() => {
    db.$client.close();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it("is registered on the root oRPC router in src/ipc/router.ts", () => {
    const routerSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/ipc/router.ts"),
      "utf-8"
    );

    expect(routerSource).toMatch(BACKUP_ROUTER_REGISTRATION_PATTERN);
  });

  describe("exportBackup", () => {
    it("writes an encrypted file at filePath containing the current data", async () => {
      const now = new Date();
      db.insert(programs)
        .values({
          createdAt: now,
          id: randomUUID(),
          name: "Pos I",
          updatedAt: now,
        })
        .run();

      await client.exportBackup({ filePath: backupPath, passphrase: "abc123" });

      const written = fs.readFileSync(backupPath);
      expect(written.length).toBeGreaterThan(0);
    });

    it("produces a file that importBackup can restore with the same passphrase", async () => {
      const now = new Date();
      db.insert(programs)
        .values({
          createdAt: now,
          id: randomUUID(),
          name: "Pos I",
          updatedAt: now,
        })
        .run();

      await client.exportBackup({ filePath: backupPath, passphrase: "abc123" });
      db.delete(programs).run();

      await client.importBackup({ filePath: backupPath, passphrase: "abc123" });

      const restored = db.select().from(programs).all();
      expect(restored.map((p) => p.name)).toEqual(["Pos I"]);
    });
  });

  describe("importBackup", () => {
    it("throws and does not modify current data when the passphrase is wrong", async () => {
      const now = new Date();
      db.insert(programs)
        .values({
          createdAt: now,
          id: randomUUID(),
          name: "Original",
          updatedAt: now,
        })
        .run();
      await client.exportBackup({ filePath: backupPath, passphrase: "right" });

      await expect(
        client.importBackup({ filePath: backupPath, passphrase: "wrong" })
      ).rejects.toThrow();

      const current = db.select().from(programs).all();
      expect(current.map((p) => p.name)).toEqual(["Original"]);
    });

    it("relaunches the app after a successful import", async () => {
      await client.exportBackup({ filePath: backupPath, passphrase: "abc123" });

      await client.importBackup({ filePath: backupPath, passphrase: "abc123" });

      expect(relaunchMock).toHaveBeenCalledTimes(1);
      expect(exitMock).toHaveBeenCalledTimes(1);
    });

    it("releases the single-instance lock before relaunching, so the new process can acquire it", async () => {
      await client.exportBackup({ filePath: backupPath, passphrase: "abc123" });

      await client.importBackup({ filePath: backupPath, passphrase: "abc123" });

      expect(releaseSingleInstanceLockMock).toHaveBeenCalledTimes(1);
      expect(releaseSingleInstanceLockMock.mock.invocationCallOrder[0]).toBeLessThan(
        relaunchMock.mock.invocationCallOrder[0]
      );
    });

    it("does not relaunch when the import fails", async () => {
      await client.exportBackup({ filePath: backupPath, passphrase: "right" });

      await expect(
        client.importBackup({ filePath: backupPath, passphrase: "wrong" })
      ).rejects.toThrow();

      expect(relaunchMock).not.toHaveBeenCalled();
      expect(exitMock).not.toHaveBeenCalled();
    });
  });
});
