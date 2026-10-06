/** @jest-environment node */
import { eq, sql } from 'drizzle-orm';

import { sampleWord } from '@/content/sample-lesson';
import type { LessonWord } from '@/domain/types';

import type { AtlasDatabase } from '../client';
import { appSettings, knowledgeItems, savedWords } from '../schema';
import { DEFAULT_COURSE } from '../seed/courses';
import { loadSeed } from '../seed/loadSeed';
import { openTestDatabase, removeDatabaseFile, tempDatabasePath } from '../testDatabase';
import { createLearnerRepository } from './learnerRepo';

let mockIdCounter = 0;
jest.mock('@/lib/id', () => ({ newId: () => `id-${++mockIdCounter}` }));

// The sample lesson's word: seed item es-v0-001 (Hola / Hello), already written by loadSeed.
const HOLA: LessonWord = sampleWord('es', 'en');
const BUENOS_DIAS: LessonWord = {
  seedId: 'es-v0-002',
  text: 'Buenos días',
  meaning: 'Good morning',
  example: 'Buenos días, señora.',
  lessonId: 'sample-es',
};
const SEEDED_AT = Date.UTC(2026, 9, 6, 13, 50);
const SAVED_AT = Date.UTC(2026, 9, 6, 13, 51);

async function setup() {
  const db = await openTestDatabase();
  loadSeed(db, DEFAULT_COURSE, SEEDED_AT);
  return { db, repo: createLearnerRepository(db) };
}

function seededItem(db: AtlasDatabase, seedId: string) {
  return db.select().from(knowledgeItems).where(eq(knowledgeItems.seedId, seedId)).get();
}

describe('learnerRepo (SQLite)', () => {
  beforeEach(() => {
    mockIdCounter = 0;
  });

  it('has no profile until a course is started, and stores activeCourseId in app_settings', async () => {
    const { db, repo } = await setup();
    expect(await repo.getProfile()).toBeNull();

    expect(await repo.startCourse('en-es-v0')).toEqual({ nativeLanguage: 'en', targetLanguage: 'es' });
    expect(await repo.getProfile()).toEqual({ nativeLanguage: 'en', targetLanguage: 'es' });
    expect(db.select().from(appSettings).all()).toEqual([{ key: 'activeCourseId', value: '"en-es-v0"' }]);

    await repo.clearProfile();
    expect(await repo.getProfile()).toBeNull();
    expect(db.select().from(appSettings).all()).toEqual([]);
  });

  it('rejects a course that does not exist', async () => {
    const { repo } = await setup();
    await expect(repo.startCourse('en-xx-v0')).rejects.toThrow('Unknown course en-xx-v0');
    expect(await repo.getProfile()).toBeNull();
  });

  it('the sample lesson teaches seed item es-v0-001', () => {
    expect(HOLA).toEqual({
      seedId: 'es-v0-001',
      text: 'Hola',
      meaning: 'Hello',
      example: 'Hola, ¿cómo estás?',
      lessonId: 'sample-es',
    });
  });

  it('saves a word with every field the in-memory store carried', async () => {
    const { db, repo } = await setup();
    await repo.startCourse('en-es-v0');

    const saved = await repo.saveWord(HOLA, SAVED_AT);

    expect(saved).toEqual({
      id: seededItem(db, 'es-v0-001')?.id,
      text: 'Hola',
      meaning: 'Hello',
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

  it('saves the seeded KnowledgeItem: no new item, the seed row unchanged, plus a saved_words row', async () => {
    const { db, repo } = await setup();
    await repo.startCourse('en-es-v0');
    const itemsBefore = db.select().from(knowledgeItems).all();
    const holaBefore = seededItem(db, 'es-v0-001');

    const saved = await repo.saveWord(HOLA, SAVED_AT);

    expect(db.select().from(knowledgeItems).all()).toEqual(itemsBefore);
    expect(db.select().from(knowledgeItems).where(eq(knowledgeItems.targetText, 'Hola')).all()).toHaveLength(1);
    expect(holaBefore).toMatchObject({
      id: saved.id,
      seedId: 'es-v0-001',
      kind: 'word',
      targetText: 'Hola',
      meaning: 'Hello',
      courseId: 'en-es-v0',
      level: 'A1',
      topic: 'greetings',
      status: 'new',
      createdAt: SEEDED_AT,
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

  it('is idempotent: saving the same word twice keeps one row and the first saved time', async () => {
    const { db, repo } = await setup();
    await repo.startCourse('en-es-v0');
    const itemCount = db.select().from(knowledgeItems).all().length;

    const first = await repo.saveWord(HOLA, SAVED_AT);
    const second = await repo.saveWord(HOLA, SAVED_AT + 60_000);

    expect(second).toEqual(first);
    expect(await repo.listSavedWords()).toEqual([first]);
    expect(db.select().from(savedWords).all()).toHaveLength(1);
    expect(db.select().from(knowledgeItems).all()).toHaveLength(itemCount);
  });

  it('refuses to save before a course is started, and writes nothing', async () => {
    const { db, repo } = await setup();
    const itemsBefore = db.select().from(knowledgeItems).all();

    await expect(repo.saveWord(HOLA, SAVED_AT)).rejects.toThrow('Start a course before saving words');
    expect(db.select().from(knowledgeItems).all()).toEqual(itemsBefore);
    expect(db.select().from(savedWords).all()).toEqual([]);
  });

  it('refuses a word that is not in the active course seed deck, and writes nothing', async () => {
    const { db, repo } = await setup();
    await repo.startCourse('en-es-v0');
    const itemsBefore = db.select().from(knowledgeItems).all();

    await expect(repo.saveWord({ ...HOLA, seedId: 'sample:es:hola' }, SAVED_AT)).rejects.toThrow(
      'Seed item sample:es:hola is not in course en-es-v0',
    );
    expect(db.select().from(knowledgeItems).all()).toEqual(itemsBefore);
    expect(db.select().from(savedWords).all()).toEqual([]);
  });

  it('lists saved words newest first', async () => {
    const { repo } = await setup();
    await repo.startCourse('en-es-v0');
    await repo.saveWord(HOLA, SAVED_AT);
    await repo.saveWord(BUENOS_DIAS, SAVED_AT + 1);

    expect((await repo.listSavedWords()).map((word) => word.text)).toEqual(['Buenos días', 'Hola']);
  });

  it('keeps the profile and saved words across a restart (close and reopen the database file)', async () => {
    const path = tempDatabasePath();
    try {
      const first = await openTestDatabase(path);
      loadSeed(first, DEFAULT_COURSE, SEEDED_AT);
      const before = createLearnerRepository(first);
      await before.startCourse('en-es-v0');
      const saved = await before.saveWord(HOLA, SAVED_AT);
      first.close();

      // Second launch: migrations and seeding run again, then the store reloads.
      const second = await openTestDatabase(path);
      loadSeed(second, DEFAULT_COURSE, SAVED_AT + 1000);
      const after = createLearnerRepository(second);
      expect(await after.getProfile()).toEqual({ nativeLanguage: 'en', targetLanguage: 'es' });
      expect(await after.listSavedWords()).toEqual([saved]);
      second.close();
    } finally {
      removeDatabaseFile(path);
    }
  });

  it('enforces the CHECK constraints on enums', async () => {
    const { db } = await setup();
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
