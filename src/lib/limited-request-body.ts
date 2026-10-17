/**
 * Read a request body with an enforced byte cap *during* streaming.
 * Calling Request.text() before checking the length can buffer an arbitrarily
 * large attacker-controlled payload. Returning null means the cap was exceeded.
 */
export async function readTextWithinLimit(request: Request, maxBytes: number): Promise<string | null> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError('maxBytes must be a nonnegative safe integer');
  }

  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (total + value.byteLength > maxBytes) {
        // Stop processing oversized payloads without buffering the remainder.
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
      total += value.byteLength;
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    // Never silently rewrite malformed bytes to U+FFFD in forensic feedback.
    // The caller maps decoder failures to HTTP 400 without persisting a verdict.
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } finally {
    reader.releaseLock();
  }
}
