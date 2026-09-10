import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import {
  activities,
  appSettings,
  flashcards,
  modules,
  programs,
  reviewItems,
} from "@/database/schema";

/**
 * RED phase (Issue #21, Spec Driven TDD): src/utils/backup-data.ts does not
 * exist yet. Every test below is expected to fail until the Developer
 * implements collectBackupData/restoreBackupData per
 * docs/specs/issue-21-backup-local.md AC-3.
 */

function seedFullHierarchy(db: DatabaseClient) {
  const now = new Date();
  const program = {
    createdAt: now,
    id: randomUUID(),
    name: "Pos I",
    updatedAt: now,
  };
  db.insert(programs).values(program).run();

  const module_ = {
    createdAt: now,
    id: randomUUID(),
    name: "Modulo 1",
    programId: program.id,
    updatedAt: now,
  };
  db.insert(modules).values(module_).run();

  const activity = {
    createdAt: now,
    id: randomUUID(),
    moduleId: module_.id,
    title: "Baralho de Anatomia",
    type: "flashcard_deck",
    updatedAt: now,
  };
  db.insert(activities).values(activity).run();

  const deletedActivity = {
    createdAt: now,
    deletedAt: now,
    id: randomUUID(),
    moduleId: module_.id,
    title: "Atividade removida",
    type: "link",
    updatedAt: now,
  };
  db.insert(activities).values(deletedActivity).run();

  const flashcard = {
    activityId: activity.id,
    back: "Free Spaced Repetition Scheduler",
    createdAt: now,
    front: "O que e FSRS?",
    id: randomUUID(),
    updatedAt: now,
  };
  db.insert(flashcards).values(flashcard).run();

  const reviewItem = {
    createdAt: now,
    difficulty: 5,
    dueDate: now,
    flashcardId: flashcard.id,
    id: randomUUID(),
    lastRating: "good",
    ratingHistory: "[]",
    stability: 2.5,
    updatedAt: now,
  };
  db.insert(reviewItems).values(reviewItem).run();

  db.insert(appSettings).values({ autoStartEnabled: true, id: 1 }).run();

  return { activity, deletedActivity, flashcard, module_, program, reviewItem };
}

describe("backup-data (Issue #21)", () => {
  let tmpDir: string;
  let dbPath: string;
  let db: DatabaseClient;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-backup-data-"));
    dbPath = path.join(tmpDir, "test.sqlite");
    db = createDatabaseClient(dbPath);
    runMigrations(db);
  });

  afterEach(() => {
    db.$client.close();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  describe("collectBackupData", () => {
    it("reads every business table, including soft-deleted rows", async () => {
      const { collectBackupData } = await import("@/utils/backup-data");
      const seed = seedFullHierarchy(db);

      const data = collectBackupData(db);

      expect(data.programs.map((p) => p.id)).toContain(seed.program.id);
      expect(data.modules.map((m) => m.id)).toContain(seed.module_.id);
      expect(data.activities.map((a) => a.id)).toEqual(
        expect.arrayContaining([seed.activity.id, seed.deletedActivity.id])
      );
      expect(data.flashcards.map((f) => f.id)).toContain(seed.flashcard.id);
      expect(data.reviewItems.map((r) => r.id)).toContain(seed.reviewItem.id);
      expect(data.appSettings).toHaveLength(1);
    });
  });

  describe("restoreBackupData", () => {
    it("replaces all current data with the backup's data (programs)", async () => {
      const { collectBackupData, restoreBackupData } = await import(
        "@/utils/backup-data"
      );
      seedFullHierarchy(db);
      const backup = collectBackupData(db);

      const staleNow = new Date();
      db.insert(programs)
        .values({
          createdAt: staleNow,
          id: randomUUID(),
          name: "Programa que nao deveria sobreviver",
          updatedAt: staleNow,
        })
        .run();

      restoreBackupData(db, backup);

      const restoredPrograms = db.select().from(programs).all();
      expect(restoredPrograms.map((p) => p.name)).toEqual(["Pos I"]);
    });

    it("restores the exact full hierarchy end-to-end after a round-trip through collectBackupData", async () => {
      const { collectBackupData, restoreBackupData } = await import(
        "@/utils/backup-data"
      );
      const seed = seedFullHierarchy(db);
      const backup = collectBackupData(db);

      restoreBackupData(db, backup);

      const restoredReviewItem = db
        .select()
        .from(reviewItems)
        .where(eq(reviewItems.id, seed.reviewItem.id))
        .get();
      const restoredFlashcard = db
        .select()
        .from(flashcards)
        .where(eq(flashcards.id, seed.flashcard.id))
        .get();
      const restoredDeletedActivity = db
        .select()
        .from(activities)
        .where(eq(activities.id, seed.deletedActivity.id))
        .get();

      expect(restoredReviewItem?.flashcardId).toBe(seed.flashcard.id);
      expect(restoredFlashcard?.activityId).toBe(seed.activity.id);
      expect(restoredDeletedActivity?.deletedAt).not.toBeNull();
    });

    it("is atomic -- restoring twice in a row never leaves duplicate or orphaned rows", async () => {
      const { collectBackupData, restoreBackupData } = await import(
        "@/utils/backup-data"
      );
      seedFullHierarchy(db);
      const backup = collectBackupData(db);

      restoreBackupData(db, backup);
      restoreBackupData(db, backup);

      expect(db.select().from(programs).all()).toHaveLength(1);
      expect(db.select().from(reviewItems).all()).toHaveLength(1);
    });

    it("restores an empty backup as a fully empty database", async () => {
      const { restoreBackupData } = await import("@/utils/backup-data");
      seedFullHierarchy(db);
      const emptyBackup = {
        activities: [],
        appSettings: [],
        exportedAt: new Date(),
        flashcards: [],
        modules: [],
        programs: [],
        quizOptions: [],
        quizQuestions: [],
        reviewItems: [],
        version: 1 as const,
      };

      restoreBackupData(db, emptyBackup);

      expect(db.select().from(programs).all()).toHaveLength(0);
      expect(db.select().from(reviewItems).all()).toHaveLength(0);
      expect(db.select().from(appSettings).all()).toHaveLength(0);
    });
  });
});
