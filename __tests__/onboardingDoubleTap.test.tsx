// A double tap on an onboarding button must navigate once. Uses the real session repository.
import { act } from 'react';
import { renderRouter, screen } from 'expo-router/testing-library';

import { createSessionRepo, type SessionRepository } from '@/data/repositories/sessionRepo';
import { createSettingsRepo } from '@/data/repositories/settingsRepo';
import { practiceSessions } from '@/data/schema';
import { DEFAULT_COURSE } from '@/data/seed/courses';
import { loadSeed } from '@/data/seed/loadSeed';
import { openTestDatabase } from '@/data/testDatabase';
import { hydrateLearner } from '@/state/learnerStore';
import { hydrateSession, resetSession } from '@/state/sessionStore';
import { hydrateSettings, resetSettings } from '@/state/settingsStore';

import { createMemoryLearnerRepository } from './support/memoryLearnerRepo';

jest.mock('@/state/bootstrap', () => ({ useAppBootstrap: () => ({ ready: true, error: null }) }));
let mockIdCounter = 0;
jest.mock('@/lib/id', () => ({ newId: () => `id-${++mockIdCounter}` }));

const appDir = './app';
type Db = Awaited<ReturnType<typeof openTestDatabase>>;

function memorySettings(values: Record<string, unknown> = {}) {
  const saved = new Map(Object.entries(values));
  return {
    get: (key: string) => (saved.has(key) ? saved.get(key) : null),
    set: (key: string, value: unknown) => {
      saved.set(key, value);
    },
    remove: (key: string) => {
      saved.delete(key);
    },
  } as ReturnType<typeof createSettingsRepo>;
}

/** Taps delivered in one synchronous tick, before React re-renders, through the host onClick that Pressable wires to onPress. */
async function tapSameTick(target: Parameters<typeof import('expo-router/testing-library').fireEvent.press>[0], times: number) {
  await act(async () => {
    for (let i = 0; i < times; i++) {
      (target as { props: { onClick?: (event: unknown) => void } }).props.onClick?.({
        stopPropagation() {},
        preventDefault() {},
        nativeEvent: {},
      });
    }
  });
}

describe('onboarding double tap', () => {
  let db: Db;
  let repo: SessionRepository;

  beforeEach(async () => {
    mockIdCounter = 0;
    db = await openTestDatabase();
    loadSeed(db, DEFAULT_COURSE, Date.now());
    createSettingsRepo(db).set('activeCourseId', 'en-es-v0');
    repo = createSessionRepo(db);
    await act(async () => {
      resetSession();
      await hydrateLearner(createMemoryLearnerRepository());
      hydrateSession(repo);
      hydrateSettings(memorySettings({ onboardingCompleted: false }));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    act(() => {
      resetSession();
      resetSettings();
    });
  });

  function mockRouter() {
    const router = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: () => false };
    jest.spyOn(require('expo-router'), 'useRouter').mockReturnValue(router);
    return router;
  }

  it('Start first session pushes one practice screen and creates one session', async () => {
    const router = mockRouter();
    await renderRouter(appDir, { initialUrl: '/first-session' });
    await tapSameTick(await screen.findByRole('button', { name: 'Start first session' }), 3);
    expect(router.push).toHaveBeenCalledTimes(1);
    const sessions = db.select().from(practiceSessions).all();
    expect(sessions).toHaveLength(1);
    expect(router.push).toHaveBeenCalledWith({ pathname: '/practice/[sessionId]', params: { sessionId: sessions[0]!.id } });
  });

  it('Continue on the onboarding summary navigates to Daily habit once', async () => {
    const started = repo.start('onboarding', Date.now(), 'America/Bogota');
    if (started.kind !== 'started') throw new Error('expected a session');
    const { replace } = mockRouter();
    await renderRouter(appDir, { initialUrl: `/practice/summary/${started.id}` });
    await tapSameTick(await screen.findByRole('button', { name: 'Continue' }), 3);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('/(onboarding)/habit');
  });
});
