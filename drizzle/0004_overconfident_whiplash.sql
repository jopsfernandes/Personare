CREATE TABLE `quiz_options` (
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`id` text PRIMARY KEY NOT NULL,
	`is_correct` integer DEFAULT false NOT NULL,
	`question_id` text NOT NULL,
	`text` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`question_id`) REFERENCES `quiz_questions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `quiz_questions` (
	`activity_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`id` text PRIMARY KEY NOT NULL,
	`text` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE no action
);
