import { os } from "@orpc/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { quizOptions, quizQuestions } from "@/database/schema";
import { getDatabaseClient } from "@/ipc/database/state";
import {
  createOptionInputSchema,
  createQuestionInputSchema,
  listOptionsInputSchema,
  listQuestionsInputSchema,
  softDeleteOptionInputSchema,
  softDeleteQuestionInputSchema,
  updateOptionInputSchema,
  updateQuestionInputSchema,
} from "./schemas";

function requireDatabaseClient() {
  const db = getDatabaseClient();

  if (!db) {
    throw new Error("Database client is not initialized");
  }

  return db;
}

export const listQuestions = os
  .input(listQuestionsInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    return db
      .select()
      .from(quizQuestions)
      .where(
        and(
          eq(quizQuestions.activityId, input.activityId),
          isNull(quizQuestions.deletedAt)
        )
      )
      .orderBy(asc(quizQuestions.createdAt))
      .all();
  });

export const createQuestion = os
  .input(createQuestionInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    const now = new Date();

    return db
      .insert(quizQuestions)
      .values({
        activityId: input.activityId,
        createdAt: now,
        text: input.text,
        updatedAt: now,
      })
      .returning()
      .get();
  });

export const updateQuestion = os
  .input(updateQuestionInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    return db
      .update(quizQuestions)
      .set({ text: input.text, updatedAt: new Date() })
      .where(eq(quizQuestions.id, input.id))
      .returning()
      .get();
  });

export const softDeleteQuestion = os
  .input(softDeleteQuestionInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    db.update(quizQuestions)
      .set({ deletedAt: new Date() })
      .where(eq(quizQuestions.id, input.id))
      .run();
  });

export const listOptions = os
  .input(listOptionsInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    return db
      .select()
      .from(quizOptions)
      .where(
        and(
          eq(quizOptions.questionId, input.questionId),
          isNull(quizOptions.deletedAt)
        )
      )
      .orderBy(asc(quizOptions.createdAt))
      .all();
  });

export const createOption = os
  .input(createOptionInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    const now = new Date();

    return db
      .insert(quizOptions)
      .values({
        createdAt: now,
        isCorrect: input.isCorrect,
        questionId: input.questionId,
        text: input.text,
        updatedAt: now,
      })
      .returning()
      .get();
  });

export const updateOption = os
  .input(updateOptionInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    return db
      .update(quizOptions)
      .set({
        isCorrect: input.isCorrect,
        text: input.text,
        updatedAt: new Date(),
      })
      .where(eq(quizOptions.id, input.id))
      .returning()
      .get();
  });

export const softDeleteOption = os
  .input(softDeleteOptionInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    db.update(quizOptions)
      .set({ deletedAt: new Date() })
      .where(eq(quizOptions.id, input.id))
      .run();
  });
