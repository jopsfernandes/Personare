import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient } from "@/database/client";
import { resolveMigrationsFolder, runMigrations } from "@/database/migrate";

describe("runMigrations", () => {
  let tmpDir: string;
  let dbPath: string;
  let db: ReturnType<typeof createDatabaseClient> | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-db-migrate-"));
    dbPath = path.join(tmpDir, "test.sqlite");
    db = undefined;
  });

  afterEach(() => {
    // Windows refuses to delete a sqlite file while a connection to it is
    // still open (EPERM), unlike Linux/macOS -- close it first.
    db?.$client.close();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it("runs pending migrations against a fresh database without throwing", () => {
    db = createDatabaseClient(dbPath);

    expect(() => runMigrations(db)).not.toThrow();
  });

  it("is idempotent: running migrations twice does not throw", () => {
    db = createDatabaseClient(dbPath);

    runMigrations(db);

    expect(() => runMigrations(db)).not.toThrow();
  });

  it("records applied migrations in a drizzle migrations tracking table", () => {
    db = createDatabaseClient(dbPath);

    runMigrations(db);

    const tables = db.$client
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '%migrations%'"
      )
      .all();

    expect(tables.length).toBeGreaterThan(0);
  });
});

describe("resolveMigrationsFolder", () => {
  it("resolves against the repo root when not packaged", () => {
    const migrationsFolder = resolveMigrationsFolder({
      isPackaged: false,
      resourcesPath: "C:\\some\\unused\\resources",
    });

    expect(migrationsFolder).toBe(path.resolve(process.cwd(), "drizzle"));
  });

  it("resolves against process.resourcesPath when packaged", () => {
    const resourcesPath = path.join(
      os.tmpdir(),
      "personare-packaged-resources"
    );

    const migrationsFolder = resolveMigrationsFolder({
      isPackaged: true,
      resourcesPath,
    });

    expect(migrationsFolder).toBe(path.join(resourcesPath, "drizzle"));
  });
});

describe("drizzle-kit migrations folder", () => {
  it("contains at least one generated migration file", () => {
    const migrationsDir = path.resolve(process.cwd(), "drizzle");

    expect(fs.existsSync(migrationsDir)).toBe(true);

    const sqlFiles = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"));

    expect(sqlFiles.length).toBeGreaterThanOrEqual(1);
  });
});
