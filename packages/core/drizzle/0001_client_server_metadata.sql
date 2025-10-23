ALTER TABLE `logs` ADD COLUMN `client_name` text;
--> statement-breakpoint
ALTER TABLE `logs` ADD COLUMN `client_version` text;
--> statement-breakpoint
ALTER TABLE `logs` ADD COLUMN `client_title` text;
--> statement-breakpoint
ALTER TABLE `logs` ADD COLUMN `server_version` text;
--> statement-breakpoint
ALTER TABLE `logs` ADD COLUMN `server_title` text;
--> statement-breakpoint
ALTER TABLE `logs` ADD COLUMN `server_info_name` text;
--> statement-breakpoint
ALTER TABLE `logs` ADD COLUMN `user_agent` text;
--> statement-breakpoint
ALTER TABLE `logs` ADD COLUMN `client_ip` text;
--> statement-breakpoint
CREATE INDEX `idx_client_name` ON `logs` (`client_name`);
--> statement-breakpoint
CREATE INDEX `idx_client_name_version` ON `logs` (`client_name`,`client_version`);
--> statement-breakpoint
CREATE INDEX `idx_client_ip` ON `logs` (`client_ip`);
--> statement-breakpoint
CREATE TABLE `session_metadata` (
  `session_id` text PRIMARY KEY NOT NULL,
  `server_name` text NOT NULL,
  `client_name` text,
  `client_version` text,
  `client_title` text,
  `server_version` text,
  `server_title` text,
  `server_info_name` text,
  `first_seen` text NOT NULL,
  `last_seen` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `session_metadata_idx_server_name` ON `session_metadata` (`server_name`);
--> statement-breakpoint
CREATE INDEX `session_metadata_idx_last_seen` ON `session_metadata` (`last_seen`);
