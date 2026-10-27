// Drives the real PracticeSession against the real session repository on SQLite.
// The other UI tests use a fake repository, so they cannot see repo-level behavior (stale sessions, caps, grants).
import { act } from 'react';
import { AppState } from 'react-native';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { createSessionRepo, type SessionRepository } from '@/data/repositories/sessionRepo';
import { createSettingsRepo } from '@/data/repositories/settingsRepo';
import { practiceAttempts, practiceSessions, unlockGrants } from '@/data/schema';
import { DEFAULT_COURSE } from '@/data/seed/courses';
import { loadSeed } from '@/data/seed/loadSeed';
import { openTestDatabase } from '@/data/testDatabase';
import { createMockSpeechService } from '@/services/speech/mock';
import { SPEECH_TIMEOUT_MS } from '@/services/speech/interruptible';
import * as speechRegistry from '@/services/speech/registry';
import type { SpeechService } from '@/services/speech/types';
import { resetDevScript } from '@/state/devSpeechScript';
import { hydrateLearner } from '@/state/learnerStore';
import { hydrateSession, resetSession } from '@/state/sessionStore';

import { createMemoryLearnerRepository } from './support/memoryLearnerRepo';

jest.mock('@/state/bootstrap', () => ({ useAppBootstrap: () => ({ ready: true, error: null }) }));
let mockIdCounter = 0;
jest.mock('@/lib/id', () => ({ newId: () => `id-${++mockIdCounter}` }));

const appDir = './app';
type Db = Awaited<ReturnType<typeof openTestDatabase>>;

describe('PracticeSession on the real repository', () => {
  let db: Db;
  let repo: SessionRepository;
  let id: string;

  async function boot(mode: 'daily' | 'onboarding' = 'daily') {
    db = await openTestDatabase();
    loadSeed(db, DEFAULT_COURSE, Date.now());
    createSettingsRepo(db).set('activeCourseId', 'en-es-v0');
    repo = createSessionRepo(db);
    const started = repo.start(mode, Date.now(), 'America/Bogota');
    if (started.kind !== 'started') throw new Error('expected a session');
    id = started.id;
    await act(async () => {
      resetSession();
      await hydrateLearner(createMemoryLearnerRepository());
      hydrateSession(repo);
    });
  }

  const attempts = () => db.select().from(practiceAttempts).all();
  const grants = () => db.select().from(unlockGrants).all();
  const cursor = () => db.select().from(practiceSessions).all()[0]!.cursor;

  beforeEach(() => resetDevScript());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    act(() => resetSession());
  });

  /** Several taps delivered in one synchronous tick, before React re-renders `busy`, through the host onClick that Pressable wires to onPress. */
  async function tapSameTick(targets: Parameters<typeof fireEvent.press>[0][], times = 1) {
    await act(async () => {
      for (let i = 0; i < times; i++) {
        for (const target of targets) {
          (target as { props: { onClick?: (event: unknown) => void } }).props.onClick?.({
            stopPropagation() {},
            preventDefault() {},
            nativeEvent: {},
          });
        }
      }
    });
  }

  async function flush() {
    for (let i = 0; i < 10; i++) await act(async () => { await Promise.resolve(); });
  }

  async function typeAnswer(text: string) {
    await fireEvent.changeText(await screen.findByLabelText('Type the phrase'), text);
  }

  /** Fails the test on any unhandled promise rejection while `run` executes. */
  async function expectNoRejections(run: () => Promise<void>) {
    const rejections: unknown[] = [];
    const onRejection = (error: unknown) => rejections.push(error);
    process.on('unhandledRejection', onRejection);
    try {
      await run();
      await flush();
    } finally {
      process.off('unhandledRejection', onRejection);
    }
    expect(rejections.map(String)).toEqual([]);
  }

  it('five rapid taps on Check typing write exactly one attempt', async () => {
    await boot();
    await renderRouter(appDir, { initialUrl: `/practice/${id}` });
    await typeAnswer('Hola');
    await tapSameTick([screen.getByRole('button', { name: 'Check typing' })], 5);
    await screen.findByRole('button', { name: 'Next' });
    expect(attempts()).toHaveLength(1);
  });

  it('five rapid taps on I don\'t know write exactly one skipped attempt', async () => {
    await boot();
    await renderRouter(appDir, { initialUrl: `/practice/${id}` });
    await tapSameTick([await screen.findByRole('button', { name: "I don't know" })], 5);
    await screen.findByRole('button', { name: 'Next' });
    expect(attempts().map((attempt) => attempt.status)).toEqual(['skipped']);
  });

  it('Check typing, skip and Repeat in the same tick write exactly one attempt', async () => {
    await boot();
    await renderRouter(appDir, { initialUrl: `/practice/${id}` });
    await typeAnswer('Hola');
    const check = screen.getByRole('button', { name: 'Check typing' });
    const skip = screen.getByRole('button', { name: "I don't know" });
    const repeat = await screen.findByRole('button', { name: 'Repeat' });
    await tapSameTick([check, skip, repeat]);
    await screen.findByRole('button', { name: 'Next' });
    expect(attempts()).toHaveLength(1);
  });

  it('five rapid taps on Next advance the cursor exactly once', async () => {
    await boot();
    await renderRouter(appDir, { initialUrl: `/practice/${id}` });
    await fireEvent.press(await screen.findByRole('button', { name: "I don't know" }));
    await tapSameTick([await screen.findByRole('button', { name: 'Next' })], 5);
    expect(cursor()).toBe(1);
  });

  it('after three wrong typed tries the inputs go away, Next stays, and three rows exist', async () => {
    await boot();
    await renderRouter(appDir, { initialUrl: `/practice/${id}` });
    for (let i = 0; i < 3; i++) {
      await typeAnswer(`wrong${i}`);
      await fireEvent.press(screen.getByRole('button', { name: 'Check typing' }));
      await waitFor(() => expect(attempts()).toHaveLength(i + 1));
      await flush();
    }
    expect(screen.queryByLabelText('Type the phrase')).toBeNull();
    expect(screen.queryByRole('button', { name: "I don't know" })).toBeNull();
    expect(screen.getByRole('button', { name: 'Next' })).toBeOnTheScreen();
    expect(attempts().map((attempt) => attempt.tryNumber)).toEqual([1, 2, 3]);
  });

  it('a typed-only release session finishes with one grant even when the last Next is tapped three times', async () => {
    const original = (globalThis as { __DEV__?: boolean }).__DEV__;
    const env = process.env.EXPO_PUBLIC_SPEECH_IMPL;
    delete process.env.EXPO_PUBLIC_SPEECH_IMPL;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    try {
      await boot();
      const app = renderRouter(appDir, { initialUrl: `/practice/${id}` });
      await app;
      const view = repo.getPractice(id)!;
      for (let i = 0; i < view.steps.length; i++) {
        await screen.findByText(`Step ${i + 1} of ${view.steps.length}`);
        expect(screen.queryByRole('button', { name: 'Repeat' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Hear it' })).toBeNull();
        await typeAnswer(view.steps[i]!.targetText);
        await fireEvent.press(screen.getByRole('button', { name: 'Check typing' }));
        const next = await screen.findByRole('button', { name: 'Next' });
        if (i === view.steps.length - 1) await tapSameTick([next], 3);
        else await fireEvent.press(next);
      }
      await waitFor(() => expect(app.getPathname()).toBe(`/practice/summary/${id}`));
      expect(grants()).toHaveLength(1);
    } finally {
      (globalThis as { __DEV__?: boolean }).__DEV__ = original;
      if (env !== undefined) process.env.EXPO_PUBLIC_SPEECH_IMPL = env;
    }
  });

  describe('a session that ended underneath the learner', () => {
    it('Check typing shows the abandoned state, throws nothing, and saves nothing', async () => {
      await boot();
      await renderRouter(appDir, { initialUrl: `/practice/${id}` });
      await typeAnswer('Hola');
      repo.abandon(id, Date.now());
      await expectNoRejections(() => tapSameTick([screen.getByRole('button', { name: 'Check typing' })]));
      expect(screen.getByText('This session was abandoned.')).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Check typing' })).toBeNull();
      expect(attempts()).toHaveLength(0);
    });

    it('Repeat shows the abandoned state instead of swallowing the error', async () => {
      await boot();
      await renderRouter(appDir, { initialUrl: `/practice/${id}` });
      const repeat = await screen.findByRole('button', { name: 'Repeat' });
      repo.abandon(id, Date.now());
      await expectNoRejections(() => tapSameTick([repeat]));
      // The mock microphone answers after a short delay.
      expect(await screen.findByText('This session was abandoned.')).toBeOnTheScreen();
      expect(attempts()).toHaveLength(0);
    });

    it("I don't know shows the abandoned state and throws nothing", async () => {
      await boot();
      await renderRouter(appDir, { initialUrl: `/practice/${id}` });
      const skip = await screen.findByRole('button', { name: "I don't know" });
      repo.abandon(id, Date.now());
      await expectNoRejections(() => tapSameTick([skip]));
      expect(screen.getByText('This session was abandoned.')).toBeOnTheScreen();
      expect(attempts()).toHaveLength(0);
    });

    it('Next shows the abandoned state and throws nothing', async () => {
      await boot();
      await renderRouter(appDir, { initialUrl: `/practice/${id}` });
      await fireEvent.press(await screen.findByRole('button', { name: "I don't know" }));
      const next = await screen.findByRole('button', { name: 'Next' });
      repo.abandon(id, Date.now());
      await expectNoRejections(() => tapSameTick([next]));
      expect(screen.getByText('This session was abandoned.')).toBeOnTheScreen();
      expect(cursor()).toBe(0);
    });

    it('a session past 2 hours is abandoned on the next write, with no attempt and no grant', async () => {
      await boot();
      await renderRouter(appDir, { initialUrl: `/practice/${id}` });
      await typeAnswer('Hola');
      const twoHoursLater = Date.now() + 2 * 60 * 60 * 1000 + 60_000;
      jest.spyOn(Date, 'now').mockReturnValue(twoHoursLater);
      await expectNoRejections(() => tapSameTick([screen.getByRole('button', { name: 'Check typing' })]));
      expect(screen.getByText('This session was abandoned.')).toBeOnTheScreen();
      expect(db.select().from(practiceSessions).get()?.status).toBe('abandoned');
      expect(attempts()).toHaveLength(0);
      expect(grants()).toHaveLength(0);
    });
  });

  describe('a speech engine that never answers', () => {
    function stalledSpeech(overrides: Partial<SpeechService>) {
      const speech: SpeechService = { ...createMockSpeechService(), ...overrides };
      jest.spyOn(speechRegistry, 'createSpeechService').mockReturnValue(speech);
      return speech;
    }

    it('speak() that never resolves: Hear it, typing and skip stay usable, and after the timeout the control resets', async () => {
      await boot();
      const stopSpeaking = jest.fn(async () => {});
      stalledSpeech({ speak: () => new Promise<void>(() => {}), stopSpeaking });
      await renderRouter(appDir, { initialUrl: `/practice/${id}` });
      jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
      await fireEvent.press(await screen.findByRole('button', { name: 'Hear it' }));
      expect(screen.getByRole('button', { name: 'Hear it' })).toBeDisabled();
      expect(screen.getByText('Playing the phrase.')).toBeOnTheScreen();
      await act(async () => {
        jest.advanceTimersByTime(SPEECH_TIMEOUT_MS);
      });
      await flush();
      expect(stopSpeaking).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Hear it' })).toBeEnabled();
      expect(screen.queryByText('Played.')).toBeNull();
      expect(screen.queryByText('Playing the phrase.')).toBeNull();
      expect(screen.getByText("The audio didn't play. Tap Hear it to try again, or type the phrase.")).toBeOnTheScreen();
      await typeAnswer('Hola');
      await fireEvent.press(screen.getByRole('button', { name: 'Check typing' }));
      expect(await screen.findByRole('button', { name: 'Next' })).toBeOnTheScreen();
      expect(attempts()).toHaveLength(1);
    });

    it('listen() that never resolves: it is cancelled at the timeout, nothing is saved, and Repeat works again', async () => {
      await boot();
      const cancel = jest.fn();
      const base = createMockSpeechService();
      stalledSpeech({ listen: (opts) => ({ ...base.listen(opts), cancel, result: new Promise(() => {}) }) });
      await renderRouter(appDir, { initialUrl: `/practice/${id}` });
      jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
      await fireEvent.press(await screen.findByRole('button', { name: 'Repeat' }));
      expect(screen.getByRole('button', { name: 'Repeat' })).toBeDisabled();
      expect(screen.getByText('Listening. Say the phrase now.')).toBeOnTheScreen();
      await act(async () => {
        jest.advanceTimersByTime(SPEECH_TIMEOUT_MS);
      });
      await flush();
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Repeat' })).toBeEnabled();
      expect(screen.queryByText('Listening. Say the phrase now.')).toBeNull();
      expect(screen.getByText("I couldn't hear a response. Tap Repeat to try again, or type the phrase.")).toBeOnTheScreen();
      expect(attempts()).toHaveLength(0);
    });

    it('unmounting during a stalled listen cancels it', async () => {
      await boot();
      const cancel = jest.fn();
      const base = createMockSpeechService();
      stalledSpeech({ listen: (opts) => ({ ...base.listen(opts), cancel, result: new Promise(() => {}) }) });
      const app = await renderRouter(appDir, { initialUrl: `/practice/${id}` });
      await fireEvent.press(await screen.findByRole('button', { name: 'Repeat' }));
      await act(async () => {
        app.unmount();
      });
      expect(cancel).toHaveBeenCalledTimes(1);
    });

    it('unmounting during a stalled speak stops playback', async () => {
      await boot();
      const stopSpeaking = jest.fn(async () => {});
      stalledSpeech({ speak: () => new Promise<void>(() => {}), stopSpeaking });
      const app = await renderRouter(appDir, { initialUrl: `/practice/${id}` });
      await fireEvent.press(await screen.findByRole('button', { name: 'Hear it' }));
      await act(async () => {
        app.unmount();
      });
      await flush();
      expect(stopSpeaking).toHaveBeenCalledTimes(1);
    });

    it('going to the background cancels a stalled listen and frees the controls', async () => {
      await boot();
      const cancel = jest.fn();
      const base = createMockSpeechService();
      stalledSpeech({ listen: (opts) => ({ ...base.listen(opts), cancel, result: new Promise(() => {}) }) });
      const listeners: ((state: string) => void)[] = [];
      jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, listener: (state: string) => void) => {
        listeners.push(listener);
        return { remove: jest.fn() };
      }) as unknown as typeof AppState.addEventListener);
      await renderRouter(appDir, { initialUrl: `/practice/${id}` });
      await fireEvent.press(await screen.findByRole('button', { name: 'Repeat' }));
      expect(screen.getByRole('button', { name: 'Repeat' })).toBeDisabled();
      await act(async () => {
        for (const listener of listeners) listener('background');
      });
      await flush();
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('button', { name: 'Repeat' })).toBeEnabled();
    });
  });
  describe('dead ends', () => {
    it('an abandoned session opened with no history still has a working Back to Learn', async () => {
      await boot();
      repo.abandon(id, Date.now());
      const app = renderRouter(appDir, { initialUrl: `/practice/${id}` });
      await app;
      expect(await screen.findByText('This session was abandoned.')).toBeOnTheScreen();
      expect(screen.getByText('Answers you already gave stay saved. Start a new session from Learn.')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Back to Learn' }));
      await waitFor(() => expect(app.getPathname()).toBe('/learn'));
    });

    it.each(['/practice/missing-session', '/practice/summary/missing-session'])(
      'a session that is not on this device offers a way out (%s)',
      async (url) => {
        await boot();
        const app = renderRouter(appDir, { initialUrl: url });
        await app;
        expect(await screen.findByText("This session isn't on this device.")).toBeOnTheScreen();
        await fireEvent.press(screen.getByRole('button', { name: 'Back to Learn' }));
        await waitFor(() => expect(app.getPathname()).toBe('/learn'));
      },
    );
  });
});
