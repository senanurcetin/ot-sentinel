import { withTimeout } from '@/lib/with-timeout';

describe('withTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('resolves with the value when the promise settles in time', async () => {
    await expect(withTimeout(Promise.resolve(42), 1000)).resolves.toBe(42);
  });

  it('rejects with a descriptive error when the promise is too slow', async () => {
    const pending = withTimeout(new Promise(() => {}), 500, 'AI call');
    const assertion = expect(pending).rejects.toThrow('AI call timed out after 500 ms');
    await jest.advanceTimersByTimeAsync(500);
    await assertion;
  });

  it('propagates the original rejection and clears the timer', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 1000)).rejects.toThrow('boom');
    expect(jest.getTimerCount()).toBe(0);
  });
});
