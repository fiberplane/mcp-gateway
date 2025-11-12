-- Make server_health.url nullable for stdio servers
CREATE TABLE `server_health_new` (
  `server_name` text PRIMARY KEY NOT NULL,
  `health` text NOT NULL,
  `last_check` text NOT NULL,
  `url` text,
  `last_check_time` integer,
  `last_healthy_time` integer,
  `last_error_time` integer,
  `error_message` text,
  `error_code` text,
  `response_time_ms` integer
);

INSERT INTO `server_health_new`
SELECT `server_name`, `health`, `last_check`, `url`, `last_check_time`, `last_healthy_time`, `last_error_time`, `error_message`, `error_code`, `response_time_ms`
FROM `server_health`;

DROP TABLE `server_health`;

ALTER TABLE `server_health_new` RENAME TO `server_health`;
