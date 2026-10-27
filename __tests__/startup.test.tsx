import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';

import { openAndMigrateDatabase } from '@/data/db';
import { openTestDatabase } from '@/data/testDatabase';

// The real root layout and the real bootstrap run here. Only the database opener is replaced:
// it fails on demand, then hands back a real migrated SQLite (node:sqlite behind the expo-sqlite driver).
jest.mock('@/data/db', () => ({ openAndMigrateDatabase: jest.fn() }));

// expo-crypto is native, so seeding gets counter ids (as in the repository tests).
let mockIdCounter = 0;
jest.mock('@/lib/id', () => ({ newId: () => `id-${++mockIdCounter}` }));

const open = jest.mocked(openAndMigrateDatabase);
const appDir = './app';

// A fresh database has not finished onboarding, so a working startup lands on Welcome.
const APP_OPEN = { name: 'Welcome' };
const ERROR_TITLE = "Atlas couldn't open your saved data";

describe('Startup (architecture §3 root layout)', () => {
  beforeEach(() => {
    open.mockReset();
  });

  it('shows the startup error screen when the database cannot be opened, not a crash', async () => {
    open.mockRejectedValue(new Error('unable to open database file'));

    await renderRouter(appDir, { initialUrl: '/learn' });

    expect(await screen.findByRole('header', { name: ERROR_TITLE })).toBeOnTheScreen();
    expect(screen.getByText('unable to open database file')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeOnTheScreen();
    // The app itself never mounted.
    expect(screen.queryByRole('header', APP_OPEN)).not.toBeOnTheScreen();
  });

  it('shows the same screen when a migration fails', async () => {
    open.mockRejectedValue(new Error('migration 0005 failed'));

    await renderRouter(appDir, { initialUrl: '/learn' });

    expect(await screen.findByText('migration 0005 failed')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeOnTheScreen();
  });

  it('Retry runs the startup again, and the app opens once it works', async () => {
    open.mockRejectedValueOnce(new Error('disk is busy'));
    open.mockImplementationOnce(() => openTestDatabase());

    await renderRouter(appDir, { initialUrl: '/learn' });
    await screen.findByText('disk is busy');
    expect(open).toHaveBeenCalledTimes(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('header', APP_OPEN)).toBeOnTheScreen();
    expect(open).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('header', { name: ERROR_TITLE })).not.toBeOnTheScreen();
  });

  it('keeps showing the error, with Retry, when the retry fails too', async () => {
    open.mockRejectedValueOnce(new Error('first failure'));
    open.mockRejectedValueOnce(new Error('second failure'));
    open.mockImplementationOnce(() => openTestDatabase());

    await renderRouter(appDir, { initialUrl: '/learn' });
    await screen.findByText('first failure');

    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('second failure')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByRole('header', APP_OPEN)).toBeOnTheScreen());
  });
});
