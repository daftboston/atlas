/** Longest a speak or listen call may run before the learner gets control back. */
export const SPEECH_TIMEOUT_MS = 15_000;

export class SpeechInterruptedError extends Error {
  constructor(readonly reason: 'timeout' | 'interrupted') {
    super(`Speech ${reason}`);
    this.name = 'SpeechInterruptedError';
  }
}

export type Interruptible<T> = {
  /** Settles with `work`, or rejects with SpeechInterruptedError on timeout or `interrupt()`. */
  promise: Promise<T>;
  /** Stops waiting now (unmount, app in background). Runs `cleanup`. No effect once settled. */
  interrupt(): void;
};

/**
 * A speech engine can stall and never settle. This wraps its promise so the caller always gets an answer:
 * after `timeoutMs`, or when `interrupt()` is called, the promise rejects and `cleanup` stops the engine.
 */
export function interruptible<T>(work: Promise<T>, cleanup: () => void, timeoutMs = SPEECH_TIMEOUT_MS): Interruptible<T> {
  let stop: (reason: 'timeout' | 'interrupted') => void = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => stop('timeout'), timeoutMs);
    stop = (reason) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        cleanup();
      } catch {
        // Cleanup is best effort. The learner must get control back either way.
      }
      reject(new SpeechInterruptedError(reason));
    };
    work.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
  return { promise, interrupt: () => stop('interrupted') };
}
