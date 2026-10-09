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
    ['/welcome', 'Welcome', 'Atlas gets you speaking from the first minute, in short daily sessions.'],
    ['/language', 'Accent', 'English to Spanish. Choose the accent you want to hear.'],
    ['/mic', 'Microphone', 'Atlas listens so it can tell you how close your phrase was. You can type instead, and that still counts.'],
    ['/first-session', 'First session', 'Three new phrases. Listen, then say each one back. Typing works too.'],
    ['/habit', 'Daily habit', 'A finished session can earn a few free minutes. Screen Time is coming later, so for now Atlas shows a timer.'],
    ['/done', "You're ready", 'Your next session will put the first reviews on the schedule.'],
  ])('%s explains the step', async (url, title, copy) => {
    await renderRouter(appDir, { initialUrl: url });

    expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
    expect(screen.getByText(copy)).toBeOnTheScreen();
  });

  it.each([
    ['/practice/abc', 'Practice'],
    ['/practice/summary/abc', 'Summary'],
  ])('%s says the session is not on this device', async (url, title) => {
    await renderRouter(appDir, { initialUrl: url });

    expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
    expect(screen.getByText("This session isn't on this device.")).toBeOnTheScreen();
  });
});
