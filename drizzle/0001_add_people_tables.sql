CREATE TABLE `people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`cover_entry_path` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_name_idx` ON `people` (`name`);--> statement-breakpoint
CREATE TABLE `photo_people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`library_id` integer NOT NULL,
	`entry_path` text NOT NULL,
	`person_id` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`library_id`) REFERENCES `libraries`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photo_people_entry_person_idx` ON `photo_people` (`library_id`,`entry_path`,`person_id`);--> statement-breakpoint
CREATE INDEX `photo_people_library_entry_idx` ON `photo_people` (`library_id`,`entry_path`);--> statement-breakpoint
CREATE INDEX `photo_people_person_idx` ON `photo_people` (`person_id`);