CREATE TABLE `review_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`attempt_id` text NOT NULL,
	`rating` integer NOT NULL,
	`fsrs_state_before` text NOT NULL,
	`due_before` integer NOT NULL,
	`stability_before` real NOT NULL,
	`difficulty_before` real NOT NULL,
	`elapsed_days` real NOT NULL,
	`scheduled_days` real NOT NULL,
	`reviewed_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `knowledge_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`attempt_id`) REFERENCES `practice_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "review_logs_rating_check" CHECK("review_logs"."rating" BETWEEN 1 AND 4),
	CONSTRAINT "review_logs_fsrs_state_before_check" CHECK("review_logs"."fsrs_state_before" IN ('New', 'Learning', 'Review', 'Relearning'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_logs_attempt_id_unique` ON `review_logs` (`attempt_id`);--> statement-breakpoint
CREATE TABLE `review_queue` (
	`item_id` text PRIMARY KEY NOT NULL,
	`due` integer NOT NULL,
	`stability` real NOT NULL,
	`difficulty` real NOT NULL,
	`elapsed_days` real NOT NULL,
	`scheduled_days` real NOT NULL,
	`learning_steps` integer NOT NULL,
	`reps` integer NOT NULL,
	`lapses` integer NOT NULL,
	`fsrs_state` text NOT NULL,
	`last_review_at` integer,
	FOREIGN KEY (`item_id`) REFERENCES `knowledge_items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "review_queue_fsrs_state_check" CHECK("review_queue"."fsrs_state" IN ('New', 'Learning', 'Review', 'Relearning'))
);
--> statement-breakpoint
CREATE INDEX `review_queue_due_idx` ON `review_queue` (`due`);--> statement-breakpoint
ALTER TABLE `practice_sessions` ADD `planned_steps` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_feedback` (
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
	CONSTRAINT "feedback_method_check" CHECK("__new_feedback"."method" = 'text-match'),
	CONSTRAINT "feedback_rating_check" CHECK("__new_feedback"."rating" IS NULL OR "__new_feedback"."rating" BETWEEN 1 AND 4)
);
--> statement-breakpoint
INSERT INTO `__new_feedback`("id", "attempt_id", "overall", "accuracy", "pronunciation", "words_json", "method", "matched_text", "accent_hints_json", "rating", "hint_key", "created_at") SELECT "id", "attempt_id", "overall", "accuracy", "pronunciation", "words_json", "method", "matched_text", "accent_hints_json", "rating", "hint_key", "created_at" FROM `feedback`;--> statement-breakpoint
DROP TABLE `feedback`;--> statement-breakpoint
ALTER TABLE `__new_feedback` RENAME TO `feedback`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `feedback_attempt_id_unique` ON `feedback` (`attempt_id`);