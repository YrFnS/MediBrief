import { createCipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

const NEW_VAULT_PASSPHRASE = 'MediBrief browser acceptance 2026!';
const CLOUD_CONSENT_KEY = 'medibrief_cloud_processing_consent_v1';
const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

const createNewVault = async (page: Page): Promise<void> => {
    await page.goto('/');

    await expect(
        page.getByRole('heading', { name: 'Create local vault' }),
    ).toBeVisible();
    await expect(page.getByText('Strong passphrase required')).toBeVisible();

    await page.getByLabel('Create vault passphrase').fill('123456789012');
    await page.getByLabel('Confirm passphrase').fill('123456789012');
    await page.getByRole('button', { name: 'Create local vault' }).click();
    await expect(
        page.getByText('Passphrase cannot contain only numbers.'),
    ).toBeVisible();

    await page.getByLabel('Create vault passphrase')
        .fill(NEW_VAULT_PASSPHRASE);
    await page.getByLabel('Confirm passphrase')
        .fill(NEW_VAULT_PASSPHRASE);
    await page.getByRole('button', { name: 'Create local vault' }).click();

    await expect(
        page.getByRole('heading', { name: 'Local record prototype' }),
    ).toBeVisible({ timeout: 30_000 });
};

const acceptBoundaryNotice = async (page: Page): Promise<void> => {
    await expect(page.getByText('Not a certified medical device')).toBeVisible();
    await expect(
        page.getByText('CLOUD IS SEPARATE AND OFF BY DEFAULT:', {
            exact: false,
        }),
    ).toBeVisible();

    await expect.poll(async () => page.evaluate(
        key => sessionStorage.getItem(key),
        CLOUD_CONSENT_KEY,
    )).toBeNull();

    await page.getByRole('button', {
        name: 'I understand these boundaries',
    }).click();
    await expect(page.getByRole('button', {
        name: 'Open safety boundaries and capability status',
    })).toBeVisible();
};

const openSafetyCenter = async (page: Page) => {
    await page.getByRole('button', {
        name: 'Open safety boundaries and capability status',
    }).click();
    const dialog = page.getByRole('dialog', {
        name: 'Safety boundaries and capability status',
    });
    await expect(dialog).toBeVisible();
    return dialog;
};

const legacyVaultValues = (credential: string) => {
    const salt = randomBytes(16);
    const key = pbkdf2Sync(credential, salt, 100_000, 32, 'sha256');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([
        cipher.update(Buffer.from('VALID', 'utf8')),
        cipher.final(),
        cipher.getAuthTag(),
    ]);

    return {
        salt: salt.toString('base64'),
        verifier: JSON.stringify({
            iv: iv.toString('base64'),
            data: ciphertext.toString('base64'),
        }),
    };
};

test('first-run setup, disclaimer, capability matrix, and cloud consent', async ({
    page,
}) => {
    await createNewVault(page);

    await expect(page.locator('script[src^="http"]')).toHaveCount(0);
    await expect(
        page.locator('link[rel="stylesheet"][href^="http"]'),
    ).toHaveCount(0);

    await acceptBoundaryNotice(page);
    const dialog = await openSafetyCenter(page);

    await expect(dialog.getByText('Local only', { exact: true })).toBeVisible();
    await expect(
        dialog.getByText('0 reviewed clinical model profiles'),
    ).toBeVisible();

    for (const status of ['Available', 'Experimental', 'Disabled', 'Planned']) {
        await expect(dialog.locator('h4', { hasText: status })).toBeVisible();
    }

    await dialog.getByRole('button', {
        name: 'I understand — enable for this tab',
    }).click();
    await expect(dialog.getByText('Enabled', { exact: true })).toBeVisible();
    await expect.poll(async () => page.evaluate(
        key => sessionStorage.getItem(key),
        CLOUD_CONSENT_KEY,
    )).toBe('granted');

    await dialog.getByRole('button', {
        name: 'Disable cloud processing',
    }).click();
    await expect(dialog.getByText('Local only', { exact: true })).toBeVisible();
    await expect.poll(async () => page.evaluate(
        key => sessionStorage.getItem(key),
        CLOUD_CONSENT_KEY,
    )).toBeNull();
});

test('unreviewed patient-record requests fail closed before transmission', async ({
    page,
}) => {
    await createNewVault(page);
    await acceptBoundaryNotice(page);

    let openRouterRequests = 0;
    page.on('request', request => {
        if (request.url() === OPENROUTER_CHAT_URL) openRouterRequests += 1;
    });

    const dialog = await openSafetyCenter(page);
    await dialog.getByRole('button', {
        name: 'I understand — enable for this tab',
    }).click();
    await dialog.getByRole('button', {
        name: 'Close safety and capabilities',
    }).click();

    const result = await page.evaluate(async ({ endpoint, consentKey }) => {
        sessionStorage.setItem(consentKey, 'granted');
        try {
            await fetch(endpoint, {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer synthetic-test-key',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'unreviewed/example-model',
                    messages: [
                        {
                            role: 'system',
                            content: 'MEDIBRIEF_GROUNDED_PATIENT_ANSWER_V1',
                        },
                        {
                            role: 'user',
                            content: 'Summarize the selected patient record.',
                        },
                    ],
                    stream: false,
                }),
            });
            return { blocked: false, message: '' };
        } catch (error) {
            return {
                blocked: true,
                message: error instanceof Error ? error.message : String(error),
            };
        }
    }, {
        endpoint: OPENROUTER_CHAT_URL,
        consentKey: CLOUD_CONSENT_KEY,
    });

    expect(result.blocked).toBe(true);
    expect(result.message).toContain('no task-specific MediBrief review package');
    expect(openRouterRequests).toBe(0);

    const blockedDialog = page.getByRole('dialog', {
        name: 'Safety boundaries and capability status',
    });
    await expect(blockedDialog).toBeVisible();
    await expect(blockedDialog.getByText('Cloud request withheld')).toBeVisible();
    await expect(blockedDialog.getByText(
        'Task: patient-record · Model: unreviewed/example-model',
    )).toBeVisible();
});

test('legacy PIN vaults remain unlockable and show migration warnings', async ({
    context,
    page,
}) => {
    const credential = '1234';
    const seed = legacyVaultValues(credential);
    await context.addInitScript(values => {
        if (location.origin === 'null') return;
        localStorage.setItem('medibrief_sec_salt', values.salt);
        localStorage.setItem('medibrief_sec_verifier', values.verifier);
        localStorage.removeItem('medibrief_sec_policy_version');
    }, seed);

    await page.goto('/');
    await expect(
        page.getByRole('heading', { name: 'Unlock local vault' }),
    ).toBeVisible();
    await expect(page.getByText('Legacy vault credential detected.')).toBeVisible();
    await expect(page.getByLabel('Vault passphrase or legacy PIN')).toBeVisible();

    await page.getByLabel('Vault passphrase or legacy PIN').fill(credential);
    await page.getByRole('button', { name: 'Unlock local record' }).click();
    await expect(
        page.getByRole('heading', { name: 'Local record prototype' }),
    ).toBeVisible({ timeout: 30_000 });

    await acceptBoundaryNotice(page);
    const dialog = await openSafetyCenter(page);
    await expect(dialog.getByRole('heading', {
        name: 'Legacy vault credential detected',
    })).toBeVisible();
});

test('the production app shell remains available offline', async ({
    context,
    page,
}) => {
    await createNewVault(page);
    await acceptBoundaryNotice(page);

    await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
    });
    await page.reload({ waitUntil: 'networkidle' });
    await expect(
        page.getByRole('heading', { name: 'Unlock local vault' }),
    ).toBeVisible();
    await expect.poll(async () => page.evaluate(
        () => Boolean(navigator.serviceWorker.controller),
    )).toBe(true);

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/MediBrief/);
    await expect(
        page.getByRole('heading', { name: 'Unlock local vault' }),
    ).toBeVisible();
    await context.setOffline(false);
});
