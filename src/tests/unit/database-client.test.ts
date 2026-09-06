import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient } from "@/database/client";

describe("createDatabaseClient", () => {
  let tmpDir: string;
  let dbPath: string;
  let db: ReturnType<typeof createDatabaseClient> | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-db-client-"));
    dbPath = path.join(tmpDir, "test.sqlite");
    db = undefined;
  });

  afterEach(() => {
    // Windows refuses to delete a sqlite file while a connection to it is
    // still open (EPERM), unlike Linux/macOS -- close it first.
    db?.$client.close();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it("creates a database client without throwing", () => {
    expect(() => {
      db = createDatabaseClient(dbPath);
    }).not.toThrow();
  });

  it("creates the sqlite file on disk at the given path", () => {
    db = createDatabaseClient(dbPath);

    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it("returns a client that can run a raw query against the underlying sqlite connection", () => {
    db = createDatabaseClient(dbPath);
    const result = db.$client.prepare("SELECT 1 as value").get();

    expect(result).toEqual({ value: 1 });
  });
});
