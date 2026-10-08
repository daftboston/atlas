/** @jest-environment node */
import { eq, sql } from 'drizzle-orm';

import { textMatch } from '@/domain/scoring/textMatch';

import type { AtlasDatabase } from '../client';
import { feedback, knowledgeItems, practiceAttempts, practiceSessions } from '../schema';
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

    expect(db.select().from(practiceAttempts).all()).toMatchObject([{ status: 'scored', graded: false, tryNumber: 1 }]);
    expect(db.select().from(feedback).all()).toMatchObject([{ overall: 100, rating: null }]);

    let status: 'active' | 'completed' = 'active';
    for (let i = 0; i < view.steps.length; i += 1) status = repo.advance(started.id, NOW + 2);
    expect(status).toBe('completed');
    expect(db.select().from(practiceSessions).all()[0]).toMatchObject({ status: 'completed', cursor: view.steps.length });
    expect(item(db, 'es-v0-001')).toMatchObject({ status: 'new', masteredAt: null, introducedAt: NOW });
  });
});
