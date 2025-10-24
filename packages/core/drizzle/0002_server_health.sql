CREATE TABLE `server_health` (
  `server_name` text PRIMARY KEY NOT NULL,
  `health` text NOT NULL,
  `last_check` text NOT NULL,
  `url` text NOT NULL
);
