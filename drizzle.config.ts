import { defineConfig } from 'drizzle-kit';

// Drizzle's Expo SQLite guide: dialect sqlite + driver expo. Output goes where
// architecture §5 puts it, and is committed.
export default defineConfig({
  dialect: 'sqlite',
  driver: 'expo',
  schema: './src/data/schema.ts',
  out: './src/data/migrations',
});
