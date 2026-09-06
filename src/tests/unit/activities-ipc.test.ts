import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import { activities as activitiesTable } from "@/database/schema";
import { activities as activitiesNamespace } from "@/ipc/activities";
import { setDatabaseClient } from "@/ipc/database/state";
import { modules as modulesNamespace } from "@/ipc/modules";
import { programs as programsNamespace } from "@/ipc/programs";

/**
 * RED phase (Issue #10, Spec Driven TDD): src/ipc/activities does not exist
 * yet. Every test below is expected to fail until Bigorna (Developer)
 * implements the "activities" oRPC namespace (list/create/update/softDelete)
 * mirroring the pattern already used by src/ipc/modules (Issue #9).
 *
 * Unlike modules.list (scoped by programId), activities.list receives
 * { moduleId } and must scope its results to that Module (criterio de
 * aceite 1). create/update also take a "type" field which, per the
 * architectural decision from Issue #4, is an OPEN text discriminator, not a
 * closed database enum -- the "accepts an activity type outside the MVP
 * list" test below guards against Bigorna accidentally introducing a
 * closed-enum validation.
 *
 * Procedures are exercised through `createRouterClient`, oRPC's in-process
 * server-side client -- this calls the handlers exactly the way the
 * renderer does through `ipc.client.activities.*`, without needing the
 * MessagePort/Electron transport.
 */

const ACTIVITIES_ROUTER_REGISTRATION_PATTERN = /\bactivities\b/;
const MVP_ACTIVITY_TYPES = ["link", "quiz", "pdf", "flashcard_deck"] as const;

describe("activities IPC namespace (Issue #10)", () => {
  let tmpDir: string;
  let dbPath: string;
  let db: DatabaseClient;
  let activitiesClient: ReturnType<
    typeof createRouterClient<typeof activitiesNamespace>
  >;
  let modulesClient: ReturnType<
    typeof createRouterClient<typeof modulesNamespace>
  >;
  let programsClient: ReturnType<
    typeof createRouterClient<typeof programsNamespace>
  >;
  let moduleId: string;
  let otherModuleId: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "personare-activities-ipc-")
    );
    dbPath = path.join(tmpDir, "test.sqlite");
    db = createDatabaseClient(dbPath);
    runMigrations(db);
    setDatabaseClient(db);
    activitiesClient = createRouterClient(activitiesNamespace);
    modulesClient = createRouterClient(modulesNamespace);
    programsClient = createRouterClient(programsNamespace);

    const program = await programsClient.create({ name: "Bacharelado II" });
    const createdModule = await modulesClient.create({
      name: "Modulo 1",
      programId: program.id,
    });
    moduleId = createdModule.id;
    const otherModule = await modulesClient.create({
      name: "Modulo 2",
      programId: program.id,
    });
    otherModuleId = otherModule.id;
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

    expect(routerSource).toMatch(ACTIVITIES_ROUTER_REGISTRATION_PATTERN);
  });

  it("exposes list, create, update and softDelete procedures", () => {
    expect(activitiesNamespace.list).toBeDefined();
    expect(activitiesNamespace.create).toBeDefined();
    expect(activitiesNamespace.update).toBeDefined();
    expect(activitiesNamespace.softDelete).toBeDefined();
  });

  describe("list", () => {
    it("returns an empty array when the module has no activities", async () => {
      await expect(activitiesClient.list({ moduleId })).resolves.toEqual([]);
    });

    it("returns activities that were created through the create procedure", async () => {
      const created = await activitiesClient.create({
        moduleId,
        title: "Aula 1",
        type: "link",
      });

      const list = await activitiesClient.list({ moduleId });

      expect(list.map((activity) => activity.id)).toContain(created.id);
      expect(list.map((activity) => activity.title)).toContain("Aula 1");
    });

    it("orders activities by creation order", async () => {
      const first = await activitiesClient.create({
        moduleId,
        title: "Primeira",
        type: "link",
      });
      const second = await activitiesClient.create({
        moduleId,
        title: "Segunda",
        type: "quiz",
      });

      const list = await activitiesClient.list({ moduleId });

      expect(list.map((activity) => activity.id)).toEqual([
        first.id,
        second.id,
      ]);
    });

    it("only returns activities belonging to the given module", async () => {
      const inModule = await activitiesClient.create({
        moduleId,
        title: "Deste modulo",
        type: "pdf",
      });
      await activitiesClient.create({
        moduleId: otherModuleId,
        title: "De outro modulo",
        type: "pdf",
      });

      const list = await activitiesClient.list({ moduleId });

      expect(list.map((activity) => activity.id)).toEqual([inModule.id]);
    });

    it("excludes soft-deleted activities", async () => {
      const active = await activitiesClient.create({
        moduleId,
        title: "Ativa",
        type: "quiz",
      });
      const deleted = await activitiesClient.create({
        moduleId,
        title: "Removida",
        type: "quiz",
      });
      await activitiesClient.softDelete({ id: deleted.id });

      const list = await activitiesClient.list({ moduleId });

      expect(list.map((activity) => activity.id)).toContain(active.id);
      expect(list.map((activity) => activity.id)).not.toContain(deleted.id);
    });
  });

  describe("create", () => {
    it("inserts a new activity associated with the given module and returns it", async () => {
      const created = await activitiesClient.create({
        moduleId,
        title: "Aula 1",
        type: "flashcard_deck",
      });

      expect(typeof created.id).toBe("string");
      expect(created.title).toBe("Aula 1");
      expect(created.type).toBe("flashcard_deck");
      expect(created.moduleId).toBe(moduleId);
    });

    it("rejects an empty title", async () => {
      await expect(
        activitiesClient.create({ moduleId, title: "", type: "link" })
      ).rejects.toThrow();
    });

    it("rejects an empty type", async () => {
      await expect(
        activitiesClient.create({ moduleId, title: "Valido", type: "" })
      ).rejects.toThrow();
    });

    it.each(MVP_ACTIVITY_TYPES)(
      "accepts the MVP activity type %s",
      async (type) => {
        const created = await activitiesClient.create({
          moduleId,
          title: "Titulo",
          type,
        });

        expect(created.type).toBe(type);
      }
    );

    it("accepts an activity type outside the MVP list, since type is an open text column and not a closed enum (Issue #4)", async () => {
      const created = await activitiesClient.create({
        moduleId,
        title: "Tipo futuro",
        type: "video",
      });

      expect(created.type).toBe("video");
    });
  });

  describe("update", () => {
    it("updates the title and type of an existing activity", async () => {
      const created = await activitiesClient.create({
        moduleId,
        title: "Nome Antigo",
        type: "link",
      });

      const updated = await activitiesClient.update({
        id: created.id,
        title: "Nome Novo",
        type: "quiz",
      });

      expect(updated.id).toBe(created.id);
      expect(updated.title).toBe("Nome Novo");
      expect(updated.type).toBe("quiz");

      const list = await activitiesClient.list({ moduleId });
      const persisted = list.find((activity) => activity.id === created.id);
      expect(persisted?.title).toBe("Nome Novo");
      expect(persisted?.type).toBe("quiz");
    });

    it("rejects an empty title", async () => {
      const created = await activitiesClient.create({
        moduleId,
        title: "Valido",
        type: "pdf",
      });

      await expect(
        activitiesClient.update({ id: created.id, title: "", type: "pdf" })
      ).rejects.toThrow();
    });

    it("rejects an empty type", async () => {
      const created = await activitiesClient.create({
        moduleId,
        title: "Valido",
        type: "pdf",
      });

      await expect(
        activitiesClient.update({ id: created.id, title: "Valido", type: "" })
      ).rejects.toThrow();
    });
  });

  describe("softDelete", () => {
    it("sets deletedAt on the row instead of removing it from the database", async () => {
      const created = await activitiesClient.create({
        moduleId,
        title: "Sera Removida",
        type: "link",
      });

      await activitiesClient.softDelete({ id: created.id });

      const rawRow = db
        .select()
        .from(activitiesTable)
        .where(eq(activitiesTable.id, created.id))
        .get();

      expect(rawRow).toBeDefined();
      expect(rawRow?.deletedAt).not.toBeNull();
    });

    it("excludes the soft-deleted activity from a subsequent list call", async () => {
      const created = await activitiesClient.create({
        moduleId,
        title: "Sera Removida",
        type: "link",
      });

      await activitiesClient.softDelete({ id: created.id });

      const list = await activitiesClient.list({ moduleId });

      expect(list.map((activity) => activity.id)).not.toContain(created.id);
    });
  });
});
