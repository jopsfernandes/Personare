import { integer, sqliteTable } from "drizzle-orm/sqlite-core";

export const healthCheck = sqliteTable("health_check", {
  id: integer("id").primaryKey({ autoIncrement: true }),
});
