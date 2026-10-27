/** @jest-environment node */
import { eq, sql } from 'drizzle-orm';

import { textMatch } from '@/domain/scoring/textMatch';
import type { InputMode, PromptType } from '@/domain/types';

import type { AtlasDatabase } from '../client';
import { feedback, knowledgeItems, practiceAttempts, practiceSessions, reviewLogs, reviewQueue, unlockGrants } from '../schema';
import { DEFAULT_COURSE } from '../seed/courses';
import { loadSeed } from '../seed/loadSeed';
import { openTestDatabase } from '../testDatabase';
import { createSettingsRepo } from './settingsRepo';
import { createSessionRepo, OnboardingClosedError, StepIncompleteError } from './sessionRepo';

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
    for (const [index, current] of view.steps.entries()) {
      if (index > 0) answer(repo, started.id, current, view.speechLocale, { transcript: current.targetText });
      status = repo.advance(started.id, NOW + 2);
    }
    expect(status).toBe('completed');
    expect(db.select().from(practiceSessions).all()[0]).toMatchObject({ status: 'completed', cursor: view.steps.length });
    // Both steps of a new item are graded (§5.3), which moves the card out of Learning. Never straight to mastered.
    expect(item(db, 'es-v0-001')).toMatchObject({ status: 'review', masteredAt: null, introducedAt: NOW });
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

  it('earns 15 minutes when an onboarding session has 3 graded attempts', () => {
    const repo = createSessionRepo(db);
    const { id, status } = finishOnboarding(repo);
    expect(status).toBe('completed');
    expect(db.select().from(unlockGrants).all()).toMatchObject([{ sessionId: id, minutes: 15, status: 'earned' }]);
    expect(repo.getPractice(id, NOW, ZONE)?.unlock).toEqual({ kind: 'grant', minutes: 15 });
    expect(item(db, 'es-v0-001')?.status).toBe('review');
  });

  it('does not earn an unlock once today already has 60 minutes', () => {
    db.insert(practiceSessions)
      .values({
        id: 'earlier',
        startedAt: NOW - 1000,
        endedAt: NOW - 1,
        mode: 'daily',
        status: 'completed',
        plannedItemIds: [],
        cursor: 0,
      })
      .run();
    db.insert(unlockGrants)
      .values({
        id: 'earlier-grant',
        sessionId: 'earlier',
        minutes: 60,
        status: 'earned',
        earnedAt: NOW - 1000,
        activatedAt: null,
        expiresAt: null,
        expiresUnusedAt: NOW + 60_000,
        screenTimeApplied: false,
      })
      .run();
    const repo = createSessionRepo(db);
    const { id } = finishOnboarding(repo);
    expect(db.select().from(unlockGrants).all()).toHaveLength(1);
    expect(repo.getPractice(id, NOW, ZONE)?.unlock).toEqual({ kind: 'daily-limit' });
  });

  it('rolls back session completion when the grant insert fails', () => {
    const repo = createSessionRepo(db);
    const started = repo.start('onboarding', NOW, ZONE);
    if (started.kind !== 'started') throw new Error('expected a session');
    const view = repo.getPractice(started.id, NOW, ZONE);
    if (!view) throw new Error('expected a session');
    for (const step of view.steps) answer(repo, started.id, step, view.speechLocale, { transcript: step.targetText });
    for (let i = 0; i < view.steps.length - 1; i += 1) repo.advance(started.id, NOW, ZONE);
    db.run(sql`CREATE TRIGGER fail_grant BEFORE INSERT ON unlock_grants BEGIN SELECT RAISE(ABORT, 'fail'); END`);
    expect(() => repo.advance(started.id, NOW, ZONE)).toThrow(/fail/);
    expect(db.select().from(practiceSessions).all()[0]?.status).toBe('active');
    expect(db.select().from(unlockGrants).all()).toEqual([]);
  });

  describe('unlock integrity (learning-loop §5.4, §8.1)', () => {
    const wrong = { transcript: 'zzz' };

    it('earns no grant for a 1-item session answered only wrong, even with every retry used', () => {
      createSettingsRepo(db).set('dailyNewLimit', 1);
      const repo = createSessionRepo(db);
      // 2 steps x 3 tries = 6 scored attempts, all scoring 0. Only the 2 try-1 attempts are graded.
      const { id, status } = playSession(repo, 'daily', () => [wrong, wrong, wrong]);

      expect(status).toBe('completed');
      expect(db.select().from(practiceAttempts).all()).toHaveLength(6);
      expect(db.select().from(feedback).all().every((row) => row.overall === 0)).toBe(true);
      expect(db.select().from(unlockGrants).all()).toEqual([]);
      expect(repo.getPractice(id, NOW, ZONE)?.unlock).toEqual({ kind: 'not-enough' });
    });

    it('earns no grant for an onboarding session that was only silence', () => {
      const repo = createSessionRepo(db);
      const { id, status } = playSession(repo, 'onboarding', () => [
        { status: 'captured', transcript: null },
        { status: 'captured', transcript: null },
      ]);

      expect(status).toBe('completed');
      expect(db.select().from(practiceAttempts).all()).toHaveLength(12);
      expect(db.select().from(unlockGrants).all()).toEqual([]);
      expect(repo.getPractice(id, NOW, ZONE)?.unlock).toEqual({ kind: 'not-enough' });
    });

    it('earns no grant when every step was skipped', () => {
      const repo = createSessionRepo(db);
      const { id } = playSession(repo, 'onboarding', () => [{ status: 'skipped', transcript: null }]);
      expect(db.select().from(unlockGrants).all()).toEqual([]);
      expect(repo.getPractice(id, NOW, ZONE)?.unlock).toEqual({ kind: 'not-enough' });
    });

    it('needs 3 real graded answers in onboarding: 2 real plus silence is not enough, 3 is', () => {
      const repo = createSessionRepo(db);
      const two = playSession(repo, 'onboarding', (step, index) =>
        index < 2 ? [{ transcript: step.targetText }] : [{ status: 'captured', transcript: null }],
      );
      expect(repo.getPractice(two.id, NOW, ZONE)?.unlock).toEqual({ kind: 'not-enough' });
      expect(db.select().from(unlockGrants).all()).toEqual([]);
    });

    it('earns the grant once the third real answer is there, silent steps notwithstanding', () => {
      const repo = createSessionRepo(db);
      const three = playSession(repo, 'onboarding', (step, index) =>
        index < 3 ? [{ transcript: step.targetText }] : [{ status: 'captured', transcript: null }],
      );
      expect(db.select().from(unlockGrants).all()).toMatchObject([{ sessionId: three.id, minutes: 15 }]);
    });

    it('does not let retries raise the average: a wrong try 1 then a perfect retry stays at 10 minutes', () => {
      const repo = createSessionRepo(db);
      const { id } = playSession(repo, 'onboarding', (step) => [wrong, { transcript: step.targetText }]);
      expect(db.select().from(unlockGrants).all()).toMatchObject([{ sessionId: id, minutes: 10 }]);
    });

    it('does not let a perfect try 1 followed by wrong retries lower the average', () => {
      const repo = createSessionRepo(db);
      const { id } = playSession(repo, 'onboarding', (step) => [{ transcript: step.targetText }, wrong, wrong]);
      expect(db.select().from(unlockGrants).all()).toMatchObject([{ sessionId: id, minutes: 15 }]);
    });

    it('rejects a second onboarding session once the first one is completed', () => {
      const repo = createSessionRepo(db);
      finishOnboarding(repo);
      expect(() => repo.start('onboarding', NOW, ZONE)).toThrow(OnboardingClosedError);
      expect(db.select().from(practiceSessions).all()).toHaveLength(1);
      expect(db.select().from(unlockGrants).all()).toHaveLength(1);
    });

    it('rejects onboarding once the onboardingCompleted setting is true, and still allows daily', () => {
      const repo = createSessionRepo(db);
      createSettingsRepo(db).set('onboardingCompleted', true);
      expect(() => repo.start('onboarding', NOW, ZONE)).toThrow(OnboardingClosedError);
      expect(db.select().from(practiceSessions).all()).toHaveLength(0);
      expect(repo.start('daily', NOW, ZONE).kind).toBe('started');
    });

    it('resumes an in-progress onboarding session and allows a retry after one was abandoned', () => {
      const repo = createSessionRepo(db);
      const first = repo.start('onboarding', NOW, ZONE);
      expect(repo.start('onboarding', NOW, ZONE)).toEqual({ kind: 'resumed', id: first.kind === 'started' ? first.id : '' });
      if (first.kind === 'started') repo.abandon(first.id, NOW);
      expect(repo.start('onboarding', NOW, ZONE).kind).toBe('started');
    });

    it('still counts typed answers, and they cap at Good', () => {
      const repo = createSessionRepo(db);
      const { id } = playSession(repo, 'onboarding', (step) => [{ transcript: step.targetText, inputMode: 'typed' }]);
      expect(db.select().from(unlockGrants).all()).toMatchObject([{ sessionId: id, minutes: 15, status: 'earned' }]);
      expect(Math.max(...db.select().from(reviewLogs).all().map((row) => row.rating))).toBe(3);
    });

    it('earns 10 minutes when the try-1 average is below 80', () => {
      const { id } = playSession(createSessionRepo(db), 'onboarding', (step, index) => [
        index % 2 === 0 ? { transcript: step.targetText } : wrong,
      ]);
      expect(db.select().from(unlockGrants).where(eq(unlockGrants.sessionId, id)).get()).toMatchObject({ minutes: 10 });
    });

    it('earns 15 minutes for a correct daily session (average 80 or more)', () => {
      const repo = createSessionRepo(db);
      const { id } = playSession(repo, 'daily', (step) => [{ transcript: step.targetText }]);
      expect(db.select().from(unlockGrants).where(eq(unlockGrants.sessionId, id)).get()).toMatchObject({ minutes: 15 });
    });

    it('refuses to advance a step with no attempt, or with only failed attempts', () => {
      const repo = createSessionRepo(db);
      const started = repo.start('daily', NOW, ZONE);
      if (started.kind !== 'started') throw new Error('expected a session');
      const view = repo.getPractice(started.id, NOW, ZONE);
      const step = view?.steps[0];
      if (!step || !view) throw new Error('expected a step');

      expect(() => repo.advance(started.id, NOW, ZONE)).toThrow(StepIncompleteError);
      for (let attempt = 0; attempt < 3; attempt += 1) answer(repo, started.id, step, view.speechLocale, { status: 'failed', transcript: null });
      expect(() => repo.advance(started.id, NOW, ZONE)).toThrow(StepIncompleteError);
      expect(repo.getPractice(started.id, NOW, ZONE)?.session.cursor).toBe(0);

      answer(repo, started.id, step, view.speechLocale, { transcript: step.targetText });
      expect(repo.advance(started.id, NOW, ZONE)).toBe('active');
      expect(repo.getPractice(started.id, NOW, ZONE)?.session.cursor).toBe(1);
    });

    it('lets an explicit skip advance a step, and refuses the last step too until it is complete', () => {
      createSettingsRepo(db).set('dailyNewLimit', 1);
      const repo = createSessionRepo(db);
      const started = repo.start('daily', NOW, ZONE);
      if (started.kind !== 'started') throw new Error('expected a session');
      const view = repo.getPractice(started.id, NOW, ZONE);
      if (!view || view.steps.length !== 2) throw new Error('expected two steps');

      answer(repo, started.id, view.steps[0]!, view.speechLocale, { status: 'skipped', transcript: null });
      expect(repo.advance(started.id, NOW, ZONE)).toBe('active');
      expect(() => repo.advance(started.id, NOW, ZONE)).toThrow(StepIncompleteError);
      expect(repo.getPractice(started.id, NOW, ZONE)?.session.status).toBe('active');
      answer(repo, started.id, view.steps[1]!, view.speechLocale, { status: 'skipped', transcript: null });
      expect(repo.advance(started.id, NOW, ZONE)).toBe('completed');
      expect(db.select().from(unlockGrants).all()).toEqual([]);
    });

    it('ignores a repeated skip, a 4th answer, and any write after a skip', () => {
      const repo = createSessionRepo(db);
      const started = repo.start('daily', NOW, ZONE);
      if (started.kind !== 'started') throw new Error('expected a session');
      const view = repo.getPractice(started.id, NOW, ZONE);
      const step = view?.steps[0];
      const other = view?.steps[1];
      if (!step || !other || !view) throw new Error('expected steps');

      const results = [1, 2, 3, 4, 5].map(() => answer(repo, started.id, step, view.speechLocale, { transcript: 'zzz' }));
      expect(results).toEqual(['recorded', 'recorded', 'recorded', 'ignored', 'ignored']);

      expect(answer(repo, started.id, other, view.speechLocale, { status: 'skipped', transcript: null })).toBe('recorded');
      expect(answer(repo, started.id, other, view.speechLocale, { status: 'skipped', transcript: null })).toBe('ignored');
      expect(answer(repo, started.id, other, view.speechLocale, { transcript: 'zzz' })).toBe('ignored');
      expect(db.select().from(practiceAttempts).all()).toHaveLength(4);
      expect(db.select().from(reviewLogs).all()).toHaveLength(2);
    });

    it('refuses to record into a session that is not active', () => {
      const repo = createSessionRepo(db);
      const started = repo.start('daily', NOW, ZONE);
      if (started.kind !== 'started') throw new Error('expected a session');
      const view = repo.getPractice(started.id, NOW, ZONE);
      const step = view?.steps[0];
      if (!step || !view) throw new Error('expected a step');
      repo.abandon(started.id, NOW);
      expect(() => answer(repo, started.id, step, view.speechLocale, { transcript: 'Hola' })).toThrow(/not active/);
    });
  });
});

type Repo = ReturnType<typeof createSessionRepo>;
type AnswerInput = Parameters<typeof answer>[4];

/**
 * Plays a whole session. `plan` answers each step in order (a list of attempts per step, so retries are possible),
 * then advances it. Returns the final advance status.
 */
function playSession(repo: Repo, mode: 'onboarding' | 'daily', plan: (step: { targetText: string }, index: number) => AnswerInput[]) {
  const started = repo.start(mode, NOW, ZONE);
  if (started.kind !== 'started') throw new Error('expected a session');
  const view = repo.getPractice(started.id, NOW, ZONE);
  if (!view) throw new Error('expected a session');
  let status: 'active' | 'completed' = 'active';
  for (const [index, step] of view.steps.entries()) {
    for (const input of plan(step, index)) answer(repo, started.id, step, view.speechLocale, input);
    status = repo.advance(started.id, NOW, ZONE);
  }
  return { id: started.id, status, steps: view.steps };
}

function finishOnboarding(repo: Repo) {
  return playSession(repo, 'onboarding', (step) => [{ transcript: step.targetText }]);
}

function answer(
  repo: ReturnType<typeof createSessionRepo>,
  sessionId: string,
  step: { itemId: string; promptType: PromptType; targetText: string; variants: string[]; reading: string | null; romanization: string | null },
  locale: string,
  input: { transcript: string | null; status?: 'scored' | 'failed' | 'skipped' | 'captured'; inputMode?: InputMode },
) {
  const status = input.status ?? 'scored';
  const mode: InputMode = input.inputMode ?? 'speech';
  return repo.recordAttempt({
    sessionId,
    itemId: step.itemId,
    promptType: step.promptType,
    inputMode: mode,
    status,
    transcript: input.transcript,
    error: status === 'failed' ? 'interrupted' : status === 'captured' ? 'noSpeech' : null,
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
