import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import {
  flashcards as flashcardsTable,
  reviewItems as reviewItemsTable,
} from "@/database/schema";
import { activities as activitiesNamespace } from "@/ipc/activities";
import { setDatabaseClient } from "@/ipc/database/state";
import { flashcards as flashcardsNamespace } from "@/ipc/flashcards";
import { modules as modulesNamespace } from "@/ipc/modules";
import { programs as programsNamespace } from "@/ipc/programs";
import { review as reviewNamespace } from "@/ipc/review";

/**
 * RED phase (Issue #15, Spec Driven TDD): src/ipc/flashcards does not exist
 * yet. Every test below is expected to fail until the Developer implements
 * the "flashcards" oRPC namespace, mirroring src/ipc/activities exactly
 * (docs/specs/issue-15-flashcard-baralho.md, AC-1). Unlike quiz_questions/
 * quiz_options, a Flashcard is a flat entity -- no sub-entity, no
 * composition layer.
 *
 * Contract exercised here:
 * - list({ activityId }) is scoped to a single Activity (the "Baralho"),
 *   ordered by createdAt.
 * - create/update reject an empty front or back (Zod .min(1)).
 * - softDelete sets deletedAt on the row instead of removing it, and
 *   excludes the flashcard from a subsequent list call.
 *
 * The flashcards and review_items tables already exist (drizzle/0001) --
 * no migration is exercised or expected here. review_items is never
 * referenced by any test below: creating/reading it is explicitly out of
 * scope for this issue (Issue #16, the FSRS engine).
 */

const FLASHCARDS_ROUTER_REGISTRATION_PATTERN = /\bflashcards\b/;

describe("flashcards IPC namespace (Issue #15)", () => {
  let tmpDir: string;
  let dbPath: string;
  let db: DatabaseClient;
  let flashcardsClient: ReturnType<
    typeof createRouterClient<typeof flashcardsNamespace>
  >;
  let activitiesClient: ReturnType<
    typeof createRouterClient<typeof activitiesNamespace>
  >;
  let modulesClient: ReturnType<
    typeof createRouterClient<typeof modulesNamespace>
  >;
  let programsClient: ReturnType<
    typeof createRouterClient<typeof programsNamespace>
  >;
  let activityId: string;
  let otherActivityId: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "personare-flashcards-ipc-")
    );
    dbPath = path.join(tmpDir, "test.sqlite");
    db = createDatabaseClient(dbPath);
    runMigrations(db);
    setDatabaseClient(db);
    flashcardsClient = createRouterClient(flashcardsNamespace);
    activitiesClient = createRouterClient(activitiesNamespace);
    modulesClient = createRouterClient(modulesNamespace);
    programsClient = createRouterClient(programsNamespace);

    const program = await programsClient.create({ name: "Bacharelado II" });
    const createdModule = await modulesClient.create({
      name: "Modulo 1",
      programId: program.id,
    });
    const activity = await activitiesClient.create({
      moduleId: createdModule.id,
      title: "Baralho de Revisao",
      type: "flashcard_deck",
    });
    activityId = activity.id;
    const otherActivity = await activitiesClient.create({
      moduleId: createdModule.id,
      title: "Outro Baralho",
      type: "flashcard_deck",
    });
    otherActivityId = otherActivity.id;
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

    expect(routerSource).toMatch(FLASHCARDS_ROUTER_REGISTRATION_PATTERN);
  });

  it("exposes list, create, update and softDelete procedures", () => {
    expect(flashcardsNamespace.list).toBeDefined();
    expect(flashcardsNamespace.create).toBeDefined();
    expect(flashcardsNamespace.update).toBeDefined();
    expect(flashcardsNamespace.softDelete).toBeDefined();
  });

  describe("list", () => {
    it("returns an empty array when the activity has no flashcards", async () => {
      await expect(flashcardsClient.list({ activityId })).resolves.toEqual([]);
    });

    it("returns flashcards created through create", async () => {
      const created = await flashcardsClient.create({
        activityId,
        back: "Uma capital brasileira",
        front: "Brasilia",
      });

      const list = await flashcardsClient.list({ activityId });

      expect(list.map((flashcard) => flashcard.id)).toContain(created.id);
      expect(list.map((flashcard) => flashcard.front)).toContain("Brasilia");
    });

    it("orders flashcards by creation order", async () => {
      const first = await flashcardsClient.create({
        activityId,
        back: "Verso 1",
        front: "Frente 1",
      });
      const second = await flashcardsClient.create({
        activityId,
        back: "Verso 2",
        front: "Frente 2",
      });

      const list = await flashcardsClient.list({ activityId });

      expect(list.map((flashcard) => flashcard.id)).toEqual([
        first.id,
        second.id,
      ]);
    });

    it("only returns flashcards belonging to the given activity", async () => {
      const inActivity = await flashcardsClient.create({
        activityId,
        back: "Verso",
        front: "Deste baralho",
      });
      await flashcardsClient.create({
        activityId: otherActivityId,
        back: "Verso",
        front: "De outro baralho",
      });

      const list = await flashcardsClient.list({ activityId });

      expect(list.map((flashcard) => flashcard.id)).toEqual([inActivity.id]);
    });

    it("excludes soft-deleted flashcards", async () => {
      const active = await flashcardsClient.create({
        activityId,
        back: "Verso ativo",
        front: "Ativo",
      });
      const deleted = await flashcardsClient.create({
        activityId,
        back: "Verso removido",
        front: "Removido",
      });
      await flashcardsClient.softDelete({ id: deleted.id });

      const list = await flashcardsClient.list({ activityId });

      expect(list.map((flashcard) => flashcard.id)).toContain(active.id);
      expect(list.map((flashcard) => flashcard.id)).not.toContain(deleted.id);
    });
  });

  describe("create", () => {
    it("inserts a new flashcard associated with the given activity and returns it", async () => {
      const created = await flashcardsClient.create({
        activityId,
        back: "Uma capital brasileira",
        front: "Brasilia",
      });

      expect(typeof created.id).toBe("string");
      expect(created.front).toBe("Brasilia");
      expect(created.back).toBe("Uma capital brasileira");
      expect(created.activityId).toBe(activityId);
    });

    it("rejects an empty front", async () => {
      await expect(
        flashcardsClient.create({
          activityId,
          back: "Verso valido",
          front: "",
        })
      ).rejects.toThrow();
    });

    it("rejects an empty back", async () => {
      await expect(
        flashcardsClient.create({
          activityId,
          back: "",
          front: "Frente valida",
        })
      ).rejects.toThrow();
    });
  });

  describe("update", () => {
    it("updates the front and back of an existing flashcard", async () => {
      const created = await flashcardsClient.create({
        activityId,
        back: "Verso antigo",
        front: "Frente antiga",
      });

      const updated = await flashcardsClient.update({
        back: "Verso novo",
        front: "Frente nova",
        id: created.id,
      });

      expect(updated.id).toBe(created.id);
      expect(updated.front).toBe("Frente nova");
      expect(updated.back).toBe("Verso novo");

      const list = await flashcardsClient.list({ activityId });
      const persisted = list.find((flashcard) => flashcard.id === created.id);
      expect(persisted?.front).toBe("Frente nova");
      expect(persisted?.back).toBe("Verso novo");
    });

    it("rejects an empty front", async () => {
      const created = await flashcardsClient.create({
        activityId,
        back: "Verso valido",
        front: "Frente valida",
      });

      await expect(
        flashcardsClient.update({
          back: "Verso valido",
          front: "",
          id: created.id,
        })
      ).rejects.toThrow();
    });

    it("rejects an empty back", async () => {
      const created = await flashcardsClient.create({
        activityId,
        back: "Verso valido",
        front: "Frente valida",
      });

      await expect(
        flashcardsClient.update({
          back: "",
          front: "Frente valida",
          id: created.id,
        })
      ).rejects.toThrow();
    });
  });

  describe("softDelete", () => {
    it("sets deletedAt on the row instead of removing it from the database", async () => {
      const created = await flashcardsClient.create({
        activityId,
        back: "Sera removido",
        front: "Sera removido",
      });

      await flashcardsClient.softDelete({ id: created.id });

      const rawRow = db
        .select()
        .from(flashcardsTable)
        .where(eq(flashcardsTable.id, created.id))
        .get();

      expect(rawRow).toBeDefined();
      expect(rawRow?.deletedAt).not.toBeNull();
    });

    it("excludes the soft-deleted flashcard from a subsequent list call", async () => {
      const created = await flashcardsClient.create({
        activityId,
        back: "Sera removido",
        front: "Sera removido",
      });

      await flashcardsClient.softDelete({ id: created.id });

      const list = await flashcardsClient.list({ activityId });

      expect(list.map((flashcard) => flashcard.id)).not.toContain(created.id);
    });
  });

  /**
   * RED phase (Issue #22, Spec Driven TDD): AC-3 documents behavior that
   * already works today (docs/specs/issue-22-cascata-soft-delete.md) --
   * flashcards.update never touches review_items, and softDelete never
   * removes a review_item row (review_items has no deletedAt column by
   * design, Issue #16). These tests are expected to PASS immediately,
   * locking in the existing correct behavior rather than driving new
   * production code.
   */
  describe("editing/deleting a flashcard that already has a ReviewItem (Issue #22)", () => {
    let reviewClient: ReturnType<
      typeof createRouterClient<typeof reviewNamespace>
    >;

    beforeEach(() => {
      reviewClient = createRouterClient(reviewNamespace);
    });

    it("does not alter the ReviewItem's FSRS fields or ratingHistory when the flashcard's content is edited", async () => {
      const flashcard = await flashcardsClient.create({
        activityId,
        back: "Verso antigo",
        front: "Frente antiga",
      });
      await reviewClient.ensureReviewItems({ activityId });
      const [due] = await reviewClient.listDue({ activityId });
      await reviewClient.submitRating({ rating: "good", reviewItemId: due.id });

      const before = db
        .select()
        .from(reviewItemsTable)
        .where(eq(reviewItemsTable.flashcardId, flashcard.id))
        .get();

      await flashcardsClient.update({
        back: "Verso novo",
        front: "Frente nova",
        id: flashcard.id,
      });

      const after = db
        .select()
        .from(reviewItemsTable)
        .where(eq(reviewItemsTable.flashcardId, flashcard.id))
        .get();

      expect(after?.stability).toBe(before?.stability);
      expect(after?.difficulty).toBe(before?.difficulty);
      expect(after?.dueDate.getTime()).toBe(before?.dueDate.getTime());
      expect(after?.ratingHistory).toBe(before?.ratingHistory);
      expect(after?.state).toBe(before?.state);
      expect(after?.reps).toBe(before?.reps);
    });

    it("shows the edited front/back through listDue and listSchedule, not the original content", async () => {
      const flashcard = await flashcardsClient.create({
        activityId,
        back: "Verso antigo",
        front: "Frente antiga",
      });
      await reviewClient.ensureReviewItems({ activityId });

      await flashcardsClient.update({
        back: "Verso novo",
        front: "Frente nova",
        id: flashcard.id,
      });

      const due = await reviewClient.listDue({ activityId });
      const schedule = await reviewClient.listSchedule();

      expect(due[0].front).toBe("Frente nova");
      expect(due[0].back).toBe("Verso novo");
      expect(schedule[0].front).toBe("Frente nova");
    });

    it("does not delete or otherwise modify the ReviewItem row when its flashcard is soft-deleted", async () => {
      const flashcard = await flashcardsClient.create({
        activityId,
        back: "Verso",
        front: "Frente",
      });
      await reviewClient.ensureReviewItems({ activityId });
      const before = db
        .select()
        .from(reviewItemsTable)
        .where(eq(reviewItemsTable.flashcardId, flashcard.id))
        .get();

      await flashcardsClient.softDelete({ id: flashcard.id });

      const after = db
        .select()
        .from(reviewItemsTable)
        .where(eq(reviewItemsTable.flashcardId, flashcard.id))
        .get();

      expect(after).toBeDefined();
      expect(after).toEqual(before);
    });
  });
});
