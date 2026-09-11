import { and, eq, isNull, lte, sql } from "drizzle-orm";
import type { DatabaseClient } from "@/database/client";
import {
  activities as activitiesTable,
  flashcards as flashcardsTable,
  reviewItems as reviewItemsTable,
} from "@/database/schema";

/**
 * Sums the two review_items origins (Issue #77): Flashcard-scoped (the
 * original, via an inner join that by construction excludes any row whose
 * flashcardId is null) and Activity-scoped (quiz/pdf/link, via activityId
 * directly) -- mirrors the same two branches review.listSchedule unions.
 */
export function countDueReviews(db: DatabaseClient, now: Date): number {
  const viaFlashcard = db
    .select({ count: sql<number>`count(*)` })
    .from(reviewItemsTable)
    .innerJoin(
      flashcardsTable,
      eq(reviewItemsTable.flashcardId, flashcardsTable.id)
    )
    .where(
      and(isNull(flashcardsTable.deletedAt), lte(reviewItemsTable.dueDate, now))
    )
    .get();

  const viaActivity = db
    .select({ count: sql<number>`count(*)` })
    .from(reviewItemsTable)
    .innerJoin(
      activitiesTable,
      eq(reviewItemsTable.activityId, activitiesTable.id)
    )
    .where(
      and(isNull(activitiesTable.deletedAt), lte(reviewItemsTable.dueDate, now))
    )
    .get();

  return (viaFlashcard?.count ?? 0) + (viaActivity?.count ?? 0);
}
