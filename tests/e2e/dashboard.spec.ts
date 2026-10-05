import { expect, test } from '@playwright/test';

const attackSwitch = (page: import('@playwright/test').Page) =>
  page.getByRole('switch', { name: 'Simulate Attack' });

test.describe('OT-Sentinel dashboard', () => {
  test('loads and streams telemetry with a detector risk score', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'OT-Sentinel' })).toBeVisible();
    // First poll replaces N/A with "<n>/100".
    await expect(page.getByText(/^\d+\/100$/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('sensor-contributions')).toContainText('Current risk score');
    await expect(page.getByText(/Showing last [1-9]\d* events/)).toBeVisible();
  });

  test('attack simulation raises a critical alert and explains which sensors drive it', async ({ page }) => {
    await page.goto('/');
    await attackSwitch(page).click();

    await expect(page.getByText('CRITICAL THREAT DETECTED')).toBeVisible({ timeout: 10_000 });
    const panel = page.getByTestId('sensor-contributions');
    await expect(panel).toContainText('critical');
    await expect(panel).toContainText('vibration'); // DOM text is lowercase; CSS capitalises it
    await expect(page.getByText('Critical events in this session').locator('..').getByText('1')).toBeVisible();

    // With no valid Gemini key the dialog must still give the operator usable guidance.
    await expect(page.getByText(/Isolate the affected network segment/)).toBeVisible({ timeout: 15_000 });
  });

  test('operator verdict is sent to /api/feedback and dismisses the alert', async ({ page }) => {
    const bodies: unknown[] = [];
    await page.route('**/api/feedback', async (route) => {
      bodies.push(route.request().postDataJSON());
      await route.fulfill({ status: 202, json: { received: true, stored: 1 } });
    });

    await page.goto('/');
    await attackSwitch(page).click();
    await expect(page.getByText('CRITICAL THREAT DETECTED')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Mark as false alarm' }).click();
    await expect(page.getByText('CRITICAL THREAT DETECTED')).toBeHidden();
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ verdict: 'false_alarm', timestamp: expect.any(String) });
  });

  test('forensic report downloads a CSV of the audit log', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/Showing last [3-9]\d* events|Showing last \d{2,} events/)).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: 'View Report' }).click();
    await expect(page.getByRole('heading', { name: 'Forensic Analysis Report' })).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Download Report/ }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^otsentinel-forensic-report-.+\.csv$/);

    const { readFile } = await import('node:fs/promises');
    const csv = await readFile((await download.path())!, 'utf8');
    const [header, ...rows] = csv.split('\n');
    expect(header).toBe('Timestamp,Status,Source IP,Payload');
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows[0]).toMatch(/^"\d{4}-\d{2}-\d{2}T[\d:.]+Z","(SECURE|CRITICAL)","[^"]+","/);
  });
});
