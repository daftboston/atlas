import { act } from 'react';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import type { PracticeView, RecordAttemptInput, SessionRepository } from '@/data/repositories/sessionRepo';
import * as speechRegistry from '@/services/speech/registry';
import { createMockSpeechService } from '@/services/speech/mock';
import type { SpeechService } from '@/services/speech/types';
import { gradeAttempt } from '@/domain/scheduler/grading';
import type { PracticeAttempt } from '@/domain/types';
import { hydrateLearner } from '@/state/learnerStore';
import { resetDevScript, setDevScript } from '@/state/devSpeechScript';
import { hydrateSession, resetSession } from '@/state/sessionStore';

import { createMemoryLearnerRepository } from './support/memoryLearnerRepo';

jest.mock('@/state/bootstrap', () => ({ useAppBootstrap: () => ({ ready: true, error: null }) }));

const appDir = './app';

function practiceRepo(attempts: PracticeAttempt[] = []): SessionRepository {
  let cursor = 0;
  let started = false;
  let status: PracticeView['session']['status'] = 'active';
  const feedback: PracticeView['feedback'] = [];
  const steps: PracticeView['steps'] = [
    {
      itemId: 'item-1',
      promptType: 'listen-repeat',
      targetText: 'Hola',
      meaning: 'Hello',
      variants: [],
      reading: null,
      romanization: null,
      notes: null,
    },
    {
      itemId: 'item-1',
      promptType: 'recall-speak',
      targetText: 'Hola',
      meaning: 'Hello',
      variants: [],
      reading: null,
      romanization: null,
      notes: null,
    },
  ];

  return {
    abandonStale() {},
    home: () => ({
      activeSessionId: started && status === 'active' ? 's1' : null,
      newRemaining: 5,
      dueCount: 0,
      caughtUp: false,
    }),
    start: () => {
      started = true;
      status = 'active';
      return { kind: 'started', id: 's1' };
    },
    touch(_sessionId, _now) {
      return this.getPractice(_sessionId);
    },
    getPractice: () => ({
      session: {
        id: 's1',
        startedAt: 1,
        endedAt: status === 'active' ? null : 2,
        mode: 'daily',
        status,
        plannedItemIds: ['item-1'],
        cursor,
      },
      steps,
      speechLocale: 'es-MX',
      attempts: [...attempts],
      feedback: [...feedback],
      masteredCount: 0,
      unlock: { kind: 'not-earned' },
    }),
    recordAttempt(input: RecordAttemptInput) {
      const id = `attempt-${attempts.length + 1}`;
      // Same rules as the real repo: failed attempts are try 0, the first non-failed attempt is the graded try 1.
      const tryNumber =
        input.status === 'failed'
          ? 0
          : attempts.filter((row) => row.itemId === input.itemId && row.promptType === input.promptType && row.status !== 'failed')
              .length + 1;
      attempts.push({
        id,
        sessionId: input.sessionId,
        itemId: input.itemId,
        promptType: input.promptType,
        inputMode: input.inputMode,
        tryNumber,
        status: input.status,
        transcript: input.transcript,
        durationMs: null,
        error: input.error,
        graded:
          gradeAttempt({
            status: input.status,
            promptType: input.promptType,
            inputMode: input.inputMode,
            tryNumber,
            overall: input.score?.overall ?? null,
          }) !== null,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
      });
      if (input.score) {
        feedback.push({
          id: `feedback-${id}`,
          attemptId: id,
          overall: input.score.overall,
          accuracy: input.score.accuracy,
          pronunciation: null,
          words: input.score.words,
          method: 'text-match',
          matchedText: input.score.matchedText,
          accentHints: input.score.accentHints,
          rating: null,
          hint: input.hint,
          createdAt: input.endedAt,
        });
      }
      return 'recorded';
    },
    advance() {
      cursor += 1;
      if (cursor >= steps.length) {
        status = 'completed';
        return 'completed';
      }
      return 'active';
    },
    abandon() {
      status = 'abandoned';
    },
  };
}

describe('Practice session', () => {
  let attempts: PracticeAttempt[];

  beforeEach(async () => {
    attempts = [];
    resetDevScript();
    await act(async () => {
      resetSession();
      await hydrateLearner(createMemoryLearnerRepository());
      hydrateSession(practiceRepo(attempts));
    });
  });

  afterEach(() => jest.restoreAllMocks());
  afterAll(() => resetDevScript());

  afterEach(() => {
    act(() => resetSession());
  });

  it('starts a session, scores a simulated repeat, and opens the summary', async () => {
    const app = renderRouter(appDir, { initialUrl: '/learn' });
    await app;

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('5 new phrases left today')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Start session' }));
    expect(app.getPathname()).toBe('/practice/s1');

    expect(screen.getByText('Hello')).toBeOnTheScreen();
    expect(screen.getByText('Hola')).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole('button', { name: 'Repeat' }));
    expect(await screen.findByText('That matches.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(screen.queryByText('Hola')).toBeNull();
    expect(screen.getByText('Say the phrase from the meaning. The microphone is simulated.')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: "I don't know" }));
    expect(screen.getByText('Skipped.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(app.getPathname()).toBe('/practice/summary/s1');
    expect(screen.getByText('1 of 2 steps matched.')).toBeOnTheScreen();
    expect(screen.getByText('These phrases are not mastered.')).toBeOnTheScreen();
  });

  it('asks before leaving and marks the session abandoned', async () => {
    const app = renderRouter(appDir, { initialUrl: '/practice/s1' });
    await app;

    await fireEvent.press(screen.getByRole('button', { name: 'Leave session' }));
    expect(screen.getByText(/marked abandoned/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Stay' }));
    expect(screen.queryByText(/marked abandoned/)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Leave session' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Leave' }));
    expect(app.getPathname()).toBe('/learn');

    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('button', { name: 'Start session' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
  });

  it('does not offer Next after a step with only interrupted or denied attempts', async () => {
    const app = renderRouter(appDir, { initialUrl: '/practice/s1' });
    await app;
    const repeat = await screen.findByRole('button', { name: 'Repeat' });
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();

    setDevScript('interrupted');
    await fireEvent.press(repeat);
    expect(await screen.findByText(/interrupted/i)).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Repeat' })).toBeEnabled());
    expect(attempts.map((row) => row.status)).toEqual(['failed']);
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();

    setDevScript('denied');
    await fireEvent.press(screen.getByRole('button', { name: 'Repeat' }));
    await waitFor(() => expect(attempts).toHaveLength(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Repeat' })).toBeEnabled());
    expect(attempts.map((row) => row.status)).toEqual(['failed', 'failed']);
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();

    // A real answer is graded, which unlocks Next.
    setDevScript('perfect');
    await fireEvent.press(screen.getByRole('button', { name: 'Repeat' }));
    expect(await screen.findByRole('button', { name: 'Next' })).toBeOnTheScreen();
  });

  it('offers Skip, and a skip lets the step advance', async () => {
    const app = renderRouter(appDir, { initialUrl: '/practice/s1' });
    await app;
    expect(await screen.findByRole('button', { name: "I don't know" })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: "I don't know" }));
    expect(screen.getByRole('button', { name: 'Next' })).toBeOnTheScreen();
    expect(attempts).toHaveLength(1);
  });

  /** A mock whose score() waits on a gate, so a second tap lands while the first answer is still being scored. */
  function gatedSpeech() {
    const base = createMockSpeechService();
    let open!: () => void;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const speech: SpeechService = {
      ...base,
      score: async (input) => {
        await gate;
        return base.score(input);
      },
    };
    jest.spyOn(speechRegistry, 'createSpeechService').mockReturnValue(speech);
    return open;
  }

  it('writes exactly one attempt when Check typing is tapped twice while the first is still scoring', async () => {
    const open = gatedSpeech();
    const app = renderRouter(appDir, { initialUrl: '/practice/s1' });
    await app;
    await fireEvent.changeText(await screen.findByLabelText('Type the phrase'), 'Hola');
    const check = screen.getByRole('button', { name: 'Check typing' });

    await fireEvent.press(check);
    await fireEvent.press(check);
    await act(async () => open());

    expect(await screen.findByText('That matches.')).toBeOnTheScreen();
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({ inputMode: 'typed', tryNumber: 1, graded: true });
  });

  it('disables the answer buttons while an answer is being scored', async () => {
    const open = gatedSpeech();
    const app = renderRouter(appDir, { initialUrl: '/practice/s1' });
    await app;
    await fireEvent.changeText(await screen.findByLabelText('Type the phrase'), 'Hola');
    await fireEvent.press(screen.getByRole('button', { name: 'Check typing' }));

    expect(screen.getByRole('button', { name: 'Check typing' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Repeat' })).toBeDisabled();
    expect(screen.getByRole('button', { name: "I don't know" })).toBeDisabled();
    await act(async () => open());
    expect(await screen.findByRole('button', { name: 'Next' })).toBeOnTheScreen();
  });

  it('writes exactly one attempt when Repeat is tapped twice while the first is still scoring', async () => {
    const open = gatedSpeech();
    const app = renderRouter(appDir, { initialUrl: '/practice/s1' });
    await app;
    const repeat = await screen.findByRole('button', { name: 'Repeat' });
    await fireEvent.press(repeat);
    await fireEvent.press(repeat);
    await act(async () => open());
    await screen.findByText('That matches.');
    expect(attempts).toHaveLength(1);
  });

  it('hides the speak controls and offers typed answers only in a release build with no speech setting', async () => {
    const original = (globalThis as { __DEV__?: boolean }).__DEV__;
    const env = process.env.EXPO_PUBLIC_SPEECH_IMPL;
    delete process.env.EXPO_PUBLIC_SPEECH_IMPL;
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    try {
      const app = renderRouter(appDir, { initialUrl: '/practice/s1' });
      await app;
      expect(await screen.findByText("Type the phrase. Speaking isn't available in this build.")).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Repeat' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Hear it' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Check typing' })).toBeOnTheScreen();

      // Typed answers still work and still advance the step.
      await fireEvent.changeText(screen.getByLabelText('Type the phrase'), 'Hola');
      await fireEvent.press(screen.getByRole('button', { name: 'Check typing' }));
      expect(await screen.findByRole('button', { name: 'Next' })).toBeOnTheScreen();
      expect(attempts).toMatchObject([{ inputMode: 'typed', graded: true }]);
    } finally {
      (globalThis as { __DEV__?: boolean }).__DEV__ = original;
      if (env !== undefined) process.env.EXPO_PUBLIC_SPEECH_IMPL = env;
    }
  });

  it('shows Hear it and Repeat in development builds, where the mock is the default', async () => {
    const app = renderRouter(appDir, { initialUrl: '/practice/s1' });
    await app;
    expect(await screen.findByRole('button', { name: 'Hear it' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Repeat' })).toBeOnTheScreen();
  });
});
