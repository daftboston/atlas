import { useCallback, useEffect, useState } from 'react';

import { openAndMigrateDatabase } from '@/data/db';
import { createCourseRepo } from '@/data/repositories/courseRepo';
import { createLearnerRepository } from '@/data/repositories/learnerRepo';
import { createReviewRepo } from '@/data/repositories/reviewRepo';
import { createSessionRepo } from '@/data/repositories/sessionRepo';
import { createSettingsRepo } from '@/data/repositories/settingsRepo';
import { createUnlockRepo } from '@/data/repositories/unlockRepo';
import { DEFAULT_COURSE } from '@/data/seed/courses';
import { loadSeed } from '@/data/seed/loadSeed';
import { V0_COURSE } from '@/content/sample-lesson';

import { bindAccent } from './accent';
import { hydrateLearner } from './learnerStore';
import { hydrateReview } from './reviewStore';
import { hydrateSession } from './sessionStore';
import { hydrateSettings, setKnownSpeechLocale } from './settingsStore';
import { hydrateUnlock } from './unlockStore';

export type BootstrapState = { ready: boolean; error: Error | null; retry: () => void };

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * The startup work (architecture §3 root layout): open the database, apply migrations, seed
 * the default course (idempotent, so it runs on every launch), then load the stores. It is
 * async and throws on failure, so `useAppBootstrap` can show the startup error screen and
 * run it again on Retry.
 */
export async function bootstrapApp(): Promise<void> {
  const db = await openAndMigrateDatabase();
  loadSeed(db, DEFAULT_COURSE, Date.now());
  const settings = createSettingsRepo(db);
  const courses = createCourseRepo(db);
  const courseId = settings.get('activeCourseId') ?? V0_COURSE.courseId;
  bindAccent((locale) => {
    courses.setSpeechLocale(settings.get('activeCourseId') ?? V0_COURSE.courseId, locale);
    setKnownSpeechLocale(locale);
  });
  hydrateSettings(settings, courses.get(courseId)?.speechLocale ?? null);
  await hydrateLearner(createLearnerRepository(db));
  hydrateReview(createReviewRepo(db));
  hydrateSession(createSessionRepo(db));
  hydrateUnlock(createUnlockRepo(db));
}

type Phase = { status: 'loading' } | { status: 'ready' } | { status: 'error'; error: Error };

/** Runs `bootstrapApp` once on mount, and again each time `retry` is called after a failure. */
export function useAppBootstrap(): BootstrapState {
  const [phase, setPhase] = useState<Phase>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    bootstrapApp().then(
      () => {
        if (!cancelled) setPhase({ status: 'ready' });
      },
      (error: unknown) => {
        if (!cancelled) setPhase({ status: 'error', error: toError(error) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setPhase({ status: 'loading' });
    setAttempt((count) => count + 1);
  }, []);

  return {
    ready: phase.status === 'ready',
    error: phase.status === 'error' ? phase.error : null,
    retry,
  };
}
