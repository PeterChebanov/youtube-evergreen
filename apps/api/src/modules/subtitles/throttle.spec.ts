import { RetryableError, SerialThrottle, withBackoff } from './throttle';

describe('SerialThrottle', () => {
  it('never runs two downloads at once and spaces their starts', async () => {
    const throttle = new SerialThrottle(30);
    let running = 0;
    let maxRunning = 0;
    const starts: number[] = [];
    const task = () =>
      throttle.run(async () => {
        starts.push(Date.now());
        maxRunning = Math.max(maxRunning, ++running);
        await new Promise((r) => setTimeout(r, 5));
        running--;
      });
    await Promise.all([task(), task(), task()]);
    expect(maxRunning).toBe(1);
    expect(starts[1] - starts[0]).toBeGreaterThanOrEqual(28);
    expect(starts[2] - starts[1]).toBeGreaterThanOrEqual(28);
  });

  it('keeps working after a failed task', async () => {
    const throttle = new SerialThrottle(0);
    await expect(throttle.run(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    await expect(throttle.run(async () => 'ok')).resolves.toBe('ok');
  });
});

describe('withBackoff', () => {
  it('retries rate-limit errors until success', async () => {
    let calls = 0;
    const result = await withBackoff(async () => {
      if (++calls < 3) throw new RetryableError('429');
      return 'subtitles';
    }, 3, 1);
    expect(result).toBe('subtitles');
    expect(calls).toBe(3);
  });

  it('gives up after the allowed retries', async () => {
    let calls = 0;
    await expect(withBackoff(async () => {
      calls++;
      throw new RetryableError('429');
    }, 2, 1)).rejects.toThrow('429');
    expect(calls).toBe(3);
  });

  it('does not retry other failures', async () => {
    let calls = 0;
    await expect(withBackoff(async () => {
      calls++;
      throw new Error('video is private');
    }, 3, 1)).rejects.toThrow('private');
    expect(calls).toBe(1);
  });
});
