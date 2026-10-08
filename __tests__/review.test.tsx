import { act } from 'react';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import type { ReviewRepository } from '@/data/repositories/reviewRepo';
import { hydrateLearner } from '@/state/learnerStore';
import { hydrateReview, resetReview } from '@/state/reviewStore';
import { hydrateSession, resetSession } from '@/state/sessionStore';

import { createMemoryLearnerRepository } from './support/memoryLearnerRepo';

jest.mock('@/state/bootstrap', () => ({ useAppBootstrap: () => ({ ready: true, error: null }) }));

const appDir = './app';

function reviewRepo(): ReviewRepository {
  return {
    home: () => ({
      masteredCount: 2,
      due: [{ itemId: 'due-1', targetText: 'Buenos días', meaning: 'Good morning', due: 1 }],
      upcoming: [{ itemId: 'soon-1', targetText: 'Gracias', meaning: 'Thank you', due: Date.now() + 2 * 24 * 60 * 60 * 1000 }],
      saved: [{ itemId: 'saved-1', targetText: 'Hola', meaning: 'Hello', due: null }],
    }),
  };
}

describe('Review tab', () => {
  beforeEach(async () => {
    await act(async () => {
      resetSession();
      resetReview();
      const learner = createMemoryLearnerRepository();
      await learner.startCourse('en-es-v0');
      await hydrateLearner(learner);
      hydrateReview(reviewRepo());
      hydrateSession({
        abandonStale() {},
        home: () => ({ activeSessionId: null, newRemaining: 5, dueCount: 1, caughtUp: false }),
        start: (mode) => ({ kind: 'started', id: mode === 'review-only' ? 'review-1' : 'daily-1' }),
        touch: () => null,
        getPractice: () => null,
        recordAttempt() {},
        advance: () => 'active',
        abandon() {},
      });
    });
  });

  afterEach(() => {
    act(() => {
      resetSession();
      resetReview();
    });
  });

  it('shows the mastered count, due cards, the next week, and one saved row', async () => {
    const app = renderRouter(appDir, { initialUrl: '/review' });
    await app;

    expect(screen.getByText('Mastered 2')).toBeOnTheScreen();
    expect(screen.getByText('Buenos días')).toBeOnTheScreen();
    expect(screen.getByText('Good morning · Due')).toBeOnTheScreen();
    expect(screen.getByText('Gracias')).toBeOnTheScreen();
    expect(screen.getByText('Hello · Ready to review')).toBeOnTheScreen();
    expect(screen.getAllByText('Hola')).toHaveLength(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Review only' }));
    expect(app.getPathname()).toBe('/practice/review-1');
  });
});
