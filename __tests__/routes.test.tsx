import { renderRouter, screen } from 'expo-router/testing-library';

import { hydrateLearner } from '@/state/learnerStore';

import { createMemoryLearnerRepository } from './support/memoryLearnerRepo';

// The real root layout opens expo-sqlite, which Jest can't run. Skip startup and
// hydrate the learner store from an in-memory repository instead.
jest.mock('@/state/bootstrap', () => ({ useAppBootstrap: () => ({ ready: true, error: null }) }));

// renderRouter resolves this path from the working directory (the repo root under
// `npm test`), not from the test file as its docs say.
const appDir = './app';

// Every non-tab route in architecture §3 exists and says honestly that it is not built yet.
describe('Route map (architecture §3)', () => {
  beforeEach(async () => {
    await hydrateLearner(createMemoryLearnerRepository());
  });

  it.each([
    ['/welcome', 'Welcome'],
    ['/language', 'Your course'],
    ['/mic', 'Microphone'],
    ['/first-session', 'First session'],
    ['/habit', 'Daily habit'],
    ['/done', 'All set'],
    ['/practice/abc', 'Practice'],
    ['/practice/summary/abc', 'Session summary'],
  ])('%s renders a placeholder', async (url, title) => {
    await renderRouter(appDir, { initialUrl: url });

    expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
    expect(screen.getByText('Not built yet. This screen is a placeholder.')).toBeOnTheScreen();
  });
});
