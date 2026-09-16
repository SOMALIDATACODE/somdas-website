CREATE TABLE `section_drafts` (
	`key` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`base_body` text NOT NULL,
	`revision` integer NOT NULL,
	`status` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `section_history` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`body` text NOT NULL,
	`revision` integer NOT NULL,
	`action` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL
);
