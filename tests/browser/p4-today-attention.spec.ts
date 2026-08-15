import { expect, test, type Page } from '@playwright/test';

const PASSPHRASE = 'MediBrief P4 Today acceptance 2026!';

const openUnlockedRecord = async (page: Page): Promise<void> => {
    await page.goto('/');

    await page.getByLabel('Create vault passphrase').fill(PASSPHRASE);
    await page.getByLabel('Confirm passphrase').fill(PASSPHRASE);
    await page.getByRole('button', { name: 'Create local vault' }).click();

    await expect(
        page.getByRole('heading', { name: 'Local record prototype' }),
    ).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', {
        name: 'I understand these boundaries',
    }).click();
};

test('Today shows deterministic attention and deep-links to record management', async ({
    page,
}) => {
    await openUnlockedRecord(page);

    const attention = page.getByRole('region', {
        name: 'Review & follow-up',
    });
    await expect(attention).toBeVisible();
    await expect(attention).toContainText(
        'Signals are separate and may overlap',
    );
    await expect(attention).toContainText(
        'Counts do not indicate clinical severity',
    );

    await attention.getByRole('button', {
        name: 'Open record manager',
    }).click();

    const primary = page.getByRole('tablist', {
        name: 'Patient record navigation',
    });
    await expect(
        primary.getByRole('tab', { name: /Health Record/ }),
    ).toHaveAttribute('aria-selected', 'true');

    const areas = page.getByRole('tablist', {
        name: 'Health record areas',
    });
    await expect(
        areas.getByRole('tab', { name: /Manage/ }),
    ).toHaveAttribute('aria-selected', 'true');

    await expect(page.getByRole('navigation', {
        name: 'Manage sections',
    }).getByRole('button', { name: /Manage records/ }))
        .toHaveAttribute('aria-current', 'page');
});
