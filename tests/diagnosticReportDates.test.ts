import { describe, expect, it } from 'vitest';
import {
    buildDiagnosticReportBundle,
    parseReviewedDiagnosticReportDraft,
    type ReviewedDiagnosticReportDraft,
} from '../features/diagnostic-reports';

const baseDraft = (): ReviewedDiagnosticReportDraft => ({
    patientId: 'patient-date-policy',
    reportTitle: 'Synthetic date-policy report',
    status: 'final',
    effectiveDate: '2026-07-30',
    issuedAt: '2026-07-31T09:30:00.000Z',
    results: [{
        localId: 'result-1',
        testName: 'Synthetic result',
        valueText: '5',
        unitText: 'mg/dL',
    }],
    source: {
        documentId: 'document-date-policy',
        fileName: 'date-policy.pdf',
    },
});

const ids = (resourceType: string, localId: string): string =>
    `${resourceType}-${localId}`;

describe('Phase 4 diagnostic date inheritance', () => {
    it('keeps an explicitly unknown result date unknown instead of inheriting the report date', () => {
        const input = baseDraft();
        input.results[0].clinicalDate = null;
        input.results[0].issuedAt = null;

        const parsed = parseReviewedDiagnosticReportDraft(input);
        expect(parsed.results[0].clinicalDate).toBe('unknown');
        expect(parsed.results[0].issuedAt).toBe('unknown');

        const bundle = buildDiagnosticReportBundle(parsed, {
            now: '2026-07-31T12:00:00.000Z',
            idFactory: ids,
        });
        expect(bundle.observations[0].effective).toMatchObject({
            precision: 'unknown',
            sourceText: 'unknown',
        });
        expect(bundle.observations[0].issuedAt).toBeUndefined();
    });

    it('allows an omitted result date to inherit known report context', () => {
        const bundle = buildDiagnosticReportBundle(baseDraft(), {
            now: '2026-07-31T12:00:00.000Z',
            idFactory: ids,
        });

        expect(bundle.observations[0].effective).toMatchObject({
            value: '2026-07-30',
            precision: 'day',
            sourceText: '2026-07-30',
        });
        expect(bundle.observations[0].issuedAt)
            .toBe('2026-07-31T09:30:00.000Z');
    });
});
