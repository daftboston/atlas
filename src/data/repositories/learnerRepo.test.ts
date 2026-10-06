/** @jest-environment node */
import { sql } from 'drizzle-orm';

import type { LessonWord } from '@/domain/types';

import { appSettings, knowledgeItems, savedWords } from '../schema';
import { DEFAULT_COURSE } from '../seed/courses';
import { loadSeed } from '../seed/loadSeed';
import { openTestDatabase, removeDatabaseFile, tempDatabasePath } from '../testDatabase';
import { createLearnerRepository } from './learnerRepo';

let mockIdCounter = 0;
jest.mock('@/lib/id', () => ({ newId: () => `id-${++mockIdCounter}` }));

const HOLA: LessonWord = {
  contentId: 'sample:es:hola',
  kind: 'word',
  level: 'A1',
  topic: 'greetings',
  text: 'hola',
  meaning: 'hello',
  example: 'Hola, ¿cómo estás?',
  lessonId: 'sample-es',
};
const SAVED_AT = Date.UTC(2026, 9, 6, 13, 51);

function setup() {
  const db = openTestDatabase();
  loadSeed(db, DEFAULT_COURSE, SAVED_AT - 1000);
  return { db, repo: createLearnerRepository(db) };
}

describe('learnerRepo (SQLite)', () => {
  beforeEach(() => {
    mockIdCounter = 0;
  });

  it('has no profile until a course is started, and stores activeCourseId in app_settings', async () => {
    const { db, repo } = setup();
    expect(await repo.getProfile()).toBeNull();

    expect(await repo.startCourse('en-es-v0')).toEqual({ nativeLanguage: 'en', targetLanguage: 'es' });
    expect(await repo.getProfile()).toEqual({ nativeLanguage: 'en', targetLanguage: 'es' });
    expect(db.select().from(appSettings).all()).toEqual([{ key: 'activeCourseId', value: '"en-es-v0"' }]);

    await repo.clearProfile();
    expect(await repo.getProfile()).toBeNull();
    expect(db.select().from(appSettings).all()).toEqual([]);
  });

  it('rejects a course that does not exist', async () => {
    const { repo } = setup();
    await expect(repo.startCourse('en-xx-v0')).rejects.toThrow('Unknown course en-xx-v0');
    expect(await repo.getProfile()).toBeNull();
  });

  it('saves a word with every field the in-memory store carried', async () => {
    const { repo } = setup();
    await repo.startCourse('en-es-v0');

    const saved = await repo.saveWord(HOLA, SAVED_AT);

    expect(saved).toEqual({
      id: expect.stringMatching(/^id-\d+$/),
      text: 'hola',
      meaning: 'hello',
      example: 'Hola, ¿cómo estás?',
      lessonId: 'sample-es',
      language: 'es',
      difficulty: 'intro',
      status: 'ready-to-review',
      score: null,
      savedAt: '2026-10-06T13:51:00.000Z',
    });
    expect(await repo.listSavedWords()).toEqual([saved]);
  });

  it('stores the word as a KnowledgeItem in the active course plus a saved_words row', async () => {
    const { db, repo } = setup();
    await repo.startCourse('en-es-v0');
    const saved = await repo.saveWord(HOLA, SAVED_AT);

    const item = db.select().from(knowledgeItems).where(sql`${knowledgeItems.seedId} = 'sample:es:hola'`).get();
    expect(item).toMatchObject({
      id: saved.id,
      kind: 'word',
      targetText: 'hola',
      meaning: 'hello',
      courseId: 'en-es-v0',
      variants: [],
      tags: [],
      level: 'A1',
      status: 'new',
      createdAt: SAVED_AT,
    });
    expect(db.select().from(savedWords).all()).toEqual([
      {
        itemId: saved.id,
        example: 'Hola, ¿cómo estás?',
        lessonId: 'sample-es',
        difficulty: 'intro',
        status: 'ready-to-review',
        score: null,
        savedAt: SAVED_AT,
      },
    ]);
  });

  it('is idempotent: saving the same word twice keeps one item and the first saved time', async () => {
    const { db, repo } = setup();
    await repo.startCourse('en-es-v0');

    const first = await repo.saveWord(HOLA, SAVED_AT);
    const second = await repo.saveWord(HOLA, SAVED_AT + 60_000);

    expect(second).toEqual(first);
    expect(await repo.listSavedWords()).toEqual([first]);
    expect(db.select().from(savedWords).all()).toHaveLength(1);
    expect(
      db.select().from(knowledgeItems).where(sql`${knowledgeItems.seedId} = 'sample:es:hola'`).all(),
    ).toHaveLength(1);
  });

  it('refuses to save before a course is started, and writes nothing', async () => {
    const { db, repo } = setup();
    const itemsBefore = db.select().from(knowledgeItems).all().length;

    await expect(repo.saveWord(HOLA, SAVED_AT)).rejects.toThrow('Start a course before saving words');
    expect(db.select().from(knowledgeItems).all()).toHaveLength(itemsBefore);
    expect(db.select().from(savedWords).all()).toEqual([]);
  });

  it('lists saved words newest first', async () => {
    const { repo } = setup();
    await repo.startCourse('en-es-v0');
    await repo.saveWord(HOLA, SAVED_AT);
    await repo.saveWord({ ...HOLA, contentId: 'sample:es:gracias', text: 'gracias', meaning: 'thank you' }, SAVED_AT + 1);

    expect((await repo.listSavedWords()).map((word) => word.text)).toEqual(['gracias', 'hola']);
  });

  it('keeps the profile and saved words across a restart (close and reopen the database file)', async () => {
    const path = tempDatabasePath();
    try {
      const first = openTestDatabase(path);
      loadSeed(first, DEFAULT_COURSE, SAVED_AT - 1000);
      const before = createLearnerRepository(first);
      await before.startCourse('en-es-v0');
      const saved = await before.saveWord(HOLA, SAVED_AT);
      first.close();

      // Second launch: migrations and seeding run again, then the store reloads.
      const second = openTestDatabase(path);
      loadSeed(second, DEFAULT_COURSE, SAVED_AT + 1000);
      const after = createLearnerRepository(second);
      expect(await after.getProfile()).toEqual({ nativeLanguage: 'en', targetLanguage: 'es' });
      expect(await after.listSavedWords()).toEqual([saved]);
      second.close();
    } finally {
      removeDatabaseFile(path);
    }
  });

  it('enforces the CHECK constraints on enums', () => {
    const { db } = setup();
    let failure: unknown;
    try {
      db.run(
        sql`INSERT INTO knowledge_items (id, kind, target_text, meaning, course_id, variants, level, topic, tags, status, created_at, updated_at)
            VALUES ('x', 'word', 'a', 'b', 'en-es-v0', '[]', 'A1', 't', '[]', 'ready-to-review', 0, 0)`,
      );
    } catch (error) {
      failure = error;
    }
    // Drizzle wraps the driver error; SQLite's message is on `cause`.
    expect(String((failure as Error | undefined)?.cause)).toMatch(/CHECK constraint failed/);
  });
});
