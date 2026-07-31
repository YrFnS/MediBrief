import { beforeEach, describe, expect, it } from 'vitest';
import {
    parseClinicalRecordResource,
    parsePatientClinicalRecord,
    useClinicalRecordStore,
    type DocumentReferenceRecord,
    type PatientClinicalRecord,
} from '../features/clinical-record';
import {
    buildDiagnosticReportCandidateGraph,
    confirmDiagnosticReportCandidateGraph,
    confirmDiagnosticReportGraph,
    createDiagnosticReportDraftCandidates,
    diagnosticReportGraphTag,
    insertDiagnosticReportCandidateGraph,
    rejectDiagnosticReportGraph,
    validateDiagnosticReportDraft,
    validateDiagnosticReportCandidateGraph,
    type DiagnosticReportDraft,
} from '../features/diagnostic-reports';
import {
    FIXED_TIME,
    clinicalDay,
    makePatientRecord,
    unknownClinicalDate,
} from './fixtures';

const makeDocument = (): DocumentReferenceRecord =>
    parseClinicalRecordResource({
        id: 'document-lab-1',
        patientId: 'patient-1',
        resourceType: 'DocumentReference',
        verificationStatus: 'confirmed',
        recordedAt: FIXED_TIME,
        provenance: {
            source: {
                kind: 'manual',
                description: 'Test source document',
            },
            createdAt: FIXED_TIME,
            updatedAt: FIXED_TIME,
            confirmation: {
                reviewedAt: FIXED_TIME,
                reviewedBy: 'test-user',
                reason: 'Uploaded by the user',
            },
        },
        amendments: [],
        status: 'current',
        storageId: 'storage-lab-1',
        fileName: 'lab-report.pdf',
        mimeType: 'application/pdf',
        uploadedAt: FIXED_TIME,
        relatedResources: [],
    }) as DocumentReferenceRecord;

const recordWithDocument = (): PatientClinicalRecord => {
    const record = makePatientRecord();
    return parsePatientClinicalRecord({
        ...record,
        resources: {
            ...record.resources,
            documents: [makeDocument()],
        },
    });
};

const makeDraft = (): DiagnosticReportDraft => ({
    schemaVersion: 1,
    draftId: 'cbc-2026-07-30',
    patientId: 'patient-1',
    documentId: 'document-lab-1',
    fileName: 'lab-report.pdf',
    status: 'final',
    code: { text: 'Complete blood count' },
    category: [{ text: 'Laboratory' }],
    effectivePeriod: {
        start: clinicalDay('2026-07-29'),
        end: clinicalDay('2026-07-29'),
    },
    issuedAt: '2026-07-30T08:00:00.000Z',
    performer: ['Test Laboratory'],
    reportSource: {
        documentId: 'document-lab-1',
        fileName: 'lab-report.pdf',
        pageNumber: 1,
        section: 'Hematology',
    },
    specimens: [
        {
            localId: 'blood-1',
            status: 'available',
            type: { text: 'Whole blood' },
            collectedAt: clinicalDay('2026-07-29'),
            receivedAt: unknownClinicalDate('Received date not printed'),
            source: {
                documentId: 'document-lab-1',
                fileName: 'lab-report.pdf',
                pageNumber: 1,
                excerpt: 'Specimen: Whole blood',
            },
        },
    ],
    results: [
        {
            localId: 'wbc',
            status: 'final',
            code: { text: 'White blood cell count' },
            category: [{ text: 'Laboratory' }],
            value: {
                type: 'quantity',
                rawText: '<4.0 x10^9/L',
                value: 4,
                unit: 'x10^9/L',
                comparator: '<',
                normalized: {
                    value: 4,
                    unit: '10*9/L',
                    system: 'http://unitsofmeasure.org',
                    code: '10*9/L',
                },
            },
            interpretation: [{ text: 'Low' }],
            referenceRanges: [
                {
                    low: { value: 4.5, unit: 'x10^9/L' },
                    high: { value: 11, unit: 'x10^9/L' },
                    text: '4.5–11.0 x10^9/L',
                    sourceText: 'Reference: 4.5–11.0 x10^9/L',
                },
            ],
            specimenLocalId: 'blood-1',
            effective: clinicalDay('2026-07-29'),
            performer: ['Test Laboratory'],
            source: {
                documentId: 'document-lab-1',
                fileName: 'lab-report.pdf',
                pageNumber: 1,
                startOffset: 120,
                endOffset: 160,
                excerpt: 'WBC <4.0 x10^9/L L 4.5–11.0',
            },
        },
        {
            localId: 'film-comment',
            status: 'final',
            code: { text: 'Blood film comment' },
            category: [{ text: 'Laboratory' }],
            value: {
                type: 'string',
                text: 'No abnormal cells seen',
            },
            referenceRanges: [],
            specimenLocalId: 'blood-1',
            effective: unknownClinicalDate('No result-specific date printed'),
            source: {
                documentId: 'document-lab-1',
                fileName: 'lab-report.pdf',
                pageNumber: 2,
                excerpt: 'Blood film: No abnormal cells seen',
            },
        },
    ],
    extraction: {
        engine: 'Synthetic report parser',
        model: 'fixture-v1',
        confidence: 0.91,
        extractedAt: FIXED_TIME,
    },
});

describe('Phase 4 diagnostic report candidate graph', () => {
    beforeEach(() => {
        useClinicalRecordStore.setState({ records: {} });
    });

    it('preserves comparator quantities, normalized values, qualitative text, and unknown dates', () => {
        const validation = validateDiagnosticReportDraft(makeDraft());
        expect(validation.ok).toBe(true);

        const graph = buildDiagnosticReportCandidateGraph(
            makeDraft(),
            FIXED_TIME,
        );
        expect(graph.report.verificationStatus).toBe('candidate');
        expect(graph.observations).toHaveLength(2);
        expect(graph.specimens).toHaveLength(1);
        expect(graph.report.resultIds).toEqual(
            graph.observations.map(result => result.id),
        );
        expect(graph.report.specimenIds).toEqual(
            graph.specimens.map(specimen => specimen.id),
        );
        expect(graph.report.documentIds).toEqual(['document-lab-1']);

        const quantity = graph.observations[0].value;
        expect(quantity?.type).toBe('quantity');
        if (quantity?.type === 'quantity') {
            expect(quantity.quantity.original).toEqual({
                value: 4,
                unit: 'x10^9/L',
                comparator: '<',
            });
            expect(quantity.quantity.normalized?.unit).toBe('10*9/L');
        }
        expect(graph.observations[0].note).toContain(
            'Original source result: <4.0 x10^9/L',
        );
        expect(graph.observations[0].note).toContain(
            'Reference range source: Reference: 4.5–11.0 x10^9/L',
        );
        expect(graph.observations[1].value).toEqual({
            type: 'string',
            text: 'No abnormal cells seen',
        });
        expect(graph.observations[1].effective).toEqual(
            unknownClinicalDate('No result-specific date printed'),
        );
        expect(graph.observations[1].provenance.source.document?.pageNumber)
            .toBe(2);
    });

    it('fails before persistence when a result references an unknown specimen', () => {
        const draft = makeDraft();
        draft.results[0].specimenLocalId = 'missing-specimen';
        const validation = validateDiagnosticReportDraft(draft);
        expect(validation.ok).toBe(false);
        expect(validation.issues).toContainEqual({
            path: 'results.0.specimenLocalId',
            message: 'Result references an unknown specimen local ID.',
        });
    });

    it('requires a confirmed source document and keeps same-source retries idempotent', () => {
        const graph = buildDiagnosticReportCandidateGraph(
            makeDraft(),
            FIXED_TIME,
        );
        const missingDocumentIssues = validateDiagnosticReportCandidateGraph(
            makePatientRecord(),
            graph,
        );
        expect(missingDocumentIssues.some(issue =>
            issue.path === 'documentId')).toBe(true);

        const record = recordWithDocument();
        const first = insertDiagnosticReportCandidateGraph(
            record,
            graph,
            FIXED_TIME,
        );
        expect(first.record).toBeDefined();
        expect(first.duplicate).toBe(false);

        const retry = insertDiagnosticReportCandidateGraph(
            first.record!,
            graph,
            FIXED_TIME,
        );
        expect(retry.duplicate).toBe(true);
        expect(retry.record).toBeUndefined();
    });

    it('confirms the report, observations, and specimen in one record replacement', () => {
        const graph = buildDiagnosticReportCandidateGraph(
            makeDraft(),
            FIXED_TIME,
        );
        const inserted = insertDiagnosticReportCandidateGraph(
            recordWithDocument(),
            graph,
            FIXED_TIME,
        ).record!;

        const transition = confirmDiagnosticReportGraph(
            inserted,
            graph.graphId,
            {
                reviewedAt: '2026-07-30T12:15:00.000Z',
                reviewedBy: 'reviewer',
                reason: 'Confirmed against both report pages',
            },
        );
        expect(transition.issues).toEqual([]);
        expect(transition.record).toBeDefined();

        const confirmed = transition.record!;
        const tag = diagnosticReportGraphTag(graph.graphId);
        const resources = [
            ...confirmed.resources.diagnosticReports,
            ...confirmed.resources.observations,
            ...confirmed.resources.specimens,
        ].filter(resource => resource.tags?.includes(tag));
        expect(resources).toHaveLength(4);
        expect(resources.every(resource =>
            resource.verificationStatus === 'confirmed')).toBe(true);
        expect(resources.every(resource =>
            resource.provenance.confirmation?.reviewedBy === 'reviewer'))
            .toBe(true);
        expect(resources.every(resource =>
            resource.amendments.at(-1)?.previousValues?.verificationStatus
            === 'candidate')).toBe(true);
    });

    it('rejects the complete graph only when a reason is supplied', () => {
        const graph = buildDiagnosticReportCandidateGraph(
            makeDraft(),
            FIXED_TIME,
        );
        const inserted = insertDiagnosticReportCandidateGraph(
            recordWithDocument(),
            graph,
            FIXED_TIME,
        ).record!;

        const missingReason = rejectDiagnosticReportGraph(
            inserted,
            graph.graphId,
            {},
        );
        expect(missingReason.record).toBeUndefined();
        expect(missingReason.issues[0].path).toBe('reason');

        const rejected = rejectDiagnosticReportGraph(
            inserted,
            graph.graphId,
            {
                reviewedAt: '2026-07-30T12:20:00.000Z',
                reviewedBy: 'reviewer',
                reason: 'Wrong patient report',
            },
        );
        expect(rejected.record).toBeDefined();
        expect([
            ...rejected.record!.resources.diagnosticReports,
            ...rejected.record!.resources.observations,
            ...rejected.record!.resources.specimens,
        ].filter(resource =>
            resource.tags?.includes(diagnosticReportGraphTag(graph.graphId)))
            .every(resource => resource.verificationStatus === 'rejected'))
            .toBe(true);
    });

    it('refuses an atomic transition when one graph node was reviewed separately', () => {
        const graph = buildDiagnosticReportCandidateGraph(
            makeDraft(),
            FIXED_TIME,
        );
        const inserted = insertDiagnosticReportCandidateGraph(
            recordWithDocument(),
            graph,
            FIXED_TIME,
        ).record!;
        const mixed = parsePatientClinicalRecord({
            ...inserted,
            resources: {
                ...inserted.resources,
                observations: inserted.resources.observations.map(
                    (observation, index) => index === 0
                        ? {
                            ...observation,
                            verificationStatus: 'confirmed',
                            provenance: {
                                ...observation.provenance,
                                confirmation: {
                                    reviewedAt: FIXED_TIME,
                                    reason: 'Separate review',
                                },
                            },
                        }
                        : observation,
                ),
            },
        });

        const transition = confirmDiagnosticReportGraph(
            mixed,
            graph.graphId,
            { reason: 'Attempt graph confirmation' },
        );
        expect(transition.record).toBeUndefined();
        expect(transition.issues[0].message).toContain('mixed review state');
    });

    it('persists and confirms through one store-level graph action', () => {
        const actions = useClinicalRecordStore.getState().actions;
        actions.replacePatientRecord(recordWithDocument());

        const created = createDiagnosticReportDraftCandidates(makeDraft());
        expect(created.ok).toBe(true);
        expect(created.status).toBe('created');
        expect(created.graphId).toBeTruthy();

        const confirmed = confirmDiagnosticReportCandidateGraph(
            'patient-1',
            created.graphId!,
            {
                reviewedAt: '2026-07-30T12:30:00.000Z',
                reviewedBy: 'reviewer',
                reason: 'Report-level review complete',
            },
        );
        expect(confirmed.ok).toBe(true);
        expect(confirmed.status).toBe('confirmed');
        const record = actions.getPatientRecord('patient-1')!;
        expect(record.resources.diagnosticReports[0].verificationStatus)
            .toBe('confirmed');
        expect(record.resources.observations.every(resource =>
            resource.verificationStatus === 'confirmed')).toBe(true);
        expect(record.resources.specimens.every(resource =>
            resource.verificationStatus === 'confirmed')).toBe(true);
    });
});
