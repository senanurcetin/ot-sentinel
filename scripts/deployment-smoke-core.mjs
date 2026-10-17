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
