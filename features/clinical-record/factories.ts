import {
    CLINICAL_RECORD_SCHEMA_VERSION,
    UNKNOWN_CLINICAL_DATE,
} from './constants';
import type {
    AdministrativeSex,
    ClinicalAssertionContext,
    ClinicalDate,
    ClinicalProvenance,
    PatientClinicalRecord,
    PatientClinicalResources,
    RecordSource,
} from './types';

export const DEFAULT_ASSERTION_CONTEXT: ClinicalAssertionContext = {
    polarity: 'unknown',
    certainty: 'unknown',
    temporality: 'unknown',
    experiencer: 'patient',
};

export const createUnknownClinicalDate = (sourceText?: string): ClinicalDate => ({
    ...UNKNOWN_CLINICAL_DATE,
    ...(sourceText ? { sourceText } : {}),
});

export const createRecordSource = (
    source: Partial<RecordSource> & Pick<RecordSource, 'kind'>,
): RecordSource => ({
    kind: source.kind,
    ...(source.document ? { document: source.document } : {}),
    ...(source.externalSystem ? { externalSystem: source.externalSystem } : {}),
    ...(source.externalId ? { externalId: source.externalId } : {}),
    ...(source.description ? { description: source.description } : {}),
});

export const createClinicalProvenance = ({
    source,
    now = new Date().toISOString(),
    actor,
}: {
    source: RecordSource;
    now?: string;
    actor?: string;
}): ClinicalProvenance => ({
    source,
    createdAt: now,
    updatedAt: now,
    ...(actor ? { createdBy: actor, updatedBy: actor } : {}),
});

export const createEmptyPatientResources = (): PatientClinicalResources => ({
    encounters: [],
    conditions: [],
    allergies: [],
    medications: [],
    observations: [],
    diagnosticReports: [],
    specimens: [],
    procedures: [],
    immunizations: [],
    appointments: [],
    tasks: [],
    carePlans: [],
    documents: [],
    notes: [],
});

export interface CreatePatientClinicalRecordInput {
    patientId: string;
    displayName: string;
    now?: string;
    actor?: string;
    dateOfBirth?: ClinicalDate;
    administrativeSex?: AdministrativeSex;
    preferredLanguage?: string;
}

export const createPatientClinicalRecord = ({
    patientId,
    displayName,
    now = new Date().toISOString(),
    actor,
    dateOfBirth,
    administrativeSex,
    preferredLanguage,
}: CreatePatientClinicalRecordInput): PatientClinicalRecord => {
    const provenance = createClinicalProvenance({
        source: createRecordSource({
            kind: 'manual',
            description: 'Patient record initialized in MediBrief',
        }),
        now,
        actor,
    });

    return {
        schemaVersion: CLINICAL_RECORD_SCHEMA_VERSION,
        patientId,
        profile: {
            id: `patient-profile-${patientId}`,
            patientId,
            resourceType: 'PatientProfile',
            verificationStatus: 'confirmed',
            recordedAt: now,
            provenance,
            amendments: [],
            displayName,
            identifiers: [],
            contacts: [],
            addresses: [],
            ...(dateOfBirth ? { dateOfBirth } : {}),
            ...(administrativeSex ? { administrativeSex } : {}),
            ...(preferredLanguage ? { preferredLanguage } : {}),
        },
        resources: createEmptyPatientResources(),
        createdAt: now,
        updatedAt: now,
    };
};
