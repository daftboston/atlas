import { interruptible, SPEECH_TIMEOUT_MS, SpeechInterruptedError } from './interruptible';

describe('interruptible', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('passes through a result and never runs cleanup', async () => {
    const cleanup = jest.fn();
    const run = interruptible(Promise.resolve(7), cleanup);
    await expect(run.promise).resolves.toBe(7);
    jest.advanceTimersByTime(SPEECH_TIMEOUT_MS * 2);
    run.interrupt();
    expect(cleanup).not.toHaveBeenCalled();
  });

  it('passes through the work error', async () => {
    const run = interruptible(Promise.reject(new Error('cancelled')), jest.fn());
    await expect(run.promise).rejects.toThrow('cancelled');
  });

  it('times out a promise that never resolves and cleans up once', async () => {
    const cleanup = jest.fn();
    const run = interruptible(new Promise<void>(() => {}), cleanup);
    const settled = expect(run.promise).rejects.toMatchObject({ reason: 'timeout' });
    jest.advanceTimersByTime(SPEECH_TIMEOUT_MS - 1);
    expect(cleanup).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    await settled;
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('interrupts early and clears the timer', async () => {
    const cleanup = jest.fn();
    const run = interruptible(new Promise<void>(() => {}), cleanup);
    const settled = expect(run.promise).rejects.toBeInstanceOf(SpeechInterruptedError);
    run.interrupt();
    run.interrupt();
    await settled;
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('still rejects when cleanup throws', async () => {
    const run = interruptible(new Promise<void>(() => {}), () => {
      throw new Error('boom');
    });
    const settled = expect(run.promise).rejects.toMatchObject({ reason: 'interrupted' });
    run.interrupt();
    await settled;
  });
});
