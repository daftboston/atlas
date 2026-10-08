CREATE TABLE `feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`overall` real NOT NULL,
	`accuracy` real NOT NULL,
	`pronunciation` real,
	`words_json` text NOT NULL,
	`method` text NOT NULL,
	`matched_text` text NOT NULL,
	`accent_hints_json` text NOT NULL,
	`rating` integer,
	`hint_key` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `practice_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "feedback_method_check" CHECK("feedback"."method" = 'text-match')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_attempt_id_unique` ON `feedback` (`attempt_id`);--> statement-breakpoint
CREATE TABLE `practice_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`item_id` text NOT NULL,
	`prompt_type` text NOT NULL,
	`input_mode` text NOT NULL,
	`try_number` integer NOT NULL,
	`status` text NOT NULL,
	`transcript` text,
	`duration_ms` integer,
	`error` text,
	`graded` integer NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `practice_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `knowledge_items`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "practice_attempts_prompt_type_check" CHECK("practice_attempts"."prompt_type" IN ('listen-repeat', 'recall-speak')),
	CONSTRAINT "practice_attempts_input_mode_check" CHECK("practice_attempts"."input_mode" IN ('speech', 'typed')),
	CONSTRAINT "practice_attempts_status_check" CHECK("practice_attempts"."status" IN ('pending', 'captured', 'scored', 'failed', 'skipped'))
);
--> statement-breakpoint
CREATE TABLE `practice_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`planned_item_ids` text NOT NULL,
	`cursor` integer NOT NULL,
	CONSTRAINT "practice_sessions_mode_check" CHECK("practice_sessions"."mode" IN ('onboarding', 'daily', 'review-only')),
	CONSTRAINT "practice_sessions_status_check" CHECK("practice_sessions"."status" IN ('active', 'completed', 'abandoned'))
);
