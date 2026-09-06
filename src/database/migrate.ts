import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { DatabaseClient } from "./client";

export function resolveMigrationsFolder(options: {
  isPackaged: boolean;
  resourcesPath: string;
}): string {
  return options.isPackaged
    ? path.join(options.resourcesPath, "drizzle")
    : path.resolve(process.cwd(), "drizzle");
}

export function runMigrations(
  db: DatabaseClient,
  migrationsFolder: string = path.resolve(process.cwd(), "drizzle")
) {
  migrate(db, { migrationsFolder });
}
