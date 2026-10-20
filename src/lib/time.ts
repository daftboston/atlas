/**
 * The local day rolls over at 04:00 device time (architecture §5).
 * Both functions read `timeZone` on every call. Nothing stores an offset or a day key.
 * Tests inject a zone. Production callers omit it and use the device zone.
 */

const ROLLOVER_HOUR = 4;

type WallClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

function wallClock(nowMs: number, timeZone: string): WallClock {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(nowMs));
  const bag = Object.fromEntries(formatted.map((part) => [part.type, part.value]));
  let hour = Number(bag.hour);
  // Some engines report midnight as hour 24 on the same calendar date.
  if (hour === 24) hour = 0;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour,
    minute: Number(bag.minute),
    second: Number(bag.second),
  };
}

/** Local wall clock interpreted as UTC, minus the real UTC instant. */
function offsetMs(nowMs: number, timeZone: string): number {
  const local = wallClock(nowMs, timeZone);
  const asUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  return asUtc - nowMs;
}

function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const corrected = guess - offsetMs(guess, timeZone);
  return guess - offsetMs(corrected, timeZone);
}

function key(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function shiftCalendarDay(year: number, month: number, day: number, timeZone: string, direction: 1 | -1): WallClock {
  const noon = zonedToUtc(year, month, day, 12, 0, timeZone);
  return wallClock(noon + direction * 24 * 60 * 60 * 1000, timeZone);
}

/** Calendar date of the local day that contains `nowMs`, after the 04:00 rollover. */
export function localDayKey(nowMs: number, timeZone = deviceTimeZone()): string {
  const local = wallClock(nowMs, timeZone);
  const rollover = zonedToUtc(local.year, local.month, local.day, ROLLOVER_HOUR, 0, timeZone);
  if (nowMs >= rollover) return key(local.year, local.month, local.day);
  const previous = shiftCalendarDay(local.year, local.month, local.day, timeZone, -1);
  return key(previous.year, previous.month, previous.day);
}

/** UTC instant when the local day that contains `nowMs` began (04:00 that day). */
export function localDayStartMs(nowMs: number, timeZone = deviceTimeZone()): number {
  const [year, month, day] = localDayKey(nowMs, timeZone).split('-').map(Number);
  return zonedToUtc(year, month, day, ROLLOVER_HOUR, 0, timeZone);
}

/** The next 04:00 strictly after `nowMs`. An instant that is exactly 04:00 belongs to the new day. */
export function nextRolloverMs(nowMs: number, timeZone = deviceTimeZone()): number {
  const local = wallClock(nowMs, timeZone);
  const today = zonedToUtc(local.year, local.month, local.day, ROLLOVER_HOUR, 0, timeZone);
  if (nowMs < today) return today;
  const next = shiftCalendarDay(local.year, local.month, local.day, timeZone, 1);
  return zonedToUtc(next.year, next.month, next.day, ROLLOVER_HOUR, 0, timeZone);
}
