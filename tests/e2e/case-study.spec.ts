import { expect, test } from '@playwright/test';

test.describe('case study page', () => {
  test('is reachable from the dashboard header and shows caveats before numbers', async ({ page }) => {
    const violations: string[] = [];
    page.on('console', (msg) => {
      if (/Content Security Policy|Refused to/i.test(msg.text())) violations.push(msg.text());
    });

    await page.goto('/');
    await page.getByRole('link', { name: 'Case study' }).click();
    await expect(page).toHaveURL(/\/case-study$/);
    await expect(page.getByRole('heading', { name: 'Detector evaluation on BATADAL' })).toBeVisible();

    const note = page.getByRole('note', { name: /how to read these results/i });
    await expect(note).toContainText('offline');
    await expect(note).toContainText('not what was measured');

    // The note comes before the first table in document order.
    const noteBox = await note.boundingBox();
    const firstTableBox = await page.getByRole('table').first().boundingBox();
    expect(noteBox!.y).toBeLessThan(firstTableBox!.y);

    expect(violations).toEqual([]);
  });

  test('renders both evaluations, the per-attack tables and the drift table', async ({ page }) => {
    await page.goto('/case-study');
    const headline = page.getByRole('region', { name: /Test set/ });
    await expect(headline.getByRole('cell', { name: 'Max absolute z-score' }).first()).toBeVisible();
    await expect(headline.getByRole('table')).toHaveCount(2);
    await expect(page.getByRole('region', { name: /dataset04/ })).toContainText(
      'not evaluated here: trained on this data'
    );
    await expect(page.getByText('P_J280').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Limitations' })).toBeVisible();
  });

  test('shows the protocol v3 decision and explanation accuracy', async ({ page }) => {
    await page.goto('/case-study');
    await expect(page.getByRole('heading', { name: 'Does adding time help? (protocol v3)' })).toBeVisible();
    await expect(page.getByText('No temporal detector passes.')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Do the explanations point at the attacked equipment?' })
    ).toBeVisible();
  });

  test('links back to the dashboard', async ({ page }) => {
    await page.goto('/case-study');
    await page.getByRole('link', { name: /Dashboard/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'OT-Sentinel' })).toBeVisible();
  });
});
