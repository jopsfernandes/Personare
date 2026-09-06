import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import { programs as programsTable } from "@/database/schema";
import { setDatabaseClient } from "@/ipc/database/state";
import { programs as programsNamespace } from "@/ipc/programs";

/**
 * RED phase (Issue #8, Spec Driven TDD): src/ipc/programs does not exist yet.
 * Every test below is expected to fail until Torno (Developer) implements
 * the "programs" oRPC namespace (list/create/update/softDelete) following
 * the pattern already used by src/ipc/database and src/ipc/theme.
 *
 * Procedures are exercised through `createRouterClient`, oRPC's in-process
 * server-side client -- this calls the handlers exactly the way the
 * renderer does through `ipc.client.programs.*`, without needing the
 * MessagePort/Electron transport.
 */

const PROGRAMS_ROUTER_REGISTRATION_PATTERN = /\bprograms\b/;

describe("programs IPC namespace (Issue #8)", () => {
  let tmpDir: string;
  let dbPath: string;
  let db: DatabaseClient;
  let client: ReturnType<typeof createRouterClient<typeof programsNamespace>>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-programs-ipc-"));
    dbPath = path.join(tmpDir, "test.sqlite");
    db = createDatabaseClient(dbPath);
    runMigrations(db);
    setDatabaseClient(db);
    client = createRouterClient(programsNamespace);
  });

  afterEach(() => {
    // Windows refuses to delete a sqlite file while a connection to it is
    // still open (EPERM), unlike Linux/macOS -- close it first.
    db.$client.close();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  it("is registered on the root oRPC router in src/ipc/router.ts", () => {
    const routerSource = fs.readFileSync(
      path.resolve(process.cwd(), "src/ipc/router.ts"),
      "utf-8"
    );

    expect(routerSource).toMatch(PROGRAMS_ROUTER_REGISTRATION_PATTERN);
  });

  it("exposes list, create, update and softDelete procedures", () => {
    expect(programsNamespace.list).toBeDefined();
    expect(programsNamespace.create).toBeDefined();
    expect(programsNamespace.update).toBeDefined();
    expect(programsNamespace.softDelete).toBeDefined();
  });

  describe("list", () => {
    it("returns an empty array when there are no programs", async () => {
      await expect(client.list()).resolves.toEqual([]);
    });

    it("returns programs that were created through the create procedure", async () => {
      const created = await client.create({ name: "Bacharelado II" });

      const list = await client.list();

      expect(list.map((program) => program.id)).toContain(created.id);
      expect(list.map((program) => program.name)).toContain("Bacharelado II");
    });

    it("orders programs by name", async () => {
      await client.create({ name: "Zeta" });
      await client.create({ name: "Alfa" });

      const list = await client.list();

      expect(list.map((program) => program.name)).toEqual(["Alfa", "Zeta"]);
    });

    it("excludes soft-deleted programs", async () => {
      const active = await client.create({ name: "Ativo" });
      const deleted = await client.create({ name: "Removido" });
      await client.softDelete({ id: deleted.id });

      const list = await client.list();

      expect(list.map((program) => program.id)).toContain(active.id);
      expect(list.map((program) => program.id)).not.toContain(deleted.id);
    });
  });

  describe("create", () => {
    it("inserts a new program with the given name and returns it", async () => {
      const created = await client.create({ name: "Pos I" });

      expect(typeof created.id).toBe("string");
      expect(created.name).toBe("Pos I");
    });

    it("rejects an empty name", async () => {
      await expect(client.create({ name: "" })).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("updates the name of an existing program", async () => {
      const created = await client.create({ name: "Nome Antigo" });

      const updated = await client.update({
        id: created.id,
        name: "Nome Novo",
      });

      expect(updated.id).toBe(created.id);
      expect(updated.name).toBe("Nome Novo");

      const list = await client.list();
      expect(list.find((program) => program.id === created.id)?.name).toBe(
        "Nome Novo"
      );
    });

    it("rejects an empty name", async () => {
      const created = await client.create({ name: "Valido" });

      await expect(
        client.update({ id: created.id, name: "" })
      ).rejects.toThrow();
    });
  });

  describe("softDelete", () => {
    it("sets deletedAt on the row instead of removing it from the database", async () => {
      const created = await client.create({ name: "Sera Removido" });

      await client.softDelete({ id: created.id });

      const rawRow = db
        .select()
        .from(programsTable)
        .where(eq(programsTable.id, created.id))
        .get();

      expect(rawRow).toBeDefined();
      expect(rawRow?.deletedAt).not.toBeNull();
    });

    it("excludes the soft-deleted program from a subsequent list call", async () => {
      const created = await client.create({ name: "Sera Removido" });

      await client.softDelete({ id: created.id });

      const list = await client.list();

      expect(list.map((program) => program.id)).not.toContain(created.id);
    });
  });
});
