import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import {
  activities,
  flashcards,
  healthCheck,
  modules,
  programs,
  reviewItems,
} from "./schema";

export function createDatabaseClient(dbPath: string) {
  const sqlite = new Database(dbPath);

  return drizzle(sqlite, {
    schema: {
      activities,
      flashcards,
      healthCheck,
      modules,
      programs,
      reviewItems,
    },
  });
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;
