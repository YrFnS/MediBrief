import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { evaluateClinicalSafety } from '../features/cdss/rulesEngine';
import { reviewMedicationLabelsAsync } from '../features/safety/medicationLabelReviewService';

const source = (relativePath: string): string =>
    readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('disabled unvalidated clinical rules', () => {
    it('returns no automated conclusions from the compatibility entry point', async () => {
        const alerts = await evaluateClinicalSafety([{
            resourceType: 'Observation',
            id: 'extreme-value',
            status: 'final',
            code: { text: 'Lactate' },
            valueQuantity: { value: 99, unit: 'mmol/L' },
            effectiveDateTime: '2026-07-30T12:00:00.000Z',
        }]);

        expect(alerts).toEqual([]);
    });
});

describe('limited medication label review', () => {
    it('reports label fields and limitations without a patient-specific safety verdict', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
            JSON.stringify({
                results: [{
                    openfda: { generic_name: ['Example Drug'] },
                    boxed_warning: ['Important boxed warning text.'],
                    warnings: ['General label warning text.'],
                }],
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            },
        )));

        const result = await reviewMedicationLabelsAsync([{
            drugName: 'Example Drug 5mg',
            amount: 5,
            unit: 'mg',
        }]);

        expect(result.hasBoxedWarnings).toBe(true);
        expect(result.labelWarnings[0]).toContain('boxed-warning text');
        expect(result.labelInformation[0]).toContain('warning information');
        expect(result.limitations.some(item =>
            item.includes('does not validate the prescribed dose'),
        )).toBe(true);
        expect(result).not.toHaveProperty('isSafe');
        expect(result).not.toHaveProperty('verifiedItems');
    });

    it('treats a located label without a boxed-warning field as information, not clearance', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
            JSON.stringify({
                results: [{
                    openfda: { brand_name: ['No Box Example'] },
                }],
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            },
        )));

        const result = await reviewMedicationLabelsAsync([{
            drugName: 'No Box Example',
            amount: 1,
            unit: 'tablet',
        }]);

        expect(result.hasBoxedWarnings).toBe(false);
        expect(result.labelInformation[0])
            .toContain('did not contain a boxed-warning field');
        expect(result.limitations.some(item =>
            item.includes('does not mean that a medication or regimen is safe'),
        )).toBe(true);
    });
});

describe('user-facing semantic regression guards', () => {
    it('does not claim that local proposals were executed', () => {
        const layout = source('../features/layout/MainLayout.tsx');
        const advisories = source('../features/cdss/CDSSContainer.tsx');
        const messages = source('../features/chat/components/Message.tsx');

        expect(layout).not.toContain('ACTION EXECUTED');
        expect(advisories).not.toContain('ACTION EXECUTED');
        expect(messages).not.toContain('Tool Executed');
    });

    it('keeps image-viewer terminology within implemented capability', () => {
        const viewer = source('../components/ImageViewer.tsx');

        expect(viewer).toContain('Medical Image Viewer');
        expect(viewer).toContain('not a DICOM/PACS workstation');
        expect(viewer).not.toContain('PACS_VIEWER');
        expect(viewer).not.toContain('Bone Window');
    });

    it('does not present medication label lookup as a safety check', () => {
        const reviewCard = source(
            '../features/chat/components/MedicationReviewCard.tsx',
        );
        const message = source('../features/chat/components/Message.tsx');

        expect(reviewCard).not.toContain('Run Safety Check');
        expect(message).not.toContain('Verified Safe');
        expect(message).toContain('FDA label information');
        expect(message).toContain('This does not validate the patient’s regimen');
    });

    it('renders only explicitly validated advisories', () => {
        const container = source('../features/cdss/CDSSContainer.tsx');

        expect(container).toContain(
            "alert => alert.validationStatus === 'validated'",
        );
    });
});
