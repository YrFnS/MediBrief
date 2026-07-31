import { describe, expect, it } from 'vitest';
import {
    parseClinicalRecordResource,
    type AllergyIntoleranceRecord,
    type DiagnosticReportRecord,
    type MedicationRecord,
    type ObservationRecord,
} from '../features/clinical-record';
import {
    buildAllergyModuleViewModel,
    buildConditionModuleViewModel,
    buildMedicationModuleViewModel,
    buildResultsModuleViewModel,
} from '../features/personal-health-record';
import {
    FIXED_TIME,
    affirmedPatientAssertion,
    clinicalDay,
    makeCondition,
    makePatientRecord,
    unknownClinicalDate,
} from './fixtures';

const confirmedProvenance = (description: string) => ({
    source: {
        kind: 'manual' as const,
        description,
    },
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    confirmation: {
        reviewedAt: FIXED_TIME,
        reviewedBy: 'test-user',
        reason: 'Confirmed test record',
    },
});

const makeAllergyRecord = ({
    id,
    status,
    substance,
}: {
    id: string;
    status: AllergyIntoleranceRecord['clinicalStatus'];
    substance: string;
}): AllergyIntoleranceRecord => parseClinicalRecordResource({
    id,
    patientId: 'patient-1',
    resourceType: 'AllergyIntolerance',
    verificationStatus: 'confirmed',
    recordedAt: FIXED_TIME,
    effective: clinicalDay('2026-07-01'),
    assertion: affirmedPatientAssertion,
    provenance: confirmedProvenance('Allergy fixture'),
    amendments: [],
    substance: { text: substance },
    clinicalStatus: status,
    criticality: status === 'active' ? 'high' : 'low',
    categories: ['medication'],
    reactions: [{
        manifestation: [{ text: 'Hives' }],
        description: 'Raised itchy rash',
        onset: clinicalDay('2025-05-01'),
        severity: 'moderate',
        exposureRoute: { text: 'Oral' },
    }],
    lastOccurrence: clinicalDay('2025-05-01'),
}) as AllergyIntoleranceRecord;

const makeMedicationRecord = ({
    id,
    status,
    name,
}: {
    id: string;
    status: MedicationRecord['status'];
    name: string;
}): MedicationRecord => parseClinicalRecordResource({
    id,
    patientId: 'patient-1',
    resourceType: 'Medication',
    verificationStatus: 'confirmed',
    recordedAt: FIXED_TIME,
    effective: clinicalDay('2026-06-01'),
    assertion: affirmedPatientAssertion,
    provenance: confirmedProvenance('Medication fixture'),
    amendments: [],
    kind: 'statement',
    medication: { text: name },
    status,
    dosageInstructions: [{
        text: '500 mg twice daily with meals',
        dose: {
            original: { value: 500, unit: 'mg' },
        },
        route: { text: 'Oral' },
        frequency: 'Twice daily',
        timingText: 'With meals',
        asNeeded: false,
    }],
    reason: [{ text: 'Type 2 diabetes' }],
    start: clinicalDay('2026-06-01'),
    prescriber: 'Dr Example',
}) as MedicationRecord;

const makeLabObservation = (): ObservationRecord => parseClinicalRecordResource({
    id: 'observation-potassium',
    patientId: 'patient-1',
    resourceType: 'Observation',
    verificationStatus: 'confirmed',
    recordedAt: FIXED_TIME,
    effective: unknownClinicalDate('Report date not visible'),
    assertion: affirmedPatientAssertion,
    provenance: {
        ...confirmedProvenance('Lab report extraction'),
        source: {
            kind: 'document-extraction',
            document: {
                documentId: 'document-lab',
                fileName: 'labs.pdf',
                pageNumber: 2,
                excerpt: 'Potassium 5.8 mmol/L',
            },
        },
        extraction: {
            engine: 'test-extractor',
            confidence: 0.93,
            extractedAt: FIXED_TIME,
        },
    },
    amendments: [],
    tags: ['lab-extraction', 'human-reviewed'],
    status: 'final',
    category: [{ text: 'Laboratory' }],
    code: { text: 'Potassium' },
    value: {
        type: 'quantity',
        quantity: {
            original: { value: 5.8, unit: 'mmol/L' },
            normalized: { value: 5.8, unit: 'mmol/L' },
        },
    },
    interpretation: [{ text: 'High' }],
    referenceRanges: [{
        low: { value: 3.5, unit: 'mmol/L' },
        high: { value: 5, unit: 'mmol/L' },
        text: '3.5–5.0 mmol/L',
    }],
    diagnosticReportId: 'report-chemistry',
    issuedAt: FIXED_TIME,
    performer: ['Example Laboratory'],
}) as ObservationRecord;

const makeReport = (): DiagnosticReportRecord => parseClinicalRecordResource({
    id: 'report-chemistry',
    patientId: 'patient-1',
    resourceType: 'DiagnosticReport',
    verificationStatus: 'confirmed',
    recordedAt: FIXED_TIME,
    effective: clinicalDay('2026-07-29'),
    assertion: affirmedPatientAssertion,
    provenance: confirmedProvenance('Chemistry report fixture'),
    amendments: [],
    status: 'final',
    code: { text: 'Basic metabolic panel' },
    category: [{ text: 'Laboratory' }],
    issuedAt: FIXED_TIME,
    resultIds: ['observation-potassium'],
    specimenIds: ['specimen-blood'],
    documentIds: ['document-lab'],
    conclusion: 'Potassium above the recorded reference range.',
    performer: ['Example Laboratory'],
}) as DiagnosticReportRecord;

describe('first-class conditions module', () => {
    it('separates current and historical conditions while excluding candidates', () => {
        const record = makePatientRecord();
        record.resources.conditions = [
            makeCondition({
                id: 'active-condition',
                verificationStatus: 'confirmed',
                text: 'Asthma',
                clinicalStatus: 'active',
            }),
            makeCondition({
                id: 'resolved-condition',
                verificationStatus: 'confirmed',
                text: 'Pneumonia',
                clinicalStatus: 'resolved',
            }),
            makeCondition({
                id: 'candidate-condition',
                verificationStatus: 'candidate',
                text: 'Possible reflux',
                clinicalStatus: 'unknown',
            }),
        ];

        const current = buildConditionModuleViewModel(record);
        const history = buildConditionModuleViewModel(record, {
            scope: 'history',
        });

        expect(current.items.map(item => item.name)).toEqual(['Asthma']);
        expect(history.items.map(item => item.name)).toEqual(['Pneumonia']);
        expect(current.totalConfirmed).toBe(2);
        expect(current.candidateCount).toBe(1);
    });
});

describe('first-class allergy module', () => {
    it('preserves reaction detail and keeps current allergy status unknown when only history exists', () => {
        const record = makePatientRecord();
        record.resources.allergies = [makeAllergyRecord({
            id: 'resolved-allergy',
            status: 'resolved',
            substance: 'Penicillin',
        })];

        const current = buildAllergyModuleViewModel(record);
        const history = buildAllergyModuleViewModel(record, {
            scope: 'history',
        });

        expect(current.items).toEqual([]);
        expect(current.allergyStatusKnown).toBe(false);
        expect(history.items[0].reactions[0]).toMatchObject({
            manifestations: ['Hives'],
            description: 'Raised itchy rash',
            severity: 'Moderate',
            route: 'Oral',
        });
    });
});

describe('first-class medication module', () => {
    it('separates current medication use from medication history and preserves dosage context', () => {
        const record = makePatientRecord();
        record.resources.medications = [
            makeMedicationRecord({
                id: 'active-medication',
                status: 'active',
                name: 'Metformin',
            }),
            makeMedicationRecord({
                id: 'stopped-medication',
                status: 'stopped',
                name: 'Old medication',
            }),
        ];

        const current = buildMedicationModuleViewModel(record);
        const history = buildMedicationModuleViewModel(record, {
            scope: 'history',
        });

        expect(current.items[0].name).toBe('Metformin');
        expect(current.items[0].dosages[0]).toMatchObject({
            dose: '500 mg',
            route: 'Oral',
            frequency: 'Twice daily',
            timing: 'With meals',
            asNeeded: false,
        });
        expect(history.items.map(item => item.name)).toEqual(['Old medication']);
    });
});

describe('first-class labs and reports module', () => {
    it('links reports and results while preserving source values, flags, and unknown dates', () => {
        const record = makePatientRecord();
        record.resources.observations = [makeLabObservation()];
        record.resources.diagnosticReports = [makeReport()];

        const all = buildResultsModuleViewModel(record);
        const flaggedLabs = buildResultsModuleViewModel(record, {
            content: 'laboratory',
            interpretation: 'flagged',
        });

        expect(all.reports[0]).toMatchObject({
            name: 'Basic metabolic panel',
            resultCount: 1,
            specimenCount: 1,
            documentCount: 1,
        });
        expect(all.reports[0].linkedResults[0]).toMatchObject({
            name: 'Potassium',
            valueLabel: '5.8 mmol/L',
            flagged: true,
        });
        expect(flaggedLabs.observations[0]).toMatchObject({
            name: 'Potassium',
            laboratory: true,
            flagged: true,
            knownClinicalDate: false,
            clinicalDateLabel: 'Clinical date unknown',
            originalValueLabel: '5.8 mmol/L',
        });
        expect(flaggedLabs.observations[0].provenance.sourceDocument)
            .toMatchObject({
                documentId: 'document-lab',
                pageNumber: 2,
            });
    });
});
