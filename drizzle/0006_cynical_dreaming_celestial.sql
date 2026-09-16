CREATE TABLE `auth_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_auth_rate_limits_reset` ON `auth_rate_limits` (`reset_at`);--> statement-breakpoint
CREATE INDEX `idx_admin_history_created` ON `admin_history` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_media_created` ON `media` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_section_history_key_created` ON `section_history` (`key`,`created_at`);