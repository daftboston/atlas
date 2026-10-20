import { act } from 'react';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { createSettingsRepo } from '@/data/repositories/settingsRepo';
import { SPANISH_ACCENTS } from '@/domain/language/profiles/es';
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

describe('Settings', () => {
  afterEach(() => {
    act(() => resetSettings());
  });

  it('shows the accent and raises the daily limit', async () => {
    const learner = createMemoryLearnerRepository();
    await learner.startCourse('en-es-v0');
    await hydrateLearner(learner);
    act(() => hydrateSettings(memorySettings({ onboardingCompleted: true }), SPANISH_ACCENTS[0].locale));

    const app = renderRouter(appDir, { initialUrl: '/settings' });
    await app;

    expect(screen.getByText('Latin America')).toBeOnTheScreen();
    expect(screen.getByText('Spain')).toBeOnTheScreen();
    expect(screen.getByText('New phrases a day')).toBeOnTheScreen();
    expect(screen.getByText('5')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'More new phrases' }));
    expect(screen.getByText('6')).toBeOnTheScreen();
  });
});
