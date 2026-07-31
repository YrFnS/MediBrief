import { beforeEach, describe, expect, it } from 'vitest';
import {
    parseClinicalRecordResource,
    type DocumentReferenceRecord,
    useClinicalRecordStore,
} from '../features/clinical-record';
import {
    analyzeDiagnosticReportConflicts,
    buildAndCommitReviewedDiagnosticReport,
    buildDiagnosticResultsIntelligence,
    buildReviewedDiagnosticReportBundle,
    validateConflictAwareDiagnosticReportBundle,
    type ReviewedDiagnosticReportDraft,
} from '../features/diagnostic-reports';

const NOW = '2026-08-01T08:00:00.000Z';
const PATIENT_ID = 'patient-phase4-conflicts';

const document = (id: string, fileName: string): DocumentReferenceRecord =>
    parseClinicalRecordResource({
        id,
        patientId: PATIENT_ID,
        resourceType: 'DocumentReference',
        verificationStatus: 'confirmed',
        recordedAt: NOW,
        provenance: {
            source: { kind: 'manual', description: 'Synthetic diagnostic source' },
            createdAt: NOW,
            updatedAt: NOW,
            confirmation: {
                reviewedAt: NOW,
                reviewedBy: 'tester',
                reason: 'Synthetic source fixture',
            },
        },
        amendments: [],
        status: 'current',
        storageId: `storage-${id}`,
        fileName,
        mimeType: 'application/pdf',
        uploadedAt: NOW,
        relatedResources: [],
    }) as DocumentReferenceRecord;

const ids = (prefix: string) => (
    resourceType: string,
    localId: string,
): string => `${prefix}-${resourceType.toLowerCase()}-${localId}`;

const draft = ({
    documentId,
    value,
    accession = 'ACC-CONFLICT-001',
    status = 'final',
    conflictResolution,
}: {
    documentId: string;
    value: string;
    accession?: string;
    status?: ReviewedDiagnosticReportDraft['status'];
    conflictResolution?: ReviewedDiagnosticReportDraft['conflictResolution'];
}): ReviewedDiagnosticReportDraft => ({
    patientId: PATIENT_ID,
    reportTitle: 'Complete blood count',
    status,
    categoryTexts: ['Laboratory'],
    effectiveDate: '2026-07-31',
    issuedAt: '2026-07-31T10:00:00.000Z',
    performer: ['Synthetic laboratory'],
    accessionIdentifier: { value: accession },
    specimens: [{
        localId: 'blood',
        status: 'available',
        typeText: 'Venous blood',
        collectedDate: '2026-07-31',
    }],
    results: [{
        localId: 'hemoglobin',
        testName: 'Hemoglobin',
        loincCode: '718-7',
        status: status === 'corrected' ? 'corrected' : status === 'amended' ? 'amended' : 'final',
        categoryTexts: ['Laboratory'],
        valueText: value,
        unitText: 'g/dL',
        referenceRangeText: '12.0 - 16.0',
        clinicalDate: '2026-07-31',
        specimenLocalId: 'blood',
        source: { pageNumber: 1, excerpt: `Hemoglobin ${value} g/dL` },
    }],
    source: {
        documentId,
        fileName: `${documentId}.pdf`,
        pageNumber: 1,
    },
    verificationStatus: 'confirmed',
    reviewedAt: NOW,
    reviewedBy: 'tester',
    ...(conflictResolution ? { conflictResolution } : {}),
});

describe('Phase 4 corrected report lineage and conflict resolution', () => {
    beforeEach(() => {
        useClinicalRecordStore.setState({ records: {} });
        const actions = useClinicalRecordStore.getState().actions;
        actions.initializePatientRecord({
            patientId: PATIENT_ID,
            displayName: 'Synthetic Conflict Patient',
            now: NOW,
        });
        actions.addResource(document('source-1', 'original-report.pdf'));
        actions.addResource(document('source-2', 'duplicate-report.pdf'));
        actions.addResource(document('source-3', 'corrected-report.pdf'));
        actions.addResource(document('source-4', 'similar-distinct-report.pdf'));
    });

    it('blocks an unresolved cross-source exact duplicate and skips it after review', () => {
        const first = buildAndCommitReviewedDiagnosticReport(
            draft({ documentId: 'source-1', value: '13.2' }),
            { now: NOW, committedAt: NOW, actor: 'tester', idFactory: ids('v1') },
        );
        expect(first.commit.ok).toBe(true);

        const record = useClinicalRecordStore.getState().actions
            .getPatientRecord(PATIENT_ID)!;
        const duplicateDraft = draft({ documentId: 'source-2', value: '13.2' });
        const duplicateBundle = buildReviewedDiagnosticReportBundle(
            duplicateDraft,
            { now: NOW, actor: 'tester', idFactory: ids('dup'), record },
        );
        const analysis = analyzeDiagnosticReportConflicts(record, duplicateBundle);
        const validation = validateConflictAwareDiagnosticReportBundle({
            bundle: duplicateBundle,
            record,
        });

        expect(analysis.blockingCandidates[0]).toMatchObject({
            reportId: first.commit.reportId,
            kind: 'exact-duplicate',
            blocking: true,
        });
        expect(validation.valid).toBe(false);
        expect(validation.issues.some(issue =>
            issue.code === 'duplicate-report-content')).toBe(true);

        const resolved = buildAndCommitReviewedDiagnosticReport(
            draft({
                documentId: 'source-2',
                value: '13.2',
                conflictResolution: {
                    relatedReportId: first.commit.reportId!,
                    decision: 'duplicate',
                    reason: 'Both source documents contain the same accession and result value.',
                },
            }),
            { now: NOW, committedAt: NOW, actor: 'tester', idFactory: ids('dup') },
        );
        const unchanged = useClinicalRecordStore.getState().actions
            .getPatientRecord(PATIENT_ID)!;

        expect(resolved.commit).toMatchObject({
            ok: true,
            status: 'resolved-duplicate',
            duplicateOf: first.commit.reportId,
            createdResourceIds: [],
        });
        expect(unchanged.resources.diagnosticReports).toHaveLength(1);
        expect(unchanged.resources.observations).toHaveLength(1);
    });

    it('creates a corrected version with observation lineage and preserves prior values', () => {
        const first = buildAndCommitReviewedDiagnosticReport(
            draft({ documentId: 'source-1', value: '13.2' }),
            { now: NOW, committedAt: NOW, actor: 'tester', idFactory: ids('v1') },
        );
        const corrected = buildAndCommitReviewedDiagnosticReport(
            draft({
                documentId: 'source-3',
                value: '12.8',
                status: 'corrected',
                conflictResolution: {
                    relatedReportId: first.commit.reportId!,
                    decision: 'corrects',
                    reason: 'The laboratory issued a corrected hemoglobin value.',
                },
            }),
            { now: NOW, committedAt: NOW, actor: 'tester', idFactory: ids('v2') },
        );
        const record = useClinicalRecordStore.getState().actions
            .getPatientRecord(PATIENT_ID)!;
        const originalReport = record.resources.diagnosticReports.find(item =>
            item.id === first.commit.reportId)!;
        const correctedReport = record.resources.diagnosticReports.find(item =>
            item.id === corrected.commit.reportId)!;
        const originalObservation = record.resources.observations.find(item =>
            item.id === originalReport.resultIds[0])!;
        const correctedObservation = record.resources.observations.find(item =>
            item.id === correctedReport.resultIds[0])!;

        expect(corrected.commit.status).toBe('created');
        expect(correctedReport.relationships).toEqual([
            expect.objectContaining({
                type: 'corrects',
                relatedReportId: originalReport.id,
            }),
        ]);
        expect(correctedObservation.lineage).toMatchObject({
            relationship: 'corrects',
            predecessorObservationId: originalObservation.id,
        });
        expect(originalObservation.value).toMatchObject({
            type: 'quantity',
            quantity: { original: { value: 13.2 } },
        });
        expect(correctedObservation.value).toMatchObject({
            type: 'quantity',
            quantity: { original: { value: 12.8 } },
        });

        const intelligence = buildDiagnosticResultsIntelligence(record);
        expect(intelligence.supersededResults.map(item => item.id))
            .toContain(originalObservation.id);
        expect(intelligence.panels.find(item => item.id === originalReport.id))
            .toMatchObject({ isSuperseded: true });
        expect(intelligence.panels.find(item => item.id === correctedReport.id))
            .toMatchObject({ isSuperseded: false });
        expect(intelligence.trendSeries.flatMap(series =>
            series.points.map(point => point.observationId)))
            .not.toContain(originalObservation.id);
        expect(intelligence.trendExclusions).toContainEqual(
            expect.objectContaining({
                observationId: originalObservation.id,
                reason: 'superseded-result',
            }),
        );
    });

    it('keeps a same-day similar report advisory when no strong event identifier matches', () => {
        const first = buildAndCommitReviewedDiagnosticReport(
            draft({ documentId: 'source-1', value: '13.2', accession: 'ACC-A' }),
            { now: NOW, committedAt: NOW, actor: 'tester', idFactory: ids('v1') },
        );
        expect(first.commit.ok).toBe(true);

        const secondDraft = draft({
            documentId: 'source-4',
            value: '12.1',
            accession: 'ACC-B',
        });
        const record = useClinicalRecordStore.getState().actions
            .getPatientRecord(PATIENT_ID)!;
        const bundle = buildReviewedDiagnosticReportBundle(secondDraft, {
            now: NOW,
            actor: 'tester',
            idFactory: ids('distinct'),
            record,
        });
        const analysis = analyzeDiagnosticReportConflicts(record, bundle);
        const committed = buildAndCommitReviewedDiagnosticReport(secondDraft, {
            now: NOW,
            committedAt: NOW,
            actor: 'tester',
            idFactory: ids('distinct'),
        });

        expect(analysis.candidates[0]).toMatchObject({
            kind: 'possible-duplicate',
            blocking: false,
        });
        expect(analysis.requiresResolution).toBe(false);
        expect(committed.commit.status).toBe('created');
    });
});
