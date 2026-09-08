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
  modules,
  programs,
  quizOptions,
  quizQuestions,
} from "@/database/schema";

/**
 * RED phase (Issue #14, Spec Driven TDD): quiz_questions and quiz_options do
 * not exist yet in src/database/schema.ts, and no migration (0004) reflecting
 * them has been generated yet. Every test below is expected to fail until
 * Fundacao (Developer) implements the schema and generates the corresponding
 * drizzle-kit migration (criterio de aceite 1).
 *
 * Unlike Link/PDF (Issues #12/#13, single column added to "activities"),
 * Quiz needs its own relational structure: quiz_questions references
 * activities, and quiz_options references quiz_questions. Both use a UUID
 * text primary key and created_at/updated_at timestamps, following the exact
 * convention already used by programs/modules/activities.
 *
 * quiz_options' soft-delete strategy is intentionally left open by the spec
 * (a deleted_at column, or hard delete-and-recreate when a question is
 * edited, are both acceptable if documented in the PR) -- so this file does
 * not assert the presence of a deleted_at column on quiz_options, only that
 * quiz_questions has one, matching every other entity in the app.
 */

function insertProgram(db: DatabaseClient) {
  const now = new Date();
  const row = {
    createdAt: now,
    deletedAt: null,
    id: randomUUID(),
    name: "Bacharelado II",
    updatedAt: now,
  };
  db.insert(programs).values(row).run();
  return row;
}

function insertModule(db: DatabaseClient, programId: string) {
  const now = new Date();
  const row = {
    createdAt: now,
    deletedAt: null,
    id: randomUUID(),
    name: "Modulo 1",
    programId,
    updatedAt: now,
  };
  db.insert(modules).values(row).run();
  return row;
}

function insertQuizActivity(db: DatabaseClient, moduleId: string) {
  const now = new Date();
  const row = {
    createdAt: now,
    deletedAt: null,
    filePath: null,
    id: randomUUID(),
    moduleId,
    title: "Quiz de Revisao",
    type: "quiz",
    updatedAt: now,
    url: null,
  };
  db.insert(activities).values(row).run();
  return row;
}

function insertQuizQuestion(
  db: DatabaseClient,
  activityId: string,
  overrides: Partial<{ id: string; text: string; deletedAt: Date | null }> = {}
) {
  const now = new Date();
  const row = {
    activityId,
    createdAt: now,
    deletedAt: overrides.deletedAt ?? null,
    id: overrides.id ?? randomUUID(),
    text: overrides.text ?? "Qual e a capital do Brasil?",
    updatedAt: now,
  };
  db.insert(quizQuestions).values(row).run();
  return row;
}

function insertQuizOption(
  db: DatabaseClient,
  questionId: string,
  overrides: Partial<{ id: string; text: string; isCorrect: boolean }> = {}
) {
  const now = new Date();
  const row = {
    createdAt: now,
    id: overrides.id ?? randomUUID(),
    isCorrect: overrides.isCorrect ?? false,
    questionId,
    text: overrides.text ?? "Brasilia",
    updatedAt: now,
  };
  db.insert(quizOptions).values(row).run();
  return row;
}

describe("quiz database schema (Issue #14)", () => {
  let tmpDir: string;
  let dbPath: string;
  let db: DatabaseClient;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-quiz-schema-"));
    dbPath = path.join(tmpDir, "test.sqlite");
    db = createDatabaseClient(dbPath);
    runMigrations(db);
  });

  afterEach(() => {
    // Windows refuses to delete a sqlite file while a connection to it is
    // still open (EPERM), unlike Linux/macOS -- close it first.
    db.$client.close();
    fs.rmSync(tmpDir, { force: true, recursive: true });
  });

  describe("migration", () => {
    it("creates the quiz_questions and quiz_options tables without throwing", () => {
      const tableNames = db.$client
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all()
        .map((row) => (row as { name: string }).name);

      expect(tableNames).toEqual(
        expect.arrayContaining(["quiz_questions", "quiz_options"])
      );
    });
  });

  describe("quiz_questions", () => {
    it("uses a UUID text primary key, not an autoincrementing integer", () => {
      const createSql = (
        db.$client
          .prepare(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'quiz_questions'"
          )
          .get() as { sql: string } | undefined
      )?.sql;

      expect(createSql).toBeDefined();
      expect(createSql?.toUpperCase()).not.toContain("AUTOINCREMENT");
    });

    it("references the activity it belongs to", () => {
      const program = insertProgram(db);
      const module_ = insertModule(db, program.id);
      const activity = insertQuizActivity(db, module_.id);
      const question = insertQuizQuestion(db, activity.id);

      const found = db
        .select()
        .from(quizQuestions)
        .where(eq(quizQuestions.id, question.id))
        .get();

      expect(found?.activityId).toBe(activity.id);
      expect(found?.text).toBe(question.text);
    });

    it("has created_at and updated_at timestamps", () => {
      const program = insertProgram(db);
      const module_ = insertModule(db, program.id);
      const activity = insertQuizActivity(db, module_.id);
      const question = insertQuizQuestion(db, activity.id);

      const found = db
        .select()
        .from(quizQuestions)
        .where(eq(quizQuestions.id, question.id))
        .get();

      expect(found?.createdAt).toBeInstanceOf(Date);
      expect(found?.updatedAt).toBeInstanceOf(Date);
    });

    it("supports soft-delete via a nullable deleted_at column", () => {
      const program = insertProgram(db);
      const module_ = insertModule(db, program.id);
      const activity = insertQuizActivity(db, module_.id);
      const active = insertQuizQuestion(db, activity.id, {
        text: "Pergunta ativa",
      });
      const deleted = insertQuizQuestion(db, activity.id, {
        deletedAt: new Date(),
        text: "Pergunta removida",
      });

      const activeOnly = db
        .select()
        .from(quizQuestions)
        .where(isNull(quizQuestions.deletedAt))
        .all();

      expect(activeOnly.map((q) => q.id)).toContain(active.id);
      expect(activeOnly.map((q) => q.id)).not.toContain(deleted.id);

      const rawRow = db
        .select()
        .from(quizQuestions)
        .where(eq(quizQuestions.id, deleted.id))
        .get();

      expect(rawRow).toBeDefined();
      expect(rawRow?.deletedAt).not.toBeNull();
    });
  });

  describe("quiz_options", () => {
    it("uses a UUID text primary key, not an autoincrementing integer", () => {
      const createSql = (
        db.$client
          .prepare(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'quiz_options'"
          )
          .get() as { sql: string } | undefined
      )?.sql;

      expect(createSql).toBeDefined();
      expect(createSql?.toUpperCase()).not.toContain("AUTOINCREMENT");
    });

    it("references the question it belongs to", () => {
      const program = insertProgram(db);
      const module_ = insertModule(db, program.id);
      const activity = insertQuizActivity(db, module_.id);
      const question = insertQuizQuestion(db, activity.id);
      const option = insertQuizOption(db, question.id, {
        text: "Rio de Janeiro",
      });

      const found = db
        .select()
        .from(quizOptions)
        .where(eq(quizOptions.id, option.id))
        .get();

      expect(found?.questionId).toBe(question.id);
      expect(found?.text).toBe("Rio de Janeiro");
    });

    it("stores whether an option is the correct one", () => {
      const program = insertProgram(db);
      const module_ = insertModule(db, program.id);
      const activity = insertQuizActivity(db, module_.id);
      const question = insertQuizQuestion(db, activity.id);
      const correct = insertQuizOption(db, question.id, {
        isCorrect: true,
        text: "Brasilia",
      });
      const incorrect = insertQuizOption(db, question.id, {
        isCorrect: false,
        text: "Sao Paulo",
      });

      const foundCorrect = db
        .select()
        .from(quizOptions)
        .where(eq(quizOptions.id, correct.id))
        .get();
      const foundIncorrect = db
        .select()
        .from(quizOptions)
        .where(eq(quizOptions.id, incorrect.id))
        .get();

      expect(foundCorrect?.isCorrect).toBe(true);
      expect(foundIncorrect?.isCorrect).toBe(false);
    });

    it("has created_at and updated_at timestamps", () => {
      const program = insertProgram(db);
      const module_ = insertModule(db, program.id);
      const activity = insertQuizActivity(db, module_.id);
      const question = insertQuizQuestion(db, activity.id);
      const option = insertQuizOption(db, question.id);

      const found = db
        .select()
        .from(quizOptions)
        .where(eq(quizOptions.id, option.id))
        .get();

      expect(found?.createdAt).toBeInstanceOf(Date);
      expect(found?.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("end-to-end quiz hierarchy", () => {
    it("links Activity -> QuizQuestion -> QuizOption", () => {
      const program = insertProgram(db);
      const module_ = insertModule(db, program.id);
      const activity = insertQuizActivity(db, module_.id);
      const question = insertQuizQuestion(db, activity.id);
      const option = insertQuizOption(db, question.id, { isCorrect: true });

      const joined = db
        .select()
        .from(quizOptions)
        .innerJoin(quizQuestions, eq(quizOptions.questionId, quizQuestions.id))
        .innerJoin(activities, eq(quizQuestions.activityId, activities.id))
        .where(eq(quizOptions.id, option.id))
        .get();

      expect(joined?.activities.id).toBe(activity.id);
      expect(joined?.quiz_questions.id).toBe(question.id);
      expect(joined?.quiz_options.id).toBe(option.id);
    });
  });
});
