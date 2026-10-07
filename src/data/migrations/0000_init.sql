CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`source_lang` text NOT NULL,
	`target_lang` text NOT NULL,
	`speech_locale` text NOT NULL,
	`speech_locales` text NOT NULL,
	`title` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `knowledge_items` (
	`id` text PRIMARY KEY NOT NULL,
	`seed_id` text,
	`kind` text NOT NULL,
	`target_text` text NOT NULL,
	`meaning` text NOT NULL,
	`course_id` text NOT NULL,
	`reading` text,
	`romanization` text,
	`variants` text NOT NULL,
	`level` text NOT NULL,
	`topic` text NOT NULL,
	`notes` text,
	`tags` text NOT NULL,
	`status` text NOT NULL,
	`status_before_suspend` text,
	`created_at` integer NOT NULL,
	`introduced_at` integer,
	`mastered_at` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "knowledge_items_kind_check" CHECK("knowledge_items"."kind" IN ('word', 'phrase', 'sentence')),
	CONSTRAINT "knowledge_items_level_check" CHECK("knowledge_items"."level" IN ('A1', 'A2')),
	CONSTRAINT "knowledge_items_status_check" CHECK("knowledge_items"."status" IN ('new', 'learning', 'review', 'relearning', 'mastered', 'suspended')),
	CONSTRAINT "knowledge_items_status_before_suspend_check" CHECK("knowledge_items"."status_before_suspend" IS NULL OR "knowledge_items"."status_before_suspend" IN ('new', 'learning', 'review', 'relearning', 'mastered', 'suspended'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `knowledge_items_seed_id_unique` ON `knowledge_items` (`seed_id`);--> statement-breakpoint
CREATE TABLE `saved_words` (
	`item_id` text PRIMARY KEY NOT NULL,
	`example` text NOT NULL,
	`lesson_id` text NOT NULL,
	`difficulty` text NOT NULL,
	`status` text NOT NULL,
	`score` real,
	`saved_at` integer NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `knowledge_items`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "saved_words_difficulty_check" CHECK("saved_words"."difficulty" IN ('intro')),
	CONSTRAINT "saved_words_status_check" CHECK("saved_words"."status" IN ('ready-to-review'))
);
