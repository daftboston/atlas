/** @jest-environment node */
import { createScreenTimeStub } from './stub';

describe('screen time stub', () => {
  it('rejects a shield lift while Screen Time is unavailable', async () => {
    const screenTime = createScreenTimeStub();
    await expect(screenTime.availability()).resolves.toBe('unavailable');
    await expect(screenTime.liftShield(1_000)).rejects.toThrow(/unavailable/);
  });

  it('records a lift and a restore when the dev toggle simulates authorization', async () => {
    const screenTime = createScreenTimeStub();
    screenTime.setSimulated(true);
    await screenTime.liftShield(5_000);
    await screenTime.restoreShield();
    expect(screenTime.events()).toEqual([{ type: 'authorizationChanged', availability: 'authorized' }, { type: 'shieldLifted', until: 5_000 }, { type: 'shieldRestored' }]);
  });

  it('remembers the blocked selection it was given, for the blocking demo', async () => {
    const screenTime = createScreenTimeStub();
    await expect(screenTime.getSelection()).resolves.toBeNull();
    const selection = { token: 'demo', appCount: 2, categoryCount: 0, appIds: ['instagram', 'x'] };
    await screenTime.applyShield(selection);
    await expect(screenTime.getSelection()).resolves.toEqual(selection);
  });
});
