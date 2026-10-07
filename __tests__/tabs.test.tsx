import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import { resetLearnerForTests } from '@/lib/learner-store';

// Render the real app/ tree (root layout included), not a mock file system.
// renderRouter resolves this path from the working directory (the repo root under
// `npm test`), not from the test file as its docs say.
const appDir = './app';

// With @testing-library/react-native 14, `render` is async, so the router helpers
// (`getPathname`) end up on the promise renderRouter returns, not on `screen`.
// Keep that object, await it, and hand back the helper (returning the promise
// itself from an async function would unwrap it).
async function openApp(initialUrl: string) {
  const app = renderRouter(appDir, { initialUrl });
  await app;
  return { getPathname: () => app.getPathname() };
}

describe('Tabs (architecture §3)', () => {
  beforeEach(() => {
    resetLearnerForTests();
  });

  it('opens on Learn from the root URL', async () => {
    const app = await openApp('/');

    expect(app.getPathname()).toBe('/learn');
    expect(screen.getByText("You speak English, you're learning Spanish")).toBeOnTheScreen();
  });

  it.each([
    ['Learn', '/learn', "You speak English, you're learning Spanish"],
    ['Review', '/review', 'Start your course on the Learn tab first.'],
    ['Unlock', '/unlock', 'Not built yet. This screen is a placeholder.'],
    ['Settings', '/settings', 'Course not started yet.'],
  ])('renders the %s tab', async (_title, pathname, content) => {
    const app = await openApp(pathname);

    expect(app.getPathname()).toBe(pathname);
    expect(screen.getByText(content)).toBeOnTheScreen();
  });

  it('shows exactly Learn, Review, Unlock and Settings in the tab bar, and each one opens', async () => {
    const app = await openApp('/learn');

    const tabs = screen
      .getAllByRole('button')
      .map((button) => String(button.props.accessibilityLabel))
      .filter((label) => label.includes(', tab, '))
      .map((label) => label.split(',')[0]);
    expect(tabs).toEqual(['Learn', 'Review', 'Unlock', 'Settings']);

    await fireEvent.press(screen.getByRole('button', { name: /^Review/ }));
    expect(app.getPathname()).toBe('/review');
    await fireEvent.press(screen.getByRole('button', { name: /^Unlock/ }));
    expect(app.getPathname()).toBe('/unlock');
    await fireEvent.press(screen.getByRole('button', { name: /^Settings/ }));
    expect(app.getPathname()).toBe('/settings');
    await fireEvent.press(screen.getByRole('button', { name: /^Learn/ }));
    expect(app.getPathname()).toBe('/learn');
  });
});
