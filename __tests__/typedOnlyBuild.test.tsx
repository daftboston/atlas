import { act } from 'react';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { createSettingsRepo } from '@/data/repositories/settingsRepo';
import * as speechRegistry from '@/services/speech/registry';
import { createUnavailableSpeechService } from '@/services/speech/unavailable';
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

// A release build with no speech engine: the learner can only type. No screen may offer or mention a microphone.
describe('typed-only (release without a speech engine)', () => {
  beforeEach(() => {
    jest.spyOn(speechRegistry, 'createSpeechService').mockImplementation(() => createUnavailableSpeechService());
  });
  afterEach(() => {
    act(() => resetSettings());
    jest.restoreAllMocks();
  });

  it('the mic screen says typing only, has one Continue button, and does not record a denial', async () => {
    act(() => hydrateSettings(memorySettings({ onboardingCompleted: false })));
    const app = renderRouter(appDir, { initialUrl: '/mic' });
    await app;
    expect(await screen.findByRole('header', { name: 'Typing only' })).toBeOnTheScreen();
    expect(screen.getByText(/Speaking isn't available in this build/)).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Allow microphone' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Continue without the microphone' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(app.getPathname()).toBe('/first-session');
    expect(await screen.findByText('Three new phrases. Read each meaning, then type the phrase.')).toBeOnTheScreen();
  });

  it('Learn never says simulated or Mac, and Learn has no Turn on mic button', async () => {
    const learner = createMemoryLearnerRepository();
    await learner.startCourse('en-es-v0');
    await act(async () => {
      await hydrateLearner(learner);
      hydrateSettings(memorySettings({ onboardingCompleted: true, micDenied: true }));
    });
    const app = renderRouter(appDir, { initialUrl: '/learn' });
    await app;
    expect(await screen.findByText("Speaking isn't available in this build. Type the phrase instead.")).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Turn on mic' })).toBeNull();
    expect(screen.queryByText(/simulated|Mac/i)).toBeNull();
  });

  it('Settings says typing only and never says simulated or Mac', async () => {
    await act(async () => {
      hydrateSettings(memorySettings({ onboardingCompleted: true }));
    });
    await renderRouter(appDir, { initialUrl: '/settings' });
    expect(await screen.findByText(/Speaking isn't available in this build, so you type your answers/)).toBeOnTheScreen();
    expect(screen.queryByText(/simulated microphone|\bMac\b/)).toBeNull();
  });
});
