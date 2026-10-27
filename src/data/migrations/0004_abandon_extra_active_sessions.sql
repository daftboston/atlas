-- Custom SQL migration (drizzle-kit `generate --custom`): drizzle-kit can't express a data fix.
-- Runs before 0005 adds the single-active-session unique index. Without it, a database that
-- already holds two `active` sessions would fail that index, and the whole migration batch
-- would roll back and keep the app on the startup error screen.
-- Keeps the most recently started active session and abandons the rest (learning-loop §5.4:
-- graded attempts stay graded, no unlock is earned).
UPDATE `practice_sessions`
SET `status` = 'abandoned', `ended_at` = CAST(strftime('%s', 'now') AS integer) * 1000
WHERE `status` = 'active'
  AND `id` <> (
    SELECT `id` FROM `practice_sessions`
    WHERE `status` = 'active'
    ORDER BY `started_at` DESC, `id` DESC
    LIMIT 1
  );
