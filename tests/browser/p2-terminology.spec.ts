import { expect, test, type Page } from '@playwright/test';

const VAULT_PASSPHRASE = 'MediBrief P2 terminology acceptance 2026!';

const createUnlockedApp = async (page: Page): Promise<void> => {
    await page.goto('/');
    await page.getByLabel('Create vault passphrase').fill(VAULT_PASSPHRASE);
    await page.getByLabel('Confirm passphrase').fill(VAULT_PASSPHRASE);
    await page.getByRole('button', { name: 'Create local vault' }).click();
    await expect(
        page.getByRole('heading', { name: 'Local record prototype' }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', {
        name: 'I understand these boundaries',
    }).click();
};

test('terminology review remains explicit and makes no request on open', async ({ page }) => {
    await createUnlockedApp(page);
    const appOrigin = new URL(page.url()).origin;
    const externalRequests: string[] = [];
    page.on('request', request => {
        if (new URL(request.url()).origin !== appOrigin) {
            externalRequests.push(request.url());
        }
    });

    await page.getByRole('button', {
        name: 'Open terminology review center',
    }).click();

    const dialog = page.getByRole('dialog', {
        name: 'Terminology review center',
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('No coding is applied automatically.')).toBeVisible();
    await expect(dialog.getByText('Terminology is not clinical validation')).toBeVisible();
    await expect(dialog.getByText('MediBrief does not include a SNOMED CT browser or code set.')).toBeVisible();
    await page.waitForTimeout(250);
    expect(externalRequests).toEqual([]);
});
