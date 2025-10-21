ALTER TABLE `logs` ADD COLUMN `server_info_name` text;
--> statement-breakpoint
ALTER TABLE `session_metadata` ADD COLUMN `server_info_name` text;
