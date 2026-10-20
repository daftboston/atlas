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
    due: [],
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

  it('reviews the most at-risk cards first and fills the remaining slots with new items', () => {
    const result = plan({
      sessionSize: 3,
      due: [
        { itemId: 'r1', retrievability: 0.8 },
        { itemId: 'r2', retrievability: 0.2 },
      ],
    });
    expect(result?.itemIds).toEqual(['r2', 'r1', 'a']);
    expect(result?.steps.map((step) => step.promptType)).toEqual([
      'recall-speak',
      'recall-speak',
      'listen-repeat',
      'recall-speak',
    ]);
  });

  it('adds no new items when more than 30 cards are due', () => {
    const due = Array.from({ length: 31 }, (_, index) => ({ itemId: `d${index}`, retrievability: index / 100 }));
    expect(plan({ sessionSize: 8, due })?.itemIds).toEqual(['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7']);
    expect(plan({ sessionSize: 40, due })?.itemIds).toHaveLength(31);
  });

  it('review-only takes due cards and skips new items', () => {
    expect(plan({ mode: 'review-only', due: [{ itemId: 'rev', retrievability: 0.4 }] })?.steps).toEqual([
      { itemId: 'rev', promptType: 'recall-speak' },
    ]);
  });

  it('onboarding stays three new items when reviews are due', () => {
    expect(plan({ mode: 'onboarding', due: [{ itemId: 'rev', retrievability: 0.1 }] })?.itemIds).toEqual(['a', 'b', 'c']);
  });

  it('keeps a single item as listen then recall', () => {
    expect(interleaveNewItems(['only'])).toEqual([
      { itemId: 'only', promptType: 'listen-repeat' },
      { itemId: 'only', promptType: 'recall-speak' },
    ]);
  });
});
