import { join } from 'node:path';
import { test, expect } from '@playwright/test';

const fixtures = join(process.cwd(), 'tests', 'fixtures');
const independentlyPinnedDigest = 'b9d39cd41d9358d143432876db77de7ac70e315d9dc4ac1ee4972f34160b2936';

test('local verified replay steps through historical samples without uploading files', async ({ page }) => {
  const uploads: string[] = [];
  page.on('request', request => {
    if (request.method() === 'POST') uploads.push(request.url());
  });
  await page.goto('/offline-replay');
  await expect(page.getByRole('heading', { name: 'Local Telemetry Replay' })).toBeVisible();
  await expect(page.getByText('No verified recording loaded')).toBeVisible();
  await expect(page.getByText('LOCAL HASH VERIFIED')).toHaveCount(0);

  await page.locator('#recording-json')
    .setInputFiles(join(fixtures, 'offline-recording.json'));
  await page.locator('#manifest-json')
    .setInputFiles(join(fixtures, 'offline-recording.manifest.json'));
  await page.locator('#trusted-digest').fill(independentlyPinnedDigest);
  await page.getByRole('button', { name: 'Verify and open replay' }).click();

  await expect(page.getByText('LOCAL HASH VERIFIED')).toBeVisible();
  await page.getByRole('button', { name: 'Next recorded sample' }).click();
  await expect(page.getByText('Historical detector verdict: SECURE')).toBeVisible();
  await page.getByRole('button', { name: 'Next recorded sample' }).click();
  await expect(page.getByText('Historical detector verdict: CRITICAL')).toBeVisible();
  await expect(page.getByText('End of verified recording.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next recorded sample' })).toBeDisabled();

  await page.getByRole('button', { name: 'Restart from first sample' }).click();
  await expect(page.getByText('Verified and ready.', { exact: false })).toBeVisible();
  expect(uploads).toEqual([]);
});
