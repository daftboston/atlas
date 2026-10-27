import { renderHook } from '@testing-library/react-native';

import { SINGLE_TAP_WINDOW_MS, useSingleTap } from './useSingleTap';

describe('useSingleTap', () => {
  afterEach(() => jest.restoreAllMocks());

  it('runs once for taps in the same tick and passes the arguments', async () => {
    const handler = jest.fn();
    const { result } = await renderHook(() => useSingleTap(handler));
    result.current();
    result.current();
    result.current();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('runs again after the window', async () => {
    let now = 1_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const handler = jest.fn();
    const { result } = await renderHook(() => useSingleTap(handler));
    result.current();
    now += SINGLE_TAP_WINDOW_MS - 1;
    result.current();
    now += 1;
    result.current();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('always calls the latest handler', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const { result, rerender } = await renderHook(({ fn }: { fn: () => void }) => useSingleTap(fn), { initialProps: { fn: first as () => void } });
    await rerender({ fn: second });
    result.current();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
