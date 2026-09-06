CREATE TABLE `activities` (
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`id` text PRIMARY KEY NOT NULL,
	`module_id` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`module_id`) REFERENCES `modules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `flashcards` (
	`activity_id` text NOT NULL,
	`back` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`front` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `modules` (
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`program_id` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `programs` (
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_items` (
	`created_at` integer NOT NULL,
	`difficulty` real NOT NULL,
	`due_date` integer NOT NULL,
	`flashcard_id` text NOT NULL,
	`id` text PRIMARY KEY NOT NULL,
	`last_rating` text NOT NULL,
	`rating_history` text NOT NULL,
	`stability` real NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`flashcard_id`) REFERENCES `flashcards`(`id`) ON UPDATE no action ON DELETE no action
);
