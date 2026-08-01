CREATE TABLE `link_previews` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`provider` text DEFAULT 'web' NOT NULL,
	`site_name` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`image_url` text,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `link_previews_url_idx` ON `link_previews` (`url`);--> statement-breakpoint
CREATE INDEX `link_previews_fetched_idx` ON `link_previews` (`fetched_at`);--> statement-breakpoint
ALTER TABLE `profiles` ADD `avatar_key` text;