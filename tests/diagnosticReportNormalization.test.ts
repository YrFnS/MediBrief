import { describe, expect, it } from 'vitest';
import {
    buildReviewedDiagnosticReportBundle,
    normalizeDiagnosticQuantity,
    type ReviewedDiagnosticReportDraft,
} from '../features/diagnostic-reports';

const NOW = '2026-07-31T12:00:00.000Z';

const draft = (): ReviewedDiagnosticReportDraft => ({
    patientId: 'patient-normalization',
    reportTitle: 'Normalization fixture',
    status: 'final',
    effectiveDate: '2026-07-30',
    results: [
        {
            localId: 'hemoglobin',
            testName: 'Hemoglobin',
            valueText: '13.2',
            unitText: 'g/dL',
        },
        {
            localId: 'comparator',
            testName: 'Comparator analyte',
            valueText: '<5',
            unitText: 'mg/dL',
        },
        {
            localId: 'unknown-unit',
            testName: 'Enzyme activity',
            valueText: '42',
            unitText: 'IU/L',
        },
    ],
    source: {
        documentId: 'document-normalization',
        fileName: 'normalization.pdf',
    },
    verificationStatus: 'confirmed',
    reviewedAt: NOW,
});

const ids = (type: string, localId: string): string =>
    `${type.toLowerCase()}-${localId}`;

describe('Phase 4 conservative diagnostic normalization', () => {
    it('adds a safe normalized value without replacing the source quantity', () => {
        const bundle = buildReviewedDiagnosticReportBundle(draft(), {
            now: NOW,
            idFactory: ids,
        });
        const hemoglobin = bundle.observations[0];

        expect(hemoglobin.value).toEqual({
            type: 'quantity',
            quantity: {
                original: {
                    value: 13.2,
                    unit: 'g/dL',
                    system: 'http://unitsofmeasure.org',
                    code: 'g/dL',
                },
                normalized: {
                    value: 132,
                    unit: 'g/L',
                    system: 'http://unitsofmeasure.org',
                    code: 'g/L',
                },
            },
        });
    });

    it('preserves comparator and unsupported units with explicit warnings', () => {
        const bundle = buildReviewedDiagnosticReportBundle(draft(), {
            now: NOW,
            idFactory: ids,
        });
        const comparator = bundle.observations[1];
        const unknownUnit = bundle.observations[2];

        expect(comparator.value?.type).toBe('quantity');
        if (comparator.value?.type === 'quantity') {
            expect(comparator.value.quantity.original.comparator).toBe('<');
            expect(comparator.value.quantity.normalized).toBeUndefined();
            expect(comparator.value.quantity.normalizationWarning)
                .toContain('Comparator result preserved');
        }
        if (unknownUnit.value?.type === 'quantity') {
            expect(unknownUnit.value.quantity.original.unit).toBe('IU/L');
            expect(unknownUnit.value.quantity.normalized).toBeUndefined();
            expect(unknownUnit.value.quantity.normalizationWarning)
                .toContain('not in the conservative normalization table');
        }
        expect(bundle.warnings.filter(warning =>
            warning.code === 'unit-not-normalized').length)
            .toBeGreaterThanOrEqual(2);
    });

    it('never performs analyte-specific molecular conversions', () => {
        const result = normalizeDiagnosticQuantity({
            original: {
                value: 100,
                unit: 'mg/dL',
                system: 'http://unitsofmeasure.org',
                code: 'mg/dL',
            },
        });

        expect(result.quantity.normalized).toEqual({
            value: 1,
            unit: 'g/L',
            system: 'http://unitsofmeasure.org',
            code: 'g/L',
        });
        expect(result.quantity.normalized?.unit).not.toBe('mmol/L');
    });
});
