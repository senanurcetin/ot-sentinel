import { expect, test } from '@playwright/test';
import { E2E_PASSWORD as password, E2E_USER as username } from './auth-credentials';

// Runs against the second CI server, started with DEMO_BASIC_AUTH (see playwright.config.ts).

test.describe('demo protected by DEMO_BASIC_AUTH', () => {
  test('pages and APIs ask for credentials; the health probe stays open', async ({ request }) => {
    for (const path of ['/', '/case-study', '/api/metrics?attack=false', '/api/feedback/summary']) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(401);
      expect(res.headers()['www-authenticate']).toContain('Basic realm="OT-Sentinel demo"');
      // The config-level security headers still apply to the challenge.
      expect(res.headers()['x-frame-options']).toBe('DENY');
    }
    const feedback = await request.post('/api/feedback', {
      data: { timestamp: new Date().toISOString(), verdict: 'false_alarm' },
    });
    expect(feedback.status()).toBe(401);

    const health = await request.get('/api/health');
    expect(health.status()).toBe(200);
  });

  test('wrong credentials are rejected', async ({ browser }) => {
    const context = await browser.newContext({ httpCredentials: { username, password: 'wrong-password-123' } });
    const res = await context.request.get('/api/metrics?attack=false');
    expect(res.status()).toBe(401);
    await context.close();
  });

  test('with the right credentials the dashboard works end to end', async ({ browser }) => {
    const context = await browser.newContext({ httpCredentials: { username, password } });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'OT-Sentinel' })).toBeVisible();
    // Telemetry polling is a same-origin fetch; the browser resends the credentials.
    await expect(page.getByText(/^\d+\/100$/)).toBeVisible({ timeout: 10_000 });
    await context.close();
  });
});
