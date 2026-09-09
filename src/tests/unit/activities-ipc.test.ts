import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import {
  activities as activitiesTable,
  flashcards as flashcardsTable,
} from "@/database/schema";
import { activities as activitiesNamespace } from "@/ipc/activities";
import { setDatabaseClient } from "@/ipc/database/state";
import { flashcards as flashcardsNamespace } from "@/ipc/flashcards";
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

    /**
     * RED phase (Issue #12, Spec Driven TDD): list does not return a "url"
     * field yet -- expected to fail until Bancada wires it through
     * src/ipc/activities/handlers.ts (criterio de aceite 6).
     */
    it("includes the url of activities that have one", async () => {
      await activitiesClient.create({
        moduleId,
        title: "Aula 1",
        type: "link",
        url: "https://example.com/aula-1",
      });

      const list = await activitiesClient.list({ moduleId });

      expect(list.find((activity) => activity.title === "Aula 1")?.url).toBe(
        "https://example.com/aula-1"
      );
    });

    /**
     * RED phase (Issue #13, Spec Driven TDD): list does not return a
     * "filePath" field yet -- expected to fail until Serralheria wires it
     * through src/ipc/activities/handlers.ts (criterio de aceite 5).
     */
    it("includes the filePath of activities that have one", async () => {
      await activitiesClient.create({
        filePath: "C:\\Users\\aluno\\Documents\\apostila.pdf",
        moduleId,
        title: "Apostila",
        type: "pdf",
      });

      const list = await activitiesClient.list({ moduleId });

      expect(
        list.find((activity) => activity.title === "Apostila")?.filePath
      ).toBe("C:\\Users\\aluno\\Documents\\apostila.pdf");
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

    /**
     * RED phase (Issue #12, Spec Driven TDD): create/update/list do not
     * accept or return a "url" field yet -- these are expected to fail
     * until Bancada adds the column (schema.test.ts) and wires "url"
     * through src/ipc/activities/schemas.ts and handlers.ts (criterio de
     * aceite 3 and 6).
     */
    it("persists the url when creating a Link activity", async () => {
      const created = await activitiesClient.create({
        moduleId,
        title: "Aula 1",
        type: "link",
        url: "https://example.com/aula-1",
      });

      expect(created.url).toBe("https://example.com/aula-1");
    });

    it("defaults url to null when creating an activity that does not provide one", async () => {
      const created = await activitiesClient.create({
        moduleId,
        title: "Quiz 1",
        type: "quiz",
      });

      expect(created.url).toBeNull();
    });

    /**
     * RED phase (Issue #13, Spec Driven TDD): create does not accept a
     * "filePath" field yet -- expected to fail until Serralheria adds the
     * column (schema.test.ts) and wires "filePath" through
     * src/ipc/activities/schemas.ts and handlers.ts (criterio de aceite 1
     * and 5).
     */
    it("persists the filePath when creating a Pdf activity", async () => {
      const created = await activitiesClient.create({
        filePath: "C:\\Users\\aluno\\Documents\\apostila.pdf",
        moduleId,
        title: "Apostila",
        type: "pdf",
      });

      expect(created.filePath).toBe(
        "C:\\Users\\aluno\\Documents\\apostila.pdf"
      );
    });

    it("defaults filePath to null when creating an activity that does not provide one", async () => {
      const created = await activitiesClient.create({
        moduleId,
        title: "Quiz 1",
        type: "quiz",
      });

      expect(created.filePath).toBeNull();
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

    /**
     * RED phase (Issue #12, Spec Driven TDD): see comment in the "create"
     * describe block above -- update does not accept/return "url" yet.
     */
    it("updates the url of an existing Link activity", async () => {
      const created = await activitiesClient.create({
        moduleId,
        title: "Aula 1",
        type: "link",
        url: "https://old.example.com",
      });

      const updated = await activitiesClient.update({
        id: created.id,
        title: "Aula 1",
        type: "link",
        url: "https://new.example.com",
      });

      expect(updated.url).toBe("https://new.example.com");

      const list = await activitiesClient.list({ moduleId });
      const persisted = list.find((activity) => activity.id === created.id);
      expect(persisted?.url).toBe("https://new.example.com");
    });

    /**
     * RED phase (Issue #13, Spec Driven TDD): update does not accept/return
     * "filePath" yet -- see comments in the "create" describe block above.
     */
    it("updates the filePath of an existing Pdf activity", async () => {
      const created = await activitiesClient.create({
        filePath: "C:\\Users\\aluno\\Documents\\antigo.pdf",
        moduleId,
        title: "Apostila",
        type: "pdf",
      });

      const updated = await activitiesClient.update({
        filePath: "C:\\Users\\aluno\\Documents\\novo.pdf",
        id: created.id,
        title: "Apostila",
        type: "pdf",
      });

      expect(updated.filePath).toBe("C:\\Users\\aluno\\Documents\\novo.pdf");

      const list = await activitiesClient.list({ moduleId });
      const persisted = list.find((activity) => activity.id === created.id);
      expect(persisted?.filePath).toBe("C:\\Users\\aluno\\Documents\\novo.pdf");
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

  /**
   * RED phase (Issue #22, Spec Driven TDD): activities.softDelete does not
   * cascade to a flashcard_deck's flashcards yet -- see
   * docs/specs/issue-22-cascata-soft-delete.md (AC-1), last level of the
   * programs -> modules -> activities -> flashcards chain. link/pdf/quiz
   * activities have no flashcards to cascade to, so this only applies to
   * flashcard_deck.
   */
  describe("cascading soft-delete to flashcards (Issue #22)", () => {
    let flashcardsClient: ReturnType<
      typeof createRouterClient<typeof flashcardsNamespace>
    >;

    beforeEach(() => {
      flashcardsClient = createRouterClient(flashcardsNamespace);
    });

    it("cascades deletedAt down to every non-deleted flashcard when a flashcard_deck activity is soft-deleted", async () => {
      const deck = await activitiesClient.create({
        moduleId,
        title: "Baralho",
        type: "flashcard_deck",
      });
      const flashcard = await flashcardsClient.create({
        activityId: deck.id,
        back: "Verso",
        front: "Frente",
      });

      await activitiesClient.softDelete({ id: deck.id });

      const flashcardRow = db
        .select()
        .from(flashcardsTable)
        .where(eq(flashcardsTable.id, flashcard.id))
        .get();

      expect(flashcardRow?.deletedAt).not.toBeNull();
    });

    it("uses the same timestamp for the activity and every cascaded flashcard", async () => {
      const deck = await activitiesClient.create({
        moduleId,
        title: "Baralho",
        type: "flashcard_deck",
      });
      const flashcard = await flashcardsClient.create({
        activityId: deck.id,
        back: "Verso",
        front: "Frente",
      });

      await activitiesClient.softDelete({ id: deck.id });

      const activityRow = db
        .select()
        .from(activitiesTable)
        .where(eq(activitiesTable.id, deck.id))
        .get();
      const flashcardRow = db
        .select()
        .from(flashcardsTable)
        .where(eq(flashcardsTable.id, flashcard.id))
        .get();

      expect(flashcardRow?.deletedAt?.getTime()).toBe(
        activityRow?.deletedAt?.getTime()
      );
    });

    it("does not overwrite the deletedAt of a flashcard that was already independently soft-deleted before", async () => {
      const deck = await activitiesClient.create({
        moduleId,
        title: "Baralho",
        type: "flashcard_deck",
      });
      const flashcard = await flashcardsClient.create({
        activityId: deck.id,
        back: "Verso",
        front: "Frente",
      });
      const previouslyDeletedAt = new Date("2020-01-01T00:00:00Z");
      db.update(flashcardsTable)
        .set({ deletedAt: previouslyDeletedAt })
        .where(eq(flashcardsTable.id, flashcard.id))
        .run();

      await activitiesClient.softDelete({ id: deck.id });

      const flashcardRow = db
        .select()
        .from(flashcardsTable)
        .where(eq(flashcardsTable.id, flashcard.id))
        .get();

      expect(flashcardRow?.deletedAt?.getTime()).toBe(
        previouslyDeletedAt.getTime()
      );
    });
  });
});
