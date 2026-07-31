import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string): string =>
    readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('Phase 4 report-level review workspace contracts', () => {
    it('reviews the original source beside the connected report graph', () => {
        const workspace = source(
            '../features/diagnostic-reports/components/DiagnosticReportReviewWorkspace.tsx',
        );
        const sourcePane = source(
            '../features/diagnostic-reports/components/DiagnosticReportSourcePane.tsx',
        );

        expect(workspace).toContain('DiagnosticReportSourcePane');
        expect(workspace).toContain('Original source + report + specimens + results');
        expect(workspace).toContain('buildDiagnosticReviewEvidence');
        expect(workspace).toContain('buildAndCommitReviewedDiagnosticReport');
        expect(workspace).toContain('validateDiagnosticReportBundleGraph');
        expect(workspace).toContain('Confirm report graph');
        expect(sourcePane).toContain('blobStorage.getFile');
        expect(sourcePane).toContain('Original report');
        expect(sourcePane).toContain('#page=${pageNumber}');
    });

    it('supports report, specimen, and per-result review without numeric-only assumptions', () => {
        const workspace = source(
            '../features/diagnostic-reports/components/DiagnosticReportReviewWorkspace.tsx',
        );

        expect(workspace).toContain('Add specimen');
        expect(workspace).toContain('Add result');
        expect(workspace).toContain('Absent-result reason');
        expect(workspace).toContain('Qualitative, comparator, textual, and absent results are supported');
        expect(workspace).toContain("included ? 'Included' : 'Excluded'");
        expect(workspace).toContain('A recorded flag or range is not a diagnosis');
        expect(workspace).toContain('At least one reviewed result must remain included');
    });

    it('retires the legacy row-only confirmation writer', () => {
        const layout = source('../features/layout/MainLayout.tsx');
        const legacyModalPath = new URL(
            '../features/clinical-analysis/components/LabVerificationModal.tsx',
            import.meta.url,
        );

        expect(layout).toContain('DiagnosticReportReviewWorkspace');
        expect(layout).toContain('handleDiagnosticReportSaved');
        expect(layout).not.toContain('LabVerificationModal');
        expect(layout).not.toContain('handleLabVerification');
        expect(layout).not.toContain('ingestObservations');
        expect(layout).not.toContain('normalizeValue');
        expect(layout).not.toContain('CLINICAL_OBSERVATIONS_CONFIRMED');
        expect(existsSync(legacyModalPath)).toBe(false);
    });

    it('carries uploaded-source context into pending review state', () => {
        const orchestrator = source(
            '../features/chat/hooks/useChatOrchestrator.ts',
        );
        const uiState = source('../features/ui/UIContext.tsx');
        const adapter = source(
            '../features/diagnostic-reports/legacyLabReview.ts',
        );

        expect(orchestrator).toContain('createPendingLegacyLabReview');
        expect(orchestrator).toContain('`document-${uploadedFile.storageId}`');
        expect(orchestrator).toContain('Google Gemini lab-report extraction');
        expect(orchestrator).toContain('OpenRouter lab-report extraction');
        expect(uiState).toContain('PendingLegacyLabReview | null');
        expect(adapter).toContain("verificationStatus: 'candidate'");
        expect(adapter).toContain('Confirming it is blocked until the original report is available');
    });

    it('audits review opening, confirmation, and cancellation separately', () => {
        const workspace = source(
            '../features/diagnostic-reports/components/DiagnosticReportReviewWorkspace.tsx',
        );
        const auditTypes = source('../features/audit/types.ts');

        for (const eventType of [
            'DIAGNOSTIC_REPORT_REVIEW_STARTED',
            'DIAGNOSTIC_REPORT_REVIEW_CONFIRMED',
            'DIAGNOSTIC_REPORT_REVIEW_CANCELLED',
        ]) {
            expect(workspace).toContain(eventType);
            expect(auditTypes).toContain(eventType);
        }
        expect(workspace).toContain('saved together');
        expect(workspace).toContain('does not diagnose the patient');
    });
});
