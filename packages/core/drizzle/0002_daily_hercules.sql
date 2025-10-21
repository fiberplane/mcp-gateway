CREATE TABLE `session_metadata` (
	`session_id` text PRIMARY KEY NOT NULL,
	`server_name` text NOT NULL,
	`client_name` text,
	`client_version` text,
	`client_title` text,
	`server_version` text,
	`server_title` text,
	`first_seen` text NOT NULL,
	`last_seen` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `session_metadata_idx_server_name` ON `session_metadata` (`server_name`);--> statement-breakpoint
CREATE INDEX `session_metadata_idx_last_seen` ON `session_metadata` (`last_seen`);