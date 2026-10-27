import { and, eq, inArray, isNull, lte, sql } from 'drizzle-orm';

import { DAILY_NEW_LIMIT, DEFAULT_DESIRED_RETENTION, MAX_TRIES_PER_STEP, ONBOARDING_ITEM_COUNT, SESSION_SIZE } from '@/domain/config';
import { decideUnlock, type UnlockDecision } from '@/domain/unlock/unlockRules';
import { itemStatusAfterGrade } from '@/domain/memory/promotion';
import { gradeAttempt } from '@/domain/scheduler/grading';
import { initCard, retrievability, schedule, type QueueCard } from '@/domain/scheduler/fsrs';
import { buildSession, dailyNewRemaining, sessionSteps, type SessionStep } from '@/domain/session/buildSession';
import { isSessionStale } from '@/domain/session/sessionRules';
import type { TextMatchResult } from '@/domain/scoring/types';
import type {
  AttemptFeedback,
  FsrsStateName,
  InputMode,
  PracticeAttempt,
  PracticeSession,
  PromptType,
  SessionMode,
} from '@/domain/types';
import { newId } from '@/lib/id';
import { deviceTimeZone, localDayStartMs, nextRolloverMs } from '@/lib/time';

import type { AtlasDatabase } from '../client';
import { courses, feedback, knowledgeItems, practiceAttempts, practiceSessions, reviewLogs, reviewQueue, unlockGrants } from '../schema';
import { createSettingsRepo } from './settingsRepo';

export type StepView = SessionStep & {
  targetText: string;
  meaning: string;
  variants: string[];
  reading: string | null;
  romanization: string | null;
  notes: string | null;
};

export type PracticeView = {
  session: PracticeSession;
  steps: StepView[];
  speechLocale: string;
  attempts: PracticeAttempt[];
  feedback: AttemptFeedback[];
  masteredCount: number;
  unlock: UnlockDecision | { kind: 'not-earned' };
};

export type SessionHome = {
  activeSessionId: string | null;
  newRemaining: number;
  dueCount: number;
  caughtUp: boolean;
};

export type StartResult = { kind: 'started' | 'resumed'; id: string } | { kind: 'caught-up' };

export type RecordAttemptInput = {
  sessionId: string;
  itemId: string;
  promptType: PromptType;
  inputMode: InputMode;
  status: 'scored' | 'failed' | 'skipped' | 'captured';
  transcript: string | null;
  error: string | null;
  startedAt: number;
  endedAt: number;
  score: TextMatchResult | null;
  hint: string | null;
};

/** `ignored` means the step was already answered to its limit or skipped, so nothing was written. */
export type RecordResult = 'recorded' | 'ignored';

/** `advance()` was called on a step with no graded attempt and no skip (learning-loop §5.4). */
export class StepIncompleteError extends Error {
  constructor(sessionId: string) {
    super(`Session ${sessionId}: the current step needs a graded answer or a skip before it can advance`);
    this.name = 'StepIncompleteError';
  }
}

/** The session is not active (abandoned, finished, unknown, or older than 2 hours). Callers reload and show its state. */
export class SessionNotActiveError extends Error {
  constructor(sessionId: string) {
    super(`Session ${sessionId} is not active`);
    this.name = 'SessionNotActiveError';
  }
}

/** `start('onboarding')` after onboarding is completed, or when a completed onboarding session already exists. */
export class OnboardingClosedError extends Error {
  constructor() {
    super('Onboarding has already been completed');
    this.name = 'OnboardingClosedError';
  }
}

export type SessionRepository = ReturnType<typeof createSessionRepo>;

type AttemptRow = typeof practiceAttempts.$inferSelect;
type FeedbackRow = typeof feedback.$inferSelect;

export function createSessionRepo(db: AtlasDatabase) {
  function sessionRow(id: string) {
    return db.select().from(practiceSessions).where(eq(practiceSessions.id, id)).get() ?? null;
  }

  function dueCandidates(now: number) {
    const retention = createSettingsRepo(db).get('desiredRetention') ?? DEFAULT_DESIRED_RETENTION;
    return db
      .select({
        due: reviewQueue.due,
        stability: reviewQueue.stability,
        difficulty: reviewQueue.difficulty,
        elapsedDays: reviewQueue.elapsedDays,
        scheduledDays: reviewQueue.scheduledDays,
        learningSteps: reviewQueue.learningSteps,
        reps: reviewQueue.reps,
        lapses: reviewQueue.lapses,
        fsrsState: reviewQueue.fsrsState,
        lastReviewAt: reviewQueue.lastReviewAt,
        itemId: reviewQueue.itemId,
      })
      .from(reviewQueue)
      .innerJoin(knowledgeItems, eq(knowledgeItems.id, reviewQueue.itemId))
      .where(and(lte(reviewQueue.due, now), sql`${knowledgeItems.status} NOT IN ('new', 'suspended')`))
      .all()
      .map((row) => ({
        itemId: row.itemId,
        retrievability: retrievability(toCard(row), now, retention),
      }));
  }

  function activeSession(): PracticeSession | null {
    return db.select().from(practiceSessions).where(eq(practiceSessions.status, 'active')).get() ?? null;
  }

  function onboardingFinished(): boolean {
    return !!db
      .select({ id: practiceSessions.id })
      .from(practiceSessions)
      .where(and(eq(practiceSessions.mode, 'onboarding'), eq(practiceSessions.status, 'completed')))
      .get();
  }

  /**
   * Learning-loop §5.4 (the 2-hour rule): an active session past SESSION_STALE_MS is marked abandoned, so it earns
   * nothing, and the caller gets SessionNotActiveError. Kept outside any transaction so the abandon is not rolled back.
   */
  function requireActive(sessionId: string, now: number) {
    const session = sessionRow(sessionId);
    if (!session || session.status !== 'active') throw new SessionNotActiveError(sessionId);
    if (isSessionStale(session.startedAt, now)) {
      db.update(practiceSessions)
        .set({ status: 'abandoned', endedAt: now })
        .where(and(eq(practiceSessions.id, sessionId), eq(practiceSessions.status, 'active')))
        .run();
      throw new SessionNotActiveError(sessionId);
    }
    return session;
  }

  function courseItems(courseId: string) {
    return db
      .select({
        id: knowledgeItems.id,
        seedId: knowledgeItems.seedId,
        status: knowledgeItems.status,
        introducedAt: knowledgeItems.introducedAt,
      })
      .from(knowledgeItems)
      .where(eq(knowledgeItems.courseId, courseId))
      .all();
  }

  function limits(courseId: string | null, now: number, timeZone: string, mode: SessionMode) {
    const settings = createSettingsRepo(db);
    const items = courseId ? courseItems(courseId) : [];
    return {
      now,
      timeZone,
      mode,
      dailyNewLimit: settings.get('dailyNewLimit') ?? DAILY_NEW_LIMIT,
      sessionSize: settings.get('sessionSize') ?? SESSION_SIZE,
      onboardingItemCount: ONBOARDING_ITEM_COUNT,
      items,
      due: dueCandidates(now),
    };
  }

  return {
    abandonStale(now: number) {
      const active = db.select().from(practiceSessions).where(eq(practiceSessions.status, 'active')).all();
      for (const session of active) {
        if (!isSessionStale(session.startedAt, now)) continue;
        db.update(practiceSessions)
          .set({ status: 'abandoned', endedAt: now })
          .where(eq(practiceSessions.id, session.id))
          .run();
      }
    },

    home(now: number, timeZone: string): SessionHome {
      this.abandonStale(now);
      const active = activeSession();
      const courseId = createSettingsRepo(db).get('activeCourseId');
      const planInput = limits(courseId, now, timeZone, 'daily');
      const remaining = dailyNewRemaining(planInput);
      const dueCount = planInput.due.length;
      return {
        activeSessionId: active?.id ?? null,
        newRemaining: remaining,
        dueCount,
        caughtUp: active === null && remaining === 0 && dueCount === 0,
      };
    },

    start(mode: SessionMode, now: number, timeZone: string): StartResult {
      if (mode === 'onboarding' && (createSettingsRepo(db).get('onboardingCompleted') === true || onboardingFinished())) {
        throw new OnboardingClosedError();
      }
      this.abandonStale(now);
      const active = activeSession();
      if (active) return { kind: 'resumed', id: active.id };

      const courseId = createSettingsRepo(db).get('activeCourseId');
      const plan = courseId ? buildSession(limits(courseId, now, timeZone, mode)) : null;
      if (!plan) return { kind: 'caught-up' };

      const id = newId();
      db.insert(practiceSessions)
        .values({
          id,
          startedAt: now,
          endedAt: null,
          mode: plan.mode,
          status: 'active',
          plannedItemIds: plan.itemIds,
          plannedSteps: plan.steps,
          cursor: 0,
        })
        .run();
      return { kind: 'started', id };
    },

    /** Resume check: a stale active session is abandoned, then the saved view is returned. */
    touch(sessionId: string, now: number): PracticeView | null {
      const existing = sessionRow(sessionId);
      if (existing?.status === 'active' && isSessionStale(existing.startedAt, now)) this.abandon(sessionId, now);
      return this.getPractice(sessionId, now);
    },

    getPractice(sessionId: string, now = Date.now(), timeZone = deviceTimeZone()): PracticeView | null {
      const session = sessionRow(sessionId);
      if (!session) return null;

      const rows = db
        .select({
          id: knowledgeItems.id,
          targetText: knowledgeItems.targetText,
          meaning: knowledgeItems.meaning,
          variants: knowledgeItems.variants,
          reading: knowledgeItems.reading,
          romanization: knowledgeItems.romanization,
          notes: knowledgeItems.notes,
          status: knowledgeItems.status,
          speechLocale: courses.speechLocale,
        })
        .from(knowledgeItems)
        .innerJoin(courses, eq(courses.id, knowledgeItems.courseId))
        .where(inArray(knowledgeItems.id, session.plannedItemIds))
        .all();
      const byId = new Map(rows.map((row) => [row.id, row]));
      const steps: StepView[] = sessionSteps(session.plannedItemIds, session.plannedSteps).map((step) => {
        const item = byId.get(step.itemId);
        if (!item) throw new Error(`Session item ${step.itemId} is missing`);
        return {
          itemId: step.itemId,
          promptType: step.promptType,
          targetText: item.targetText,
          meaning: item.meaning,
          variants: item.variants,
          reading: item.reading,
          romanization: item.romanization,
          notes: item.notes,
        };
      });
      const speechLocale = rows[0]?.speechLocale;
      if (!speechLocale) throw new Error(`Session ${sessionId} has no speech locale`);

      const attempts = db
        .select()
        .from(practiceAttempts)
        .where(eq(practiceAttempts.sessionId, sessionId))
        .all()
        .map(toAttempt);
      const attemptIds = attempts.map((attempt) => attempt.id);
      const feedbackRows =
        attemptIds.length === 0
          ? []
          : db.select().from(feedback).where(inArray(feedback.attemptId, attemptIds)).all();

      return {
        session,
        steps,
        speechLocale,
        attempts,
        feedback: feedbackRows.map(toFeedback),
        masteredCount: rows.filter((row) => row.status === 'mastered').length,
        unlock: unlockFor(db, session, now, timeZone),
      };
    },

    /**
     * Attempt, feedback, and a try-1 grade commit together. A failure while
     * writing feedback leaves no attempt and no card.
     */
    recordAttempt(input: RecordAttemptInput): RecordResult {
      // The attempt's own end time is the clock, so a session left open for 2 hours cannot be finished late.
      requireActive(input.sessionId, input.endedAt);
      const retention = createSettingsRepo(db).get('desiredRetention') ?? DEFAULT_DESIRED_RETENTION;
      return db.transaction((tx): RecordResult => {
        const owner = tx.select().from(practiceSessions).where(eq(practiceSessions.id, input.sessionId)).get();
        if (!owner || owner.status !== 'active') throw new SessionNotActiveError(input.sessionId);
        const prior = tx
          .select({ status: practiceAttempts.status })
          .from(practiceAttempts)
          .where(
            and(
              eq(practiceAttempts.sessionId, input.sessionId),
              eq(practiceAttempts.itemId, input.itemId),
              eq(practiceAttempts.promptType, input.promptType),
            ),
          )
          .all();
        const nonFailed = prior.filter((row) => row.status !== 'failed').length;
        // Idempotent against a repeated tap: a skipped step or a step at its try limit takes no more attempts.
        if (input.status !== 'failed' && (prior.some((row) => row.status === 'skipped') || nonFailed >= MAX_TRIES_PER_STEP)) {
          return 'ignored';
        }
        const tryNumber = input.status === 'failed' ? 0 : nonFailed + 1;
        const attemptId = newId();
        tx.insert(practiceAttempts)
          .values({
            id: attemptId,
            sessionId: input.sessionId,
            itemId: input.itemId,
            promptType: input.promptType,
            inputMode: input.inputMode,
            tryNumber,
            status: input.status,
            transcript: input.transcript,
            durationMs: null,
            error: input.error,
            graded: false,
            startedAt: input.startedAt,
            endedAt: input.endedAt,
          })
          .run();
        if (input.status !== 'failed') {
          tx.update(knowledgeItems)
            .set({ introducedAt: input.startedAt, updatedAt: input.startedAt })
            .where(and(eq(knowledgeItems.id, input.itemId), isNull(knowledgeItems.introducedAt)))
            .run();
        }
        const rating = gradeAttempt({
          status: input.status,
          promptType: input.promptType,
          inputMode: input.inputMode,
          tryNumber,
          overall: input.score?.overall ?? null,
        });
        if (rating !== null) {
          const item = tx.select().from(knowledgeItems).where(eq(knowledgeItems.id, input.itemId)).get();
          if (!item) throw new Error(`Item ${input.itemId} is missing`);
          const existing = tx.select().from(reviewQueue).where(eq(reviewQueue.itemId, input.itemId)).get();
          const before = existing ? toCard(existing) : initCard(input.startedAt);
          const scheduled = schedule(before, rating, input.endedAt, retention);
          const nextStatus = itemStatusAfterGrade({
            status: item.status,
            fsrsState: scheduled.card.state,
            rating,
            stabilityDays: scheduled.card.stability,
            lapses: scheduled.card.lapses,
          });
          tx.insert(reviewQueue)
            .values({
              itemId: input.itemId,
              due: scheduled.card.due,
              stability: scheduled.card.stability,
              difficulty: scheduled.card.difficulty,
              elapsedDays: scheduled.card.elapsedDays,
              scheduledDays: scheduled.card.scheduledDays,
              learningSteps: scheduled.card.learningSteps,
              reps: scheduled.card.reps,
              lapses: scheduled.card.lapses,
              fsrsState: scheduled.card.state,
              lastReviewAt: scheduled.card.lastReviewAt,
            })
            .onConflictDoUpdate({
              target: reviewQueue.itemId,
              set: {
                due: scheduled.card.due,
                stability: scheduled.card.stability,
                difficulty: scheduled.card.difficulty,
                elapsedDays: scheduled.card.elapsedDays,
                scheduledDays: scheduled.card.scheduledDays,
                learningSteps: scheduled.card.learningSteps,
                reps: scheduled.card.reps,
                lapses: scheduled.card.lapses,
                fsrsState: scheduled.card.state,
                lastReviewAt: scheduled.card.lastReviewAt,
              },
            })
            .run();
          tx.insert(reviewLogs)
            .values({
              id: newId(),
              itemId: input.itemId,
              attemptId,
              rating,
              fsrsStateBefore: scheduled.log.stateBefore,
              dueBefore: scheduled.log.dueBefore,
              stabilityBefore: scheduled.log.stabilityBefore,
              difficultyBefore: scheduled.log.difficultyBefore,
              elapsedDays: scheduled.log.elapsedDays,
              scheduledDays: scheduled.log.scheduledDays,
              reviewedAt: scheduled.log.reviewedAt,
            })
            .run();
          tx.update(knowledgeItems)
            .set({
              status: nextStatus,
              masteredAt: nextStatus === 'mastered' && item.status !== 'mastered' ? input.endedAt : item.masteredAt,
              updatedAt: input.endedAt,
            })
            .where(eq(knowledgeItems.id, input.itemId))
            .run();
          tx.update(practiceAttempts).set({ graded: true }).where(eq(practiceAttempts.id, attemptId)).run();
        }
        if (!input.score) return 'recorded';
        tx.insert(feedback)
          .values({
            id: newId(),
            attemptId,
            overall: input.score.overall,
            accuracy: input.score.accuracy,
            pronunciation: input.score.pronunciation,
            wordsJson: input.score.words,
            method: input.score.method,
            matchedText: input.score.matchedText,
            accentHintsJson: input.score.accentHints,
            rating,
            hintKey: input.hint,
            createdAt: input.endedAt,
          })
          .run();
        return 'recorded';
      });
    },

    advance(sessionId: string, now: number, timeZone = deviceTimeZone()): 'active' | 'completed' {
      const session = requireActive(sessionId, now);
      const current = sessionSteps(session.plannedItemIds, session.plannedSteps)[session.cursor];
      if (!current || !stepComplete(db, sessionId, current)) throw new StepIncompleteError(sessionId);
      const next = session.cursor + 1;
      const done = next >= sessionSteps(session.plannedItemIds, session.plannedSteps).length;
      if (!done) {
        db.update(practiceSessions).set({ cursor: next }).where(eq(practiceSessions.id, sessionId)).run();
        return 'active';
      }
      db.transaction((tx) => {
        tx.update(practiceSessions)
          .set({ cursor: next, status: 'completed', endedAt: now })
          .where(eq(practiceSessions.id, sessionId))
          .run();
        const stats = gradedStats(tx, sessionId);
        const decision = decideUnlock({
          mode: session.mode,
          gradedCount: stats.gradedCount,
          overalls: stats.overalls,
          minutesAlreadyToday: minutesToday(tx, now, timeZone, sessionId),
        });
        if (decision.kind !== 'grant') return;
        tx.insert(unlockGrants)
          .values({
            id: newId(),
            sessionId,
            minutes: decision.minutes,
            status: 'earned',
            earnedAt: now,
            activatedAt: null,
            expiresAt: null,
            expiresUnusedAt: nextRolloverMs(now, timeZone),
            screenTimeApplied: false,
          })
          .run();
      });
      return 'completed';
    },

    abandon(sessionId: string, now: number) {
      db.update(practiceSessions)
        .set({ status: 'abandoned', endedAt: now })
        .where(and(eq(practiceSessions.id, sessionId), eq(practiceSessions.status, 'active')))
        .run();
    },
  };
}

function unlockFor(
  db: AtlasDatabase,
  session: { id: string; mode: PracticeView['session']['mode']; status: string },
  now: number,
  timeZone: string,
): PracticeView['unlock'] {
  if (session.status !== 'completed') return { kind: 'not-earned' };
  const grant = db.select().from(unlockGrants).where(eq(unlockGrants.sessionId, session.id)).get();
  if (grant) return grant.status === 'forfeited' ? { kind: 'not-earned' } : { kind: 'grant', minutes: grant.minutes };
  return decideUnlock({
    mode: session.mode,
    ...gradedStats(db, session.id),
    minutesAlreadyToday: minutesToday(db, now, timeZone, session.id),
  });
}

/**
 * learning-loop §5.4: a step is complete once it has a graded attempt or an explicit skip.
 * A failed attempt (denied, interrupted, engine error) is never graded, so it can't complete a step.
 */
function stepComplete(db: AtlasDatabase, sessionId: string, step: SessionStep): boolean {
  const rows = db
    .select({ status: practiceAttempts.status, graded: practiceAttempts.graded })
    .from(practiceAttempts)
    .where(
      and(
        eq(practiceAttempts.sessionId, sessionId),
        eq(practiceAttempts.itemId, step.itemId),
        eq(practiceAttempts.promptType, step.promptType),
      ),
    )
    .all();
  return rows.some((row) => row.graded || row.status === 'skipped');
}

/**
 * learning-loop §8.1: only a graded try-1 attempt with a real score counts toward unlock eligibility
 * and the average. Retries, silence (captured), skips, and technical failures (denied, interrupted,
 * engine error) never count. Speech and typed answers count alike.
 */
function gradedStats(db: AtlasDatabase, sessionId: string) {
  const rows = db
    .select({ overall: feedback.overall })
    .from(practiceAttempts)
    .innerJoin(feedback, eq(feedback.attemptId, practiceAttempts.id))
    .where(
      and(
        eq(practiceAttempts.sessionId, sessionId),
        eq(practiceAttempts.status, 'scored'),
        eq(practiceAttempts.graded, true),
        eq(practiceAttempts.tryNumber, 1),
      ),
    )
    .all();
  return {
    gradedCount: rows.length,
    overalls: rows.map((row) => row.overall),
  };
}

function minutesToday(db: AtlasDatabase, now: number, timeZone: string, exceptSessionId: string) {
  const start = localDayStartMs(now, timeZone);
  const end = nextRolloverMs(now, timeZone);
  return db
    .select()
    .from(unlockGrants)
    .all()
    .filter(
      (grant) =>
        grant.sessionId !== exceptSessionId &&
        grant.status !== 'forfeited' &&
        grant.earnedAt >= start &&
        grant.earnedAt < end,
    )
    .reduce((sum, grant) => sum + grant.minutes, 0);
}

function toCard(row: {
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  fsrsState: FsrsStateName;
  lastReviewAt: number | null;
}): QueueCard {
  return {
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    elapsedDays: row.elapsedDays,
    scheduledDays: row.scheduledDays,
    learningSteps: row.learningSteps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.fsrsState,
    lastReviewAt: row.lastReviewAt,
  };
}

function toAttempt(row: AttemptRow): PracticeAttempt {
  return row;
}

function toFeedback(row: FeedbackRow): AttemptFeedback {
  return {
    id: row.id,
    attemptId: row.attemptId,
    overall: row.overall,
    accuracy: row.accuracy,
    pronunciation: row.pronunciation,
    words: row.wordsJson,
    method: 'text-match',
    matchedText: row.matchedText,
    accentHints: row.accentHintsJson,
    rating: row.rating,
    hint: row.hintKey,
    createdAt: row.createdAt,
  };
}
