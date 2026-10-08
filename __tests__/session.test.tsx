import { act } from 'react';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import type { PracticeView, RecordAttemptInput, SessionRepository } from '@/data/repositories/sessionRepo';
import type { PracticeAttempt } from '@/domain/types';
import { hydrateLearner } from '@/state/learnerStore';
import { hydrateSession, resetSession } from '@/state/sessionStore';

import { createMemoryLearnerRepository } from './support/memoryLearnerRepo';

jest.mock('@/state/bootstrap', () => ({ useAppBootstrap: () => ({ ready: true, error: null }) }));

const appDir = './app';

function practiceRepo(): SessionRepository {
  let cursor = 0;
  let started = false;
  let status: PracticeView['session']['status'] = 'active';
  const attempts: PracticeAttempt[] = [];
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
    }),
    recordAttempt(input: RecordAttemptInput) {
      const id = `attempt-${attempts.length + 1}`;
      attempts.push({
        id,
        sessionId: input.sessionId,
        itemId: input.itemId,
        promptType: input.promptType,
        inputMode: input.inputMode,
        tryNumber: attempts.length + 1,
        status: input.status,
        transcript: input.transcript,
        durationMs: null,
        error: input.error,
        graded: false,
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
  beforeEach(async () => {
    await act(async () => {
      resetSession();
      await hydrateLearner(createMemoryLearnerRepository());
      hydrateSession(practiceRepo());
    });
  });

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
    await fireEvent.press(screen.getByRole('button', { name: 'Repeat' }));
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
});
