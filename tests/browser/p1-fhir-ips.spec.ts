import { expect, test, type Page } from '@playwright/test';

const VAULT_PASSPHRASE = 'MediBrief P1 browser acceptance 2026!';

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

const urn = (value: string): string => `urn:uuid:${value}`;

const validSyntheticIps = () => ({
    resourceType: 'Bundle',
    id: 'synthetic-import-bundle',
    meta: {
        profile: [
            'http://hl7.org/fhir/uv/ips/StructureDefinition/Bundle-uv-ips',
        ],
    },
    identifier: {
        system: 'urn:ietf:rfc:3986',
        value: urn('10000000-0000-4000-8000-000000000001'),
    },
    type: 'document',
    timestamp: '2026-08-14T12:00:00.000Z',
    entry: [
        {
            fullUrl: urn('10000000-0000-4000-8000-000000000002'),
            resource: {
                resourceType: 'Composition',
                id: 'synthetic-composition',
                meta: {
                    profile: [
                        'http://hl7.org/fhir/uv/ips/StructureDefinition/Composition-uv-ips',
                    ],
                },
                language: 'en',
                text: {
                    status: 'generated',
                    div: '<div xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en"><p>Synthetic IPS for browser acceptance.</p></div>',
                },
                identifier: {
                    system: 'urn:ietf:rfc:3986',
                    value: urn('10000000-0000-4000-8000-000000000003'),
                },
                status: 'final',
                type: {
                    coding: [{
                        system: 'http://loinc.org',
                        code: '60591-5',
                        display: 'Patient summary Document',
                    }],
                },
                subject: {
                    reference: urn('10000000-0000-4000-8000-000000000004'),
                },
                date: '2026-08-14T12:00:00.000Z',
                author: [{
                    reference: urn('10000000-0000-4000-8000-000000000005'),
                }],
                title: 'Synthetic International Patient Summary',
                section: [
                    {
                        title: 'Medication Summary',
                        code: { coding: [{ system: 'http://loinc.org', code: '10160-0' }] },
                        text: {
                            status: 'generated',
                            div: '<div xmlns="http://www.w3.org/1999/xhtml"><p>Medication information unavailable.</p></div>',
                        },
                        mode: 'snapshot',
                        emptyReason: {
                            coding: [{
                                system: 'http://terminology.hl7.org/CodeSystem/list-empty-reason',
                                code: 'unavailable',
                            }],
                        },
                    },
                    {
                        title: 'Allergies and Intolerances',
                        code: { coding: [{ system: 'http://loinc.org', code: '48765-2' }] },
                        text: {
                            status: 'generated',
                            div: '<div xmlns="http://www.w3.org/1999/xhtml"><p>Allergy information unavailable.</p></div>',
                        },
                        mode: 'snapshot',
                        emptyReason: {
                            coding: [{
                                system: 'http://terminology.hl7.org/CodeSystem/list-empty-reason',
                                code: 'unavailable',
                            }],
                        },
                    },
                    {
                        title: 'Problem List',
                        code: { coding: [{ system: 'http://loinc.org', code: '11450-4' }] },
                        text: {
                            status: 'generated',
                            div: '<div xmlns="http://www.w3.org/1999/xhtml"><ul><li>Essential hypertension</li></ul></div>',
                        },
                        mode: 'snapshot',
                        entry: [{
                            reference: urn('10000000-0000-4000-8000-000000000006'),
                        }],
                    },
                ],
            },
        },
        {
            fullUrl: urn('10000000-0000-4000-8000-000000000004'),
            resource: {
                resourceType: 'Patient',
                id: 'synthetic-patient',
                meta: {
                    profile: [
                        'http://hl7.org/fhir/uv/ips/StructureDefinition/Patient-uv-ips',
                    ],
                },
                name: [{ text: 'Synthetic Import Patient' }],
                birthDate: '2000-01-01',
                gender: 'unknown',
            },
        },
        {
            fullUrl: urn('10000000-0000-4000-8000-000000000005'),
            resource: {
                resourceType: 'Device',
                id: 'synthetic-author',
                deviceName: [{ name: 'Synthetic IPS generator', type: 'user-friendly-name' }],
            },
        },
        {
            fullUrl: urn('10000000-0000-4000-8000-000000000006'),
            resource: {
                resourceType: 'Condition',
                id: 'synthetic-condition',
                meta: {
                    profile: [
                        'http://hl7.org/fhir/uv/ips/StructureDefinition/Condition-uv-ips',
                    ],
                },
                clinicalStatus: {
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                        code: 'active',
                    }],
                },
                verificationStatus: {
                    coding: [{
                        system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
                        code: 'confirmed',
                    }],
                },
                code: { text: 'Essential hypertension' },
                subject: {
                    reference: urn('10000000-0000-4000-8000-000000000004'),
                },
                onsetDateTime: '2024-01-01',
            },
        },
    ],
});

test('IPS import previews identity and creates review candidates only', async ({ page }) => {
    await createUnlockedApp(page);

    await page.getByRole('button', {
        name: 'Open FHIR and International Patient Summary tools',
    }).click();
    const dialog = page.getByRole('dialog', {
        name: 'FHIR R4 and International Patient Summary',
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Nothing is auto-confirmed.')).toBeVisible();
    await expect(dialog.getByText('Interoperability boundary')).toBeVisible();

    const fileInput = dialog.getByLabel('Select FHIR IPS JSON file');
    await fileInput.setInputFiles({
        name: 'invalid-ips.json',
        mimeType: 'application/fhir+json',
        buffer: Buffer.from('{}'),
    });
    await expect(dialog.getByRole('alert')).toContainText(
        'No candidate records were created',
    );

    await fileInput.setInputFiles({
        name: 'synthetic-valid-ips.json',
        mimeType: 'application/fhir+json',
        buffer: Buffer.from(JSON.stringify(validSyntheticIps())),
    });
    await expect(dialog.getByText('Local IPS structural checks passed')).toBeVisible();
    await expect(dialog.getByText('Synthetic Import Patient')).toBeVisible();
    await expect(dialog.getByText('Condition:')).toBeVisible();
    await expect(dialog.getByText('Compare this identity', { exact: false })).toBeVisible();

    const importButton = dialog.getByRole('button', {
        name: 'Import 1 candidate',
    });
    await expect(importButton).toBeEnabled();
    await importButton.click();
    await expect(dialog.getByRole('status')).toContainText(
        '1 candidate record created',
    );
    await expect(dialog.getByRole('status')).toContainText(
        'Review every candidate against its source before confirmation',
    );
});
