import { useEffect, useState } from 'react';

import { getDatabase, useDatabaseMigrations } from '@/data/db';
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
import { hydrateSettings } from './settingsStore';
import { hydrateUnlock } from './unlockStore';

export type BootstrapState = { ready: boolean; error: Error | null };

/**
 * Startup (architecture §3 root layout): open the database, apply migrations, seed the
 * default course (idempotent, so it runs on every launch), then load the learner store.
 */
export function useAppBootstrap(): BootstrapState {
  const migrations = useDatabaseMigrations();
  const [state, setState] = useState<BootstrapState>({ ready: false, error: null });

  useEffect(() => {
    if (!migrations.success) return;
    let cancelled = false;
    (async () => {
      try {
        const db = getDatabase();
        loadSeed(db, DEFAULT_COURSE, Date.now());
        const settings = createSettingsRepo(db);
        const courses = createCourseRepo(db);
        bindAccent((locale) => {
          courses.setSpeechLocale(settings.get('activeCourseId') ?? V0_COURSE.courseId, locale);
        });
        hydrateSettings(settings);
        await hydrateLearner(createLearnerRepository(db));
        hydrateReview(createReviewRepo(db));
        hydrateSession(createSessionRepo(db));
        hydrateUnlock(createUnlockRepo(db));
        if (!cancelled) setState({ ready: true, error: null });
      } catch (error) {
        if (!cancelled) setState({ ready: false, error: error instanceof Error ? error : new Error(String(error)) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [migrations.success]);

  return { ready: state.ready, error: migrations.error ?? state.error };
}
