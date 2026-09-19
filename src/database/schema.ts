import { randomUUID } from "node:crypto";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const healthCheck = sqliteTable("health_check", {
  id: integer("id").primaryKey({ autoIncrement: true }),
});

export const programs = sqliteTable("programs", {
  color: text("color"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  icon: text("icon"),
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
  filePath: text("file_path"),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  moduleId: text("module_id")
    .notNull()
    .references(() => modules.id),
  title: text("title").notNull(),
  type: text("type").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  url: text("url"),
});

/**
 * quiz_options intentionally mirrors quiz_questions' soft-delete strategy
 * (a nullable deleted_at column) rather than hard delete-and-recreate, so
 * softDeleteOption behaves exactly like every other soft-delete in the app.
 */
export const quizQuestions = sqliteTable("quiz_questions", {
  activityId: text("activity_id")
    .notNull()
    .references(() => activities.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  /** File name of an optional attached image, under userData/attachments/. */
  imagePath: text("image_path"),
  text: text("text").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const quizOptions = sqliteTable("quiz_options", {
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  /** File name of an optional attached image, under userData/attachments/. */
  imagePath: text("image_path"),
  isCorrect: integer("is_correct", { mode: "boolean" })
    .notNull()
    .default(false),
  questionId: text("question_id")
    .notNull()
    .references(() => quizQuestions.id),
  text: text("text").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const flashcards = sqliteTable("flashcards", {
  activityId: text("activity_id")
    .notNull()
    .references(() => activities.id),
  back: text("back").notNull(),
  /** File name of an optional attached image, under userData/attachments/. */
  backImagePath: text("back_image_path"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  front: text("front").notNull(),
  /** File name of an optional attached image, under userData/attachments/. */
  frontImagePath: text("front_image_path"),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * ReviewItem is the first-class entity scheduled by FSRS, decoupled from the
 * content hierarchy: it references only the Flashcard or Activity that
 * schedules it, not the Module/Program above it. It preserves its review
 * history even after the underlying content is edited.
 *
 * Exactly one of flashcardId/activityId is set (app-validated, same open
 * discriminator style as activities.type -- not a DB CHECK constraint):
 * flashcardId for an individual Flashcard inside a flashcard_deck Activity,
 * activityId for a quiz/pdf/link Activity reviewed as a whole (Issue #77).
 */
export const reviewItems = sqliteTable("review_items", {
  activityId: text("activity_id").references(() => activities.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  difficulty: real("difficulty").notNull(),
  dueDate: integer("due_date", { mode: "timestamp_ms" }).notNull(),
  flashcardId: text("flashcard_id").references(() => flashcards.id),
  id: text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  lapses: integer("lapses").notNull().default(0),
  lastRating: text("last_rating").notNull(),
  lastReviewedAt: integer("last_reviewed_at", { mode: "timestamp_ms" }),
  learningSteps: integer("learning_steps").notNull().default(0),
  ratingHistory: text("rating_history").notNull(),
  reps: integer("reps").notNull().default(0),
  scheduledDays: integer("scheduled_days").notNull().default(0),
  stability: real("stability").notNull(),
  state: text("state").notNull().default("New"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

/**
 * Singleton settings row -- id is always 1, never a UUID like the rest of
 * the schema. The row is created lazily on first read/write (AC-4), not
 * seeded by a migration.
 */
export const appSettings = sqliteTable("app_settings", {
  autoStartEnabled: integer("auto_start_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  id: integer("id").primaryKey(),
});
