CREATE INDEX `albums_library_name_idx` ON `albums` (`library_id`,`name`);--> statement-breakpoint
CREATE INDEX `albums_library_updated_idx` ON `albums` (`library_id`,`updated_at`);