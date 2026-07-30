import type {
    ClinicalCodeableConcept,
    ClinicalDate,
    ClinicalPeriod,
    ClinicalRecordResource,
    ClinicalResourceType,
    ObservationValue,
    PatientClinicalRecord,
    PatientClinicalResources,
    PatientProfileRecord,
    RecordSource,
    VerificationStatus,
} from './types';

export type PatientClinicalResource = Exclude<ClinicalRecordResource, PatientProfileRecord>;
export type PatientClinicalResourceType = Exclude<ClinicalResourceType, 'PatientProfile'>;
export type ClinicalResourceCollectionKey = keyof PatientClinicalResources;

export const RESOURCE_COLLECTION_BY_TYPE: Record<
    PatientClinicalResourceType,
    ClinicalResourceCollectionKey
> = {
    Encounter: 'encounters',
    Condition: 'conditions',
    AllergyIntolerance: 'allergies',
    Medication: 'medications',
    Observation: 'observations',
    DiagnosticReport: 'diagnosticReports',
    Specimen: 'specimens',
    Procedure: 'procedures',
    Immunization: 'immunizations',
    Appointment: 'appointments',
    ClinicalTask: 'tasks',
    CarePlan: 'carePlans',
    DocumentReference: 'documents',
    ClinicalNote: 'notes',
};

export interface ClinicalSourceQuery {
    kinds?: RecordSource['kind'][];
    documentId?: string;
    externalSystem?: string;
    externalId?: string;
}

export interface ClinicalDateQuery {
    from?: string;
    to?: string;
    includeUnknown?: boolean;
}

export interface ClinicalResourceQuery {
    patientId?: string;
    resourceTypes?: ClinicalResourceType[];
    verificationStatuses?: VerificationStatus[];
    source?: ClinicalSourceQuery;
    date?: ClinicalDateQuery;
    includeProfile?: boolean;
}

export type TimelineDateSource =
    | 'effective'
    | 'encounter-period'
    | 'condition-onset'
    | 'allergy-last-occurrence'
    | 'medication-start'
    | 'observation-issued'
    | 'diagnostic-report-period'
    | 'diagnostic-report-issued'
    | 'specimen-collected'
    | 'specimen-received'
    | 'procedure-performed'
    | 'immunization-occurrence'
    | 'appointment-start'
    | 'task-due'
    | 'care-plan-period'
    | 'document-authored'
    | 'document-uploaded'
    | 'note-authored'
    | 'patient-birth-date'
    | 'recorded-at';

export interface ResourceDateBounds {
    start: number | null;
    end: number | null;
    clinicalDate: ClinicalDate | null;
    dateTime?: string;
    source: TimelineDateSource;
    usesRecordedAtFallback: boolean;
}

export interface ClinicalTimelineEntry {
    patientId: string;
    resourceId: string;
    resourceType: ClinicalResourceType;
    verificationStatus: VerificationStatus;
    clinicalDate: ClinicalDate | null;
    dateTime?: string;
    dateSource: TimelineDateSource;
    usesRecordedAtFallback: boolean;
    sortTimestamp: number;
    recordedAt: string;
    resource: ClinicalRecordResource;
}

const normalizeText = (value?: string): string =>
    (value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const sorted = (values: string[]): string[] =>
    [...values].sort((left, right) => left.localeCompare(right));

const conceptKey = (concept?: ClinicalCodeableConcept): string => {
    if (!concept) return '';
    return JSON.stringify([
        normalizeText(concept.text),
        sorted((concept.coding || []).map(coding => JSON.stringify([
            normalizeText(coding.system),
            normalizeText(coding.code),
            normalizeText(coding.display),
        ]))),
    ]);
};

const dateKey = (date?: ClinicalDate): string =>
    date
        ? JSON.stringify([date.precision, date.value, normalizeText(date.sourceText)])
        : '';

const periodKey = (period?: ClinicalPeriod): string =>
    period ? JSON.stringify([dateKey(period.start), dateKey(period.end)]) : '';

const dateLikeKey = (value?: ClinicalDate | ClinicalPeriod): string => {
    if (!value) return '';
    return 'precision' in value ? dateKey(value) : periodKey(value);
};

const quantityKey = (value: {
    value: number;
    unit?: string;
    system?: string;
    code?: string;
    comparator?: string;
}): string => JSON.stringify([
    value.comparator || '',
    value.value,
    normalizeText(value.unit),
    normalizeText(value.system),
    normalizeText(value.code),
]);

const observationValueKey = (value?: ObservationValue): string => {
    if (!value) return '';
    switch (value.type) {
        case 'quantity':
            return JSON.stringify([
                value.type,
                quantityKey(value.quantity.original),
                value.quantity.normalized ? quantityKey(value.quantity.normalized) : '',
            ]);
        case 'string':
            return JSON.stringify([value.type, normalizeText(value.text)]);
        case 'boolean':
        case 'integer':
            return JSON.stringify([value.type, value.value]);
        case 'codeable-concept':
            return JSON.stringify([value.type, conceptKey(value.concept)]);
    }
};

const sourceIdentity = (source: RecordSource): string | null => {
    if (source.externalSystem && source.externalId) {
        return JSON.stringify([
            'external',
            normalizeText(source.externalSystem),
            normalizeText(source.externalId),
        ]);
    }

    const document = source.document;
    if (!document?.documentId) return null;

    const hasStableLocation =
        document.pageNumber !== undefined
        || document.startOffset !== undefined
        || document.endOffset !== undefined
        || !!document.section
        || !!document.excerpt;

    if (!hasStableLocation) return null;

    return JSON.stringify([
        'document',
        document.documentId,
        document.pageNumber ?? null,
        normalizeText(document.section),
        document.startOffset ?? null,
        document.endOffset ?? null,
        normalizeText(document.excerpt),
    ]);
};

const semanticResourceKey = (resource: PatientClinicalResource): string => {
    switch (resource.resourceType) {
        case 'Encounter':
            return JSON.stringify([
                resource.encounterClass,
                conceptKey(resource.type),
                periodKey(resource.period),
                normalizeText(resource.location),
            ]);
        case 'Condition':
            return JSON.stringify([
                conceptKey(resource.code),
                resource.clinicalStatus,
                dateKey(resource.onset),
                dateKey(resource.abatement),
            ]);
        case 'AllergyIntolerance':
            return JSON.stringify([
                conceptKey(resource.substance),
                resource.clinicalStatus,
                sorted(resource.categories),
                dateKey(resource.lastOccurrence),
            ]);
        case 'Medication':
            return JSON.stringify([
                resource.kind,
                conceptKey(resource.medication),
                resource.status,
                dateKey(resource.start),
                dateKey(resource.end),
                resource.dosageInstructions.map(dosage => normalizeText(dosage.text)),
            ]);
        case 'Observation':
            return JSON.stringify([
                conceptKey(resource.code),
                dateLikeKey(resource.effective),
                observationValueKey(resource.value),
                resource.specimenId || '',
            ]);
        case 'DiagnosticReport':
            return JSON.stringify([
                conceptKey(resource.code),
                periodKey(resource.effectivePeriod),
                resource.issuedAt || '',
            ]);
        case 'Specimen':
            return JSON.stringify([
                conceptKey(resource.type),
                dateKey(resource.collectedAt),
                conceptKey(resource.bodySite),
            ]);
        case 'Procedure':
            return JSON.stringify([
                conceptKey(resource.code),
                dateLikeKey(resource.performed),
                sorted((resource.bodySite || []).map(conceptKey)),
            ]);
        case 'Immunization':
            return JSON.stringify([
                conceptKey(resource.vaccineCode),
                dateKey(resource.occurrence),
                normalizeText(resource.lotNumber),
            ]);
        case 'Appointment':
            return JSON.stringify([
                normalizeText(resource.title),
                resource.start || '',
                resource.end || '',
                normalizeText(resource.location),
            ]);
        case 'ClinicalTask':
            return JSON.stringify([
                normalizeText(resource.title),
                conceptKey(resource.code),
                dateLikeKey(resource.due),
            ]);
        case 'CarePlan':
            return JSON.stringify([
                normalizeText(resource.title),
                periodKey(resource.period),
                sorted(resource.addressesConditionIds),
            ]);
        case 'DocumentReference':
            return JSON.stringify([
                normalizeText(resource.hash),
                resource.storageId,
                normalizeText(resource.fileName),
                dateKey(resource.authoredOn),
            ]);
        case 'ClinicalNote':
            return JSON.stringify([
                resource.noteType,
                normalizeText(resource.title),
                resource.authoredAt,
                resource.encounterId || '',
                resource.sections.map(section => [
                    normalizeText(section.title),
                    normalizeText(section.text),
                ]),
            ]);
    }
};

const buildResourceFingerprint = (
    resource: PatientClinicalResource,
): string | null => {
    const source = sourceIdentity(resource.provenance.source);
    if (!source) return null;
    return JSON.stringify([
        resource.resourceType,
        source,
        semanticResourceKey(resource),
    ]);
};

/**
 * Duplicate detection is deliberately conservative. Candidates are compared
 * only when they share a stable source location or external identifier.
 */
export const buildCandidateFingerprint = (
    resource: PatientClinicalResource,
): string | null =>
    resource.verificationStatus === 'candidate'
        ? buildResourceFingerprint(resource)
        : null;

export const findDuplicateCandidate = (
    existingResources: PatientClinicalResource[],
    candidate: PatientClinicalResource,
): PatientClinicalResource | undefined => {
    const fingerprint = buildCandidateFingerprint(candidate);
    if (!fingerprint) return undefined;

    return existingResources.find(existing =>
        existing.resourceType === candidate.resourceType
        && existing.verificationStatus !== 'rejected'
        && existing.verificationStatus !== 'entered-in-error'
        && buildResourceFingerprint(existing) === fingerprint,
    );
};

export const getResourceCollectionKey = (
    resourceType: PatientClinicalResourceType,
): ClinicalResourceCollectionKey => RESOURCE_COLLECTION_BY_TYPE[resourceType];

export const flattenPatientResources = (
    record: PatientClinicalRecord,
    includeProfile = false,
): ClinicalRecordResource[] => {
    const resources = Object.values(record.resources).flat() as PatientClinicalResource[];
    return includeProfile ? [record.profile, ...resources] : resources;
};

export const findResourceInRecord = (
    record: PatientClinicalRecord,
    resourceType: ClinicalResourceType,
    resourceId: string,
): ClinicalRecordResource | undefined => {
    if (resourceType === 'PatientProfile') {
        return record.profile.id === resourceId ? record.profile : undefined;
    }

    const collection = record.resources[getResourceCollectionKey(resourceType)];
    return collection.find(resource => resource.id === resourceId) as
        | PatientClinicalResource
        | undefined;
};

const isClinicalDate = (
    value: ClinicalDate | ClinicalPeriod,
): value is ClinicalDate => 'precision' in value;

const validTimestamp = (value: number): number | null =>
    Number.isNaN(value) ? null : value;

const dateStartTimestamp = (date?: ClinicalDate): number | null => {
    if (!date?.value || date.precision === 'unknown') return null;
    if (date.precision === 'year') {
        return validTimestamp(Date.parse(`${date.value}-01-01T00:00:00.000Z`));
    }
    if (date.precision === 'month') {
        return validTimestamp(Date.parse(`${date.value}-01T00:00:00.000Z`));
    }
    return validTimestamp(Date.parse(`${date.value}T00:00:00.000Z`));
};

const dateEndTimestamp = (date?: ClinicalDate): number | null => {
    if (!date?.value || date.precision === 'unknown') return null;
    if (date.precision === 'year') {
        return validTimestamp(Date.parse(`${date.value}-12-31T23:59:59.999Z`));
    }
    if (date.precision === 'month') {
        const [year, month] = date.value.split('-').map(Number);
        return validTimestamp(Date.UTC(year, month, 0, 23, 59, 59, 999));
    }
    return validTimestamp(Date.parse(`${date.value}T23:59:59.999Z`));
};

const boundsFromDate = (
    date: ClinicalDate | undefined,
    source: TimelineDateSource,
): ResourceDateBounds | null => {
    const start = dateStartTimestamp(date);
    const end = dateEndTimestamp(date);
    if (start === null || end === null) return null;
    return {
        start,
        end,
        clinicalDate: date || null,
        source,
        usesRecordedAtFallback: false,
    };
};

const boundsFromPeriod = (
    period: ClinicalPeriod | undefined,
    source: TimelineDateSource,
): ResourceDateBounds | null => {
    if (!period) return null;

    const start = dateStartTimestamp(period.start) ?? dateStartTimestamp(period.end);
    const end = dateEndTimestamp(period.end) ?? dateEndTimestamp(period.start);
    if (start === null || end === null) return null;

    return {
        start,
        end,
        clinicalDate: period.start || period.end || null,
        source,
        usesRecordedAtFallback: false,
    };
};

const boundsFromDateLike = (
    value: ClinicalDate | ClinicalPeriod | undefined,
    source: TimelineDateSource,
): ResourceDateBounds | null => {
    if (!value) return null;
    return isClinicalDate(value)
        ? boundsFromDate(value, source)
        : boundsFromPeriod(value, source);
};

const boundsFromDateTime = (
    dateTime: string | undefined,
    source: TimelineDateSource,
): ResourceDateBounds | null => {
    if (!dateTime) return null;
    const timestamp = validTimestamp(Date.parse(dateTime));
    if (timestamp === null) return null;

    return {
        start: timestamp,
        end: timestamp,
        clinicalDate: null,
        dateTime,
        source,
        usesRecordedAtFallback: false,
    };
};

export const getResourceDateBounds = (
    resource: ClinicalRecordResource,
): ResourceDateBounds => {
    const effective = boundsFromDateLike(resource.effective, 'effective');
    if (effective) return effective;

    let resolved: ResourceDateBounds | null = null;
    switch (resource.resourceType) {
        case 'PatientProfile':
            resolved = boundsFromDate(resource.dateOfBirth, 'patient-birth-date');
            break;
        case 'Encounter':
            resolved = boundsFromPeriod(resource.period, 'encounter-period');
            break;
        case 'Condition':
            resolved = boundsFromDate(resource.onset, 'condition-onset');
            break;
        case 'AllergyIntolerance':
            resolved = boundsFromDate(
                resource.lastOccurrence,
                'allergy-last-occurrence',
            );
            break;
        case 'Medication':
            resolved = boundsFromDate(resource.start, 'medication-start');
            break;
        case 'Observation':
            resolved = boundsFromDateTime(resource.issuedAt, 'observation-issued');
            break;
        case 'DiagnosticReport':
            resolved = boundsFromPeriod(
                resource.effectivePeriod,
                'diagnostic-report-period',
            ) || boundsFromDateTime(
                resource.issuedAt,
                'diagnostic-report-issued',
            );
            break;
        case 'Specimen':
            resolved = boundsFromDate(
                resource.collectedAt,
                'specimen-collected',
            ) || boundsFromDate(
                resource.receivedAt,
                'specimen-received',
            );
            break;
        case 'Procedure':
            resolved = boundsFromDateLike(
                resource.performed,
                'procedure-performed',
            );
            break;
        case 'Immunization':
            resolved = boundsFromDate(
                resource.occurrence,
                'immunization-occurrence',
            );
            break;
        case 'Appointment':
            resolved = boundsFromDateTime(resource.start, 'appointment-start');
            break;
        case 'ClinicalTask':
            resolved = boundsFromDateLike(resource.due, 'task-due');
            break;
        case 'CarePlan':
            resolved = boundsFromPeriod(resource.period, 'care-plan-period');
            break;
        case 'DocumentReference':
            resolved = boundsFromDate(
                resource.authoredOn,
                'document-authored',
            ) || boundsFromDateTime(
                resource.uploadedAt,
                'document-uploaded',
            );
            break;
        case 'ClinicalNote':
            resolved = boundsFromDateTime(resource.authoredAt, 'note-authored');
            break;
    }

    if (resolved) return resolved;

    const recordedTimestamp = validTimestamp(Date.parse(resource.recordedAt));
    return {
        start: recordedTimestamp,
        end: recordedTimestamp,
        clinicalDate: null,
        dateTime: resource.recordedAt,
        source: 'recorded-at',
        usesRecordedAtFallback: true,
    };
};

const queryBoundaryTimestamp = (
    value: string,
    boundary: 'start' | 'end',
): number | null => {
    if (/^\d{4}$/.test(value)) {
        return validTimestamp(Date.parse(
            `${value}-${boundary === 'start'
                ? '01-01T00:00:00.000Z'
                : '12-31T23:59:59.999Z'}`,
        ));
    }

    if (/^\d{4}-\d{2}$/.test(value)) {
        const [year, month] = value.split('-').map(Number);
        return validTimestamp(boundary === 'start'
            ? Date.UTC(year, month - 1, 1, 0, 0, 0, 0)
            : Date.UTC(year, month, 0, 23, 59, 59, 999));
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return validTimestamp(Date.parse(
            `${value}T${boundary === 'start'
                ? '00:00:00.000Z'
                : '23:59:59.999Z'}`,
        ));
    }

    return validTimestamp(Date.parse(value));
};

const matchesSourceQuery = (
    source: RecordSource,
    query: ClinicalSourceQuery,
): boolean => {
    if (query.kinds?.length && !query.kinds.includes(source.kind)) return false;
    if (query.documentId && source.document?.documentId !== query.documentId) {
        return false;
    }
    if (query.externalSystem && source.externalSystem !== query.externalSystem) {
        return false;
    }
    if (query.externalId && source.externalId !== query.externalId) return false;
    return true;
};

const matchesDateQuery = (
    resource: ClinicalRecordResource,
    query: ClinicalDateQuery,
): boolean => {
    const bounds = getResourceDateBounds(resource);

    // Unknown clinical dates remain unknown. They may be included explicitly,
    // but are never positioned inside a clinical date range using recordedAt.
    if (bounds.usesRecordedAtFallback) return query.includeUnknown === true;

    const queryStart = query.from
        ? queryBoundaryTimestamp(query.from, 'start')
        : null;
    const queryEnd = query.to
        ? queryBoundaryTimestamp(query.to, 'end')
        : null;

    if (queryStart !== null && (bounds.end === null || bounds.end < queryStart)) {
        return false;
    }
    if (queryEnd !== null && (bounds.start === null || bounds.start > queryEnd)) {
        return false;
    }
    return true;
};

export const matchesClinicalResourceQuery = (
    resource: ClinicalRecordResource,
    query: ClinicalResourceQuery,
): boolean => {
    if (query.patientId && resource.patientId !== query.patientId) return false;
    if (
        query.resourceTypes?.length
        && !query.resourceTypes.includes(resource.resourceType)
    ) return false;
    if (
        query.verificationStatuses?.length
        && !query.verificationStatuses.includes(resource.verificationStatus)
    ) return false;
    if (
        query.source
        && !matchesSourceQuery(resource.provenance.source, query.source)
    ) return false;
    if (query.date && !matchesDateQuery(resource, query.date)) return false;
    return true;
};

export const createTimelineEntry = (
    resource: ClinicalRecordResource,
): ClinicalTimelineEntry => {
    const bounds = getResourceDateBounds(resource);
    const recordedTimestamp = validTimestamp(Date.parse(resource.recordedAt));

    return {
        patientId: resource.patientId,
        resourceId: resource.id,
        resourceType: resource.resourceType,
        verificationStatus: resource.verificationStatus,
        clinicalDate: bounds.clinicalDate,
        ...(bounds.dateTime ? { dateTime: bounds.dateTime } : {}),
        dateSource: bounds.source,
        usesRecordedAtFallback: bounds.usesRecordedAtFallback,
        sortTimestamp: bounds.start ?? recordedTimestamp ?? 0,
        recordedAt: resource.recordedAt,
        resource,
    };
};

export const sortTimelineEntries = (
    entries: ClinicalTimelineEntry[],
): ClinicalTimelineEntry[] =>
    [...entries].sort((left, right) => {
        if (left.sortTimestamp !== right.sortTimestamp) {
            return right.sortTimestamp - left.sortTimestamp;
        }

        const recordedComparison = right.recordedAt.localeCompare(left.recordedAt);
        if (recordedComparison !== 0) return recordedComparison;

        const typeComparison = left.resourceType.localeCompare(right.resourceType);
        if (typeComparison !== 0) return typeComparison;
        return left.resourceId.localeCompare(right.resourceId);
    });
