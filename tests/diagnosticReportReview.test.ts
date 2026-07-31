import { beforeEach, describe, expect, it } from 'vitest';
import type { LabReport } from '../features/chat/schemas';
import {
    parseClinicalRecordResource,
    type DocumentReferenceRecord,
    useClinicalRecordStore,
} from '../features/clinical-record';
import {
    buildAndCommitReviewedDiagnosticReport,
    buildDiagnosticReviewEvidence,
    buildReviewedDiagnosticReportBundle,
    createLegacyLabReviewSeed,
    createPendingLegacyLabReview,
    type ReviewedDiagnosticReportDraft,
} from '../features/diagnostic-reports';

const NOW = '2026-07-31T14:00:00.000Z';
const PATIENT_ID = 'patient-phase4-review';
const DOCUMENT_ID = 'document-phase4-review';

const extractedReport = (): LabReport => ({
    reportType: 'lab-report',
    date: '2026-07-30',
    interpretation: 'Synthetic extracted comment',
    labs: [
        {
            testName: 'Hemoglobin',
            loinc: '718-7',
            value: '13.0',
            units: 'g/dL',
            refRange: '12.0 - 16.0',
            flag: 'Normal',
        },
        {
            testName: 'Respiratory virus screen',
            value: 'Not detected',
            units: '',
            refRange: 'Not detected',
            flag: 'Normal',
        },
        {
            testName: 'Potassium',
            loinc: '2823-3',
            value: 'Pending',
            units: 'mmol/L',
            refRange: '3.5 - 5.1',
            flag: 'Unknown',
        },
    ],
});

const sourceDocument = (): DocumentReferenceRecord =>
    parseClinicalRecordResource({
        id: DOCUMENT_ID,
        patientId: PATIENT_ID,
        resourceType: 'DocumentReference',
        verificationStatus: 'confirmed',
        recordedAt: NOW,
        provenance: {
            source: {
                kind: 'manual',
                description: 'Synthetic report-review source',
            },
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
        storageId: 'storage-phase4-review',
        fileName: 'reviewed-laboratory-report.pdf',
        mimeType: 'application/pdf',
        uploadedAt: NOW,
        relatedResources: [],
    }) as DocumentReferenceRecord;

const deterministicIds = (resourceType: string, localId: string): string =>
    `${resourceType.toLowerCase()}-${localId}`;

describe('Phase 4 report-level review boundary', () => {
    beforeEach(() => {
        useClinicalRecordStore.setState({ records: {} });
        const actions = useClinicalRecordStore.getState().actions;
        actions.initializePatientRecord({
            patientId: PATIENT_ID,
            displayName: 'Synthetic Review Patient',
            now: NOW,
        });
        actions.addResource(sourceDocument());
    });

    it('keeps legacy lab extraction pending and source-linked before review', () => {
        const pending = createPendingLegacyLabReview({
            report: extractedReport(),
            source: {
                documentId: DOCUMENT_ID,
                fileName: 'reviewed-laboratory-report.pdf',
                storageId: 'storage-phase4-review',
                mimeType: 'application/pdf',
                pageNumber: 2,
            },
            detectedAt: NOW,
        });
        const seed = createLegacyLabReviewSeed({
            report: pending.report,
            patientId: PATIENT_ID,
            source: pending.source,
        });

        expect(seed.sourceAvailable).toBe(true);
        expect(seed.draft).toMatchObject({
            patientId: PATIENT_ID,
            verificationStatus: 'candidate',
            effectiveDate: '2026-07-30',
            source: {
                documentId: DOCUMENT_ID,
                fileName: 'reviewed-laboratory-report.pdf',
                pageNumber: 2,
            },
        });
        expect(seed.draft.results).toHaveLength(3);
        expect(seed.draft.results[0]).toMatchObject({
            testName: 'Hemoglobin',
            valueText: '13.0',
            source: {
                pageNumber: 2,
                excerpt: expect.stringContaining('Hemoglobin'),
            },
        });
        expect(
            useClinicalRecordStore.getState().actions
                .getPatientRecord(PATIENT_ID)?.resources.diagnosticReports,
        ).toHaveLength(0);
    });

    it('retains edits and excluded rows in amendment history and commits one graph', () => {
        const seed = createLegacyLabReviewSeed({
            report: extractedReport(),
            patientId: PATIENT_ID,
            source: {
                documentId: DOCUMENT_ID,
                fileName: 'reviewed-laboratory-report.pdf',
                pageNumber: 1,
            },
        });
        const [hemoglobin, virus, potassium] = seed.draft.results;
        const included = new Set([hemoglobin.localId, potassium.localId]);
        const reviewedWithoutEvidence: ReviewedDiagnosticReportDraft = {
            ...seed.draft,
            reportTitle: 'CBC and chemistry report',
            status: 'final',
            performer: ['Synthetic Reference Laboratory'],
            accessionIdentifier: { value: 'ACC-REVIEW-001' },
            specimens: [{
                localId: 'blood-specimen',
                status: 'available',
                typeText: 'Venous blood',
                collectedDate: '2026-07-30',
                collectionMethodText: 'Venipuncture',
            }],
            results: [
                {
                    ...hemoglobin,
                    valueText: '13.2',
                    specimenLocalId: 'blood-specimen',
                    source: {
                        ...hemoglobin.source,
                        pageNumber: 1,
                        excerpt: 'Hemoglobin 13.2 g/dL',
                    },
                },
                {
                    ...potassium,
                    valueText: null,
                    absentReasonText: 'Result pending on the source report',
                    specimenLocalId: 'blood-specimen',
                    source: {
                        ...potassium.source,
                        pageNumber: 1,
                    },
                },
            ],
            verificationStatus: 'confirmed',
            reviewedAt: NOW,
            reviewedBy: 'tester',
        };
        const evidence = buildDiagnosticReviewEvidence({
            initial: seed.draft,
            reviewed: reviewedWithoutEvidence,
            includedResultIds: included,
            reason: 'Corrected the hemoglobin value and excluded an unrelated row.',
        });
        const reviewed: ReviewedDiagnosticReportDraft = {
            ...reviewedWithoutEvidence,
            reviewEvidence: evidence,
        };

        const preview = buildReviewedDiagnosticReportBundle(reviewed, {
            now: NOW,
            actor: 'tester',
            idFactory: deterministicIds,
        });

        expect(evidence?.excludedResults).toEqual([
            expect.objectContaining({
                localId: virus.localId,
                testName: 'Respiratory virus screen',
            }),
        ]);
        expect(preview.report.amendments).toHaveLength(1);
        expect(preview.report.amendments[0].previousValues).toMatchObject({
            reportTitle: 'Laboratory report',
            excludedResults: [
                expect.objectContaining({ localId: virus.localId }),
            ],
        });
        expect(preview.observations[0].amendments[0].previousValues)
            .toMatchObject({ valueText: '13.0' });
        expect(preview.observations[0].value).toMatchObject({
            type: 'quantity',
            quantity: { original: { value: 13.2, unit: 'g/dL' } },
        });
        expect(preview.observations[1].value).toBeUndefined();
        expect(preview.observations[1].tags).toContain('data-absent');
        expect(preview.observations[1].note).toContain(
            'Data absent reason: Result pending on the source report',
        );

        const result = buildAndCommitReviewedDiagnosticReport(reviewed, {
            now: NOW,
            committedAt: NOW,
            actor: 'tester',
            idFactory: deterministicIds,
        });
        const record = useClinicalRecordStore.getState()
            .actions.getPatientRecord(PATIENT_ID)!;

        expect(result.commit).toMatchObject({
            ok: true,
            status: 'created',
            reportId: 'diagnosticreport-report',
        });
        expect(record.resources.diagnosticReports).toHaveLength(1);
        expect(record.resources.observations).toHaveLength(2);
        expect(record.resources.specimens).toHaveLength(1);
        expect(record.resources.documents[0].relatedResources).toContainEqual({
            resourceType: 'DiagnosticReport',
            id: 'diagnosticreport-report',
            display: 'CBC and chemistry report',
        });
    });

    it('blocks confirmation without the original source and writes nothing', () => {
        const actions = useClinicalRecordStore.getState().actions;
        const record = actions.getPatientRecord(PATIENT_ID)!;
        actions.replacePatientRecord({
            ...record,
            resources: { ...record.resources, documents: [] },
            updatedAt: NOW,
        });

        const seed = createLegacyLabReviewSeed({
            report: extractedReport(),
            patientId: PATIENT_ID,
            source: {
                documentId: DOCUMENT_ID,
                fileName: 'missing.pdf',
            },
        });
        const reviewed: ReviewedDiagnosticReportDraft = {
            ...seed.draft,
            status: 'final',
            verificationStatus: 'confirmed',
            reviewedAt: NOW,
            reviewedBy: 'tester',
        };
        const result = buildAndCommitReviewedDiagnosticReport(reviewed, {
            now: NOW,
            committedAt: NOW,
            actor: 'tester',
            idFactory: deterministicIds,
        });
        const unchanged = actions.getPatientRecord(PATIENT_ID)!;

        expect(result.commit).toMatchObject({
            ok: false,
            status: 'invalid-graph',
            createdResourceIds: [],
        });
        expect(result.commit.issues.some(issue =>
            issue.code === 'missing-source-document')).toBe(true);
        expect(unchanged.resources.diagnosticReports).toHaveLength(0);
        expect(unchanged.resources.observations).toHaveLength(0);
        expect(unchanged.resources.specimens).toHaveLength(0);
    });

    it('marks source-less legacy extraction as unavailable for confirmation', () => {
        const seed = createLegacyLabReviewSeed({
            report: extractedReport(),
            patientId: PATIENT_ID,
            source: {},
        });

        expect(seed.sourceAvailable).toBe(false);
        expect(seed.sourceWarning).toContain('not linked');
        expect(seed.draft.source.documentId).toBe('missing-source-document');
        expect(seed.draft.verificationStatus).toBe('candidate');
    });
});
