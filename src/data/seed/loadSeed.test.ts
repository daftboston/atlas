/** @jest-environment node */
import { eq, sql } from 'drizzle-orm';

import seedV0 from '../../../content/seed/seed-phrases-v0.json';
import { courses, knowledgeItems } from '../schema';
import { openTestDatabase } from '../testDatabase';
import { DEFAULT_COURSE } from './courses';
import { loadSeed } from './loadSeed';

let mockIdCounter = 0;
jest.mock('@/lib/id', () => ({ newId: () => `id-${++mockIdCounter}` }));

const T0 = Date.UTC(2026, 9, 6);

describe('loadSeed (learning-loop §11)', () => {
  it('seeds the v0 course (en → es, es-MX by default) and its 60 phrases as new items', () => {
    const db = openTestDatabase();

    expect(loadSeed(db, DEFAULT_COURSE, T0)).toEqual({ courseId: 'en-es-v0', itemsInserted: 60, itemsUpdated: 0 });

    expect(db.select().from(courses).all()).toEqual([
      {
        id: 'en-es-v0',
        sourceLang: 'en',
        targetLang: 'es',
        speechLocale: 'es-MX',
        speechLocales: ['es-MX', 'es-ES'],
        title: 'Spanish',
        createdAt: T0,
      },
    ]);
    const items = db.select().from(knowledgeItems).all();
    expect(items).toHaveLength(60);
    expect(items.every((item) => item.status === 'new' && item.courseId === 'en-es-v0')).toBe(true);
    expect(items.find((item) => item.seedId === 'es-v0-002')).toMatchObject({
      kind: 'phrase',
      targetText: 'Buenos días',
      meaning: 'Good morning',
      variants: ['Buen día'],
      level: 'A1',
      topic: 'greetings',
      reading: null,
      romanization: null,
      tags: [],
      introducedAt: null,
    });
  });

  it('is idempotent: running it twice creates no duplicates and changes nothing', () => {
    const db = openTestDatabase();
    loadSeed(db, DEFAULT_COURSE, T0);
    const before = db.select().from(knowledgeItems).all();

    expect(loadSeed(db, DEFAULT_COURSE, T0 + 86_400_000)).toEqual({
      courseId: 'en-es-v0',
      itemsInserted: 0,
      itemsUpdated: 0,
    });
    expect(db.select().from(courses).all()).toHaveLength(1);
    expect(db.select().from(knowledgeItems).all()).toEqual(before);
  });

  it('applies edits to text fields without resetting progress or the chosen speech locale', () => {
    const db = openTestDatabase();
    loadSeed(db, DEFAULT_COURSE, T0);
    const original = db.select().from(knowledgeItems).where(eq(knowledgeItems.seedId, 'es-v0-001')).get()!;
    // Progress the learner made since the first launch.
    db.update(knowledgeItems)
      .set({ status: 'review', introducedAt: T0 + 1 })
      .where(eq(knowledgeItems.seedId, 'es-v0-001'))
      .run();
    db.update(courses).set({ speechLocale: 'es-ES' }).run();

    const edited = {
      ...seedV0,
      items: seedV0.items.map((item) =>
        item.seedId === 'es-v0-001' ? { ...item, notes: 'Use it any time of day.' } : item,
      ),
    };
    expect(loadSeed(db, { ...DEFAULT_COURSE, seed: edited }, T0 + 5)).toEqual({
      courseId: 'en-es-v0',
      itemsInserted: 0,
      itemsUpdated: 1,
    });

    expect(db.select().from(knowledgeItems).where(eq(knowledgeItems.seedId, 'es-v0-001')).get()).toEqual({
      ...original,
      notes: 'Use it any time of day.',
      status: 'review',
      introducedAt: T0 + 1,
      updatedAt: T0 + 5,
    });
    expect(db.select().from(courses).get()?.speechLocale).toBe('es-ES');
    expect(db.get<{ n: number }>(sql`SELECT count(*) AS n FROM knowledge_items`)?.n).toBe(60);
  });

  it('rejects an invalid seed file without writing anything', () => {
    const db = openTestDatabase();
    expect(() => loadSeed(db, { ...DEFAULT_COURSE, seed: { ...seedV0, schemaVersion: 2 } }, T0)).toThrow(
      'schemaVersion must be 1',
    );
    expect(db.select().from(courses).all()).toEqual([]);
  });
});
