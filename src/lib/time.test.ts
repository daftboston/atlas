import { localDayKey, localDayStartMs, nextRolloverMs } from './time';

const BOGOTA = 'America/Bogota';
const TOKYO = 'Asia/Tokyo';

describe('local day', () => {
  it('rolls the day at 04:00 and keeps 03:59 on the previous day', () => {
    const before = Date.parse('2026-10-07T08:59:00.000Z');
    const at = Date.parse('2026-10-07T09:00:00.000Z');

    expect(localDayKey(before, BOGOTA)).toBe('2026-10-06');
    expect(localDayKey(at, BOGOTA)).toBe('2026-10-07');
    expect(localDayStartMs(before, BOGOTA)).toBe(Date.parse('2026-10-06T09:00:00.000Z'));
    expect(nextRolloverMs(before, BOGOTA)).toBe(Date.parse('2026-10-07T09:00:00.000Z'));
    expect(nextRolloverMs(at, BOGOTA)).toBe(Date.parse('2026-10-08T09:00:00.000Z'));
  });

  it('recomputes the day when the zone changes between calls', () => {
    const now = Date.parse('2026-10-07T19:30:00.000Z');

    expect(localDayKey(now, BOGOTA)).toBe('2026-10-07');
    expect(localDayKey(now, TOKYO)).toBe('2026-10-08');
    expect(localDayStartMs(now, TOKYO)).toBe(Date.parse('2026-10-07T19:00:00.000Z'));
  });
});
