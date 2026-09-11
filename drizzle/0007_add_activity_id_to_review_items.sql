PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_review_items` (
	`activity_id` text,
	`created_at` integer NOT NULL,
	`difficulty` real NOT NULL,
	`due_date` integer NOT NULL,
	`flashcard_id` text,
	`id` text PRIMARY KEY NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`last_rating` text NOT NULL,
	`last_reviewed_at` integer,
	`learning_steps` integer DEFAULT 0 NOT NULL,
	`rating_history` text NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`scheduled_days` integer DEFAULT 0 NOT NULL,
	`stability` real NOT NULL,
	`state` text DEFAULT 'New' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`flashcard_id`) REFERENCES `flashcards`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_review_items`("activity_id", "created_at", "difficulty", "due_date", "flashcard_id", "id", "lapses", "last_rating", "last_reviewed_at", "learning_steps", "rating_history", "reps", "scheduled_days", "stability", "state", "updated_at") SELECT NULL, "created_at", "difficulty", "due_date", "flashcard_id", "id", "lapses", "last_rating", "last_reviewed_at", "learning_steps", "rating_history", "reps", "scheduled_days", "stability", "state", "updated_at" FROM `review_items`;--> statement-breakpoint
DROP TABLE `review_items`;--> statement-breakpoint
ALTER TABLE `__new_review_items` RENAME TO `review_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;