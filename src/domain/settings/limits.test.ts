import { clampDailyNewLimit, clampSessionSize, normalizeRetention } from '@/domain/settings/limits';

describe('practice setting limits', () => {
  it('keeps a new-phrase count between 1 and 20', () => {
    expect(clampDailyNewLimit(0)).toBe(1);
    expect(clampDailyNewLimit(5.6)).toBe(6);
    expect(clampDailyNewLimit(40)).toBe(20);
    expect(clampDailyNewLimit(Number.NaN)).toBe(5);
  });

  it('keeps a session size between 1 and 20', () => {
    expect(clampSessionSize(0)).toBe(1);
    expect(clampSessionSize(8)).toBe(8);
    expect(clampSessionSize(100)).toBe(20);
  });

  it('accepts only the listed retention choices', () => {
    expect(normalizeRetention(0.8)).toBe(0.8);
    expect(normalizeRetention(0.9)).toBe(0.9);
    expect(normalizeRetention(0.99)).toBe(0.9);
  });
});
