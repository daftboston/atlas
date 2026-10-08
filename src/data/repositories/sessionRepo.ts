import { and, eq, inArray, isNull } from 'drizzle-orm';

import { DAILY_NEW_LIMIT, ONBOARDING_ITEM_COUNT, SESSION_SIZE } from '@/domain/config';
import { buildSession, dailyNewRemaining, interleaveNewItems, type SessionStep } from '@/domain/session/buildSession';
import { isSessionStale } from '@/domain/session/sessionRules';
import type { TextMatchResult } from '@/domain/scoring/types';
import type {
  AttemptFeedback,
  InputMode,
  PracticeAttempt,
  PracticeSession,
  PromptType,
  SessionMode,
} from '@/domain/types';
import { newId } from '@/lib/id';

import type { AtlasDatabase } from '../client';
import { courses, feedback, knowledgeItems, practiceAttempts, practiceSessions } from '../schema';
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
};

export type SessionHome = {
  activeSessionId: string | null;
  newRemaining: number;
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

export type SessionRepository = ReturnType<typeof createSessionRepo>;

type AttemptRow = typeof practiceAttempts.$inferSelect;
type FeedbackRow = typeof feedback.$inferSelect;

export function createSessionRepo(db: AtlasDatabase) {
  function sessionRow(id: string): PracticeSession | null {
    return db.select().from(practiceSessions).where(eq(practiceSessions.id, id)).get() ?? null;
  }

  function activeSession(): PracticeSession | null {
    return db.select().from(practiceSessions).where(eq(practiceSessions.status, 'active')).get() ?? null;
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
      const remaining = dailyNewRemaining(limits(courseId, now, timeZone, 'daily'));
      return {
        activeSessionId: active?.id ?? null,
        newRemaining: remaining,
        caughtUp: active === null && remaining === 0,
      };
    },

    start(mode: Exclude<SessionMode, 'review-only'>, now: number, timeZone: string): StartResult {
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
          cursor: 0,
        })
        .run();
      return { kind: 'started', id };
    },

    /** Resume check: a stale active session is abandoned, then the saved view is returned. */
    touch(sessionId: string, now: number): PracticeView | null {
      const existing = sessionRow(sessionId);
      if (existing?.status === 'active' && isSessionStale(existing.startedAt, now)) this.abandon(sessionId, now);
      return this.getPractice(sessionId);
    },

    getPractice(sessionId: string): PracticeView | null {
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
          speechLocale: courses.speechLocale,
        })
        .from(knowledgeItems)
        .innerJoin(courses, eq(courses.id, knowledgeItems.courseId))
        .where(inArray(knowledgeItems.id, session.plannedItemIds))
        .all();
      const byId = new Map(rows.map((row) => [row.id, row]));
      const steps: StepView[] = interleaveNewItems(session.plannedItemIds).map((step) => {
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

      return { session, steps, speechLocale, attempts, feedback: feedbackRows.map(toFeedback) };
    },

    /**
     * Attempt and feedback commit together. A failure while writing feedback
     * leaves no attempt row.
     */
    recordAttempt(input: RecordAttemptInput) {
      db.transaction((tx) => {
        const prior = tx
          .select({ id: practiceAttempts.id })
          .from(practiceAttempts)
          .where(
            and(
              eq(practiceAttempts.sessionId, input.sessionId),
              eq(practiceAttempts.itemId, input.itemId),
              eq(practiceAttempts.promptType, input.promptType),
            ),
          )
          .all();
        const attemptId = newId();
        tx.insert(practiceAttempts)
          .values({
            id: attemptId,
            sessionId: input.sessionId,
            itemId: input.itemId,
            promptType: input.promptType,
            inputMode: input.inputMode,
            tryNumber: prior.length + 1,
            status: input.status,
            transcript: input.transcript,
            durationMs: null,
            error: input.error,
            graded: false,
            startedAt: input.startedAt,
            endedAt: input.endedAt,
          })
          .run();
        tx.update(knowledgeItems)
          .set({ introducedAt: input.startedAt, updatedAt: input.startedAt })
          .where(and(eq(knowledgeItems.id, input.itemId), isNull(knowledgeItems.introducedAt)))
          .run();
        if (!input.score) return;
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
            rating: null,
            hintKey: input.hint,
            createdAt: input.endedAt,
          })
          .run();
      });
    },

    advance(sessionId: string, now: number): 'active' | 'completed' {
      const session = sessionRow(sessionId);
      if (!session || session.status !== 'active') throw new Error(`Session ${sessionId} is not active`);
      const next = session.cursor + 1;
      const done = next >= interleaveNewItems(session.plannedItemIds).length;
      db.update(practiceSessions)
        .set(done ? { cursor: next, status: 'completed', endedAt: now } : { cursor: next })
        .where(eq(practiceSessions.id, sessionId))
        .run();
      return done ? 'completed' : 'active';
    },

    abandon(sessionId: string, now: number) {
      db.update(practiceSessions)
        .set({ status: 'abandoned', endedAt: now })
        .where(and(eq(practiceSessions.id, sessionId), eq(practiceSessions.status, 'active')))
        .run();
    },
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
