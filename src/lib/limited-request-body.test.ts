/** @jest-environment node */
import { readTextWithinLimit } from '@/lib/limited-request-body';

const request = (value: string): Request =>
  new Request('http://localhost/api/feedback', { method: 'POST', body: value });

describe('readTextWithinLimit', () => {
  it('accepts a valid request at the exact byte limit', async () => {
    expect(await readTextWithinLimit(request('hello'), 5)).toBe('hello');
  });

  it('rejects oversized bodies without reading the rest', async () => {
    expect(await readTextWithinLimit(request('hello!'), 5)).toBeNull();
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('1234'));
        controller.enqueue(new TextEncoder().encode('5678'));
      },
      cancel() {
        cancelled = true;
      },
    });
    expect(await readTextWithinLimit({ body: stream } as Request, 6)).toBeNull();
    expect(cancelled).toBe(true);
  });

  it('counts bytes, not Unicode characters', async () => {
    expect(await readTextWithinLimit(request('çığ'), 6)).toBe('çığ');
    expect(await readTextWithinLimit(request('çığ'), 5)).toBeNull();
  });

  it('handles a missing body and empty payload', async () => {
    const noBody = new Request('http://localhost/api/feedback', { method: 'POST' });
    expect(await readTextWithinLimit(noBody, 0)).toBe('');
    expect(await readTextWithinLimit(request(''), 0)).toBe('');
  });

  it('does not decode a partial UTF-8 code point between stream chunks', async () => {
    const bytes = new TextEncoder().encode('ürün');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, 1));
        controller.enqueue(bytes.slice(1, 3));
        controller.enqueue(bytes.slice(3));
        controller.close();
      },
    });
    expect(await readTextWithinLimit({ body: stream } as Request, bytes.byteLength)).toBe('ürün');
  });

  it('rejects invalid maximum sizes', async () => {
    await expect(readTextWithinLimit(request('a'), -1)).rejects.toThrow(RangeError);
    await expect(readTextWithinLimit(request('a'), Number.POSITIVE_INFINITY)).rejects.toThrow(RangeError);
  });
  it('rejects malformed UTF-8 instead of silently changing forensic feedback text', async () => {
    const invalidJsonBytes = new Uint8Array([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xc3, 0x28, 0x22, 0x7d]);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(invalidJsonBytes.subarray(0, 7));
        controller.enqueue(invalidJsonBytes.subarray(7));
        controller.close();
      },
    });
    await expect(readTextWithinLimit({ body: stream } as Request, 100)).rejects.toMatchObject({ name: 'TypeError' });
  });

});
