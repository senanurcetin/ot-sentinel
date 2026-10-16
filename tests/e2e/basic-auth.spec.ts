import { test, expect } from '@playwright/test';
import { E2E_USER, E2E_PASSWORD } from './auth-credentials';

// Only included in the local CI project running a second protected server.
test.describe('optional synthetic demo access', () => {
  test('refuses anonymous pages, APIs, feedback writes and replay, health stays public', async ({ request }) => {
    for (const path of ['/', '/case-study', '/offline-replay', '/api/metrics?attack=false', '/api/feedback/summary']) {
      const result = await request.get(path);
      expect(result.status(), path).toBe(401);
      expect(result.headers()['www-authenticate']).toContain('OT-Sentinel synthetic demo');
      expect(result.headers()['cache-control']).toBe('no-store');
    }
    const feedback = await request.post('/api/feedback', {
      data: { timestamp: new Date().toISOString(), verdict: 'false_alarm' },
    });
    expect(feedback.status()).toBe(401);
    const health = await request.get('/api/health');
    expect(health.status()).toBe(200);
  });

  test('rejects a wrong shared password without exposing app content', async ({ browser }) => {
    const ctx = await browser.newContext({
      httpCredentials: { username: E2E_USER, password: 'incorrect-but-long-password' },
    });
    try {
      const response = await ctx.request.get('/offline-replay');
      expect(response.status()).toBe(401);
    } finally {
      await ctx.close();
    }
  });

  test('correct CI-only shared credentials open dashboard and offline replay', async ({ browser }) => {
    const ctx = await browser.newContext({
      httpCredentials: { username: E2E_USER, password: E2E_PASSWORD },
    });
    try {
      const page = await ctx.newPage();
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Industrial Security Overview' })).toBeVisible();
      await expect(page.getByText(/SIMULATED OT STREAM/)).toBeVisible();
      await page.goto('/offline-replay');
      await expect(page.getByRole('heading', { name: 'Local Telemetry Replay' })).toBeVisible();
    } finally {
      await ctx.close();
    }
  });
});
