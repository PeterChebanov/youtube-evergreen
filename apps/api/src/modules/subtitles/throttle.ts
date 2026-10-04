export class RetryableError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Runs tasks one at a time with a minimum gap between starts (REQUIREMENTS 6.3: no parallel yt-dlp). */
export class SerialThrottle {
  private tail: Promise<unknown> = Promise.resolve();
  private lastStart = 0;

  constructor(private readonly minGapMs: number) {}

  run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.tail.then(async () => {
      const wait = this.lastStart + this.minGapMs - Date.now();
      if (this.lastStart && wait > 0) await sleep(wait);
      this.lastStart = Date.now();
      return task();
    });
    this.tail = next.catch(() => undefined);
    return next;
  }
}

/** Retries RetryableError with exponential backoff; other errors fail immediately. */
export async function withBackoff<T>(task: () => Promise<T>, retries: number, baseMs: number): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await task();
    } catch (e) {
      if (!(e instanceof RetryableError) || attempt >= retries) throw e;
      await sleep(baseMs * 2 ** attempt);
    }
  }
}
