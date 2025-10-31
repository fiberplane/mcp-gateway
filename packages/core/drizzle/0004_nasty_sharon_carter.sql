CREATE TABLE `llm_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`trace_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`timestamp` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`direction` text NOT NULL,
	`request_body` text,
	`response_body` text,
	`finish_reason` text,
	`streaming` integer DEFAULT false,
	`input_tokens` integer,
	`output_tokens` integer,
	`total_tokens` integer,
	`duration_ms` integer DEFAULT 0,
	`http_status` integer DEFAULT 0,
	`tool_calls_json` text,
	`user_agent` text,
	`client_ip` text,
	`error_json` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `llm_requests_uuid_unique` ON `llm_requests` (`uuid`);--> statement-breakpoint
CREATE INDEX `llm_trace_id_idx` ON `llm_requests` (`trace_id`);--> statement-breakpoint
CREATE INDEX `llm_conversation_id_idx` ON `llm_requests` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `llm_timestamp_idx` ON `llm_requests` (`timestamp`);--> statement-breakpoint
CREATE INDEX `llm_provider_model_idx` ON `llm_requests` (`provider`,`model`);--> statement-breakpoint
CREATE INDEX `llm_conversation_timestamp_idx` ON `llm_requests` (`conversation_id`,`timestamp`);--> statement-breakpoint
ALTER TABLE `logs` ADD `llm_trace_id` text;--> statement-breakpoint
ALTER TABLE `logs` ADD `conversation_id` text;--> statement-breakpoint
CREATE INDEX `idx_llm_trace_id` ON `logs` (`llm_trace_id`);--> statement-breakpoint
CREATE INDEX `idx_conversation_id` ON `logs` (`conversation_id`);