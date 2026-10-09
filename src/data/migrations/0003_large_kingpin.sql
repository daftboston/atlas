CREATE TABLE `unlock_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`minutes` integer NOT NULL,
	`status` text NOT NULL,
	`earned_at` integer NOT NULL,
	`activated_at` integer,
	`expires_at` integer,
	`expires_unused_at` integer NOT NULL,
	`screen_time_applied` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `practice_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "unlock_grants_status_check" CHECK("unlock_grants"."status" IN ('earned', 'active', 'expired', 'forfeited'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unlock_grants_session_id_unique` ON `unlock_grants` (`session_id`);