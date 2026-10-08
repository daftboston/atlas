/** @jest-environment node */
import { eq, sql } from 'drizzle-orm';

import { textMatch } from '@/domain/scoring/textMatch';
import type { InputMode, PromptType } from '@/domain/types';

import type { AtlasDatabase } from '../client';
import { feedback, knowledgeItems, practiceAttempts, practiceSessions, reviewLogs, reviewQueue } from '../schema';
import { DEFAULT_COURSE } from '../seed/courses';
import { loadSeed } from '../seed/loadSeed';
import { openTestDatabase } from '../testDatabase';
import { createSettingsRepo } from './settingsRepo';
import { createSessionRepo } from './sessionRepo';

let mockIdCounter = 0;
jest.mock('@/lib/id', () => ({ newId: () => `id-${++mockIdCounter}` }));

const NOW = Date.parse('2026-10-07T15:00:00.000Z');
const ZONE = 'America/Bogota';
const COURSE_ID = 'en-es-v0';

function item(db: AtlasDatabase, seedId: string) {
  return db.select().from(knowledgeItems).where(eq(knowledgeItems.seedId, seedId)).get();
}

describe('session repository', () => {
  let db: AtlasDatabase;

  beforeEach(async () => {
    mockIdCounter = 0;
    db = await openTestDatabase();
    loadSeed(db, DEFAULT_COURSE, NOW);
    createSettingsRepo(db).set('activeCourseId', COURSE_ID);
  });

  it('starts five new items in seed order and does not master them', () => {
    const repo = createSessionRepo(db);
    const started = repo.start('daily', NOW, ZONE);

    expect(started.kind).toBe('started');
    if (started.kind !== 'started') return;
    const view = repo.getPractice(started.id);
    expect(view?.session.plannedItemIds).toHaveLength(5);
    expect(view?.steps.map((step) => step.promptType)).toEqual([
      'listen-repeat',
      'listen-repeat',
      'listen-repeat',
      'listen-repeat',
      'listen-repeat',
      'recall-speak',
      'recall-speak',
      'recall-speak',
      'recall-speak',
      'recall-speak',
    ]);
    expect(view?.steps[0]).toMatchObject({ targetText: 'Hola', meaning: 'Hello' });

    const hola = item(db, 'es-v0-001');
    expect(hola).toMatchObject({ status: 'new', introducedAt: null, masteredAt: null });
    expect(repo.home(NOW, ZONE)).toMatchObject({ activeSessionId: started.id, caughtUp: false, newRemaining: 5 });
    expect(repo.start('daily', NOW, ZONE)).toEqual({ kind: 'resumed', id: started.id });
  });

  it('abandons a session older than 2 hours and introduces the next items', () => {
    const repo = createSessionRepo(db);
    const first = repo.start('daily', NOW, ZONE);
    if (first.kind !== 'started') throw new Error('expected a session');
    const later = Date.parse('2026-10-08T15:00:00.000Z');

    expect(repo.touch(first.id, later)?.session.status).toBe('abandoned');
    const second = repo.start('daily', later, ZONE);

    expect(repo.getPractice(first.id)?.session.status).toBe('abandoned');
    expect(second.kind).toBe('started');
    if (second.kind !== 'started') return;
    expect(repo.getPractice(second.id)?.steps[0]?.targetText).toBe('Hola');
    expect(item(db, 'es-v0-001')?.masteredAt).toBeNull();
  });

  it('rolls back the attempt when saving feedback fails', () => {
    const repo = createSessionRepo(db);
    const started = repo.start('daily', NOW, ZONE);
    if (started.kind !== 'started') throw new Error('expected a session');
    const view = repo.getPractice(started.id);
    const step = view?.steps[0];
    if (!step) throw new Error('expected a step');
    db.run(sql`CREATE TRIGGER fail_feedback BEFORE INSERT ON feedback BEGIN SELECT RAISE(ABORT, 'fail'); END`);

    expect(() =>
      repo.recordAttempt({
        sessionId: started.id,
        itemId: step.itemId,
        promptType: step.promptType,
        inputMode: 'typed',
        status: 'scored',
        transcript: 'Hola',
        error: null,
        startedAt: NOW,
        endedAt: NOW + 1,
        hint: null,
        score: textMatch({
          target: step.targetText,
          variants: step.variants,
          transcript: 'Hola',
          locale: view?.speechLocale ?? '',
          reading: step.reading,
          romanization: step.romanization,
        }),
      }),
    ).toThrow(/fail/);

    expect(db.select().from(practiceAttempts).all()).toEqual([]);
    expect(db.select().from(feedback).all()).toEqual([]);
    expect(db.select().from(reviewQueue).all()).toEqual([]);
    expect(db.select().from(reviewLogs).all()).toEqual([]);
    expect(item(db, 'es-v0-001')?.introducedAt).toBeNull();
  });

  it('keeps a scored attempt and finishes the session without mastering the item', () => {
    const repo = createSessionRepo(db);
    const started = repo.start('daily', NOW, ZONE);
    if (started.kind !== 'started') throw new Error('expected a session');
    const view = repo.getPractice(started.id);
    const step = view?.steps[0];
    if (!step || !view) throw new Error('expected a step');

    repo.recordAttempt({
      sessionId: started.id,
      itemId: step.itemId,
      promptType: step.promptType,
      inputMode: 'speech',
      status: 'scored',
      transcript: 'Hola',
      error: null,
      startedAt: NOW,
      endedAt: NOW + 1,
      hint: null,
      score: textMatch({
        target: step.targetText,
        variants: step.variants,
        transcript: 'Hola',
        locale: view.speechLocale,
        reading: step.reading,
        romanization: step.romanization,
      }),
    });

    expect(db.select().from(practiceAttempts).all()).toMatchObject([{ status: 'scored', graded: true, tryNumber: 1 }]);
    expect(db.select().from(feedback).all()).toMatchObject([{ overall: 100, rating: 3 }]);
    expect(db.select().from(reviewLogs).all()).toHaveLength(1);
    expect(db.select().from(reviewQueue).all()[0]).toMatchObject({ fsrsState: 'Learning' });

    let status: 'active' | 'completed' = 'active';
    for (let i = 0; i < view.steps.length; i += 1) status = repo.advance(started.id, NOW + 2);
    expect(status).toBe('completed');
    expect(db.select().from(practiceSessions).all()[0]).toMatchObject({ status: 'completed', cursor: view.steps.length });
    expect(item(db, 'es-v0-001')).toMatchObject({ status: 'learning', masteredAt: null, introducedAt: NOW });
  });

  it('writes two review logs for a new item and none for a retry', () => {
    createSettingsRepo(db).set('dailyNewLimit', 1);
    const repo = createSessionRepo(db);
    const started = repo.start('daily', NOW, ZONE);
    if (started.kind !== 'started') throw new Error('expected a session');
    const view = repo.getPractice(started.id);
    const listen = view?.steps[0];
    const recall = view?.steps[1];
    if (!listen || !recall || !view) throw new Error('expected two steps');

    answer(repo, started.id, listen, view.speechLocale, { transcript: 'Hola' });
    answer(repo, started.id, recall, view.speechLocale, { transcript: 'Hola' });
    answer(repo, started.id, recall, view.speechLocale, { transcript: 'Hola' });

    const attempts = db.select().from(practiceAttempts).all();
    expect(attempts.map((row) => ({ prompt: row.promptType, tryNumber: row.tryNumber, graded: row.graded }))).toEqual([
      { prompt: 'listen-repeat', tryNumber: 1, graded: true },
      { prompt: 'recall-speak', tryNumber: 1, graded: true },
      { prompt: 'recall-speak', tryNumber: 2, graded: false },
    ]);
    expect(db.select().from(reviewLogs).all()).toHaveLength(2);
    expect(db.select().from(feedback).all().map((row) => row.rating)).toEqual([3, 4, null]);
    expect(item(db, 'es-v0-001')).toMatchObject({ status: 'review', masteredAt: null });
    expect(db.select().from(reviewQueue).all()[0]?.fsrsState).toBe('Review');
  });

  it('lets a failed listen stay try 1 and does not introduce the item', () => {
    const repo = createSessionRepo(db);
    const started = repo.start('daily', NOW, ZONE);
    if (started.kind !== 'started') throw new Error('expected a session');
    const view = repo.getPractice(started.id);
    const step = view?.steps[0];
    if (!step || !view) throw new Error('expected a step');

    answer(repo, started.id, step, view.speechLocale, { status: 'failed', transcript: null });
    expect(item(db, 'es-v0-001')?.introducedAt).toBeNull();
    expect(db.select().from(reviewLogs).all()).toEqual([]);

    answer(repo, started.id, step, view.speechLocale, { transcript: 'Hola' });
    expect(db.select().from(practiceAttempts).all().map((row) => row.tryNumber)).toEqual([0, 1]);
    expect(db.select().from(reviewLogs).all()).toHaveLength(1);
    expect(item(db, 'es-v0-001')?.introducedAt).toBe(NOW);
  });

  it('masters a stable review and leaves masteredAt when the next grade is Again', () => {
    const hola = item(db, 'es-v0-001');
    if (!hola) throw new Error('missing Hola');
    db.update(knowledgeItems)
      .set({ status: 'review', introducedAt: NOW - 86_400_000, updatedAt: NOW })
      .where(eq(knowledgeItems.id, hola.id))
      .run();
    db.insert(reviewQueue)
      .values({
        itemId: hola.id,
        due: NOW - 1000,
        stability: 80,
        difficulty: 5,
        elapsedDays: 40,
        scheduledDays: 40,
        learningSteps: 0,
        reps: 8,
        lapses: 1,
        fsrsState: 'Review',
        lastReviewAt: NOW - 40 * 86_400_000,
      })
      .run();

    const repo = createSessionRepo(db);
    const started = repo.start('review-only', NOW, ZONE);
    if (started.kind !== 'started') throw new Error('expected a review session');
    const view = repo.getPractice(started.id);
    expect(view?.steps).toEqual([expect.objectContaining({ itemId: hola.id, promptType: 'recall-speak' })]);
    const step = view?.steps[0];
    if (!step || !view) throw new Error('expected a step');

    answer(repo, started.id, step, view.speechLocale, { transcript: 'Hola' });
    const mastered = item(db, 'es-v0-001');
    expect(mastered?.status).toBe('mastered');
    expect(mastered?.masteredAt).toBe(NOW + 1);
    expect(db.select().from(reviewLogs).all()).toHaveLength(1);
  });

  it('keeps masteredAt when Again sends a mastered card back to relearning', () => {
    const hola = item(db, 'es-v0-001');
    if (!hola) throw new Error('missing Hola');
    db.update(knowledgeItems)
      .set({ status: 'mastered', introducedAt: NOW - 86_400_000, masteredAt: NOW - 1000, updatedAt: NOW })
      .where(eq(knowledgeItems.id, hola.id))
      .run();
    db.insert(reviewQueue)
      .values({
        itemId: hola.id,
        due: NOW - 1000,
        stability: 80,
        difficulty: 5,
        elapsedDays: 40,
        scheduledDays: 40,
        learningSteps: 0,
        reps: 8,
        lapses: 1,
        fsrsState: 'Review',
        lastReviewAt: NOW - 40 * 86_400_000,
      })
      .run();

    const repo = createSessionRepo(db);
    const started = repo.start('review-only', NOW, ZONE);
    if (started.kind !== 'started') throw new Error('expected a review session');
    const view = repo.getPractice(started.id);
    const step = view?.steps[0];
    if (!step || !view) throw new Error('expected a step');
    answer(repo, started.id, step, view.speechLocale, { status: 'skipped', transcript: null });
    expect(item(db, 'es-v0-001')).toMatchObject({ status: 'relearning', masteredAt: NOW - 1000 });
    expect(db.select().from(reviewLogs).all()).toMatchObject([{ rating: 1 }]);
  });

  it('does not master a review with more than 3 lapses', () => {
    const hola = item(db, 'es-v0-001');
    if (!hola) throw new Error('missing Hola');
    db.update(knowledgeItems)
      .set({ status: 'review', introducedAt: NOW - 86_400_000, updatedAt: NOW })
      .where(eq(knowledgeItems.id, hola.id))
      .run();
    db.insert(reviewQueue)
      .values({
        itemId: hola.id,
        due: NOW - 1000,
        stability: 80,
        difficulty: 5,
        elapsedDays: 40,
        scheduledDays: 40,
        learningSteps: 0,
        reps: 8,
        lapses: 4,
        fsrsState: 'Review',
        lastReviewAt: NOW - 40 * 86_400_000,
      })
      .run();

    const repo = createSessionRepo(db);
    const started = repo.start('review-only', NOW, ZONE);
    if (started.kind !== 'started') throw new Error('expected a review session');
    const view = repo.getPractice(started.id);
    const step = view?.steps[0];
    if (!step || !view) throw new Error('expected a step');
    answer(repo, started.id, step, view.speechLocale, { transcript: 'Hola' });
    expect(item(db, 'es-v0-001')?.status).not.toBe('mastered');
  });
});

function answer(
  repo: ReturnType<typeof createSessionRepo>,
  sessionId: string,
  step: { itemId: string; promptType: PromptType; targetText: string; variants: string[]; reading: string | null; romanization: string | null },
  locale: string,
  input: { transcript: string | null; status?: 'scored' | 'failed' | 'skipped' },
) {
  const status = input.status ?? 'scored';
  const mode: InputMode = 'speech';
  repo.recordAttempt({
    sessionId,
    itemId: step.itemId,
    promptType: step.promptType,
    inputMode: mode,
    status,
    transcript: input.transcript,
    error: status === 'failed' ? 'interrupted' : null,
    startedAt: NOW,
    endedAt: NOW + 1,
    hint: null,
    score:
      status === 'scored' && input.transcript
        ? textMatch({
            target: step.targetText,
            variants: step.variants,
            transcript: input.transcript,
            locale,
            reading: step.reading,
            romanization: step.romanization,
          })
        : null,
  });
}
