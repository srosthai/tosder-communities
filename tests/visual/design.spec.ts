import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const themes = [
  { name: 'public', query: 'light' },
  { name: 'admin', query: 'admin' },
] as const;

for (const theme of themes) {
  test(`design system — ${theme.name} theme`, async ({ page }) => {
    await page.goto(`/design?theme=${theme.query}`);
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({
      content: 'astro-dev-toolbar { display: none !important; }',
    });

    await expect(page).toHaveScreenshot(`design-${theme.name}.png`, {
      fullPage: true,
    });
  });

  test(`design system — ${theme.name} accessibility`, async ({ page }) => {
    await page.goto(`/design?theme=${theme.query}`);
    await page.addStyleTag({
      content: 'astro-dev-toolbar { display: none !important; }',
    });

    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (violation) =>
        violation.impact === 'critical' || violation.impact === 'serious',
    );

    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
}
