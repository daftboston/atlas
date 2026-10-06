import { useEffect, useState } from 'react';

import { getDatabase, useDatabaseMigrations } from '@/data/db';
import { createLearnerRepository } from '@/data/repositories/learnerRepo';
import { DEFAULT_COURSE } from '@/data/seed/courses';
import { loadSeed } from '@/data/seed/loadSeed';

import { hydrateLearner } from './learnerStore';

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
        await hydrateLearner(createLearnerRepository(db));
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
