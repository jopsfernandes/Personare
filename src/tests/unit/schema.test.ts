import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq, isNull } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDatabaseClient, type DatabaseClient } from "@/database/client";
import { runMigrations } from "@/database/migrate";
import {
  activities,
  flashcards,
  modules,
  programs,
  reviewItems,
} from "@/database/schema";

/**
 * RED phase (Issue #4, Spec Driven TDD): these tables do not exist yet in
 * src/database/schema.ts (only the Issue #2 `health_check` placeholder does),
 * and no migration reflecting them has been generated yet. Every test below
 * is expected to fail until Alicerce (Developer) implements the schema and
 * generates the corresponding drizzle-kit migration.
 */

function insertProgram(
  db: DatabaseClient,
  overrides: Partial<{
    id: string;
    name: string;
    deletedAt: Date | null;
  }> = {}
) {
  const now = new Date();
  const row = {
    createdAt: now,
    deletedAt: overrides.deletedAt ?? null,
    id: overrides.id ?? randomUUID(),
    name: overrides.name ?? "Bacharelado II",
    updatedAt: now,
  };
  db.insert(programs).values(row).run();
  return row;
}

function insertModule(
  db: DatabaseClient,
  programId: string,
  overrides: Partial<{ id: string; name: string; deletedAt: Date | null }> = {}
) {
  const now = new Date();
  const row = {
    createdAt: now,
    deletedAt: overrides.deletedAt ?? null,
    id: overrides.id ?? randomUUID(),
    name: overrides.name ?? "Modulo 1",
    programId,
    updatedAt: now,
  };
  db.insert(modules).values(row).run();
  return row;
}

function insertActivity(
  db: DatabaseClient,
  moduleId: string,
  overrides: Partial<{
    id: string;
    type: string;
    title: string;
    url: string | null;
    filePath: string | null;
    deletedAt: Date | null;
  }> = {}
) {
  const now = new Date();
  const row = {
    createdAt: now,
    deletedAt: overrides.deletedAt ?? null,
    filePath: overrides.filePath ?? null,
    id: overrides.id ?? randomUUID(),
    moduleId,
    title: overrides.title ?? "Baralho de Anatomia",
    type: overrides.type ?? "flashcard_deck",
    updatedAt: now,
    url: overrides.url ?? null,
  };
  db.insert(activities).values(row).run();
  return row;
}

function insertFlashcard(
  db: DatabaseClient,
  activityId: string,
  overrides: Partial<{
    id: string;
    front: string;
    back: string;
    deletedAt: Date | null;
  }> = {}
) {
  const now = new Date();
  const row = {
    activityId,
    back: overrides.back ?? "Free Spaced Repetition Scheduler",
    createdAt: now,
    deletedAt: overrides.deletedAt ?? null,
    front: overrides.front ?? "O que e FSRS?",
    id: overrides.id ?? randomUUID(),
    updatedAt: now,
  };
  db.insert(flashcards).values(row).run();
  return row;
}

function insertReviewItem(
  db: DatabaseClient,
  flashcardId: string,
  overrides: Partial<{
    id: string;
    stability: number;
    difficulty: number;
    dueDate: Date;
    lastRating: string;
    ratingHistory: string;
  }> = {}
) {
  const now = new Date();
  const row = {
    createdAt: now,
    difficulty: overrides.difficulty ?? 5,
    dueDate: overrides.dueDate ?? now,
    flashcardId,
    id: overrides.id ?? randomUUID(),
    lastRating: overrides.lastRating ?? "good",
    ratingHistory: overrides.ratingHistory ?? JSON.stringify(["good"]),
    stability: overrides.stability ?? 2.5,
    updatedAt: now,
  };
  db.insert(reviewItems).values(row).run();
  return row;
}

describe("database schema (Issue #4)", () => {
  let tmpDir: string;
  let dbPath: string;
  let db: DatabaseClient;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-db-schema-"));
    dbPath = path.join(tmpDir, "test.sqlite");
    db = createDatabaseClient(dbPath);
    runMigrations(db);
  });

  afterEach(() => {
    db.$client.close();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  describe("migration", () => {
    it("creates all business tables without throwing", () => {
      const tableNames = db.$client
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name);

      expect(tableNames).toEqual(
        expect.arrayContaining([
          "programs",
          "modules",
          "activities",
          "flashcards",
          "review_items",
        ])
      );
    });
  });

  describe("programs (Programa)", () => {
    it("inserts and reads back a program with a UUID primary key", () => {
      const row = insertProgram(db, { id: randomUUID(), name: "Pos I" });

      const found = db
        .select()
        .from(programs)
        .where(eq(programs.id, row.id))
        .get();

      expect(found?.id).toBe(row.id);
      expect(found?.name).toBe("Pos I");
      expect(typeof found?.id).toBe("string");
    });

    it("does not use an autoincrementing integer primary key", () => {
      const createSql = (
        db.$client
          .prepare(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'programs'"
          )
          .get() as { sql: string } | undefined
      )?.sql;

      expect(createSql).toBeDefined();
      expect(createSql?.toUpperCase()).not.toContain("AUTOINCREMENT");
    });

    it("has created_at and updated_at timestamps", () => {
      const row = insertProgram(db);

      const found = db
        .select()
        .from(programs)
        .where(eq(programs.id, row.id))
        .get();

      expect(found?.createdAt).toBeInstanceOf(Date);
      expect(found?.updatedAt).toBeInstanceOf(Date);
    });

    it("supports soft-delete: a deleted program is excluded from an active-only query but still exists in the table", () => {
      const active = insertProgram(db, { name: "Ativo" });
      const deleted = insertProgram(db, {
        deletedAt: new Date(),
        name: "Removido",
      });

      const activeOnly = db
        .select()
        .from(programs)
        .where(isNull(programs.deletedAt))
        .all();

      expect(activeOnly.map((p) => p.id)).toContain(active.id);
      expect(activeOnly.map((p) => p.id)).not.toContain(deleted.id);

      const rawRow = db
        .select()
        .from(programs)
        .where(eq(programs.id, deleted.id))
        .get();

      expect(rawRow).toBeDefined();
      expect(rawRow?.deletedAt).not.toBeNull();
    });
  });

  describe("modules (Modulo)", () => {
    it("references the program it belongs to", () => {
      const program = insertProgram(db);
      const module_ = insertModule(db, program.id);

      const found = db
        .select()
        .from(modules)
        .where(eq(modules.id, module_.id))
        .get();

      expect(found?.programId).toBe(program.id);
    });

    it("supports soft-delete via a nullable deleted_at column", () => {
      const program = insertProgram(db);
      const deleted = insertModule(db, program.id, { deletedAt: new Date() });

      const activeOnly = db
        .select()
        .from(modules)
        .where(isNull(modules.deletedAt))
        .all();

      expect(activeOnly.map((m) => m.id)).not.toContain(deleted.id);
    });
  });

  describe("activities (Atividade)", () => {
    it("references the module it belongs to", () => {
      const program = insertProgram(db);
      const module_ = insertModule(db, program.id);
      const activity = insertActivity(db, module_.id, { type: "quiz" });

      const found = db
        .select()
        .from(activities)
        .where(eq(activities.id, activity.id))
        .get();

      expect(found?.moduleId).toBe(module_.id);
      expect(found?.type).toBe("quiz");
    });

    it.each(["link", "quiz", "pdf", "flashcard_deck"])(
      "accepts the MVP activity type %s",
      (type) => {
        const program = insertProgram(db);
        const module_ = insertModule(db, program.id);

        expect(() => insertActivity(db, module_.id, { type })).not.toThrow();
      }
    );

    it("does not restrict the type column to a closed database enum (open discriminator, validated at the application layer)", () => {
      const program = insertProgram(db);
      const module_ = insertModule(db, program.id);

      // A type outside today's MVP set must still be insertable at the
      // database layer -- per Plan.md 1.1, new Activity types must not
      // require a destructive migration. Any enum-style validation belongs
      // to the application layer (e.g. Zod), not a SQLite CHECK constraint.
      expect(() =>
        insertActivity(db, module_.id, { type: "future_activity_type" })
      ).not.toThrow();
    });

    it("supports soft-delete via a nullable deleted_at column", () => {
      const program = insertProgram(db);
      const module_ = insertModule(db, program.id);
      const deleted = insertActivity(db, module_.id, {
        deletedAt: new Date(),
      });

      const activeOnly = db
        .select()
        .from(activities)
        .where(isNull(activities.deletedAt))
        .all();

      expect(activeOnly.map((a) => a.id)).not.toContain(deleted.id);
    });

    /**
     * RED phase (Issue #12, Spec Driven TDD): the "url" column does not
     * exist yet on the "activities" table -- these tests are expected to
     * fail until Bancada (Developer) adds a nullable text("url") column to
     * src/database/schema.ts and generates the corresponding drizzle-kit
     * migration (criterio de aceite 1). Only Link activities populate it;
     * every other activity type must keep it null without throwing.
     */
    it("has a nullable url column, used only by Link activities", () => {
      const columnNames = (
        db.$client.prepare("PRAGMA table_info(activities)").all() as {
          name: string;
          notnull: number;
        }[]
      ).map((c) => ({ name: c.name, notnull: c.notnull }));

      const urlColumn = columnNames.find((c) => c.name === "url");

      expect(urlColumn).toBeDefined();
      expect(urlColumn?.notnull).toBe(0);
    });

    it("persists and reads back the url of a Link activity", () => {
      const program = insertProgram(db);
      const module_ = insertModule(db, program.id);
      const link = insertActivity(db, module_.id, {
        type: "link",
        url: "https://example.com/aula-1",
      });

      const found = db
        .select()
        .from(activities)
        .where(eq(activities.id, link.id))
        .get();

      expect(found?.url).toBe("https://example.com/aula-1");
    });

    it("leaves url as null for activity types that do not use it", () => {
      const program = insertProgram(db);
      const module_ = insertModule(db, program.id);
      const quiz = insertActivity(db, module_.id, { type: "quiz" });

      const found = db
        .select()
        .from(activities)
        .where(eq(activities.id, quiz.id))
        .get();

      expect(found?.url).toBeNull();
    });

    /**
     * RED phase (Issue #13, Spec Driven TDD): the "file_path" column does
     * not exist yet on the "activities" table -- these tests are expected
     * to fail until Serralheria (Developer) adds a nullable
     * text("file_path") column to src/database/schema.ts and generates the
     * corresponding drizzle-kit migration (criterio de aceite 1). Only Pdf
     * activities populate it; every other activity type must keep it null
     * without throwing. Follows the exact pattern of the "url" column added
     * by Issue #12 above.
     */
    it("has a nullable filePath column, used only by Pdf activities", () => {
      const columnNames = (
        db.$client.prepare("PRAGMA table_info(activities)").all() as {
          name: string;
          notnull: number;
        }[]
      ).map((c) => ({ name: c.name, notnull: c.notnull }));

      const filePathColumn = columnNames.find((c) => c.name === "file_path");

      expect(filePathColumn).toBeDefined();
      expect(filePathColumn?.notnull).toBe(0);
    });

    it("persists and reads back the filePath of a Pdf activity", () => {
      const program = insertProgram(db);
      const module_ = insertModule(db, program.id);
      const pdf = insertActivity(db, module_.id, {
        filePath: "C:\\Users\\aluno\\Documents\\apostila.pdf",
        type: "pdf",
      });

      const found = db
        .select()
        .from(activities)
        .where(eq(activities.id, pdf.id))
        .get();

      expect(found?.filePath).toBe("C:\\Users\\aluno\\Documents\\apostila.pdf");
    });

    it("leaves filePath as null for activity types that do not use it", () => {
      const program = insertProgram(db);
      const module_ = insertModule(db, program.id);
      const quiz = insertActivity(db, module_.id, { type: "quiz" });

      const found = db
        .select()
        .from(activities)
        .where(eq(activities.id, quiz.id))
        .get();

      expect(found?.filePath).toBeNull();
    });
  });

  describe("flashcards (Flashcard)", () => {
    it("references the flashcard_deck activity it belongs to", () => {
      const program = insertProgram(db);
      const module_ = insertModule(db, program.id);
      const deck = insertActivity(db, module_.id, { type: "flashcard_deck" });
      const flashcard = insertFlashcard(db, deck.id);

      const found = db
        .select()
        .from(flashcards)
        .where(eq(flashcards.id, flashcard.id))
        .get();

      expect(found?.activityId).toBe(deck.id);
    });

    it("supports soft-delete via a nullable deleted_at column", () => {
      const program = insertProgram(db);
      const module_ = insertModule(db, program.id);
      const deck = insertActivity(db, module_.id, { type: "flashcard_deck" });
      const deleted = insertFlashcard(db, deck.id, { deletedAt: new Date() });

      const activeOnly = db
        .select()
        .from(flashcards)
        .where(isNull(flashcards.deletedAt))
        .all();

      expect(activeOnly.map((f) => f.id)).not.toContain(deleted.id);
    });
  });

  describe("review_items (ReviewItem) -- decoupled from the content hierarchy", () => {
    it("is its own first-class table, not a column appended to activities", () => {
      const columnNames = (
        db.$client.prepare("PRAGMA table_info(activities)").all() as {
          name: string;
        }[]
      ).map((c) => c.name);

      expect(columnNames).not.toContain("stability");
      expect(columnNames).not.toContain("difficulty");
      expect(columnNames).not.toContain("due_date");
    });

    it("references the flashcard that schedules it, and stores FSRS state", () => {
      const program = insertProgram(db);
      const module_ = insertModule(db, program.id);
      const deck = insertActivity(db, module_.id, { type: "flashcard_deck" });
      const flashcard = insertFlashcard(db, deck.id);
      const reviewItem = insertReviewItem(db, flashcard.id, {
        difficulty: 4.5,
        lastRating: "again",
        stability: 12.34,
      });

      const found = db
        .select()
        .from(reviewItems)
        .where(eq(reviewItems.id, reviewItem.id))
        .get();

      expect(found?.flashcardId).toBe(flashcard.id);
      expect(found?.stability).toBeCloseTo(12.34);
      expect(found?.difficulty).toBeCloseTo(4.5);
      expect(found?.dueDate).toBeInstanceOf(Date);
      expect(found?.lastRating).toBe("again");
    });

    it("does not require a Module or Program to exist directly on the row (decoupled from the content hierarchy)", () => {
      const columnNames = (
        db.$client.prepare("PRAGMA table_info(review_items)").all() as {
          name: string;
        }[]
      ).map((c) => c.name);

      expect(columnNames).not.toContain("module_id");
      expect(columnNames).not.toContain("program_id");
      expect(columnNames).not.toContain("activity_id");
    });

    it("preserves its review history even after the underlying flashcard content changes", () => {
      const program = insertProgram(db);
      const module_ = insertModule(db, program.id);
      const deck = insertActivity(db, module_.id, { type: "flashcard_deck" });
      const flashcard = insertFlashcard(db, deck.id, { front: "Original" });
      const reviewItem = insertReviewItem(db, flashcard.id, {
        ratingHistory: JSON.stringify(["again", "good"]),
      });

      db.update(flashcards)
        .set({ front: "Editado", updatedAt: new Date() })
        .where(eq(flashcards.id, flashcard.id))
        .run();

      const found = db
        .select()
        .from(reviewItems)
        .where(eq(reviewItems.id, reviewItem.id))
        .get();

      expect(JSON.parse(found?.ratingHistory ?? "[]")).toEqual([
        "again",
        "good",
      ]);

      const updatedFlashcard = db
        .select()
        .from(flashcards)
        .where(eq(flashcards.id, flashcard.id))
        .get();

      expect(updatedFlashcard?.front).toBe("Editado");
    });
  });

  describe("end-to-end content hierarchy", () => {
    it("links Program -> Module -> Activity -> Flashcard -> ReviewItem", () => {
      const program = insertProgram(db, { name: "Mestrado" });
      const module_ = insertModule(db, program.id, { name: "Modulo X" });
      const deck = insertActivity(db, module_.id, {
        title: "Baralho X",
        type: "flashcard_deck",
      });
      const flashcard = insertFlashcard(db, deck.id);
      const reviewItem = insertReviewItem(db, flashcard.id);

      const joined = db
        .select()
        .from(reviewItems)
        .innerJoin(flashcards, eq(reviewItems.flashcardId, flashcards.id))
        .innerJoin(activities, eq(flashcards.activityId, activities.id))
        .innerJoin(modules, eq(activities.moduleId, modules.id))
        .innerJoin(programs, eq(modules.programId, programs.id))
        .where(eq(reviewItems.id, reviewItem.id))
        .get();

      expect(joined?.programs.id).toBe(program.id);
      expect(joined?.modules.id).toBe(module_.id);
      expect(joined?.activities.id).toBe(deck.id);
      expect(joined?.flashcards.id).toBe(flashcard.id);
      expect(joined?.review_items.id).toBe(reviewItem.id);
    });
  });
});
