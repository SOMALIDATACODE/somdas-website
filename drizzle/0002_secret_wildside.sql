CREATE TABLE `admin_history` (
	`id` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`revision` integer NOT NULL,
	`action` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `admin_workspace` (
	`id` integer PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`revision` integer NOT NULL,
	`base_revision` integer NOT NULL,
	`status` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
