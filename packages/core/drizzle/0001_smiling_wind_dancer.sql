ALTER TABLE `logs` ADD `client_name` text;--> statement-breakpoint
ALTER TABLE `logs` ADD `client_version` text;--> statement-breakpoint
ALTER TABLE `logs` ADD `client_title` text;--> statement-breakpoint
ALTER TABLE `logs` ADD `server_version` text;--> statement-breakpoint
ALTER TABLE `logs` ADD `server_title` text;--> statement-breakpoint
ALTER TABLE `logs` ADD `user_agent` text;--> statement-breakpoint
ALTER TABLE `logs` ADD `client_ip` text;--> statement-breakpoint
CREATE INDEX `idx_client_name` ON `logs` (`client_name`);--> statement-breakpoint
CREATE INDEX `idx_client_name_version` ON `logs` (`client_name`,`client_version`);--> statement-breakpoint
CREATE INDEX `idx_client_ip` ON `logs` (`client_ip`);