import { os } from "@orpc/server";
import { asc, eq, isNull } from "drizzle-orm";
import { programs as programsTable } from "@/database/schema";
import { getDatabaseClient } from "@/ipc/database/state";
import {
  createProgramInputSchema,
  softDeleteProgramInputSchema,
  updateProgramInputSchema,
} from "./schemas";

function requireDatabaseClient() {
  const db = getDatabaseClient();

  if (!db) {
    throw new Error("Database client is not initialized");
  }

  return db;
}

export const list = os.handler(() => {
  const db = requireDatabaseClient();

  return db
    .select()
    .from(programsTable)
    .where(isNull(programsTable.deletedAt))
    .orderBy(asc(programsTable.name))
    .all();
});

export const create = os
  .input(createProgramInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();
    const now = new Date();

    return db
      .insert(programsTable)
      .values({
        createdAt: now,
        name: input.name,
        updatedAt: now,
      })
      .returning()
      .get();
  });

export const update = os
  .input(updateProgramInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    return db
      .update(programsTable)
      .set({ name: input.name, updatedAt: new Date() })
      .where(eq(programsTable.id, input.id))
      .returning()
      .get();
  });

export const softDelete = os
  .input(softDeleteProgramInputSchema)
  .handler(({ input }) => {
    const db = requireDatabaseClient();

    db.update(programsTable)
      .set({ deletedAt: new Date() })
      .where(eq(programsTable.id, input.id))
      .run();
  });
