import { test, expect } from '@playwright/test';

test('BATADAL 43-signal explorer is real benchmark evidence, not synthetic telemetry', async ({ page }) => {
  await page.goto('/case-study');
  await page.getByRole('link', { name: 'Open BATADAL evidence explorer' }).click();
  await expect(page).toHaveURL(/\/batadal-explorer$/);
  await expect(page.getByRole('heading', { name: 'BATADAL signal evidence explorer' })).toBeVisible();
  await expect(page.getByText('43 of 43 signals shown')).toBeVisible();
  await expect(page.getByText(/not a live SCADA feed/i)).toBeVisible();
  const attacks = page.getByRole('region', { name: 'Published attack descriptions' });
  await expect(attacks.getByText('#8')).toBeVisible();
  await expect(attacks.getByText('#14')).toBeVisible();
  await page.getByRole('combobox', { name: 'Signal category' }).selectOption('tanks');
  await expect(page.getByText('7 of 43 signals shown')).toBeVisible();
  const inventory = page.getByRole('region', { name: 'Signal inventory' });
  await expect(inventory.getByText('L_T1')).toBeVisible();
  await expect(inventory.getByText('P_J280')).toHaveCount(0);

  // 2016 is training data for the supervised reference, so that detector must disappear.
  await page.getByRole('combobox', { name: 'Evaluated detector' })
    .selectOption('hist_gradient_boosting');
  await page.getByRole('combobox', { name: 'Evaluation set' }).selectOption('train');
  await expect(page.getByRole('combobox', { name: 'Evaluated detector' })).toHaveValue('zscore_max');
  await expect(attacks.getByText('#1')).toBeVisible();
  await expect(attacks.getByText('#14')).toHaveCount(0);
  await expect(page.getByText(/does not execute new model inference/i)).toBeVisible();
});
