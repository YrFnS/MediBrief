import { mkdir } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const PASSPHRASE = 'MediBrief browser regression sweep 2026!';
const ARTIFACT_DIR = 'browser-artifacts';

const TOOL_LAUNCHERS = [
    'Open FHIR and International Patient Summary tools',
    'Open terminology review center',
    'Open receiver-specific exchange validation',
    'Open validated rules, evidence, and Phase 5 audit review',
    'Open safety boundaries and capability status',
] as const;

test.setTimeout(120_000);

const safeFileName = (value: string): string => value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const createUnlockedRecord = async (page: Page): Promise<void> => {
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
    await expect(page.getByRole('tablist', {
        name: 'Patient record navigation',
    })).toBeVisible();
};

const capture = async (page: Page, name: string): Promise<void> => {
    await mkdir(ARTIFACT_DIR, { recursive: true });
    await page.screenshot({
        path: `${ARTIFACT_DIR}/${safeFileName(name)}.png`,
        fullPage: true,
    });
};

const expectHealthyDocument = async (page: Page): Promise<void> => {
    const health = await page.evaluate(() => {
        const ids = Array.from(document.querySelectorAll<HTMLElement>('[id]'))
            .map(element => element.id)
            .filter(Boolean);
        const duplicateIds = Array.from(new Set(
            ids.filter((id, index) => ids.indexOf(id) !== index),
        ));
        const brokenImages = Array.from(document.images)
            .filter(image => image.complete && image.naturalWidth === 0)
            .map(image => image.currentSrc || image.src);
        const unnamedButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('button'))
            .filter(button => button.offsetParent !== null)
            .filter(button => !(
                button.getAttribute('aria-label')?.trim()
                || button.getAttribute('title')?.trim()
                || button.textContent?.trim()
            ))
            .map(button => button.outerHTML.slice(0, 220));

        return {
            innerWidth: window.innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            bodyWidth: document.body.scrollWidth,
            duplicateIds,
            brokenImages,
            unnamedButtons,
        };
    });

    expect(health.duplicateIds).toEqual([]);
    expect(health.brokenImages).toEqual([]);
    expect(health.unnamedButtons).toEqual([]);
    expect(
        Math.max(health.documentWidth, health.bodyWidth),
        JSON.stringify(health),
    ).toBeLessThanOrEqual(health.innerWidth + 1);
    await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
};

const beginRuntimeProbe = (page: Page) => {
    const issues: string[] = [];
    page.on('pageerror', error => issues.push(`pageerror: ${error.message}`));
    page.on('console', message => {
        if (message.type() === 'error') {
            issues.push(`console: ${message.text()}`);
        }
    });
    page.on('requestfailed', request => {
        const currentUrl = page.url();
        if (!currentUrl.startsWith('http')) return;
        const currentOrigin = new URL(currentUrl).origin;
        const requestUrl = new URL(request.url());
        if (requestUrl.origin === currentOrigin) {
            issues.push(
                `requestfailed: ${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`,
            );
        }
    });
    return issues;
};

const expectNonOverlappingToolRail = async (page: Page): Promise<void> => {
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();

    const boxes: Array<{
        name: string;
        x: number;
        y: number;
        width: number;
        height: number;
    }> = [];

    for (const name of TOOL_LAUNCHERS) {
        const launcher = page.getByRole('button', { name });
        await expect(launcher).toBeVisible();
        const box = await launcher.boundingBox();
        expect(box, `${name} should have a measurable tool-rail target`)
            .not.toBeNull();
        expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(44);
        expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(44);
        expect(box!.y, `${name} should remain in the reserved bottom rail`)
            .toBeGreaterThanOrEqual(viewport!.height - 66);
        boxes.push({ name, ...box! });
    }

    const ordered = [...boxes].sort((left, right) => left.x - right.x);
    for (let index = 1; index < ordered.length; index += 1) {
        const previous = ordered[index - 1];
        const current = ordered[index];
        expect(
            previous.x + previous.width,
            `${previous.name} overlaps ${current.name}`,
        ).toBeLessThanOrEqual(current.x + 1);
    }
};

test('desktop navigation, section discovery, dialogs, and runtime remain stable', async ({
    page,
}) => {
    const runtimeIssues = beginRuntimeProbe(page);
    await createUnlockedRecord(page);
    await expectNonOverlappingToolRail(page);

    const primary = page.getByRole('tablist', {
        name: 'Patient record navigation',
    });
    const destinations: Array<{
        label: string;
        title: RegExp;
    }> = [
        {
            label: 'Today',
            title: /^Today(?: — .+)? \| MediBrief$/,
        },
        {
            label: 'Health Record',
            title: /^Health Record(?: — .+)? \| MediBrief$/,
        },
        {
            label: 'Timeline',
            title: /^Timeline(?: — .+)? \| MediBrief$/,
        },
        {
            label: 'Search & Export',
            title: /^Search & Export(?: — .+)? \| MediBrief$/,
        },
        {
            label: 'Emergency',
            title: /^Emergency Summary(?: — .+)? \| MediBrief$/,
        },
        {
            label: 'Assistant',
            title: /^Assistant(?: — .+)? \| MediBrief$/,
        },
    ];

    for (const destination of destinations) {
        const tab = primary.getByRole('tab', {
            name: new RegExp(`^${destination.label}`),
        });
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
        await expect(page).toHaveTitle(destination.title);
        await expect(page.locator('#patient-record-content')).toBeVisible();
        await expectHealthyDocument(page);
        await capture(page, `desktop-${destination.label}`);
    }

    await primary.getByRole('tab', { name: /^Health Record/ }).click();
    const areas = page.getByRole('tablist', {
        name: 'Health record areas',
    });
    const areaNames = [
        'Health Record',
        'Medications',
        'Results',
        'Care',
        'Documents',
        'Manage',
    ];

    for (const areaName of areaNames) {
        const areaTab = areas.getByRole('tab', {
            name: new RegExp(`^${areaName}`),
        });
        await areaTab.click();
        await expect(areaTab).toHaveAttribute('aria-selected', 'true');

        const sections = page.getByRole('navigation', {
            name: `${areaName} sections`,
        });
        await expect(sections).toBeVisible();
        const sectionButtons = sections.getByRole('button');
        const sectionCount = await sectionButtons.count();
        expect(sectionCount, `${areaName} should expose at least one section`)
            .toBeGreaterThan(0);

        for (let index = 0; index < sectionCount; index += 1) {
            const sectionButton = sectionButtons.nth(index);
            await sectionButton.scrollIntoViewIfNeeded();
            await sectionButton.click();
            const content = (
                await page.locator('#health-data-panel').innerText()
            ).trim();
            expect(
                content.length,
                `${areaName} section ${index + 1} rendered an empty patient-record panel`,
            ).toBeGreaterThan(20);
            await expectHealthyDocument(page);
        }

        await capture(page, `desktop-area-${areaName}`);
    }

    const dialogs = [
        {
            open: 'Open settings',
            name: 'MEDIBRIEF SETTINGS',
        },
        {
            open: 'Open safety boundaries and capability status',
            name: 'Safety boundaries and capability status',
        },
        {
            open: 'Open FHIR and International Patient Summary tools',
            name: 'FHIR R4 and International Patient Summary',
        },
        {
            open: 'Open receiver-specific exchange validation',
            name: 'Receiver-specific exchange validation',
        },
        {
            open: 'Open terminology review center',
            name: 'Terminology review center',
        },
    ];

    for (const dialogCase of dialogs) {
        await page.getByRole('button', { name: dialogCase.open }).click();
        const dialog = page.getByRole('dialog', { name: dialogCase.name });
        await expect(dialog).toBeVisible();
        await capture(page, `desktop-dialog-${dialogCase.name}`);
        await dialog.getByRole('button', { name: /close/i }).first().click();
        await expect(dialog).toBeHidden();
    }

    await page.getByRole('button', { name: /New Context/i }).click();
    const addPatientDialog = page.getByRole('dialog', {
        name: 'Add patient record',
    });
    await expect(addPatientDialog).toBeVisible();
    await expect(addPatientDialog.getByLabel('Patient name or local label *'))
        .toBeVisible();
    await addPatientDialog.getByLabel('Age snapshot (years)').fill('12');
    await expect(addPatientDialog.getByText(
        'MediBrief records this information for review only. It does not calculate pediatric doses, enforce black-box warnings, or verify medication safety.',
    )).toBeVisible();
    const closeAddPatient = addPatientDialog.getByRole('button', {
        name: 'Close add patient dialog',
    });
    const closeBox = await closeAddPatient.boundingBox();
    expect(closeBox).not.toBeNull();
    expect(closeBox!.width).toBeGreaterThanOrEqual(44);
    expect(closeBox!.height).toBeGreaterThanOrEqual(44);
    await closeAddPatient.click();
    await expect(addPatientDialog).toBeHidden();

    await expectNonOverlappingToolRail(page);
    await expectHealthyDocument(page);
    expect(runtimeIssues).toEqual([]);
});

test('mobile navigation has usable touch targets and no page-level overflow', async ({
    page,
}) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const runtimeIssues = beginRuntimeProbe(page);
    await createUnlockedRecord(page);

    for (const controlName of ['Toggle patient roster', 'Open settings']) {
        const control = page.getByRole('button', { name: controlName });
        await expect(control).toBeVisible();
        const box = await control.boundingBox();
        expect(box, `${controlName} should have a measurable touch target`)
            .not.toBeNull();
        expect(box!.width, `${controlName} touch width`).toBeGreaterThanOrEqual(44);
        expect(box!.height, `${controlName} touch height`).toBeGreaterThanOrEqual(44);
    }

    await expectNonOverlappingToolRail(page);

    const primary = page.getByRole('tablist', {
        name: 'Patient record navigation',
    });
    for (const label of [
        'Today',
        'Record',
        'Timeline',
        'Search',
        'Emergency',
        'Assistant',
    ]) {
        const tab = primary.getByRole('tab', {
            name: new RegExp(`^${label}`),
        });
        await tab.scrollIntoViewIfNeeded();
        await tab.click();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
        await expectHealthyDocument(page);
    }

    await page.getByRole('button', { name: 'Toggle patient roster' }).click();
    await expect(page.getByText('Patient Roster', { exact: true })).toBeVisible();
    await capture(page, 'mobile-patient-roster');

    await page.getByRole('button', { name: /New Context/i }).click();
    const addPatientDialog = page.getByRole('dialog', {
        name: 'Add patient record',
    });
    await expect(addPatientDialog).toBeVisible();
    await addPatientDialog.getByLabel('Weight snapshot (kg)').fill('35');
    await expect(addPatientDialog.getByText(
        'It does not calculate pediatric doses, enforce black-box warnings, or verify medication safety.',
        { exact: false },
    )).toBeVisible();
    await capture(page, 'mobile-add-patient-dialog');
    await addPatientDialog.getByRole('button', {
        name: 'Close add patient dialog',
    }).click();
    await expect(addPatientDialog).toBeHidden();

    await page.mouse.click(380, 420);
    await expect(page.getByText('Patient Roster', { exact: true })).toBeHidden();

    await expectNonOverlappingToolRail(page);
    await expectHealthyDocument(page);
    await capture(page, 'mobile-final-shell');
    expect(runtimeIssues).toEqual([]);
});
