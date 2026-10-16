import { test, expect } from '@playwright/test';

test('offline replay workbench starts unverified and does not request a server upload', async ({ page }) => {
  const uploads: string[] = [];
  page.on('request', request => {
    if (request.method() === 'POST') uploads.push(request.url());
  });
  await page.goto('/offline-replay');
  await expect(page.getByRole('heading', { name: 'Local Telemetry Replay' })).toBeVisible();
  await expect(page.getByText('No verified recording loaded')).toBeVisible();
  await expect(page.getByText('LOCAL HASH VERIFIED')).toHaveCount(0);
  await page.getByRole('button', { name: 'Verify and open replay' }).click();
  await expect(page.getByRole('alert')).toContainText('Choose a local recording');
  expect(uploads).toEqual([]);
});
