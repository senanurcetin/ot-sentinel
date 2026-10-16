import { test, expect } from '@playwright/test';

test('publisher-verified 2017 hourly holdout is distinct from the 2016 training example', async ({ page }) => {
 await page.goto('/batadal-test-history');
 await expect(page.getByRole('heading', { name: 'Verified 2017 hourly sensor history' })).toBeVisible();
 await expect(page.getByText(/unseen 2017 test ZIP/)).toBeVisible();
 await expect(page.getByText(/source-local, not asserted UTC/)).toBeVisible();
 const chart=page.getByRole('region', {name:'Real historical measurement chart'});
 await expect(chart.getByText('70 / 94 in published attack interval')).toBeVisible();
 const model = page.getByRole('region', {name:'Retrospective model evidence'});
 await expect(model.getByText(/11 h after published attack start/)).toBeVisible();
 await page.getByRole('combobox', {name:'Retrospective detector'}).selectOption('static_limits');
 await expect(model.getByText(/20 h after published attack start/)).toBeVisible();
 await expect(chart.locator('svg.recharts-surface')).toHaveCount(1);
 await page.getByRole('combobox',{name:'Measurement category'}).selectOption('pressures');
 await expect(page.getByRole('combobox',{name:'Recorded measurement'})).toHaveValue('P_J280');
 await page.getByRole('combobox',{name:'Published attack interval'}).selectOption('14');
 await expect(chart.getByText('30 / 54 in published attack interval')).toBeVisible();
 await expect(page.getByText(/No training, threshold fitting, or new/)).toBeVisible();
 await page.getByRole('link',{name:/2016 training-period measurements/}).click();
 await expect(page).toHaveURL(/\/batadal-history$/);
 await expect(page.getByRole('heading', {name:'Verified 2016 hourly sensor history'})).toBeVisible();
});
