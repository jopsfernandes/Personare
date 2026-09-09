ALTER TABLE `review_items` ADD `lapses` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `review_items` ADD `last_reviewed_at` integer;--> statement-breakpoint
ALTER TABLE `review_items` ADD `learning_steps` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `review_items` ADD `reps` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `review_items` ADD `scheduled_days` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `review_items` ADD `state` text DEFAULT 'New' NOT NULL;