CREATE TABLE `cms_auth_challenges` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`purpose` text NOT NULL,
	`setup_secret` text,
	`expires_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `cms_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_cms_challenges_user` ON `cms_auth_challenges` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_cms_challenges_expiry` ON `cms_auth_challenges` (`expires_at`);--> statement-breakpoint
CREATE TABLE `cms_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`last_seen_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `cms_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_cms_sessions_user` ON `cms_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_cms_sessions_expiry` ON `cms_sessions` (`expires_at`);--> statement-breakpoint
ALTER TABLE `cms_users` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `cms_users` ADD `two_factor_secret` text;--> statement-breakpoint
ALTER TABLE `cms_users` ADD `two_factor_enabled` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `cms_users` ADD `last_login_at` text;--> statement-breakpoint
PRAGMA optimize;
