CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`path` text NOT NULL,
	`visitor_hash` text NOT NULL,
	`referrer` text NOT NULL,
	`device` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_analytics_date` ON `analytics_events` (`date`);--> statement-breakpoint
CREATE INDEX `idx_analytics_path_date` ON `analytics_events` (`path`,`date`);--> statement-breakpoint
CREATE INDEX `idx_analytics_visitor_date` ON `analytics_events` (`visitor_hash`,`date`);--> statement-breakpoint
CREATE TABLE `cms_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`actor_role` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_key` text NOT NULL,
	`target_label` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_cms_activity_created` ON `cms_activity` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_cms_activity_actor` ON `cms_activity` (`actor_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `cms_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cms_users` (
	`id` text PRIMARY KEY NOT NULL,
	`platform_id` text,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_cms_users_email` ON `cms_users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_cms_users_platform` ON `cms_users` (`platform_id`);--> statement-breakpoint
ALTER TABLE `section_drafts` ADD `owner_id` text;--> statement-breakpoint
ALTER TABLE `section_drafts` ADD `assigned_to` text;--> statement-breakpoint
ALTER TABLE `section_drafts` ADD `scheduled_at` text;--> statement-breakpoint
ALTER TABLE `section_drafts` ADD `publish_error` text;