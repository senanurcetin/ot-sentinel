import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
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
  await expect(page.getByRole('heading', { name: '03 / Historical sample trends' })).toBeVisible();
  await expect(page.getByText('1 samples in view')).toBeVisible();
  await page.getByRole('button', { name: 'Next recorded sample' }).click();
  await expect(page.getByText('Historical detector verdict: CRITICAL')).toBeVisible();
  await expect(page.getByText('2 samples in view')).toBeVisible();
  await expect(page.getByText('1 / 2')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Why this historical score?' })).toBeVisible();
  await expect(page.getByText('End of verified recording.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next recorded sample' })).toBeDisabled();
  // Download a local JSON snapshot, not an uploaded file or fabricated entire-log report.
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download reviewed JSON report' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('ot-sentinel-reviewed-window.json');
  const report = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(report.schema).toBe('ot-sentinel/local-reviewed-window/v1');
  expect(report.origin_authentication).toBe('NOT VERIFIED');
  expect(report.detector).toBe('synthetic-three-sensor-demo');
  expect(report.recording.sha256).toBe(independentlyPinnedDigest);
  expect(report.review.exported_rows).toBe(2);
  expect(report.review.inspected_rows_since_last_restart).toBe(2);
  expect(report.review.critical_rows_in_export).toBe(1);
  expect(report.reviewed_samples.map((row: { demo_verdict: string }) => row.demo_verdict))
    .toEqual(['SECURE', 'CRITICAL']);
  expect(uploads).toEqual([]);


  await page.getByRole('button', { name: 'Restart from first sample' }).click();
  await expect(page.getByText('Verified and ready.', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: '03 / Historical sample trends' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Download reviewed JSON report' })).toBeDisabled();
  expect(uploads).toEqual([]);
});

test('batch navigation reviews all intervening historical rows and stops at EOF', async ({ page }) => {
  const uploads: string[] = [];
  page.on('request', request => {
    if (request.method() === 'POST') uploads.push(request.url());
  });
  await page.goto('/offline-replay');
  await page.locator('#recording-json')
    .setInputFiles(join(fixtures, 'offline-recording.json'));
  await page.locator('#manifest-json')
    .setInputFiles(join(fixtures, 'offline-recording.manifest.json'));
  await page.locator('#trusted-digest').fill(independentlyPinnedDigest);
  await page.getByRole('button', { name: 'Verify and open replay' }).click();
  await expect(page.getByText('LOCAL HASH VERIFIED')).toBeVisible();

  // Fixture contains two samples; a ten-sample request must clamp to EOF.
  await page.getByRole('button', { name: 'Review next 10 samples' }).click();
  await expect(page.getByText('2 samples in view')).toBeVisible();
  await expect(page.getByText('Historical detector verdict: CRITICAL')).toBeVisible();
  await expect(page.getByText('End of verified recording.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review next 10 samples' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Review next 100 samples' })).toBeDisabled();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download reviewed JSON report' }).click();
  const download = await downloadPromise;
  const report = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(report.review.inspected_rows_since_last_restart).toBe(2);
  expect(report.review.exported_rows).toBe(2);
  expect(report.reviewed_samples.map((row: { timestamp: string }) => row.timestamp))
    .toEqual(['2026-10-16T10:00:00Z', '2026-10-16T10:00:01Z']);
  expect(uploads).toEqual([]);
});
