import { expect, test, type Page } from '@playwright/test';

const VAULT_PASSPHRASE = 'MediBrief P1.4 browser acceptance 2026!';

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

const receiverCapabilityStatement = () => ({
    resourceType: 'CapabilityStatement',
    id: 'browser-receiver',
    url: 'https://receiver.example/fhir/CapabilityStatement/ips',
    version: '2026.1',
    title: 'Browser Receiver',
    status: 'active',
    kind: 'instance',
    fhirVersion: '4.0.1',
    format: ['application/fhir+json'],
    document: [{
        mode: 'consumer',
        profile:
            'http://hl7.org/fhir/uv/ips/StructureDefinition/Bundle-uv-ips',
    }],
    rest: [{
        mode: 'server',
        resource: [
            {
                type: 'Bundle',
                profile:
                    'http://hl7.org/fhir/uv/ips/StructureDefinition/Bundle-uv-ips',
            },
            {
                type: 'Composition',
                profile:
                    'http://hl7.org/fhir/uv/ips/StructureDefinition/Composition-uv-ips',
            },
            {
                type: 'Patient',
                profile:
                    'http://hl7.org/fhir/uv/ips/StructureDefinition/Patient-uv-ips',
            },
            { type: 'Device' },
        ],
    }],
});

test('receiver validation stays local and fails closed', async ({ page }) => {
    await createUnlockedApp(page);

    await page.getByRole('button', {
        name: 'Open receiver-specific exchange validation',
    }).click();
    const dialog = page.getByRole('dialog', {
        name: 'Receiver-specific exchange validation',
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Network activity')).toBeVisible();
    await expect(dialog.getByText('None', { exact: true })).toBeVisible();
    await expect(dialog.getByText(
        'Validation is not transfer authorization',
    )).toBeVisible();

    await dialog.getByRole('button', {
        name: 'Validate locally',
    }).click();
    await expect(dialog.getByRole('status')).toContainText(
        'No declared receiver endpoint or terminology service was contacted',
    );
    await expect(dialog.getByText(
        'Not ready for this receiver',
    )).toBeVisible();
    await expect(dialog.getByText(
        'Transfer authorized: No',
    )).toBeVisible();
    await expect(dialog.getByText(/birth date/i)).toBeVisible();

    const capabilityInput = dialog.getByLabel(
        'Select receiver CapabilityStatement JSON file',
    );
    await capabilityInput.setInputFiles({
        name: 'not-a-capability-statement.json',
        mimeType: 'application/fhir+json',
        buffer: Buffer.from(JSON.stringify({ resourceType: 'Bundle' })),
    });
    await expect(dialog.getByRole('alert')).toContainText(
        'FHIR CapabilityStatement',
    );

    await capabilityInput.setInputFiles({
        name: 'receiver-capability.json',
        mimeType: 'application/fhir+json',
        buffer: Buffer.from(JSON.stringify(receiverCapabilityStatement())),
    });
    await expect(dialog.getByRole('status')).toContainText(
        'Imported Browser Receiver for local comparison',
    );
    await expect(dialog.getByRole('status')).toContainText(
        'No declared endpoint was contacted',
    );
    await expect(dialog.getByLabel('Receiver contract')).toHaveValue(
        'capability-browser-receiver-2026-1',
    );
});
