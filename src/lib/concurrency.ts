// Reusable concurrency limiter: keeps at most `maxConcurrent` promises in
// flight; extra callers queue FIFO until a slot frees.
export function createConcurrencyLimiter(maxConcurrent: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  return async function runLimited<T>(fn: () => Promise<T>): Promise<T> {
    if (active >= maxConcurrent) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }

    active += 1;

    try {
      return await fn();
    } finally {
      active -= 1;
      queue.shift()?.();
    }
  };
}