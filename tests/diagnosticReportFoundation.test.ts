import { beforeEach, describe, expect, it } from 'vitest';
import {
    parseClinicalRecordResource,
    type DocumentReferenceRecord,
    useClinicalRecordStore,
} from '../features/clinical-record';
import {
    buildDiagnosticReportBundle,
    commitDiagnosticReportBundle,
    parseDiagnosticObservationValue,
    parseDiagnosticReferenceRange,
    validateDiagnosticReportBundleGraph,
    type ReviewedDiagnosticReportDraft,
} from '../features/diagnostic-reports';

const NOW = '2026-07-31T12:00:00.000Z';
const PATIENT_ID = 'patient-phase4';
const DOCUMENT_ID = 'document-phase4-lab';

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
                description: 'Synthetic Phase 4 source document',
            },
            createdAt: NOW,
            updatedAt: NOW,
            confirmation: {
                reviewedAt: NOW,
                reviewedBy: 'tester',
                reason: 'Synthetic file fixture',
            },
        },
        amendments: [],
        status: 'current',
        storageId: 'storage-phase4-lab',
        fileName: 'synthetic-lab.pdf',
        mimeType: 'application/pdf',
        uploadedAt: NOW,
        relatedResources: [],
    }) as DocumentReferenceRecord;

const reviewedDraft = (): ReviewedDiagnosticReportDraft => ({
    patientId: PATIENT_ID,
    reportTitle: 'Complete blood count and respiratory screen',
    status: 'final',
    categoryTexts: ['Laboratory'],
    effectiveDate: '2026-07-30',
    issuedAt: '2026-07-31T09:30:00.000Z',
    performer: ['Synthetic Reference Laboratory'],
    accessionIdentifier: {
        system: 'urn:synthetic:accession',
        value: 'ACC-2026-0001',
    },
    specimens: [{
        localId: 'blood-specimen',
        status: 'available',
        typeText: 'Venous blood specimen',
        collectedDate: '2026-07-30',
        receivedDate: '2026-07-30',
        collectionMethodText: 'Venipuncture',
        collector: 'Synthetic collector',
        identifiers: [{ value: 'SPEC-001' }],
    }],
    results: [
        {
            localId: 'hemoglobin',
            testName: 'Hemoglobin',
            loincCode: '718-7',
            valueText: '13.2',
            unitText: 'g/dL',
            referenceRangeText: '12.0 – 16.0',
            interpretationText: 'Normal',
            specimenLocalId: 'blood-specimen',
            source: {
                pageNumber: 1,
                section: 'Hematology',
                startOffset: 120,
                endOffset: 136,
                excerpt: 'Hemoglobin 13.2 g/dL',
            },
        },
        {
            localId: 'viral-screen',
            testName: 'Respiratory virus screen',
            valueText: 'Not detected',
            referenceRangeText: 'Not detected',
            clinicalDate: null,
            source: {
                pageNumber: 2,
                section: 'Molecular testing',
            },
        },
    ],
    conclusion: 'No narrative conclusion beyond the structured results.',
    source: {
        documentId: DOCUMENT_ID,
        fileName: 'synthetic-lab.pdf',
        pageNumber: 1,
    },
    verificationStatus: 'confirmed',
    reviewedAt: NOW,
    reviewedBy: 'tester',
});

const deterministicIds = (resourceType: string, localId: string): string =>
    `${resourceType.toLowerCase()}-${localId}`;

describe('Phase 4 diagnostic value parsing', () => {
    it('preserves comparators and assigns only safe UCUM evidence', () => {
        const parsed = parseDiagnosticObservationValue({
            valueText: '<5',
            unitText: 'mg/dL',
        });

        expect(parsed.kind).toBe('quantity');
        expect(parsed.value).toEqual({
            type: 'quantity',
            quantity: {
                original: {
                    value: 5,
                    unit: 'mg/dL',
                    system: 'http://unitsofmeasure.org',
                    code: 'mg/dL',
                    comparator: '<',
                },
            },
        });
        expect(parsed.warnings).toEqual([]);
    });

    it('keeps decimal-comma values as text rather than guessing', () => {
        const parsed = parseDiagnosticObservationValue({
            valueText: '5,4',
            unitText: 'mmol/L',
        });

        expect(parsed.kind).toBe('text');
        expect(parsed.value).toEqual({ type: 'string', text: '5,4' });
        expect(parsed.warnings.some(warning =>
            warning.code === 'decimal-comma-unparsed')).toBe(true);
    });

    it('preserves qualitative and absent results as different states', () => {
        const qualitative = parseDiagnosticObservationValue({
            valueText: 'Not detected',
        });
        const absent = parseDiagnosticObservationValue({
            valueText: null,
            absentReasonText: 'Specimen rejected',
        });

        expect(qualitative.kind).toBe('qualitative');
        expect(qualitative.value?.type).toBe('codeable-concept');
        expect(absent).toMatchObject({
            kind: 'absent',
            absentReason: 'Specimen rejected',
        });
        expect(absent.value).toBeUndefined();
    });

    it('parses bounded and one-sided ranges while retaining source text', () => {
        const bounded = parseDiagnosticReferenceRange('4.0 – 10.0', 'g/dL');
        const oneSided = parseDiagnosticReferenceRange('<=5', 'mg/dL');
        const qualitative = parseDiagnosticReferenceRange('Negative');

        expect(bounded.ranges[0]).toMatchObject({
            low: { value: 4, unit: 'g/dL' },
            high: { value: 10, unit: 'g/dL' },
            text: '4.0 – 10.0',
        });
        expect(oneSided.ranges[0]).toMatchObject({
            high: { value: 5, comparator: '<=', unit: 'mg/dL' },
            text: '<=5',
        });
        expect(qualitative).toEqual({
            ranges: [{ text: 'Negative' }],
            warnings: [],
        });
    });
});

describe('Phase 4 diagnostic report graph', () => {
    beforeEach(() => {
        useClinicalRecordStore.setState({ records: {} });
        const actions = useClinicalRecordStore.getState().actions;
        actions.initializePatientRecord({
            patientId: PATIENT_ID,
            displayName: 'Synthetic Phase 4 Patient',
            now: NOW,
        });
        actions.addResource(sourceDocument());
    });

    it('builds one connected report, specimen, and result graph', () => {
        const bundle = buildDiagnosticReportBundle(reviewedDraft(), {
            now: NOW,
            actor: 'tester',
            idFactory: deterministicIds,
        });

        expect(bundle.report.id).toBe('diagnosticreport-report');
        expect(bundle.report.resultIds).toEqual([
            'observation-hemoglobin',
            'observation-viral-screen',
        ]);
        expect(bundle.report.specimenIds).toEqual([
            'specimen-blood-specimen',
        ]);
        expect(bundle.report.documentIds).toEqual([DOCUMENT_ID]);
        expect(bundle.observations[0]).toMatchObject({
            diagnosticReportId: 'diagnosticreport-report',
            specimenId: 'specimen-blood-specimen',
            verificationStatus: 'confirmed',
            effective: {
                value: '2026-07-30',
                precision: 'day',
            },
        });
        expect(
            bundle.observations[0].provenance.source.document?.pageNumber,
        ).toBe(1);
        expect(bundle.observations[1].value).toMatchObject({
            type: 'codeable-concept',
            concept: { text: 'Not detected' },
        });
        expect(bundle.report.provenance.confirmation?.reviewedBy).toBe('tester');
        expect(bundle.warnings.some(warning =>
            warning.code === 'identifier-preserved-in-provenance')).toBe(true);
        expect(validateDiagnosticReportBundleGraph(bundle).valid).toBe(true);
    });

    it('commits the complete graph and source link in one record replacement', () => {
        const bundle = buildDiagnosticReportBundle(reviewedDraft(), {
            now: NOW,
            actor: 'tester',
            idFactory: deterministicIds,
        });
        const result = commitDiagnosticReportBundle(bundle, {
            actor: 'tester',
            committedAt: NOW,
        });
        const record = useClinicalRecordStore.getState()
            .actions.getPatientRecord(PATIENT_ID)!;

        expect(result).toMatchObject({
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
            display: 'Complete blood count and respiratory screen',
        });
        expect(record.resources.documents[0].amendments).toHaveLength(1);
    });

    it('reports a duplicate source without adding a second graph', () => {
        const first = buildDiagnosticReportBundle(reviewedDraft(), {
            now: NOW,
            idFactory: deterministicIds,
        });
        expect(commitDiagnosticReportBundle(first).ok).toBe(true);

        const second = buildDiagnosticReportBundle(reviewedDraft(), {
            now: '2026-07-31T13:00:00.000Z',
            idFactory: (type, localId) => `second-${type}-${localId}`,
        });
        const result = commitDiagnosticReportBundle(second);
        const record = useClinicalRecordStore.getState()
            .actions.getPatientRecord(PATIENT_ID)!;

        expect(result).toMatchObject({
            ok: false,
            status: 'duplicate',
            duplicateOf: 'diagnosticreport-report',
        });
        expect(record.resources.diagnosticReports).toHaveLength(1);
        expect(record.resources.observations).toHaveLength(2);
        expect(record.resources.specimens).toHaveLength(1);
    });

    it('rejects a broken graph without writing any partial resources', () => {
        const bundle = buildDiagnosticReportBundle(reviewedDraft(), {
            now: NOW,
            idFactory: deterministicIds,
        });
        bundle.observations[0] = {
            ...bundle.observations[0],
            diagnosticReportId: 'wrong-report',
        };
        bundle.resources = [
            ...bundle.specimens,
            ...bundle.observations,
            bundle.report,
        ];

        const result = commitDiagnosticReportBundle(bundle);
        const record = useClinicalRecordStore.getState()
            .actions.getPatientRecord(PATIENT_ID)!;

        expect(result).toMatchObject({
            ok: false,
            status: 'invalid-graph',
        });
        expect(result.issues.some(issue =>
            issue.code === 'observation-report-mismatch')).toBe(true);
        expect(record.resources.diagnosticReports).toHaveLength(0);
        expect(record.resources.observations).toHaveLength(0);
        expect(record.resources.specimens).toHaveLength(0);
    });

    it('requires the original source document before saving', () => {
        const actions = useClinicalRecordStore.getState().actions;
        actions.deleteResource(
            PATIENT_ID,
            'DocumentReference',
            DOCUMENT_ID,
        );
        const bundle = buildDiagnosticReportBundle(reviewedDraft(), {
            now: NOW,
            idFactory: deterministicIds,
        });
        const result = commitDiagnosticReportBundle(bundle);

        expect(result).toMatchObject({
            ok: false,
            status: 'invalid-graph',
        });
        expect(result.issues.some(issue =>
            issue.code === 'missing-source-document')).toBe(true);
    });
});
