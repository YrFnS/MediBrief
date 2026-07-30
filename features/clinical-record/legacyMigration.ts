import type {
    ClinicalDataStore,
    FHIRCodeableConcept,
    FHIRCoding,
    FHIRObservation,
    FHIRQuantity,
    FHIRReferenceRange,
} from '../fhir/types';
import type {
    PatientDemographics,
    PatientMetadata,
} from '../patient-management/types';
import {
    LEGACY_MEDIBRIEF_SOURCE_SYSTEM,
} from './constants';
import {
    createPatientClinicalRecord,
    createUnknownClinicalDate,
} from './factories';
import {
    parseClinicalRecordResource,
    parsePatientClinicalRecord,
} from './schemas';
import type {
    AdministrativeSex,
    AllergyIntoleranceRecord,
    ClinicalCodeableConcept,
    ClinicalDate,
    ClinicalRecordResource,
    ConditionRecord,
    DocumentReferenceRecord,
    ObservationRecord,
    ObservationValue,
    PatientClinicalRecord,
} from './types';
import {
    getResourceCollectionKey,
    type PatientClinicalResource,
} from './resourceUtils';

export interface LegacyMigrationWarning {
    patientId: string;
    code: string;
    message: string;
    sourceId?: string;
}

export interface LegacyMigrationReport {
    patientsSeen: number;
    patientRecordsCreated: number;
    patientRecordsUpdated: number;
    patientRecordsUnchanged: number;
    resourcesAdded: number;
    resourcesAddedByType: Partial<Record<ClinicalRecordResource['resourceType'], number>>;
    warnings: LegacyMigrationWarning[];
}

export interface LegacyMigrationInput {
    patients: Record<string, PatientMetadata>;
    clinicalData?: Record<string, ClinicalDataStore>;
    existingRecords?: Record<string, PatientClinicalRecord>;
    migratedAt?: string;
}

export interface LegacyMigrationResult {
    records: Record<string, PatientClinicalRecord>;
    report: LegacyMigrationReport;
    changed: boolean;
}

const LEGACY_REVIEW_TAGS = ['legacy-migration', 'needs-review'];
const LEGACY_DOCUMENT_TAGS = ['legacy-migration'];

const stableHash = (value: string): string => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
};

const legacyResourceId = (
    kind: string,
    patientId: string,
    sourceKey: string,
): string => `legacy-${kind}-${stableHash(`${patientId}|${sourceKey}`)}`;

const cleanText = (value: unknown): string =>
    typeof value === 'string' ? value.trim() : '';

const uniqueText = (values: string[]): string[] =>
    [...new Set(values.map(cleanText).filter(Boolean))];

const isValidDateTime = (value?: string): value is string =>
    !!value && !Number.isNaN(Date.parse(value));

const numberTimestampToIso = (
    value: number | undefined,
    fallback: string,
): string => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
};

const toClinicalDate = (value?: string): ClinicalDate => {
    if (!value) return createUnknownClinicalDate();
    if (!isValidDateTime(value)) return createUnknownClinicalDate(value);

    return {
        value: new Date(value).toISOString().slice(0, 10),
        precision: 'day',
        sourceText: value,
    };
};

export const mapLegacyAdministrativeSex = (
    sex?: PatientDemographics['sex'],
): AdministrativeSex | undefined => {
    if (sex === 'Male') return 'male';
    if (sex === 'Female') return 'female';
    if (sex === 'Other') return 'other';
    return undefined;
};

const createLegacyProvenance = (
    migratedAt: string,
    description: string,
    externalId?: string,
) => ({
    source: {
        kind: 'legacy-migration' as const,
        externalSystem: LEGACY_MEDIBRIEF_SOURCE_SYSTEM,
        ...(externalId ? { externalId } : {}),
        description,
    },
    createdAt: migratedAt,
    updatedAt: migratedAt,
});

const candidateBase = (
    patientId: string,
    resourceType: PatientClinicalResource['resourceType'],
    id: string,
    migratedAt: string,
    description: string,
    externalId?: string,
) => ({
    id,
    patientId,
    resourceType,
    verificationStatus: 'candidate' as const,
    recordedAt: migratedAt,
    effective: createUnknownClinicalDate(),
    assertion: {
        polarity: 'unknown' as const,
        certainty: 'unknown' as const,
        temporality: 'unknown' as const,
        experiencer: 'patient' as const,
    },
    provenance: createLegacyProvenance(
        migratedAt,
        description,
        externalId,
    ),
    amendments: [],
    tags: LEGACY_REVIEW_TAGS,
});

const toClinicalCoding = (
    coding: FHIRCoding,
): ClinicalCodeableConcept['coding'][number] | null => {
    const code = cleanText(coding.code);
    if (!code) return null;

    return {
        code,
        ...(cleanText(coding.system)
            ? { system: cleanText(coding.system) }
            : {}),
        ...(cleanText(coding.version)
            ? { version: cleanText(coding.version) }
            : {}),
        ...(cleanText(coding.display)
            ? { display: cleanText(coding.display) }
            : {}),
        ...(coding.userSelected !== undefined
            ? { userSelected: coding.userSelected }
            : {}),
    };
};

const toClinicalConcept = (
    concept: FHIRCodeableConcept | undefined,
    fallbackText: string,
): ClinicalCodeableConcept => {
    const coding = (concept?.coding || [])
        .map(toClinicalCoding)
        .filter((item): item is NonNullable<typeof item> => item !== null);
    const text = cleanText(concept?.text)
        || cleanText(coding.find(item => item.display)?.display)
        || cleanText(coding[0]?.code)
        || fallbackText;

    return {
        text,
        ...(coding.length > 0 ? { coding } : {}),
    };
};

const toQuantityValue = (quantity?: FHIRQuantity) => {
    if (
        quantity?.value === undefined
        || !Number.isFinite(quantity.value)
    ) return undefined;

    return {
        value: quantity.value,
        ...(quantity.comparator
            ? { comparator: quantity.comparator }
            : {}),
        ...(cleanText(quantity.unit)
            ? { unit: cleanText(quantity.unit) }
            : {}),
        ...(cleanText(quantity.system)
            ? { system: cleanText(quantity.system) }
            : {}),
        ...(cleanText(quantity.code)
            ? { code: cleanText(quantity.code) }
            : {}),
    };
};

const toObservationValue = (
    observation: FHIRObservation,
): ObservationValue | undefined => {
    const quantity = toQuantityValue(observation.valueQuantity);
    if (quantity) {
        return {
            type: 'quantity',
            quantity: { original: quantity },
        };
    }
    if (observation.valueString !== undefined) {
        return { type: 'string', text: observation.valueString };
    }
    if (observation.valueBoolean !== undefined) {
        return { type: 'boolean', value: observation.valueBoolean };
    }
    if (observation.valueInteger !== undefined) {
        return { type: 'integer', value: observation.valueInteger };
    }
    if (observation.valueCodeableConcept) {
        return {
            type: 'codeable-concept',
            concept: toClinicalConcept(
                observation.valueCodeableConcept,
                'Legacy coded result',
            ),
        };
    }
    return undefined;
};

const toReferenceRange = (range: FHIRReferenceRange) => {
    const low = toQuantityValue(range.low);
    const high = toQuantityValue(range.high);
    const typeText = range.type
        ? toClinicalConcept(range.type, 'Reference range').text
        : '';
    const sourceText = cleanText(range.text);
    const text = [sourceText, typeText ? `Type: ${typeText}` : '']
        .filter(Boolean)
        .join(' | ');

    return {
        ...(low ? { low } : {}),
        ...(high ? { high } : {}),
        ...(text ? { text } : {}),
        ...(range.appliesTo?.length
            ? {
                appliesTo: range.appliesTo.map(item =>
                    toClinicalConcept(item, 'Reference population'),
                ),
            }
            : {}),
    };
};

const createLegacyCondition = (
    patientId: string,
    diagnosis: string,
    index: number,
    migratedAt: string,
): ConditionRecord => parseClinicalRecordResource({
    ...candidateBase(
        patientId,
        'Condition',
        legacyResourceId('condition', patientId, `${index}|${diagnosis}`),
        migratedAt,
        'Migrated from a legacy diagnosis string. Original assertion and review history were unavailable.',
        `diagnosis:${index}`,
    ),
    resourceType: 'Condition',
    code: { text: diagnosis },
    clinicalStatus: 'unknown',
    note: 'Review this legacy diagnosis before using it in the confirmed patient summary.',
}) as ConditionRecord;

const createLegacyAllergy = (
    patientId: string,
    allergy: string,
    index: number,
    migratedAt: string,
): AllergyIntoleranceRecord => parseClinicalRecordResource({
    ...candidateBase(
        patientId,
        'AllergyIntolerance',
        legacyResourceId('allergy', patientId, `${index}|${allergy}`),
        migratedAt,
        'Migrated from a legacy allergy string. Reaction, category, severity, and verification history were unavailable.',
        `allergy:${index}`,
    ),
    resourceType: 'AllergyIntolerance',
    substance: { text: allergy },
    clinicalStatus: 'unknown',
    criticality: 'unable-to-assess',
    categories: ['other'],
    reactions: [],
    note: 'Review this legacy allergy before using it for medication or emergency decisions.',
}) as AllergyIntoleranceRecord;

const createLegacyDemographicObservations = (
    patient: PatientMetadata,
    migratedAt: string,
): ObservationRecord[] => {
    const observations: ObservationRecord[] = [];
    const age = patient.demographics?.age;
    const weight = patient.demographics?.weight;
    const codeStatus = cleanText(patient.entities?.codeStatus);

    if (typeof age === 'number' && Number.isFinite(age)) {
        observations.push(parseClinicalRecordResource({
            ...candidateBase(
                patient.id,
                'Observation',
                legacyResourceId('age', patient.id, String(age)),
                migratedAt,
                'Migrated from the legacy age field. Date of birth was not available and was not inferred.',
                'demographics:age',
            ),
            resourceType: 'Observation',
            status: 'final',
            category: [{ text: 'Demographics' }],
            code: { text: 'Age at legacy snapshot' },
            value: { type: 'integer', value: Math.trunc(age) },
            referenceRanges: [],
            note: 'This is a legacy age snapshot, not a date of birth.',
        }) as ObservationRecord);
    }

    if (typeof weight === 'number' && Number.isFinite(weight)) {
        observations.push(parseClinicalRecordResource({
            ...candidateBase(
                patient.id,
                'Observation',
                legacyResourceId('weight', patient.id, String(weight)),
                migratedAt,
                'Migrated from the legacy static weight field. Measurement date was unavailable.',
                'demographics:weight',
            ),
            resourceType: 'Observation',
            status: 'final',
            category: [{ text: 'Vital signs' }],
            code: { text: 'Body weight' },
            value: {
                type: 'quantity',
                quantity: {
                    original: {
                        value: weight,
                        unit: 'kg',
                        system: 'http://unitsofmeasure.org',
                        code: 'kg',
                    },
                },
            },
            referenceRanges: [],
            note: 'The source did not preserve when this weight was measured.',
        }) as ObservationRecord);
    }

    if (codeStatus) {
        observations.push(parseClinicalRecordResource({
            ...candidateBase(
                patient.id,
                'Observation',
                legacyResourceId('code-status', patient.id, codeStatus),
                migratedAt,
                'Migrated from the legacy code-status string. Source document and review history were unavailable.',
                'patient-entity:code-status',
            ),
            resourceType: 'Observation',
            status: 'final',
            category: [{ text: 'Advance directive' }],
            code: { text: 'Code status' },
            value: { type: 'string', text: codeStatus },
            referenceRanges: [],
            note: 'Confirm this value against an authoritative advance-directive source.',
        }) as ObservationRecord);
    }

    return observations;
};

const createLegacyDocument = (
    patient: PatientMetadata,
    document: PatientMetadata['documents'][number],
    index: number,
    migratedAt: string,
): DocumentReferenceRecord => {
    const uploadedAt = numberTimestampToIso(document.uploadedAt, migratedAt);

    return parseClinicalRecordResource({
        id: legacyResourceId(
            'document',
            patient.id,
            `${document.storageId}|${index}`,
        ),
        patientId: patient.id,
        resourceType: 'DocumentReference',
        verificationStatus: 'confirmed',
        recordedAt: migratedAt,
        provenance: createLegacyProvenance(
            migratedAt,
            'Migrated uploaded-document metadata from the legacy patient roster.',
            document.storageId,
        ),
        amendments: [],
        tags: LEGACY_DOCUMENT_TAGS,
        status: 'current',
        storageId: document.storageId,
        fileName: document.name,
        mimeType: document.type || 'application/octet-stream',
        uploadedAt,
        relatedResources: [],
        description: 'Legacy document reference. The backup asset bundle determines whether the original file payload is portable.',
    }) as DocumentReferenceRecord;
};

const createLegacyObservation = (
    patientId: string,
    observation: FHIRObservation,
    index: number,
    migratedAt: string,
    warnings: LegacyMigrationWarning[],
): ObservationRecord => {
    const sourceId = cleanText(observation.id) || `index:${index}`;
    const value = toObservationValue(observation);
    if (!value) {
        warnings.push({
            patientId,
            code: 'LEGACY_OBSERVATION_VALUE_MISSING',
            sourceId,
            message: 'A legacy observation had no supported value representation. Its code and metadata were preserved for review.',
        });
    }

    const noteParts = (observation.note || [])
        .map(item => cleanText(item.text))
        .filter(Boolean);

    return parseClinicalRecordResource({
        ...candidateBase(
            patientId,
            'Observation',
            legacyResourceId('observation', patientId, sourceId),
            migratedAt,
            'Migrated from the legacy FHIR Observation subset. Original verification and extraction provenance were unavailable.',
            sourceId,
        ),
        resourceType: 'Observation',
        status: observation.status || 'unknown',
        effective: toClinicalDate(observation.effectiveDateTime),
        ...(observation.category?.length
            ? {
                category: observation.category.map(item =>
                    toClinicalConcept(item, 'Legacy observation category'),
                ),
            }
            : {}),
        code: toClinicalConcept(observation.code, 'Legacy observation'),
        ...(value ? { value } : {}),
        ...(observation.interpretation?.length
            ? {
                interpretation: observation.interpretation.map(item =>
                    toClinicalConcept(item, 'Legacy interpretation'),
                ),
            }
            : {}),
        referenceRanges: (observation.referenceRange || []).map(toReferenceRange),
        ...(isValidDateTime(observation.issued)
            ? { issuedAt: observation.issued }
            : {}),
        ...(observation.performer?.length
            ? {
                performer: observation.performer
                    .map(item => cleanText(item.display) || cleanText(item.reference))
                    .filter(Boolean),
            }
            : {}),
        ...(noteParts.length > 0 ? { note: noteParts.join('\n') } : {}),
    }) as ObservationRecord;
};

const createInitialRecord = (
    patient: PatientMetadata,
    migratedAt: string,
): PatientClinicalRecord => {
    const profileCreated = numberTimestampToIso(patient.createdAt, migratedAt);
    const record = createPatientClinicalRecord({
        patientId: patient.id,
        displayName: patient.name || `Legacy patient ${patient.id}`,
        now: migratedAt,
        administrativeSex: mapLegacyAdministrativeSex(
            patient.demographics?.sex,
        ),
    });

    const identifiers = cleanText(patient.mrn)
        ? [{
            system: 'urn:medibrief:legacy:mrn',
            value: cleanText(patient.mrn),
            type: 'MRN',
            use: 'official' as const,
        }]
        : [];

    return parsePatientClinicalRecord({
        ...record,
        profile: {
            ...record.profile,
            identifiers,
            provenance: createLegacyProvenance(
                migratedAt,
                `Migrated from a legacy patient roster entry created at ${profileCreated}.`,
                patient.id,
            ),
            tags: LEGACY_DOCUMENT_TAGS,
        },
    });
};

const appendResourceIfMissing = (
    record: PatientClinicalRecord,
    resource: PatientClinicalResource,
    migratedAt: string,
): { record: PatientClinicalRecord; added: boolean } => {
    const collectionKey = getResourceCollectionKey(resource.resourceType);
    const collection = record.resources[collectionKey] as PatientClinicalResource[];
    if (collection.some(current => current.id === resource.id)) {
        return { record, added: false };
    }

    return {
        record: parsePatientClinicalRecord({
            ...record,
            resources: {
                ...record.resources,
                [collectionKey]: [...collection, resource],
            },
            updatedAt: migratedAt,
        }),
        added: true,
    };
};

const migratedResourcesForPatient = (
    patient: PatientMetadata,
    legacyClinicalData: ClinicalDataStore | undefined,
    migratedAt: string,
    warnings: LegacyMigrationWarning[],
): PatientClinicalResource[] => {
    const diagnoses = uniqueText(patient.entities?.diagnosis || []);
    const allergies = uniqueText(patient.entities?.allergies || []);

    const resources: PatientClinicalResource[] = [
        ...diagnoses.map((diagnosis, index) =>
            createLegacyCondition(patient.id, diagnosis, index, migratedAt),
        ),
        ...allergies.map((allergy, index) =>
            createLegacyAllergy(patient.id, allergy, index, migratedAt),
        ),
        ...createLegacyDemographicObservations(patient, migratedAt),
        ...(patient.documents || []).map((document, index) =>
            createLegacyDocument(patient, document, index, migratedAt),
        ),
        ...(legacyClinicalData?.observations || []).map((observation, index) =>
            createLegacyObservation(
                patient.id,
                observation,
                index,
                migratedAt,
                warnings,
            ),
        ),
    ];

    return resources;
};

const createSyntheticPatient = (
    patientId: string,
    migratedAt: string,
): PatientMetadata => ({
    id: patientId,
    name: `Legacy patient ${patientId}`,
    status: 'New Admission',
    entities: {
        allergies: [],
        codeStatus: '',
        diagnosis: [],
    },
    demographics: {},
    documents: [],
    createdAt: Date.parse(migratedAt),
    lastActive: Date.parse(migratedAt),
});

export const migrateLegacyStoresToClinicalRecords = ({
    patients,
    clinicalData = {},
    existingRecords = {},
    migratedAt = new Date().toISOString(),
}: LegacyMigrationInput): LegacyMigrationResult => {
    const report: LegacyMigrationReport = {
        patientsSeen: 0,
        patientRecordsCreated: 0,
        patientRecordsUpdated: 0,
        patientRecordsUnchanged: 0,
        resourcesAdded: 0,
        resourcesAddedByType: {},
        warnings: [],
    };

    const records: Record<string, PatientClinicalRecord> = {
        ...existingRecords,
    };
    const allPatientIds = new Set([
        ...Object.keys(patients),
        ...Object.keys(clinicalData),
    ]);

    allPatientIds.forEach(patientId => {
        report.patientsSeen += 1;
        const patient = patients[patientId]
            || createSyntheticPatient(patientId, migratedAt);

        if (!patients[patientId]) {
            report.warnings.push({
                patientId,
                code: 'ORPHAN_LEGACY_CLINICAL_DATA',
                message: 'Clinical observations existed without a matching roster entry. A synthetic reviewable patient profile was created so the data was not discarded.',
            });
        }

        const existed = !!records[patientId];
        let record = records[patientId]
            || createInitialRecord(patient, migratedAt);
        let resourcesAddedForPatient = 0;

        migratedResourcesForPatient(
            patient,
            clinicalData[patientId],
            migratedAt,
            report.warnings,
        ).forEach(resource => {
            const result = appendResourceIfMissing(
                record,
                resource,
                migratedAt,
            );
            record = result.record;
            if (!result.added) return;

            resourcesAddedForPatient += 1;
            report.resourcesAdded += 1;
            report.resourcesAddedByType[resource.resourceType] =
                (report.resourcesAddedByType[resource.resourceType] || 0) + 1;
        });

        records[patientId] = parsePatientClinicalRecord(record);
        if (!existed) {
            report.patientRecordsCreated += 1;
        } else if (resourcesAddedForPatient > 0) {
            report.patientRecordsUpdated += 1;
        } else {
            report.patientRecordsUnchanged += 1;
        }
    });

    return {
        records,
        report,
        changed:
            report.patientRecordsCreated > 0
            || report.patientRecordsUpdated > 0,
    };
};
