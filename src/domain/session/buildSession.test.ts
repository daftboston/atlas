import { buildSession, dailyNewRemaining, interleaveNewItems, type SessionCandidate } from './buildSession';

const NOW = Date.parse('2026-10-07T15:00:00.000Z');
const ZONE = 'America/Bogota';

function item(id: string, seedId: string, overrides: Partial<SessionCandidate> = {}): SessionCandidate {
  return { id, seedId, status: 'new', introducedAt: null, ...overrides };
}

const deck = [
  item('c', 'es-v0-010'),
  item('a', 'es-v0-001'),
  item('b', 'es-v0-002'),
  item('learning', 'es-v0-003', { status: 'learning' }),
  item('done', 'es-v0-004', { introducedAt: NOW - 48 * 60 * 60 * 1000 }),
];

function planInput(overrides: Partial<Parameters<typeof buildSession>[0]> = {}): Parameters<typeof buildSession>[0] {
  return {
    now: NOW,
    timeZone: ZONE,
    mode: 'daily',
    dailyNewLimit: 5,
    sessionSize: 8,
    onboardingItemCount: 3,
    items: deck,
    ...overrides,
  };
}

function plan(overrides: Partial<Parameters<typeof buildSession>[0]> = {}) {
  return buildSession(planInput(overrides));
}

describe('buildSession', () => {
  it('takes new items in seed order, up to the daily limit', () => {
    expect(plan()?.itemIds).toEqual(['a', 'b', 'c']);
    expect(dailyNewRemaining(planInput())).toBe(3);
  });

  it('caps a daily session at session size when the daily limit is higher', () => {
    expect(plan({ sessionSize: 2, dailyNewLimit: 5 })?.itemIds).toEqual(['a', 'b']);
  });

  it('creates no session once today is at the daily limit', () => {
    const introduced = [item('t1', 'es-v0-011', { introducedAt: NOW - 60_000 }), item('t2', 'es-v0-012', { introducedAt: NOW })];
    expect(plan({ dailyNewLimit: 2, items: [...deck, ...introduced] })).toBeNull();
  });

  it('creates no session for an empty deck or review-only mode', () => {
    expect(plan({ items: [] })).toBeNull();
    expect(plan({ mode: 'review-only' })).toBeNull();
  });

  it('onboarding is 3 new items even when the daily limit is already used', () => {
    const introduced = [item('t1', 'es-v0-011', { introducedAt: NOW })];
    expect(plan({ mode: 'onboarding', dailyNewLimit: 1, items: [...deck, ...introduced] })?.itemIds).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('puts recall at least two steps after listen when there is more than one item', () => {
    const steps = plan()?.steps ?? [];
    for (const itemId of ['a', 'b', 'c']) {
      const listenAt = steps.findIndex((step) => step.itemId === itemId && step.promptType === 'listen-repeat');
      const recallAt = steps.findIndex((step) => step.itemId === itemId && step.promptType === 'recall-speak');
      expect(recallAt - listenAt).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps a single item as listen then recall', () => {
    expect(interleaveNewItems(['only'])).toEqual([
      { itemId: 'only', promptType: 'listen-repeat' },
      { itemId: 'only', promptType: 'recall-speak' },
    ]);
  });
});
