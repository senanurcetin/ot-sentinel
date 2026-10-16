import { test, expect } from '@playwright/test';

test('source verified 2016 hourly BATADAL shows genuine attacker windows and all signal groups', async ({ page }) => {
  await page.goto('/batadal-history');
  await expect(page.getByRole('heading', { name: 'Verified 2016 hourly sensor history' })).toBeVisible();
  await expect(page.getByText(/43 real channels/i)).toBeVisible();
  await expect(page.getByText(/source-local, not asserted UTC/i)).toBeVisible();
  const chart = page.getByRole('region', { name: 'Real historical measurement chart' });
  await expect(chart.getByText('50 / 74 in published attack interval')).toBeVisible();
  const retro = page.getByRole('region', { name: 'Retrospective model evidence' });
  await expect(retro.getByText(/0 h after published attack start/)).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Retrospective detector' })
    .locator('option[value="hist_gradient_boosting"]')).toHaveCount(0);
  await expect(chart.locator('svg.recharts-surface')).toHaveCount(1);
  await page.getByRole('combobox', { name: 'Measurement category' }).selectOption('pressures');
  await expect(page.getByRole('combobox', { name: 'Recorded measurement' })).toHaveValue('P_J280');
  await expect(chart.getByText('Source measurements: P_J280')).toBeVisible();
  await page.getByRole('combobox', { name: 'Published attack interval' }).selectOption('7');
  await expect(chart.getByText('110 / 134 in published attack interval')).toBeVisible();
  await expect(page.getByText('134 contiguous hourly rows')).toBeVisible();
  await expect(page.getByText(/verified 2017 original test measurements/)).toBeVisible();
  await expect(page.getByText(/not a live water plant/i)).toBeVisible();
});
