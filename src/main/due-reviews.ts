import { and, eq, isNull, lte, sql } from "drizzle-orm";
import type { DatabaseClient } from "@/database/client";
import {
  flashcards as flashcardsTable,
  reviewItems as reviewItemsTable,
} from "@/database/schema";

export function countDueReviews(db: DatabaseClient, now: Date): number {
  const result = db
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

  return result?.count ?? 0;
}
