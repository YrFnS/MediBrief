import {
    createPatientClinicalRecord,
    parseClinicalRecordResource,
    type AllergyIntoleranceRecord,
    type ClinicalAssertionContext,
    type ClinicalDate,
    type ConditionRecord,
    type MedicationRecord,
    type ObservationRecord,
    type PatientClinicalRecord,
    type VerificationStatus,
} from '../features/clinical-record';

export const FIXED_TIME = '2026-07-30T12:00:00.000Z';

export const clinicalDay = (value: string): ClinicalDate => ({
    value,
    precision: 'day',
    sourceText: value,
});

export const unknownClinicalDate = (sourceText?: string): ClinicalDate => ({
    value: null,
    precision: 'unknown',
    ...(sourceText ? { sourceText } : {}),
});

export const affirmedPatientAssertion: ClinicalAssertionContext = {
    polarity: 'affirmed',
    certainty: 'certain',
    temporality: 'current',
    experiencer: 'patient',
};

const provenance = (status: VerificationStatus) => ({
    source: {
        kind: status === 'candidate' ? 'ai-suggestion' as const : 'manual' as const,
        description: 'Test fixture',
    },
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    ...(status === 'confirmed'
        ? {
            confirmation: {
                reviewedAt: FIXED_TIME,
                reviewedBy: 'test-user',
                reason: 'Confirmed in test fixture',
            },
        }
        : {}),
});

export const makePatientRecord = (
    patientId = 'patient-1',
): PatientClinicalRecord => createPatientClinicalRecord({
    patientId,
    displayName: 'Test Patient',
    now: FIXED_TIME,
});

export const makeCondition = ({
    id = 'condition-1',
    patientId = 'patient-1',
    verificationStatus = 'candidate',
    text = 'Asthma',
    clinicalStatus = 'active',
    assertion = affirmedPatientAssertion,
}: {
    id?: string;
    patientId?: string;
    verificationStatus?: VerificationStatus;
    text?: string;
    clinicalStatus?: ConditionRecord['clinicalStatus'];
    assertion?: ClinicalAssertionContext;
} = {}): ConditionRecord => parseClinicalRecordResource({
    id,
    patientId,
    resourceType: 'Condition',
    verificationStatus,
    recordedAt: FIXED_TIME,
    effective: clinicalDay('2026-07-01'),
    assertion,
    provenance: provenance(verificationStatus),
    amendments: [],
    code: { text },
    clinicalStatus,
}) as ConditionRecord;

export const makeAllergy = ({
    id = 'allergy-1',
    patientId = 'patient-1',
    verificationStatus = 'confirmed',
    text = 'Penicillin',
    assertion = affirmedPatientAssertion,
}: {
    id?: string;
    patientId?: string;
    verificationStatus?: VerificationStatus;
    text?: string;
    assertion?: ClinicalAssertionContext;
} = {}): AllergyIntoleranceRecord => parseClinicalRecordResource({
    id,
    patientId,
    resourceType: 'AllergyIntolerance',
    verificationStatus,
    recordedAt: FIXED_TIME,
    assertion,
    provenance: provenance(verificationStatus),
    amendments: [],
    substance: { text },
    clinicalStatus: 'active',
    criticality: 'unable-to-assess',
    categories: ['medication'],
    reactions: [],
}) as AllergyIntoleranceRecord;

export const makeObservation = ({
    id = 'observation-1',
    patientId = 'patient-1',
    verificationStatus = 'confirmed',
    code = 'Heart rate',
    value = 72,
    unit = 'bpm',
    effective = clinicalDay('2026-07-30'),
    assertion = affirmedPatientAssertion,
}: {
    id?: string;
    patientId?: string;
    verificationStatus?: VerificationStatus;
    code?: string;
    value?: number;
    unit?: string;
    effective?: ClinicalDate;
    assertion?: ClinicalAssertionContext;
} = {}): ObservationRecord => parseClinicalRecordResource({
    id,
    patientId,
    resourceType: 'Observation',
    verificationStatus,
    recordedAt: FIXED_TIME,
    effective,
    assertion,
    provenance: provenance(verificationStatus),
    amendments: [],
    status: 'final',
    category: [{ text: 'Vital signs' }],
    code: { text: code },
    value: {
        type: 'quantity',
        quantity: {
            original: { value, unit },
        },
    },
    referenceRanges: [],
}) as ObservationRecord;

export const makeMedication = ({
    id = 'medication-1',
    patientId = 'patient-1',
    verificationStatus = 'confirmed',
    text = 'Metformin',
    status = 'active',
    assertion = affirmedPatientAssertion,
}: {
    id?: string;
    patientId?: string;
    verificationStatus?: VerificationStatus;
    text?: string;
    status?: MedicationRecord['status'];
    assertion?: ClinicalAssertionContext;
} = {}): MedicationRecord => parseClinicalRecordResource({
    id,
    patientId,
    resourceType: 'Medication',
    verificationStatus,
    recordedAt: FIXED_TIME,
    assertion,
    provenance: provenance(verificationStatus),
    amendments: [],
    kind: 'statement',
    medication: { text },
    status,
    dosageInstructions: [],
}) as MedicationRecord;
