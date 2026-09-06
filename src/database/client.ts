import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { healthCheck } from "./schema";

export function createDatabaseClient(dbPath: string) {
  const sqlite = new Database(dbPath);

  return drizzle(sqlite, { schema: { healthCheck } });
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>;
