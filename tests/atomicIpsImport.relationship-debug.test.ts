import { describe, expect, it } from 'vitest';
import {
    createClinicalProvenance,
    createPatientClinicalRecord,
    createRecordSource,
    type PatientClinicalRecord,
} from '../features/clinical-record';
import {
    buildIpsDocument,
    commitAtomicIpsImport,
    FHIR_SYSTEMS,
    prepareAtomicIpsImport,
    serializeIpsBundle,
} from '../features/fhir';

const NOW = '2026-08-15T08:00:00.000Z';
const IMPORTED_AT = '2026-08-15T09:00:00.000Z';

const provenance = createClinicalProvenance({
    source: createRecordSource({
        kind: 'manual',
        description: 'Synthetic relationship diagnostic',
    }),
    now: NOW,
    actor: 'test-suite',
});

const sourceRecord = (): PatientClinicalRecord => {
    const record = createPatientClinicalRecord({
        patientId: 'relationship-source',
        displayName: 'Synthetic Relationship Patient',
        now: NOW,
        dateOfBirth: { value: '1990-01-01', precision: 'day' },
        administrativeSex: 'unknown',
        preferredLanguage: 'en',
    });
    record.resources.specimens.push({
        id: 'relationship-specimen',
        patientId: record.patientId,
        resourceType: 'Specimen',
        verificationStatus: 'confirmed',
        recordedAt: NOW,
        provenance,
        amendments: [],
        status: 'available',
        type: { text: 'Serum specimen' },
    });
    record.resources.observations.push({
        id: 'relationship-observation',
        patientId: record.patientId,
        resourceType: 'Observation',
        verificationStatus: 'confirmed',
        recordedAt: NOW,
        provenance,
        amendments: [],
        status: 'final',
        category: [{
            text: 'Laboratory',
            coding: [{
                system: FHIR_SYSTEMS.observationCategory,
                code: 'laboratory',
                display: 'Laboratory',
            }],
        }],
        code: {
            text: 'Creatinine',
            coding: [{
                system: FHIR_SYSTEMS.loinc,
                code: '2160-0',
                display: 'Creatinine',
            }],
        },
        value: {
            type: 'quantity',
            quantity: {
                original: {
                    value: 0.9,
                    unit: 'mg/dL',
                    system: FHIR_SYSTEMS.ucum,
                    code: 'mg/dL',
                },
            },
        },
        referenceRanges: [],
        specimenId: 'relationship-specimen',
        diagnosticReportId: 'relationship-report',
    });
    record.resources.diagnosticReports.push({
        id: 'relationship-report',
        patientId: record.patientId,
        resourceType: 'DiagnosticReport',
        verificationStatus: 'confirmed',
        recordedAt: NOW,
        provenance,
        amendments: [],
        status: 'final',
        code: {
            text: 'Basic metabolic panel',
            coding: [{
                system: FHIR_SYSTEMS.loinc,
                code: '51990-0',
                display: 'Basic metabolic panel',
            }],
        },
        resultIds: ['relationship-observation'],
        specimenIds: ['relationship-specimen'],
        documentIds: [],
    });
    record.updatedAt = NOW;
    return record;
};

const targetRecord = (): PatientClinicalRecord => {
    const record = createPatientClinicalRecord({
        patientId: 'relationship-target',
        displayName: 'Synthetic Relationship Patient',
        now: NOW,
        dateOfBirth: { value: '1990-01-01', precision: 'day' },
        administrativeSex: 'unknown',
        preferredLanguage: 'en',
    });
    record.updatedAt = NOW;
    return record;
};

describe('P1.3 relationship diagnostic', () => {
    it('prints only staged relationship identifiers', async () => {
        const current = targetRecord();
        const preview = await prepareAtomicIpsImport({
            input: serializeIpsBundle(buildIpsDocument(sourceRecord(), NOW).bundle),
            targetRecord: current,
            importedAt: IMPORTED_AT,
            fileName: 'relationship.json',
            mimeType: 'application/fhir+json',
        });
        const previewObservation = preview.candidates.find(candidate =>
            candidate.resourceType === 'Observation');
        const previewReport = preview.candidates.find(candidate =>
            candidate.resourceType === 'DiagnosticReport');
        console.log('P1.3 relationship preview', JSON.stringify({
            observationId: previewObservation?.id,
            observationReportId:
                previewObservation?.resourceType === 'Observation'
                    ? previewObservation.diagnosticReportId
                    : undefined,
            reportId: previewReport?.id,
            reportResultIds:
                previewReport?.resourceType === 'DiagnosticReport'
                    ? previewReport.resultIds
                    : [],
        }));

        const committed = commitAtomicIpsImport({
            currentRecord: current,
            preview,
            identityAcknowledgement: {
                confirmed: true,
                targetPatientId: current.patientId,
                sourceSha256: preview.source!.sha256,
                acknowledgedAt: '2026-08-15T09:05:00.000Z',
            },
        });
        const record = committed.record!;
        console.log('P1.3 relationship commit', JSON.stringify({
            observations: record.resources.observations.map(observation => ({
                id: observation.id,
                diagnosticReportId: observation.diagnosticReportId,
            })),
            reports: record.resources.diagnosticReports.map(report => ({
                id: report.id,
                resultIds: report.resultIds,
                specimenIds: report.specimenIds,
            })),
        }));
        expect(committed.ok).toBe(true);
    });
});
