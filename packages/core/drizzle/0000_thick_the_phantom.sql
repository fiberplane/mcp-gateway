CREATE TABLE `logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`timestamp` text NOT NULL,
	`method` text NOT NULL,
	`jsonrpc_id` text,
	`server_name` text NOT NULL,
	`session_id` text NOT NULL,
	`duration_ms` integer DEFAULT 0,
	`http_status` integer DEFAULT 0,
	`request_json` text,
	`response_json` text,
	`error_json` text
);
--> statement-breakpoint
CREATE INDEX `idx_timestamp` ON `logs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_server_name` ON `logs` (`server_name`);--> statement-breakpoint
CREATE INDEX `idx_session_id` ON `logs` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_server_session` ON `logs` (`server_name`,`session_id`);