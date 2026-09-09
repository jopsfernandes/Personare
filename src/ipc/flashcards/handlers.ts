import { os } from "@orpc/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { flashcards as flashcardsTable } from "@/database/schema";
import { getDatabaseClient } from "@/ipc/database/state";
import {
  createFlashcardInputSchema,
  listFlashcardsInputSchema,
  softDeleteFlashcardInputSchema,
  updateFlashcardInputSchema,
} from "./schemas";

function requireDatabaseClient() {
  const db = getDatabaseClient();

  if (!db) {
    throw new Error("Database client is not initialized");
  }

  return db;
}

export const list = os
  .input(listFlashcardsInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    return db
      .select()
      .from(flashcardsTable)
      .where(
        and(
          eq(flashcardsTable.activityId, input.activityId),
          isNull(flashcardsTable.deletedAt)
        )
      )
      .orderBy(asc(flashcardsTable.createdAt))
      .all();
  });

export const create = os
  .input(createFlashcardInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    const now = new Date();

    return db
      .insert(flashcardsTable)
      .values({
        activityId: input.activityId,
        back: input.back,
        createdAt: now,
        front: input.front,
        updatedAt: now,
      })
      .returning()
      .get();
  });

export const update = os
  .input(updateFlashcardInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    return db
      .update(flashcardsTable)
      .set({
        back: input.back,
        front: input.front,
        updatedAt: new Date(),
      })
      .where(eq(flashcardsTable.id, input.id))
      .returning()
      .get();
  });

export const softDelete = os
  .input(softDeleteFlashcardInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    db.update(flashcardsTable)
      .set({ deletedAt: new Date() })
      .where(eq(flashcardsTable.id, input.id))
      .run();
  });
