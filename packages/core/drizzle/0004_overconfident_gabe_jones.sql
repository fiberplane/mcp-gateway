ALTER TABLE `server_health` ADD `last_check_time` integer;--> statement-breakpoint
ALTER TABLE `server_health` ADD `last_healthy_time` integer;--> statement-breakpoint
ALTER TABLE `server_health` ADD `last_error_time` integer;--> statement-breakpoint
ALTER TABLE `server_health` ADD `error_message` text;--> statement-breakpoint
ALTER TABLE `server_health` ADD `error_code` text;--> statement-breakpoint
ALTER TABLE `server_health` ADD `response_time_ms` integer;