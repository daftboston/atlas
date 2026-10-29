CREATE TABLE `blocked_apps` (
	`app_id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`session_id` text,
	`updated_at` integer NOT NULL,
	CONSTRAINT "blocked_apps_state_check" CHECK("blocked_apps"."state" IN ('locked', 'practicing', 'unlocked', 'relocked'))
);
