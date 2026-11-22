CREATE TABLE `album_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`album_id` integer NOT NULL,
	`library_id` integer NOT NULL,
	`entry_path` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `album_entries_unique_idx` ON `album_entries` (`album_id`,`entry_path`);--> statement-breakpoint
CREATE INDEX `album_entries_lookup_idx` ON `album_entries` (`library_id`,`entry_path`);--> statement-breakpoint
CREATE TABLE `albums` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`library_id` integer NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'custom' NOT NULL,
	`folder_path` text,
	`description` text,
	`cover_entry_path` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `albums_library_kind_idx` ON `albums` (`library_id`,`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX `albums_library_folder_idx` ON `albums` (`library_id`,`folder_path`);--> statement-breakpoint
CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `libraries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`root_path` text NOT NULL,
	`created_at` text NOT NULL,
	`last_scan_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `libraries_root_path_idx` ON `libraries` (`root_path`);--> statement-breakpoint
CREATE TABLE `library_entries` (
	`library_id` integer NOT NULL,
	`path` text NOT NULL,
	`parent_path` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`extension` text,
	`size` integer,
	`modified_at` text,
	`scan_id` text NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `library_entries_library_path_idx` ON `library_entries` (`library_id`,`path`);--> statement-breakpoint
CREATE INDEX `library_entries_browse_idx` ON `library_entries` (`library_id`,`parent_path`,`kind`,`name`);--> statement-breakpoint
CREATE INDEX `library_entries_timeline_idx` ON `library_entries` (`library_id`,`kind`,`modified_at`);--> statement-breakpoint
CREATE INDEX `library_entries_parent_idx` ON `library_entries` (`library_id`,`kind`,`parent_path`);--> statement-breakpoint
CREATE TABLE `photo_metadata` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`library_id` integer NOT NULL,
	`entry_path` text NOT NULL,
	`width` integer,
	`height` integer,
	`captured_at` text,
	`camera_make` text,
	`camera_model` text,
	`lens_model` text,
	`focal_length` text,
	`focal_length_35mm` text,
	`aperture` text,
	`shutter_speed` text,
	`iso` integer,
	`latitude` real,
	`longitude` real,
	`altitude` real,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photo_metadata_entry_idx` ON `photo_metadata` (`library_id`,`entry_path`);--> statement-breakpoint
CREATE INDEX `photo_metadata_library_captured_idx` ON `photo_metadata` (`library_id`,`captured_at`);--> statement-breakpoint
CREATE INDEX `photo_metadata_camera_idx` ON `photo_metadata` (`library_id`,`camera_make`,`camera_model`);--> statement-breakpoint
CREATE TABLE `photo_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`library_id` integer NOT NULL,
	`entry_path` text NOT NULL,
	`tag_id` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photo_tags_entry_tag_idx` ON `photo_tags` (`entry_path`,`tag_id`);--> statement-breakpoint
CREATE INDEX `photo_tags_library_entry_idx` ON `photo_tags` (`library_id`,`entry_path`);--> statement-breakpoint
CREATE INDEX `photo_tags_tag_idx` ON `photo_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `photo_user_metadata` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`library_id` integer NOT NULL,
	`entry_path` text NOT NULL,
	`is_favorite` integer DEFAULT 0 NOT NULL,
	`caption` text,
	`rating` integer DEFAULT 0,
	`is_caption_edited` integer DEFAULT 0 NOT NULL,
	`is_rating_edited` integer DEFAULT 0 NOT NULL,
	`is_tags_edited` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photo_user_meta_entry_idx` ON `photo_user_metadata` (`library_id`,`entry_path`);--> statement-breakpoint
CREATE INDEX `photo_user_meta_fav_idx` ON `photo_user_metadata` (`library_id`,`is_favorite`);--> statement-breakpoint
CREATE TABLE `scan_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`library_id` integer NOT NULL,
	`status` text NOT NULL,
	`scanned_entries` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`started_at` text,
	`finished_at` text,
	`error` text,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `scan_tasks_queue_idx` ON `scan_tasks` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `scan_tasks_library_idx` ON `scan_tasks` (`library_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_idx` ON `tags` (`name`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`display_name` text,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_idx` ON `users` (`username`);