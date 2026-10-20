/** @jest-environment node */
import { eq } from 'drizzle-orm';

import type { AtlasDatabase } from '../client';
import { knowledgeItems, reviewQueue, savedWords } from '../schema';
import { DEFAULT_COURSE } from '../seed/courses';
import { loadSeed } from '../seed/loadSeed';
import { openTestDatabase } from '../testDatabase';
import { createSettingsRepo } from './settingsRepo';
import { createReviewRepo } from './reviewRepo';

let mockIdCounter = 0;
jest.mock('@/lib/id', () => ({ newId: () => `id-${++mockIdCounter}` }));

const NOW = Date.parse('2026-10-07T15:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

describe('review repository', () => {
  let db: AtlasDatabase;

  beforeEach(async () => {
    mockIdCounter = 0;
    db = await openTestDatabase();
    loadSeed(db, DEFAULT_COURSE, NOW);
    createSettingsRepo(db).set('activeCourseId', 'en-es-v0');
  });

  it('lists a saved word once, then lets the queue replace it', () => {
    const hola = db.select().from(knowledgeItems).where(eq(knowledgeItems.seedId, 'es-v0-001')).get();
    if (!hola) throw new Error('missing Hola');
    db.insert(savedWords)
      .values({
        itemId: hola.id,
        example: 'Hola, ¿cómo estás?',
        lessonId: 'sample-es',
        difficulty: 'intro',
        status: 'ready-to-review',
        score: null,
        savedAt: NOW,
      })
      .run();

    const repo = createReviewRepo(db);
    expect(repo.home(NOW).saved.map((entry) => entry.targetText)).toEqual(['Hola']);
    expect(repo.home(NOW).due).toEqual([]);
    expect(repo.home(NOW).masteredCount).toBe(0);

    db.insert(reviewQueue)
      .values({
        itemId: hola.id,
        due: NOW + 2 * DAY,
        stability: 2,
        difficulty: 5,
        elapsedDays: 0,
        scheduledDays: 2,
        learningSteps: 0,
        reps: 2,
        lapses: 0,
        fsrsState: 'Review',
        lastReviewAt: NOW,
      })
      .run();
    db.update(knowledgeItems).set({ status: 'review' }).where(eq(knowledgeItems.id, hola.id)).run();

    const home = repo.home(NOW);
    expect(home.saved).toEqual([]);
    expect(home.due).toEqual([]);
    expect(home.upcoming.map((entry) => entry.targetText)).toEqual(['Hola']);

    db.update(reviewQueue).set({ due: NOW - 1000 }).where(eq(reviewQueue.itemId, hola.id)).run();
    expect(repo.home(NOW).due.map((entry) => entry.targetText)).toEqual(['Hola']);
    expect(repo.home(NOW).upcoming).toEqual([]);

    db.update(reviewQueue).set({ due: NOW + 8 * DAY }).where(eq(reviewQueue.itemId, hola.id)).run();
    expect(repo.home(NOW).upcoming).toEqual([]);
    expect(repo.home(NOW).due).toEqual([]);

    db.update(knowledgeItems).set({ status: 'mastered', masteredAt: NOW }).where(eq(knowledgeItems.id, hola.id)).run();
    expect(repo.home(NOW).masteredCount).toBe(1);
  });

  it('pauses a phrase and restores the status it had', () => {
    const hola = db.select().from(knowledgeItems).where(eq(knowledgeItems.seedId, 'es-v0-001')).get();
    if (!hola) throw new Error('missing Hola');
    db.update(knowledgeItems).set({ status: 'mastered', masteredAt: NOW }).where(eq(knowledgeItems.id, hola.id)).run();
    const repo = createReviewRepo(db);

    repo.suspend(hola.id, NOW);
    const paused = db.select().from(knowledgeItems).where(eq(knowledgeItems.id, hola.id)).get();
    expect(paused).toMatchObject({ status: 'suspended', statusBeforeSuspend: 'mastered' });
    expect(repo.home(NOW).suspended.map((entry) => entry.targetText)).toEqual(['Hola']);
    expect(repo.home(NOW).masteredCount).toBe(0);

    repo.unsuspend(hola.id, NOW + 1);
    const restored = db.select().from(knowledgeItems).where(eq(knowledgeItems.id, hola.id)).get();
    expect(restored).toMatchObject({ status: 'mastered', statusBeforeSuspend: null });
    expect(repo.home(NOW).suspended).toEqual([]);
    expect(repo.home(NOW).masteredCount).toBe(1);
  });
});
