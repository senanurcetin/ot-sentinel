/** Reject if `promise` has not settled within `ms`. The underlying work is not cancelled. */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
