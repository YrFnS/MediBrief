import { expect, test } from '@playwright/test';

test('every exported SVG icon renders without browser parser errors', async ({
    page,
}) => {
    const errors: string[] = [];

    page.on('pageerror', error => {
        errors.push(`pageerror: ${error.message}`);
    });
    page.on('console', message => {
        if (message.type() === 'error') {
            errors.push(`console: ${message.text()}`);
        }
    });

    await page.goto('/?__medibriefIconAudit=1');

    const audit = page.locator('[data-icon-audit-ready="true"]');
    await expect(audit).toBeVisible();

    const iconCount = Number(await audit.getAttribute('data-icon-count'));
    expect(iconCount).toBeGreaterThan(40);
    await expect(audit.locator('figure')).toHaveCount(iconCount);

    expect(errors).toEqual([]);
});
