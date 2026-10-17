#!/usr/bin/env node
import { criticalRoutes, validateDeploymentOrigin, classifyDeploymentResponse } from './deployment-smoke-core.mjs';

const raw = process.env.DEPLOYMENT_SMOKE_URL;
if (!raw) {
  console.error('Set DEPLOYMENT_SMOKE_URL to the exact protected preview origin. No requests were made.');
  process.exitCode = 2;
} else {
  try {
    const origin = validateDeploymentOrigin(raw);
    const expectedSha = process.env.DEPLOYMENT_SMOKE_EXPECTED_SHA;
    if (!expectedSha || !/^[0-9a-f]{40}$/.test(expectedSha)) {
      throw new Error('DEPLOYMENT_SMOKE_EXPECTED_SHA must be the full 40-character commit SHA.');
    }
    const headers = { Accept: 'text/html,application/json' };
    // Explicit opt-in only. Never echo secrets, and disable HTTP redirects so
    // they cannot be forwarded to an SSO or other off-origin service.
    if (process.env.DEPLOYMENT_SMOKE_COOKIE) {
      headers.Cookie = process.env.DEPLOYMENT_SMOKE_COOKIE;
    }
    if (process.env.DEPLOYMENT_SMOKE_BYPASS) {
      headers['x-vercel-protection-bypass'] = process.env.DEPLOYMENT_SMOKE_BYPASS;
    }

    let failed = 0;
    for (const route of criticalRoutes) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(new URL(route, origin), {
          method: 'GET',
          headers,
          redirect: 'manual',
          cache: 'no-store',
          signal: controller.signal,
        });
        const body = (await response.text()).slice(0, 120000);
        const verdict = classifyDeploymentResponse(route, {
          status: response.status,
          contentType: response.headers.get('content-type'),
          body,
        }, expectedSha);
        console.log((verdict.ok ? 'PASS ' : 'FAIL ') + route + ': ' + verdict.reason);
        if (!verdict.ok) failed += 1;
      } catch {
        failed += 1;
        console.error('FAIL ' + route + ': network, connection or timeout error');
      } finally {
        clearTimeout(timeout);
      }
    }
    console.log(failed
      ? 'Release acceptance BLOCKED: ' + failed + ' route(s) require authenticated review.'
      : 'Route/health smoke PASS. Browser, SSO authorization and production checks remain separate.');
    if (failed) process.exitCode = 1;
  } catch (error) {
    console.error('Invalid deployment smoke configuration: ' + (error instanceof Error ? error.message : 'unknown input'));
    process.exitCode = 2;
  }
}
