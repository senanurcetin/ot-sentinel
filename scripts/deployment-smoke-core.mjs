/** Routes that must answer from the exact deployed release candidate. */
export const criticalRoutes = Object.freeze([
  '/',
  '/offline-replay',
  '/batadal-explorer',
  '/batadal-history',
  '/batadal-test-history',
  '/case-study',
  '/api/health',
]);

export function validateDeploymentOrigin(input) {
  const url = new URL(input);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    throw new Error('Deployment smoke requires HTTPS or localhost HTTP.');
  }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Use a bare deployment origin without credentials, path or query.');
  }
  return url.origin;
}

/**
 * Consume at most 120 KB of a deployment response. Fetch's response.text()
 * buffers the entire body before slicing, so a malformed upstream response
 * could exhaust the smoke runner's memory. Cancel the stream at the cap.
 */
export async function readLimitedResponseText(response, maxBytes = 120000) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 120000) {
    throw new RangeError('Smoke response limit must be between 1 and 120000 bytes.');
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let output = '';
  let complete = false;
  try {
    while (bytes < maxBytes) {
      const { done, value } = await reader.read();
      if (done) {
        complete = true;
        break;
      }
      const consumed = Math.min(value.byteLength, maxBytes - bytes);
      output += decoder.decode(value.subarray(0, consumed), { stream: true });
      bytes += consumed;
      if (consumed < value.byteLength) break;
    }
    return output + decoder.decode();
  } finally {
    if (!complete) {
      try { await reader.cancel(); } catch { /* Abort/stream failure: already bounded. */ }
    }
    reader.releaseLock();
  }
}

/**
 * A 200 SSO login page is not an authenticated application page.
 * Redirects never count as success; callers must not forward credentials
 * to an unrelated origin. API health must return its actual JSON contract.
 */
export function classifyDeploymentResponse(route, response, expectedSha = null) {
  const status = response.status;
  if (status !== 200) {
    return { ok: false, reason: (status >= 300 && status < 400)
      ? 'redirect/authentication challenge' : 'HTTP ' + status };
  }
  const contentType = String(response.contentType ?? '').toLowerCase();
  const body = String(response.body ?? '');
  const protectedPage = /vercel authentication|deployment protection|\/_vercel\/sso|sign in to vercel/i.test(body);
  if (protectedPage) return { ok: false, reason: 'SSO-protected login content, not app acceptance' };

  if (route === '/api/health') {
    if (!contentType.includes('application/json')) {
      return { ok: false, reason: 'health response was not JSON' };
    }
    let parsed;
    try { parsed = JSON.parse(body); } catch { return { ok: false, reason: 'invalid health JSON' }; }
    if (parsed?.status !== 'ok' || typeof parsed.version !== 'string') {
      return { ok: false, reason: 'unexpected health contract' };
    }
    if (expectedSha !== null) {
      if (!/^[0-9a-f]{40}$/.test(expectedSha)) {
        return { ok: false, reason: 'invalid expected deployment SHA' };
      }
      if (parsed.commit !== expectedSha) {
        return { ok: false, reason: 'deployed SHA missing or differs from expected release' };
      }
      return { ok: true, reason: 'health contract and exact deployment SHA verified' };
    }
    return { ok: true, reason: 'health contract verified' };
  }
  if (!contentType.includes('text/html') || !/<html[\s>]/i.test(body)) {
    return { ok: false, reason: 'expected HTML application page' };
  }
  return { ok: true, reason: 'HTML route responded' };
}
