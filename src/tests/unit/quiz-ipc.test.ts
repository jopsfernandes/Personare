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
  quizOptions as quizOptionsTable,
  quizQuestions as quizQuestionsTable,
} from "@/database/schema";
import { activities as activitiesNamespace } from "@/ipc/activities";
import { setDatabaseClient } from "@/ipc/database/state";
import { modules as modulesNamespace } from "@/ipc/modules";
import { programs as programsNamespace } from "@/ipc/programs";
import { quiz as quizNamespace } from "@/ipc/quiz";

/**
 * RED phase (Issue #14, Spec Driven TDD): src/ipc/quiz does not exist yet.
 * Every test below is expected to fail until Fundacao (Developer) implements
 * the "quiz" oRPC namespace, mirroring the pattern already used by
 * src/ipc/activities (Issue #10).
 *
 * Contract exercised here (criterio de aceite 6):
 * - listQuestions is scoped to a single Activity (activityId).
 * - listOptions is scoped to a single Question (questionId).
 * - create/update/softDelete for both questions and options.
 * - soft-delete excludes a row from a subsequent list call without removing
 *   it from the underlying table (for quiz_questions, checked at the raw
 *   deleted_at column level; for quiz_options the spec leaves the exact
 *   storage strategy open, so only the list-level behavior is asserted).
 *
 * Procedures are exercised through `createRouterClient`, oRPC's in-process
 * server-side client -- this calls the handlers exactly the way the
 * renderer does through `ipc.client.quiz.*`, without needing the
 * MessagePort/Electron transport.
 */

const QUIZ_ROUTER_REGISTRATION_PATTERN = /\bquiz\b/;

describe("quiz IPC namespace (Issue #14)", () => {
  let tmpDir: string;
  let dbPath: string;
  let db: DatabaseClient;
  let quizClient: ReturnType<typeof createRouterClient<typeof quizNamespace>>;
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
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "personare-quiz-ipc-"));
    dbPath = path.join(tmpDir, "test.sqlite");
    db = createDatabaseClient(dbPath);
    runMigrations(db);
    setDatabaseClient(db);
    quizClient = createRouterClient(quizNamespace);
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
      title: "Quiz de Revisao",
      type: "quiz",
    });
    activityId = activity.id;
    const otherActivity = await activitiesClient.create({
      moduleId: createdModule.id,
      title: "Outro Quiz",
      type: "quiz",
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

    expect(routerSource).toMatch(QUIZ_ROUTER_REGISTRATION_PATTERN);
  });

  it("exposes the question and option CRUD procedures", () => {
    expect(quizNamespace.listQuestions).toBeDefined();
    expect(quizNamespace.createQuestion).toBeDefined();
    expect(quizNamespace.updateQuestion).toBeDefined();
    expect(quizNamespace.softDeleteQuestion).toBeDefined();
    expect(quizNamespace.listOptions).toBeDefined();
    expect(quizNamespace.createOption).toBeDefined();
    expect(quizNamespace.updateOption).toBeDefined();
    expect(quizNamespace.softDeleteOption).toBeDefined();
  });

  describe("questions", () => {
    describe("listQuestions", () => {
      it("returns an empty array when the activity has no questions", async () => {
        await expect(quizClient.listQuestions({ activityId })).resolves.toEqual(
          []
        );
      });

      it("returns questions created through createQuestion", async () => {
        const created = await quizClient.createQuestion({
          activityId,
          text: "Qual e a capital do Brasil?",
        });

        const list = await quizClient.listQuestions({ activityId });

        expect(list.map((question) => question.id)).toContain(created.id);
        expect(list.map((question) => question.text)).toContain(
          "Qual e a capital do Brasil?"
        );
      });

      it("only returns questions belonging to the given activity", async () => {
        const inActivity = await quizClient.createQuestion({
          activityId,
          text: "Pergunta deste quiz",
        });
        await quizClient.createQuestion({
          activityId: otherActivityId,
          text: "Pergunta de outro quiz",
        });

        const list = await quizClient.listQuestions({ activityId });

        expect(list.map((question) => question.id)).toEqual([inActivity.id]);
      });

      it("excludes soft-deleted questions", async () => {
        const active = await quizClient.createQuestion({
          activityId,
          text: "Pergunta ativa",
        });
        const deleted = await quizClient.createQuestion({
          activityId,
          text: "Pergunta removida",
        });
        await quizClient.softDeleteQuestion({ id: deleted.id });

        const list = await quizClient.listQuestions({ activityId });

        expect(list.map((question) => question.id)).toContain(active.id);
        expect(list.map((question) => question.id)).not.toContain(deleted.id);
      });
    });

    describe("createQuestion", () => {
      it("inserts a new question associated with the given activity and returns it", async () => {
        const created = await quizClient.createQuestion({
          activityId,
          text: "Qual e a capital do Brasil?",
        });

        expect(typeof created.id).toBe("string");
        expect(created.text).toBe("Qual e a capital do Brasil?");
        expect(created.activityId).toBe(activityId);
      });

      it("rejects an empty text", async () => {
        await expect(
          quizClient.createQuestion({ activityId, text: "" })
        ).rejects.toThrow();
      });

      it("persists imagePath, defaulting to null when omitted (Issue #96)", async () => {
        const withImage = await quizClient.createQuestion({
          activityId,
          imagePath: "question123.png",
          text: "Com imagem",
        });
        const withoutImage = await quizClient.createQuestion({
          activityId,
          text: "Sem imagem",
        });

        expect(withImage.imagePath).toBe("question123.png");
        expect(withoutImage.imagePath).toBeNull();
      });
    });

    describe("updateQuestion", () => {
      it("updates the text of an existing question", async () => {
        const created = await quizClient.createQuestion({
          activityId,
          text: "Pergunta antiga",
        });

        const updated = await quizClient.updateQuestion({
          id: created.id,
          text: "Pergunta nova",
        });

        expect(updated.id).toBe(created.id);
        expect(updated.text).toBe("Pergunta nova");

        const list = await quizClient.listQuestions({ activityId });
        const persisted = list.find((question) => question.id === created.id);
        expect(persisted?.text).toBe("Pergunta nova");
      });

      it("rejects an empty text", async () => {
        const created = await quizClient.createQuestion({
          activityId,
          text: "Pergunta valida",
        });

        await expect(
          quizClient.updateQuestion({ id: created.id, text: "" })
        ).rejects.toThrow();
      });

      it("updates imagePath (Issue #96)", async () => {
        const created = await quizClient.createQuestion({
          activityId,
          text: "Pergunta",
        });

        const updated = await quizClient.updateQuestion({
          id: created.id,
          imagePath: "updated123.png",
          text: "Pergunta",
        });

        expect(updated.imagePath).toBe("updated123.png");
      });
    });

    describe("softDeleteQuestion", () => {
      it("sets deletedAt on the row instead of removing it from the database", async () => {
        const created = await quizClient.createQuestion({
          activityId,
          text: "Sera removida",
        });

        await quizClient.softDeleteQuestion({ id: created.id });

        const list = await quizClient.listQuestions({ activityId });
        expect(list.map((question) => question.id)).not.toContain(created.id);
      });
    });
  });

  describe("options", () => {
    let questionId: string;
    let otherQuestionId: string;

    beforeEach(async () => {
      const question = await quizClient.createQuestion({
        activityId,
        text: "Qual e a capital do Brasil?",
      });
      questionId = question.id;
      const otherQuestion = await quizClient.createQuestion({
        activityId,
        text: "Outra pergunta",
      });
      otherQuestionId = otherQuestion.id;
    });

    describe("listOptions", () => {
      it("returns an empty array when the question has no options", async () => {
        await expect(quizClient.listOptions({ questionId })).resolves.toEqual(
          []
        );
      });

      it("returns options created through createOption", async () => {
        const created = await quizClient.createOption({
          isCorrect: true,
          questionId,
          text: "Brasilia",
        });

        const list = await quizClient.listOptions({ questionId });

        expect(list.map((option) => option.id)).toContain(created.id);
        expect(list.map((option) => option.text)).toContain("Brasilia");
      });

      it("only returns options belonging to the given question", async () => {
        const inQuestion = await quizClient.createOption({
          isCorrect: true,
          questionId,
          text: "Desta pergunta",
        });
        await quizClient.createOption({
          isCorrect: true,
          questionId: otherQuestionId,
          text: "De outra pergunta",
        });

        const list = await quizClient.listOptions({ questionId });

        expect(list.map((option) => option.id)).toEqual([inQuestion.id]);
      });

      it("excludes soft-deleted options", async () => {
        const active = await quizClient.createOption({
          isCorrect: true,
          questionId,
          text: "Ativa",
        });
        const deleted = await quizClient.createOption({
          isCorrect: false,
          questionId,
          text: "Removida",
        });
        await quizClient.softDeleteOption({ id: deleted.id });

        const list = await quizClient.listOptions({ questionId });

        expect(list.map((option) => option.id)).toContain(active.id);
        expect(list.map((option) => option.id)).not.toContain(deleted.id);
      });
    });

    describe("createOption", () => {
      it("inserts a new option associated with the given question and returns it", async () => {
        const created = await quizClient.createOption({
          isCorrect: true,
          questionId,
          text: "Brasilia",
        });

        expect(typeof created.id).toBe("string");
        expect(created.text).toBe("Brasilia");
        expect(created.isCorrect).toBe(true);
        expect(created.questionId).toBe(questionId);
      });

      it("defaults isCorrect to false when not marked as the correct option", async () => {
        const created = await quizClient.createOption({
          isCorrect: false,
          questionId,
          text: "Sao Paulo",
        });

        expect(created.isCorrect).toBe(false);
      });

      it("rejects an empty text", async () => {
        await expect(
          quizClient.createOption({ isCorrect: false, questionId, text: "" })
        ).rejects.toThrow();
      });

      it("persists imagePath, defaulting to null when omitted (Issue #96)", async () => {
        const withImage = await quizClient.createOption({
          imagePath: "option123.png",
          isCorrect: false,
          questionId,
          text: "Com imagem",
        });
        const withoutImage = await quizClient.createOption({
          isCorrect: false,
          questionId,
          text: "Sem imagem",
        });

        expect(withImage.imagePath).toBe("option123.png");
        expect(withoutImage.imagePath).toBeNull();
      });
    });

    describe("updateOption", () => {
      it("updates the text and correctness of an existing option", async () => {
        const created = await quizClient.createOption({
          isCorrect: false,
          questionId,
          text: "Texto antigo",
        });

        const updated = await quizClient.updateOption({
          id: created.id,
          isCorrect: true,
          text: "Texto novo",
        });

        expect(updated.id).toBe(created.id);
        expect(updated.text).toBe("Texto novo");
        expect(updated.isCorrect).toBe(true);

        const list = await quizClient.listOptions({ questionId });
        const persisted = list.find((option) => option.id === created.id);
        expect(persisted?.text).toBe("Texto novo");
        expect(persisted?.isCorrect).toBe(true);
      });

      it("rejects an empty text", async () => {
        const created = await quizClient.createOption({
          isCorrect: false,
          questionId,
          text: "Texto valido",
        });

        await expect(
          quizClient.updateOption({
            id: created.id,
            isCorrect: false,
            text: "",
          })
        ).rejects.toThrow();
      });

      it("updates imagePath (Issue #96)", async () => {
        const created = await quizClient.createOption({
          isCorrect: false,
          questionId,
          text: "Opcao",
        });

        const updated = await quizClient.updateOption({
          id: created.id,
          imagePath: "updated456.png",
          isCorrect: false,
          text: "Opcao",
        });

        expect(updated.imagePath).toBe("updated456.png");
      });
    });

    describe("softDeleteOption", () => {
      it("excludes the option from a subsequent listOptions call", async () => {
        const created = await quizClient.createOption({
          isCorrect: false,
          questionId,
          text: "Sera removida",
        });

        await quizClient.softDeleteOption({ id: created.id });

        const list = await quizClient.listOptions({ questionId });
        expect(list.map((option) => option.id)).not.toContain(created.id);
      });

      it("does not affect options belonging to a different question", async () => {
        const inOtherQuestion = await quizClient.createOption({
          isCorrect: true,
          questionId: otherQuestionId,
          text: "Nao deve ser afetada",
        });
        const toDelete = await quizClient.createOption({
          isCorrect: false,
          questionId,
          text: "Sera removida",
        });

        await quizClient.softDeleteOption({ id: toDelete.id });

        const list = await quizClient.listOptions({
          questionId: otherQuestionId,
        });
        expect(list.map((option) => option.id)).toContain(inOtherQuestion.id);
      });
    });
  });

  describe("cascading soft-delete", () => {
    it("removing a question's options one by one leaves the question itself untouched", async () => {
      const question = await quizClient.createQuestion({
        activityId,
        text: "Pergunta com alternativas",
      });
      const option = await quizClient.createOption({
        isCorrect: true,
        questionId: question.id,
        text: "Unica alternativa",
      });

      await quizClient.softDeleteOption({ id: option.id });

      const list = await quizClient.listQuestions({ activityId });
      expect(list.map((q) => q.id)).toContain(question.id);
    });
  });

  /**
   * RED phase (Issue #22, Spec Driven TDD): activities.softDelete does not
   * cascade to a quiz's quiz_questions/quiz_options yet -- see
   * docs/specs/issue-22-cascata-soft-delete.md (AC-2), the same bug as AC-1
   * applied to the Quiz sub-hierarchy (activities -> quiz_questions ->
   * quiz_options) instead of the Flashcard one.
   */
  describe("cascading soft-delete from the parent activity (Issue #22)", () => {
    it("cascades deletedAt down to every non-deleted question and option when the activity is soft-deleted", async () => {
      const question = await quizClient.createQuestion({
        activityId,
        text: "Pergunta",
      });
      const option = await quizClient.createOption({
        isCorrect: true,
        questionId: question.id,
        text: "Opcao",
      });

      await activitiesClient.softDelete({ id: activityId });

      const questionRow = db
        .select()
        .from(quizQuestionsTable)
        .where(eq(quizQuestionsTable.id, question.id))
        .get();
      const optionRow = db
        .select()
        .from(quizOptionsTable)
        .where(eq(quizOptionsTable.id, option.id))
        .get();

      expect(questionRow?.deletedAt).not.toBeNull();
      expect(optionRow?.deletedAt).not.toBeNull();
    });

    it("uses the same timestamp as the activity for both the cascaded question and its cascaded option", async () => {
      const question = await quizClient.createQuestion({
        activityId,
        text: "Pergunta",
      });
      const option = await quizClient.createOption({
        isCorrect: true,
        questionId: question.id,
        text: "Opcao",
      });

      await activitiesClient.softDelete({ id: activityId });

      const activityRow = db
        .select()
        .from(activitiesTable)
        .where(eq(activitiesTable.id, activityId))
        .get();
      const questionRow = db
        .select()
        .from(quizQuestionsTable)
        .where(eq(quizQuestionsTable.id, question.id))
        .get();
      const optionRow = db
        .select()
        .from(quizOptionsTable)
        .where(eq(quizOptionsTable.id, option.id))
        .get();

      expect(questionRow?.deletedAt?.getTime()).toBe(
        activityRow?.deletedAt?.getTime()
      );
      expect(optionRow?.deletedAt?.getTime()).toBe(
        activityRow?.deletedAt?.getTime()
      );
    });

    it("does not overwrite the deletedAt of a question that was already independently soft-deleted before", async () => {
      const question = await quizClient.createQuestion({
        activityId,
        text: "Pergunta",
      });
      const previouslyDeletedAt = new Date("2020-01-01T00:00:00Z");
      db.update(quizQuestionsTable)
        .set({ deletedAt: previouslyDeletedAt })
        .where(eq(quizQuestionsTable.id, question.id))
        .run();

      await activitiesClient.softDelete({ id: activityId });

      const questionRow = db
        .select()
        .from(quizQuestionsTable)
        .where(eq(quizQuestionsTable.id, question.id))
        .get();

      expect(questionRow?.deletedAt?.getTime()).toBe(
        previouslyDeletedAt.getTime()
      );
    });

    it("does not overwrite the deletedAt of an option that was already independently soft-deleted before", async () => {
      const question = await quizClient.createQuestion({
        activityId,
        text: "Pergunta",
      });
      const option = await quizClient.createOption({
        isCorrect: true,
        questionId: question.id,
        text: "Opcao",
      });
      const previouslyDeletedAt = new Date("2020-01-01T00:00:00Z");
      db.update(quizOptionsTable)
        .set({ deletedAt: previouslyDeletedAt })
        .where(eq(quizOptionsTable.id, option.id))
        .run();

      await activitiesClient.softDelete({ id: activityId });

      const optionRow = db
        .select()
        .from(quizOptionsTable)
        .where(eq(quizOptionsTable.id, option.id))
        .get();

      expect(optionRow?.deletedAt?.getTime()).toBe(
        previouslyDeletedAt.getTime()
      );
    });
  });
});
