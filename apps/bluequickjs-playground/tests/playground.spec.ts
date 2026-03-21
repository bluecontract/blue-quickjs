import { expect, test } from '@playwright/test';

async function selectGalleryItem(page: import('@playwright/test').Page, text: string) {
  await page.locator('button.gallery-item').filter({ hasText: text }).first().click();
}

test('renders the landing state', async ({ page, browserName }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'BlueQuickjs Playground' })).toBeVisible();
  await expect(page.locator('[data-selection-title]')).toContainText(
    'Basic deterministic script',
  );

  if (browserName === 'chromium') {
    await expect(page).toHaveScreenshot('playground-landing.png', {
      fullPage: true,
    });
  }
});

test('runs the baseline example and matches certified evidence', async ({
  page,
  browserName,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Run current selection' }).click();

  await expect(page.locator('[data-run-status]')).toContainText('Success');
  await expect(page.locator('[data-evidence-status]')).toContainText(
    'Matches certified snapshot',
  );
  await expect(page.locator('[data-tab-panel]')).toContainText('"gasUsed": "74"');

  if (browserName === 'chromium') {
    await expect(page).toHaveScreenshot('playground-success.png', {
      fullPage: true,
    });
  }
});

test('runs promise and binary examples through their profile-gated flows', async ({
  page,
  browserName,
}) => {
  await page.goto('/');

  await selectGalleryItem(page, 'Promises / async / microtasks');
  await page.getByRole('button', { name: 'Run current selection' }).click();
  await expect(page.locator('[data-run-status]')).toContainText('Success');
  await expect(page.locator('[data-evidence-status]')).toContainText(
    'Matches certified snapshot',
  );

  await selectGalleryItem(page, 'Binary / typed arrays / Host.v2 DV2');
  await page.getByRole('button', { name: 'Run current selection' }).click();
  await expect(page.locator('[data-run-status]')).toContainText('Success');
  await expect(page.locator('[data-evidence-status]')).toContainText(
    'Matches certified snapshot',
  );

  if (browserName === 'chromium') {
    await expect(page).toHaveScreenshot('playground-binary.png', {
      fullPage: true,
    });
  }
});

test('shows deterministic failure messaging for red fixtures', async ({
  page,
  browserName,
}) => {
  await page.goto('/');
  await selectGalleryItem(page, 'dynamic import must be rejected at build stage');

  await expect(page.locator('[data-selection-title]')).toContainText(
    'dynamic import must be rejected at build stage',
  );
  await expect(page.getByRole('button', { name: 'Run current selection' })).toBeDisabled();
  await page.getByRole('button', { name: 'Determinism evidence' }).click();
  await expect(page.locator('[data-tab-panel]')).toContainText('builder_reject');

  if (browserName === 'chromium') {
    await expect(page).toHaveScreenshot('playground-failure.png', {
      fullPage: true,
    });
  }
});

test('supports exact OOG boundary inspection and artifact-json roundtrips', async ({
  page,
  browserName,
}) => {
  await page.goto('/');
  await selectGalleryItem(page, 'Max-gas policy / OOG boundary');
  await page.getByRole('button', { name: 'Find OOG boundary' }).click();
  await page.getByRole('button', { name: 'Determinism evidence' }).click();
  await expect(page.locator('[data-tab-panel]')).toContainText('"firstSuccessGas": "170099"');
  await expect(page.locator('[data-tab-panel]')).toContainText('"lastFailureGas": "170098"');

  if (browserName === 'chromium') {
    await expect(page).toHaveScreenshot('playground-oog.png', {
      fullPage: true,
    });
  }

  await selectGalleryItem(page, 'Standard ESM module-pack');
  await page.getByRole('button', { name: 'Artifact JSON' }).click();
  await page.getByRole('button', { name: 'Run current selection' }).click();
  await expect(page.locator('[data-run-status]')).toContainText('Success');
  await expect(page.locator('[data-evidence-status]')).toContainText(
    'Matches certified snapshot',
  );

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export artifact' }).click(),
  ]);
  expect(download.suggestedFilename()).toContain('bluequickjs-artifact');
});
