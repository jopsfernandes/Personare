import { randomUUID } from "node:crypto";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const healthCheck = sqliteTable("health_check", {
  id: integer("id").primaryKey({ autoIncrement: true }),
});

export const programs = sqliteTable("programs", {
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const modules = sqliteTable("modules", {
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  name: text("name").notNull(),
  programId: text("program_id")
    .notNull()
    .references(() => programs.id),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * `type` is an open, application-validated discriminator (link, quiz, pdf,
 * flashcard_deck, ...), not a closed SQLite enum/CHECK constraint -- new
 * Activity types must not require a destructive migration (Plan.md 1.1).
 */
export const activities = sqliteTable("activities", {
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  moduleId: text("module_id")
    .notNull()
    .references(() => modules.id),
  title: text("title").notNull(),
  type: text("type").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const flashcards = sqliteTable("flashcards", {
  activityId: text("activity_id")
    .notNull()
    .references(() => activities.id),
  back: text("back").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  front: text("front").notNull(),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * ReviewItem is the first-class entity scheduled by FSRS, decoupled from the
 * content hierarchy: it references only the Flashcard that schedules it, not
 * the Module/Program/Activity above it. It preserves its review history even
 * after the underlying Flashcard content is edited.
 */
export const reviewItems = sqliteTable("review_items", {
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  difficulty: real("difficulty").notNull(),
  dueDate: integer("due_date", { mode: "timestamp" }).notNull(),
  flashcardId: text("flashcard_id")
    .notNull()
    .references(() => flashcards.id),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  lastRating: text("last_rating").notNull(),
  ratingHistory: text("rating_history").notNull(),
  stability: real("stability").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
