import { act } from 'react';
import { renderRouter, screen } from 'expo-router/testing-library';

import { createSettingsRepo } from '@/data/repositories/settingsRepo';
import { hydrateLearner } from '@/state/learnerStore';
import { hydrateSettings, resetSettings } from '@/state/settingsStore';

import { createMemoryLearnerRepository } from './support/memoryLearnerRepo';

jest.mock('@/state/bootstrap', () => ({ useAppBootstrap: () => ({ ready: true, error: null }) }));

const appDir = './app';

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

describe('onboarding gate', () => {
  afterEach(() => {
    act(() => resetSettings());
  });

  it('sends an unfinished learner from Learn to welcome', async () => {
    act(() => hydrateSettings(memorySettings({ onboardingCompleted: false })));
    const app = renderRouter(appDir, { initialUrl: '/learn' });
    await app;
    expect(app.getPathname()).toBe('/welcome');
    expect(screen.getByRole('header', { name: 'Welcome' })).toBeOnTheScreen();
  });

  it('sends a finished learner from onboarding back to Learn', async () => {
    act(() => hydrateSettings(memorySettings({ onboardingCompleted: true })));
    const app = renderRouter(appDir, { initialUrl: '/welcome' });
    await app;
    expect(app.getPathname()).toBe('/learn');
  });

  it('shows Turn on mic on Learn when the microphone was declined', async () => {
    const learner = createMemoryLearnerRepository();
    await learner.startCourse('en-es-v0');
    await act(async () => {
      await hydrateLearner(learner);
      hydrateSettings(memorySettings({ onboardingCompleted: true, micDenied: true }));
    });
    const app = renderRouter(appDir, { initialUrl: '/learn' });
    await app;
    expect(screen.getByRole('button', { name: 'Turn on mic' })).toBeOnTheScreen();
  });
});
