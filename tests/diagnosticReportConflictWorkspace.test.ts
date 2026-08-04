import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string): string =>
    readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('Phase 4 conflict and version-history workspace contracts', () => {
    it('requires an explicit duplicate or corrected-report decision and reason', () => {
        const review = source(
            '../features/diagnostic-reports/components/DiagnosticReportReviewWorkspace.tsx',
        );

        expect(review).toContain('Potential duplicate or corrected report');
        expect(review).toContain('Decision required');
        expect(review).toContain('Duplicate — do not save another copy');
        expect(review).toContain('Corrects the selected report');
        expect(review).toContain('Keep both as distinct reports');
        expect(review).toContain('Conflict-resolution reason');
        expect(review).toContain('validateConflictAwareDiagnosticReportBundle');
    });

    it('keeps superseded reports and values visible outside current trends', () => {
        const results = source(
            '../features/personal-health-record/components/ResultsModule.tsx',
        );
        const intelligence = source(
            '../features/diagnostic-reports/resultIntelligence.ts',
        );

        expect(results).toContain('Version history');
        expect(results).toContain('Superseded result values');
        expect(results).toContain('Prior reports and result values are never overwritten');
        expect(intelligence).toContain("'superseded-result'");
        expect(intelligence).toContain('observationSuccessors');
        expect(intelligence).toContain('reportSuccessors');
    });
});
