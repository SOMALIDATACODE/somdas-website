CREATE TABLE `contact_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`topic` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `contact_email_created` ON `contact_messages` (`email`,`created_at`);--> statement-breakpoint
CREATE INDEX `contact_created` ON `contact_messages` (`created_at`);