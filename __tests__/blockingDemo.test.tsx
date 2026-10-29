// The blocking demo end to end: picker, block screen, a real practice session on SQLite, the earned unlock, and the relock.
import { act } from 'react';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { createBlockedAppsRepo } from '@/data/repositories/blockedAppsRepo';
import { createSessionRepo } from '@/data/repositories/sessionRepo';
import { createSettingsRepo } from '@/data/repositories/settingsRepo';
import { createUnlockRepo } from '@/data/repositories/unlockRepo';
import { DEFAULT_COURSE } from '@/data/seed/courses';
import { loadSeed } from '@/data/seed/loadSeed';
import { openTestDatabase } from '@/data/testDatabase';
import { setScreenTimeSimulation } from '@/services/screenTime/stub';
import { hydrateBlocking, refreshBlocking, resetBlocking, setBlockedApps } from '@/state/blockingStore';
import { resetDevScript } from '@/state/devSpeechScript';
import { hydrateLearner } from '@/state/learnerStore';
import { hydrateSession, resetSession } from '@/state/sessionStore';
import { hydrateUnlock, resetUnlock } from '@/state/unlockStore';

import { createMemoryLearnerRepository } from './support/memoryLearnerRepo';

jest.mock('@/state/bootstrap', () => ({ useAppBootstrap: () => ({ ready: true, error: null }) }));
let mockIdCounter = 0;
jest.mock('@/lib/id', () => ({ newId: () => `id-${++mockIdCounter}` }));

const appDir = './app';
type Db = Awaited<ReturnType<typeof openTestDatabase>>;

describe('blocking demo', () => {
  let db: Db;

  async function boot() {
    db = await openTestDatabase();
    loadSeed(db, DEFAULT_COURSE, Date.now());
    createSettingsRepo(db).set('activeCourseId', 'en-es-v0');
    await act(async () => {
      resetSession();
      await hydrateLearner(createMemoryLearnerRepository());
      hydrateSession(createSessionRepo(db));
      hydrateUnlock(createUnlockRepo(db));
      hydrateBlocking({ blocked: createBlockedAppsRepo(db), unlock: createUnlockRepo(db) });
    });
  }

  const saved = () => createBlockedAppsRepo(db).list();

  async function open(url: string) {
    const app = renderRouter(appDir, { initialUrl: url });
    await app;
    return { getPathname: () => app.getPathname() };
  }

  /** Types the right answer for every step and presses Next until the session ends. */
  async function finishSession() {
    const sessionId = saved().find((row) => row.state === 'practicing')!.sessionId!;
    const view = createSessionRepo(db).getPractice(sessionId)!;
    for (let i = 0; i < view.steps.length; i++) {
      await screen.findByText(`Step ${i + 1} of ${view.steps.length}`);
      await fireEvent.changeText(await screen.findByLabelText('Type the phrase'), view.steps[i]!.targetText);
      await fireEvent.press(screen.getByRole('button', { name: 'Check typing' }));
      await fireEvent.press(await screen.findByRole('button', { name: 'Next' }));
    }
    return sessionId;
  }

  beforeEach(() => resetDevScript());
  afterEach(() => {
    act(() => {
      resetBlocking();
      resetUnlock();
      resetSession();
    });
    setScreenTimeSimulation(false);
  });

  it('the picker lists the six mock apps, labels the demo, and saves each choice', async () => {
    await boot();
    await open('/blocked/picker');
    expect(screen.getByText('Demo: real blocking needs an iPhone')).toBeOnTheScreen();
    for (const name of ['Instagram', 'Facebook', 'Pinterest', 'TikTok', 'YouTube', 'X']) {
      expect(screen.getByRole('switch', { name: `Block ${name}` })).toBeOnTheScreen();
    }
    expect(screen.getByRole('switch', { name: 'Block Instagram', checked: false })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('switch', { name: 'Block Instagram' }));
    await fireEvent.press(screen.getByRole('switch', { name: 'Block TikTok' }));
    expect(screen.getByRole('switch', { name: 'Block Instagram', checked: true })).toBeOnTheScreen();
    expect(saved().map((row) => [row.appId, row.state]).sort()).toEqual([['instagram', 'locked'], ['tiktok', 'locked']]);

    await fireEvent.press(screen.getByRole('switch', { name: 'Block Instagram' }));
    expect(saved().map((row) => row.appId)).toEqual(['tiktok']);
  });

  it('restores the saved choice after a restart', async () => {
    await boot();
    createBlockedAppsRepo(db).select(['youtube'], Date.now());
    await act(async () => hydrateBlocking({ blocked: createBlockedAppsRepo(db), unlock: createUnlockRepo(db) }));
    await open('/blocked/picker');
    expect(screen.getByRole('switch', { name: 'Block YouTube', checked: true })).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Block X', checked: false })).toBeOnTheScreen();
  });

  it('the Unlock tab invites you to choose apps, then lists them with Try opening', async () => {
    await boot();
    await open('/unlock');
    expect(await screen.findByText('No apps chosen yet. Pick the apps Atlas should lock.')).toBeOnTheScreen();
    expect(screen.getByText('Demo: real blocking needs an iPhone')).toBeOnTheScreen();

    await act(async () => setBlockedApps(['instagram']));
    expect(await screen.findByText('Locked')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try opening Instagram' })).toBeOnTheScreen();
  });

  it('opening a locked app shows the Atlas block screen', async () => {
    await boot();
    createBlockedAppsRepo(db).select(['instagram'], Date.now());
    await act(async () => hydrateBlocking({ blocked: createBlockedAppsRepo(db), unlock: createUnlockRepo(db) }));
    await open('/unlock');
    await fireEvent.press(await screen.findByRole('button', { name: 'Try opening Instagram' }));
    expect(await screen.findByText('Instagram is locked. Practice to unlock.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Start practice' })).toBeOnTheScreen();
    expect(screen.getByText('Demo: real blocking needs an iPhone')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
    await waitFor(() => expect(screen.queryByText('Instagram is locked. Practice to unlock.')).toBeNull());
  });

  it('a block screen for an app that is not blocked says so', async () => {
    await boot();
    await open('/blocked/tiktok');
    expect(await screen.findByText("This app isn't blocked")).toBeOnTheScreen();
  });

  it('practice unlocks the app with a countdown, it is still unlocked on reopen, then it relocks', async () => {
    await boot();
    createBlockedAppsRepo(db).select(['instagram'], Date.now());
    await act(async () => hydrateBlocking({ blocked: createBlockedAppsRepo(db), unlock: createUnlockRepo(db) }));
    const app = await open('/blocked/instagram');

    await fireEvent.press(await screen.findByRole('button', { name: 'Start practice' }));
    await waitFor(() => expect(app.getPathname()).toMatch(/^\/practice\//));
    expect(saved()[0]).toMatchObject({ state: 'practicing' });

    const sessionId = await finishSession();
    await waitFor(() => expect(app.getPathname()).toBe(`/practice/summary/${sessionId}`));
    expect(await screen.findByText('Instagram is unlocked.')).toBeOnTheScreen();
    expect(saved()[0]).toMatchObject({ state: 'unlocked', sessionId });

    // The unlock is real: one grant, active, with Screen Time lifted by the simulated service.
    const grant = createUnlockRepo(db).list()[0]!;
    expect(grant.status).toBe('active');
    expect(grant.screenTimeApplied).toBe(true);

    // Back at the Unlock tab, opening the app shows the time left.
    await fireEvent.press(screen.getByRole('button', { name: 'Back to blocked apps' }));
    await waitFor(() => expect(app.getPathname()).toBe('/unlock'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Try opening Instagram' }));
    expect(await screen.findByText(/^Unlocked, \d\d:\d\d left$/)).toBeOnTheScreen();
    expect(screen.queryByText('Instagram is locked. Practice to unlock.')).toBeNull();

    // The grant runs out while the screen is open: the block screen comes back, and it says why.
    await act(async () => refreshBlocking(grant.expiresAt! + 1000));
    expect(await screen.findByText('Instagram is locked. Practice to unlock.')).toBeOnTheScreen();
    expect(screen.getByText('Your unlock ran out.')).toBeOnTheScreen();
    expect(saved()[0]!.state).toBe('relocked');
  });

  it('leaving a practice session unfinished leaves the app locked', async () => {
    await boot();
    createBlockedAppsRepo(db).select(['instagram'], Date.now());
    await act(async () => hydrateBlocking({ blocked: createBlockedAppsRepo(db), unlock: createUnlockRepo(db) }));
    const app = await open('/blocked/instagram');
    await fireEvent.press(await screen.findByRole('button', { name: 'Start practice' }));
    await waitFor(() => expect(app.getPathname()).toMatch(/^\/practice\//));
    const sessionId = saved()[0]!.sessionId!;

    createSessionRepo(db).abandon(sessionId, Date.now());
    await act(async () => refreshBlocking());
    expect(saved()[0]!.state).toBe('locked');
    expect(createUnlockRepo(db).list()).toHaveLength(0);
  });
});
