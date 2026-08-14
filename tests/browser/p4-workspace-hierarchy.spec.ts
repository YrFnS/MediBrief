import { expect, test, type Page } from '@playwright/test';

const PASSPHRASE = 'MediBrief P4 browser acceptance 2026!';

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

test('grouped record navigation keeps every clinical area discoverable', async ({
    page,
}) => {
    await openUnlockedRecord(page);

    const primary = page.getByRole('tablist', {
        name: 'Patient record navigation',
    });

    for (const destination of [
        'Today',
        'Health Record',
        'Timeline',
        'Search & Export',
        'Emergency',
        'Assistant',
    ]) {
        await expect(
            primary.getByRole('tab', { name: new RegExp(destination) }),
        ).toBeVisible();
    }

    await primary.getByRole('tab', {
        name: /Health Record/,
    }).click();

    const areas = page.getByRole('tablist', {
        name: 'Health record areas',
    });
    for (const area of [
        'Health Record',
        'Medications',
        'Results',
        'Care',
        'Documents',
        'Manage',
    ]) {
        await expect(
            areas.getByRole('tab', { name: new RegExp(area) }),
        ).toBeVisible();
    }

    await expect(page.getByRole('navigation', {
        name: 'Health Record sections',
    }).getByRole('button', { name: /Conditions/ })).toBeVisible();

    await areas.getByRole('tab', { name: /Medications/ }).click();
    const medicationSections = page.getByRole('navigation', {
        name: 'Medications sections',
    });
    await expect(
        medicationSections.getByRole('button', {
            name: /Medication list/,
        }),
    ).toBeVisible();
    await expect(
        medicationSections.getByRole('button', {
            name: /Reconciliation/,
        }),
    ).toBeVisible();

    await areas.getByRole('tab', { name: /Care/ }).click();
    const careSections = page.getByRole('navigation', {
        name: 'Care sections',
    });
    await expect(
        careSections.getByRole('button', { name: /Appointments/ }),
    ).toBeVisible();
    await expect(
        careSections.getByRole('button', { name: /Tasks/ }),
    ).toBeVisible();
    await expect(
        careSections.getByRole('button', { name: /Care plans/ }),
    ).toBeVisible();

    await areas.getByRole('tab', { name: /Health Record/ }).focus();
    await page.keyboard.press('End');
    await expect(
        areas.getByRole('tab', { name: /Manage/ }),
    ).toHaveAttribute('aria-selected', 'true');
});
