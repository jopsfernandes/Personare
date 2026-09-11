import { os } from "@orpc/server";
import { and, asc, eq, isNull, lte, sql } from "drizzle-orm";
import { unionAll } from "drizzle-orm/sqlite-core";
import type { Grade, StateType } from "ts-fsrs";
import { Rating } from "ts-fsrs";
import type { DatabaseClient } from "@/database/client";
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
  listActivityReviewStateInputSchema,
  listDueInputSchema,
  markActivityDifficultyInputSchema,
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

/**
 * Shared by submitRating (Flashcard review) and markActivityDifficulty
 * (Activity review, Issue #77) -- both apply a rating to an existing
 * review_items row the same way, they only differ in how that row gets
 * found/created in the first place.
 */
function applyRatingToReviewItem(
  db: DatabaseClient,
  row: typeof reviewItemsTable.$inferSelect,
  rating: "again" | "hard" | "good" | "easy",
  now: Date
) {
  const reviewRow: ReviewItemRow = { ...row, state: row.state as StateType };
  const grade = RATING_TO_GRADE[rating];
  const { card } = applyRating(reviewRow, grade, now);
  const fields = fromFsrsCard(card);

  const history = JSON.parse(row.ratingHistory) as {
    rating: string;
    reviewedAt: number;
  }[];
  history.push({ rating, reviewedAt: now.getTime() });

  return db
    .update(reviewItemsTable)
    .set({
      difficulty: fields.difficulty,
      dueDate: fields.dueDate,
      lapses: fields.lapses,
      lastRating: rating,
      lastReviewedAt: fields.lastReviewedAt,
      learningSteps: fields.learningSteps,
      ratingHistory: JSON.stringify(history),
      reps: fields.reps,
      scheduledDays: fields.scheduledDays,
      stability: fields.stability,
      state: fields.state,
      updatedAt: now,
    })
    .where(eq(reviewItemsTable.id, row.id))
    .returning()
    .get();
}

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

/**
 * Union of the two review_items origins (Issue #77): the pre-existing
 * Flashcard-scoped branch (flashcard -> its Activity), and the
 * Activity-scoped branch (a quiz/pdf/link review_items row references its
 * Activity directly, no Flashcard involved -- front has nothing to project
 * there, so it's a literal NULL). Both branches join the same way from
 * Activity up to Module/Program.
 */
export const listSchedule = os.handler(() => {
  const db = requireDatabaseClient();

  const viaFlashcard = db
    .select({
      activityId: activitiesTable.id,
      activityTitle: activitiesTable.title,
      dueDate: reviewItemsTable.dueDate,
      // Widened to string | null (flashcards.front is actually never null
      // here) only so this branch's shape matches viaActivity's for
      // unionAll -- Activity-scoped rows have no Flashcard to project a
      // front from.
      front: sql<string | null>`${flashcardsTable.front}`,
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
    .where(isNull(flashcardsTable.deletedAt));

  const viaActivity = db
    .select({
      activityId: activitiesTable.id,
      activityTitle: activitiesTable.title,
      dueDate: reviewItemsTable.dueDate,
      front: sql<string | null>`NULL`,
      id: reviewItemsTable.id,
      moduleId: modulesTable.id,
      programId: programsTable.id,
    })
    .from(reviewItemsTable)
    .innerJoin(
      activitiesTable,
      eq(reviewItemsTable.activityId, activitiesTable.id)
    )
    .innerJoin(modulesTable, eq(activitiesTable.moduleId, modulesTable.id))
    .innerJoin(programsTable, eq(modulesTable.programId, programsTable.id))
    .where(isNull(activitiesTable.deletedAt));

  return unionAll(viaFlashcard, viaActivity).all();
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

    return applyRatingToReviewItem(db, row, input.rating, new Date());
  });

/**
 * One review_item per whole Activity (Issue #77), get-or-created and rated
 * in the same call: there is no separate "ensure" step like Flashcard
 * review has, since the only way this row is ever created is the user
 * marking the Activity done with a rating -- the first mark is a real FSRS
 * review, not just an empty row waiting to be reviewed later.
 */
export const markActivityDifficulty = os
  .input(markActivityDifficultyInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    const now = new Date();

    let row = db
      .select()
      .from(reviewItemsTable)
      .where(eq(reviewItemsTable.activityId, input.activityId))
      .get();

    if (!row) {
      const fields = createInitialReviewItemFields();

      row = db
        .insert(reviewItemsTable)
        .values({
          activityId: input.activityId,
          createdAt: now,
          difficulty: fields.difficulty,
          dueDate: fields.dueDate,
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
        })
        .returning()
        .get();
    }

    return applyRatingToReviewItem(db, row, input.rating, now);
  });

export const listActivityReviewState = os
  .input(listActivityReviewStateInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    return db
      .select({
        activityId: reviewItemsTable.activityId,
        dueDate: reviewItemsTable.dueDate,
        lastRating: reviewItemsTable.lastRating,
      })
      .from(reviewItemsTable)
      .innerJoin(
        activitiesTable,
        eq(reviewItemsTable.activityId, activitiesTable.id)
      )
      .where(
        and(
          eq(activitiesTable.moduleId, input.moduleId),
          isNull(activitiesTable.deletedAt)
        )
      )
      .all();
  });
