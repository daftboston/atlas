CREATE TABLE `app_settings` (
	`key` text PRIMARY KEY,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY,
	`source_lang` text NOT NULL,
	`target_lang` text NOT NULL,
	`speech_locale` text NOT NULL,
	`speech_locales` text NOT NULL,
	`title` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `knowledge_items` (
	`id` text PRIMARY KEY,
	`seed_id` text UNIQUE,
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
	CONSTRAINT `fk_knowledge_items_course_id_courses_id_fk` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`),
	CONSTRAINT "knowledge_items_kind_check" CHECK("kind" IN ('word', 'phrase', 'sentence')),
	CONSTRAINT "knowledge_items_level_check" CHECK("level" IN ('A1', 'A2')),
	CONSTRAINT "knowledge_items_status_check" CHECK("status" IN ('new', 'learning', 'review', 'relearning', 'mastered', 'suspended')),
	CONSTRAINT "knowledge_items_status_before_suspend_check" CHECK("status_before_suspend" IS NULL OR "status_before_suspend" IN ('new', 'learning', 'review', 'relearning', 'mastered', 'suspended'))
);
--> statement-breakpoint
CREATE TABLE `saved_words` (
	`item_id` text PRIMARY KEY,
	`example` text NOT NULL,
	`lesson_id` text NOT NULL,
	`difficulty` text NOT NULL,
	`status` text NOT NULL,
	`score` real,
	`saved_at` integer NOT NULL,
	CONSTRAINT `fk_saved_words_item_id_knowledge_items_id_fk` FOREIGN KEY (`item_id`) REFERENCES `knowledge_items`(`id`) ON DELETE CASCADE,
	CONSTRAINT "saved_words_difficulty_check" CHECK("difficulty" IN ('intro')),
	CONSTRAINT "saved_words_status_check" CHECK("status" IN ('ready-to-review'))
);
