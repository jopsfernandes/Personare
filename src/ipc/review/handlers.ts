import { os } from "@orpc/server";
import { and, asc, eq, isNull, lte } from "drizzle-orm";
import type { Grade, StateType } from "ts-fsrs";
import { Rating } from "ts-fsrs";
import {
  activities as activitiesTable,
  flashcards as flashcardsTable,
  modules as modulesTable,
  programs as programsTable,
  reviewItems as reviewItemsTable,
} from "@/database/schema";
import { getDatabaseClient } from "@/ipc/database/state";
import {
  applyRating,
  createInitialReviewItemFields,
  fromFsrsCard,
  type ReviewItemRow,
} from "@/utils/fsrs";
import {
  ensureReviewItemsInputSchema,
  listDueInputSchema,
  submitRatingInputSchema,
} from "./schemas";

function requireDatabaseClient() {
  const db = getDatabaseClient();

  if (!db) {
    throw new Error("Database client is not initialized");
  }

  return db;
}

const RATING_TO_GRADE: Record<"again" | "hard" | "good" | "easy", Grade> = {
  again: Rating.Again,
  easy: Rating.Easy,
  good: Rating.Good,
  hard: Rating.Hard,
};

export const ensureReviewItems = os
  .input(ensureReviewItemsInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    const scopeCondition = input.activityId
      ? eq(flashcardsTable.activityId, input.activityId)
      : undefined;

    const flashcardsWithoutReviewItems = db
      .select({ id: flashcardsTable.id })
      .from(flashcardsTable)
      .leftJoin(
        reviewItemsTable,
        eq(reviewItemsTable.flashcardId, flashcardsTable.id)
      )
      .where(
        and(
          scopeCondition,
          isNull(flashcardsTable.deletedAt),
          isNull(reviewItemsTable.id)
        )
      )
      .all();

    if (flashcardsWithoutReviewItems.length === 0) {
      return;
    }

    const now = new Date();

    db.insert(reviewItemsTable)
      .values(
        flashcardsWithoutReviewItems.map((flashcard) => {
          const fields = createInitialReviewItemFields();

          return {
            createdAt: now,
            difficulty: fields.difficulty,
            dueDate: fields.dueDate,
            flashcardId: flashcard.id,
            lapses: fields.lapses,
            lastRating: "",
            lastReviewedAt: fields.lastReviewedAt,
            learningSteps: fields.learningSteps,
            ratingHistory: "[]",
            reps: fields.reps,
            scheduledDays: fields.scheduledDays,
            stability: fields.stability,
            state: fields.state,
            updatedAt: now,
          };
        })
      )
      .run();
  });

export const listDue = os.input(listDueInputSchema).handler(({ input }) => {
  const db = requireDatabaseClient();
  const now = new Date();

  return db
    .select({
      back: flashcardsTable.back,
      dueDate: reviewItemsTable.dueDate,
      front: flashcardsTable.front,
      id: reviewItemsTable.id,
    })
    .from(reviewItemsTable)
    .innerJoin(
      flashcardsTable,
      eq(reviewItemsTable.flashcardId, flashcardsTable.id)
    )
    .where(
      and(
        eq(flashcardsTable.activityId, input.activityId),
        isNull(flashcardsTable.deletedAt),
        lte(reviewItemsTable.dueDate, now)
      )
    )
    .orderBy(asc(reviewItemsTable.dueDate))
    .all();
});

export const listSchedule = os.handler(() => {
  const db = requireDatabaseClient();

  return db
    .select({
      activityId: activitiesTable.id,
      activityTitle: activitiesTable.title,
      dueDate: reviewItemsTable.dueDate,
      front: flashcardsTable.front,
      id: reviewItemsTable.id,
      moduleId: modulesTable.id,
      programId: programsTable.id,
    })
    .from(reviewItemsTable)
    .innerJoin(
      flashcardsTable,
      eq(reviewItemsTable.flashcardId, flashcardsTable.id)
    )
    .innerJoin(
      activitiesTable,
      eq(flashcardsTable.activityId, activitiesTable.id)
    )
    .innerJoin(modulesTable, eq(activitiesTable.moduleId, modulesTable.id))
    .innerJoin(programsTable, eq(modulesTable.programId, programsTable.id))
    .where(isNull(flashcardsTable.deletedAt))
    .all();
});

export const submitRating = os
  .input(submitRatingInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    const row = db
      .select()
      .from(reviewItemsTable)
      .where(eq(reviewItemsTable.id, input.reviewItemId))
      .get();

    if (!row) {
      throw new Error("Review item not found");
    }

    const reviewRow: ReviewItemRow = { ...row, state: row.state as StateType };
    const now = new Date();
    const grade = RATING_TO_GRADE[input.rating];
    const { card } = applyRating(reviewRow, grade, now);
    const fields = fromFsrsCard(card);

    const history = JSON.parse(row.ratingHistory) as {
      rating: string;
      reviewedAt: number;
    }[];
    history.push({ rating: input.rating, reviewedAt: now.getTime() });

    return db
      .update(reviewItemsTable)
      .set({
        difficulty: fields.difficulty,
        dueDate: fields.dueDate,
        lapses: fields.lapses,
        lastRating: input.rating,
        lastReviewedAt: fields.lastReviewedAt,
        learningSteps: fields.learningSteps,
        ratingHistory: JSON.stringify(history),
        reps: fields.reps,
        scheduledDays: fields.scheduledDays,
        stability: fields.stability,
        state: fields.state,
        updatedAt: now,
      })
      .where(eq(reviewItemsTable.id, input.reviewItemId))
      .returning()
      .get();
  });
