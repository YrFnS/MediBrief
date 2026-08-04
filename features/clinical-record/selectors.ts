import type {
    AllergyIntoleranceRecord,
    ClinicalRecordResource,
    ConditionRecord,
    MedicationRecord,
    ObservationRecord,
    PatientClinicalRecord,
    PatientProfileRecord,
} from './types';
import {
    flattenPatientResources,
    getResourceDateBounds,
    type PatientClinicalResource,
} from './resourceUtils';

export interface ObservationDisplayValue {
    value: string | number;
    unit: string;
    normalized: boolean;
}

export interface ConfirmedVital {
    observation: ObservationRecord;
    value: string | number;
    unit: string;
    observedAt: Date;
    isStale: boolean;
    normalized: boolean;
}

export interface ConfirmedVitalSet {
    heartRate: ConfirmedVital | null;
    bloodPressure: ConfirmedVital | null;
    oxygenSaturation: ConfirmedVital | null;
    temperature: ConfirmedVital | null;
}

export interface ConfirmedPatientSummary {
    profile: PatientProfileRecord;
    allergies: AllergyIntoleranceRecord[];
    conditions: ConditionRecord[];
    medications: MedicationRecord[];
    observations: ObservationRecord[];
    codeStatus: string | null;
    vitals: ConfirmedVitalSet;
    candidateCount: number;
}

const DIAGNOSTIC_REPORT_GRAPH_TAG_PREFIX = 'diagnostic-report-graph:';

const normalizedText = (value?: string): string =>
    (value || '').trim().toLowerCase().replace(/\s+/g, ' ');

export const isDiagnosticReportGraphResource = (
    resource: ClinicalRecordResource,
): boolean => resource.tags?.some(tag =>
    tag.startsWith(DIAGNOSTIC_REPORT_GRAPH_TAG_PREFIX)) || false;

/**
 * A record may be confirmed by a person while still carrying assertion context.
 * Negated, family-history, and hypothetical assertions are not surfaced as
 * current patient facts in summaries or safety-oriented UI.
 */
export const isConfirmedPatientFact = (
    resource: ClinicalRecordResource,
): boolean => {
    if (resource.verificationStatus !== 'confirmed') return false;
    if (!resource.assertion) return true;

    return resource.assertion.polarity !== 'negated'
        && resource.assertion.experiencer !== 'family'
        && resource.assertion.temporality !== 'hypothetical';
};

const allCandidateResources = (
    record?: PatientClinicalRecord,
): PatientClinicalResource[] => {
    if (!record) return [];
    return flattenPatientResources(record)
        .filter((resource): resource is PatientClinicalResource =>
            resource.resourceType !== 'PatientProfile'
            && resource.verificationStatus === 'candidate',
        );
};

/**
 * Candidates belonging to a diagnostic-report graph are intentionally omitted.
 * They must be reviewed through the report-level atomic workflow so a report,
 * its results, and its specimens cannot enter mixed confirmation states.
 */
export const selectCandidateResources = (
    record?: PatientClinicalRecord,
): PatientClinicalResource[] => allCandidateResources(record)
    .filter(resource => !isDiagnosticReportGraphResource(resource))
    .sort((left, right) => {
        const timeComparison = right.recordedAt.localeCompare(left.recordedAt);
        if (timeComparison !== 0) return timeComparison;
        const typeComparison = left.resourceType.localeCompare(right.resourceType);
        if (typeComparison !== 0) return typeComparison;
        return left.id.localeCompare(right.id);
    });

export const selectDiagnosticReportCandidateGraphCount = (
    record?: PatientClinicalRecord,
): number => new Set(
    allCandidateResources(record)
        .flatMap(resource => resource.tags || [])
        .filter(tag => tag.startsWith(DIAGNOSTIC_REPORT_GRAPH_TAG_PREFIX)),
).size;

export const selectConfirmedResources = (
    record?: PatientClinicalRecord,
): PatientClinicalResource[] => {
    if (!record) return [];
    return flattenPatientResources(record)
        .filter((resource): resource is PatientClinicalResource =>
            resource.resourceType !== 'PatientProfile'
            && isConfirmedPatientFact(resource),
        );
};

export const selectConfirmedAllergies = (
    record?: PatientClinicalRecord,
): AllergyIntoleranceRecord[] =>
    selectConfirmedResources(record)
        .filter((resource): resource is AllergyIntoleranceRecord =>
            resource.resourceType === 'AllergyIntolerance'
            && resource.clinicalStatus !== 'inactive'
            && resource.clinicalStatus !== 'resolved',
        );

export const selectConfirmedConditions = (
    record?: PatientClinicalRecord,
): ConditionRecord[] =>
    selectConfirmedResources(record)
        .filter((resource): resource is ConditionRecord =>
            resource.resourceType === 'Condition',
        );

export const selectActiveConfirmedConditions = (
    record?: PatientClinicalRecord,
): ConditionRecord[] =>
    selectConfirmedConditions(record).filter(condition =>
        condition.clinicalStatus === 'active'
        || condition.clinicalStatus === 'unknown',
    );

export const selectConfirmedMedications = (
    record?: PatientClinicalRecord,
): MedicationRecord[] =>
    selectConfirmedResources(record)
        .filter((resource): resource is MedicationRecord =>
            resource.resourceType === 'Medication'
            && resource.status !== 'stopped'
            && resource.status !== 'completed'
            && resource.status !== 'not-taken'
            && resource.status !== 'entered-in-error',
        );

export const selectConfirmedObservations = (
    record?: PatientClinicalRecord,
): ObservationRecord[] =>
    selectConfirmedResources(record)
        .filter((resource): resource is ObservationRecord =>
            resource.resourceType === 'Observation'
            && resource.status !== 'cancelled'
            && resource.status !== 'entered-in-error',
        );

export const getObservationDisplayValue = (
    observation: ObservationRecord,
): ObservationDisplayValue | null => {
    const value = observation.value;
    if (!value) return null;

    switch (value.type) {
        case 'quantity': {
            const useNormalized = !!value.quantity.normalized
                && !value.quantity.normalizationWarning;
            const quantity = useNormalized
                ? value.quantity.normalized!
                : value.quantity.original;
            const comparator = quantity.comparator || '';
            return {
                value: `${comparator}${quantity.value}`,
                unit: quantity.unit || '',
                normalized: useNormalized,
            };
        }
        case 'string':
            return { value: value.text, unit: '', normalized: false };
        case 'boolean':
            return {
                value: value.value ? 'Yes' : 'No',
                unit: '',
                normalized: false,
            };
        case 'integer':
            return { value: value.value, unit: '', normalized: false };
        case 'codeable-concept':
            return {
                value: value.concept.text,
                unit: '',
                normalized: false,
            };
    }
};

const observationMatches = (
    observation: ObservationRecord,
    loincCodes: string[],
    terms: string[],
): boolean => {
    const hasLoinc = (observation.code.coding || []).some(coding =>
        normalizedText(coding.system).includes('loinc')
        && loincCodes.includes(normalizedText(coding.code)),
    );
    if (hasLoinc) return true;

    const text = normalizedText(observation.code.text);
    return terms.some(term => text.includes(normalizedText(term)));
};

const knownObservationTime = (
    observation: ObservationRecord,
): number | null => {
    const bounds = getResourceDateBounds(observation);
    if (bounds.usesRecordedAtFallback || bounds.start === null) return null;
    return bounds.start;
};

const selectLatestConfirmedVital = (
    record: PatientClinicalRecord | undefined,
    loincCodes: string[],
    terms: string[],
    staleAfterMs = 4 * 60 * 60 * 1000,
): ConfirmedVital | null => {
    const matches = selectConfirmedObservations(record)
        .filter(observation => observationMatches(observation, loincCodes, terms))
        .map(observation => ({
            observation,
            timestamp: knownObservationTime(observation),
            display: getObservationDisplayValue(observation),
        }))
        .filter((item): item is {
            observation: ObservationRecord;
            timestamp: number;
            display: ObservationDisplayValue;
        } => item.timestamp !== null && item.display !== null)
        .sort((left, right) => right.timestamp - left.timestamp);

    const latest = matches[0];
    if (!latest) return null;

    const observedAt = new Date(latest.timestamp);
    return {
        observation: latest.observation,
        value: latest.display.value,
        unit: latest.display.unit,
        observedAt,
        isStale: Date.now() - latest.timestamp > staleAfterMs,
        normalized: latest.display.normalized,
    };
};

export const selectConfirmedVitals = (
    record?: PatientClinicalRecord,
): ConfirmedVitalSet => ({
    heartRate: selectLatestConfirmedVital(
        record,
        ['8867-4'],
        ['heart rate', 'pulse'],
    ),
    bloodPressure: selectLatestConfirmedVital(
        record,
        ['8480-6'],
        ['systolic blood pressure', 'systolic', 'blood pressure'],
    ),
    oxygenSaturation: selectLatestConfirmedVital(
        record,
        ['2708-6', '59408-5'],
        ['spo2', 'oxygen saturation', 'oxygen'],
    ),
    temperature: selectLatestConfirmedVital(
        record,
        ['8310-5'],
        ['body temperature', 'temperature', 'temp'],
    ),
});

export const selectConfirmedCodeStatus = (
    record?: PatientClinicalRecord,
): string | null => {
    const matches = selectConfirmedObservations(record)
        .filter(observation =>
            normalizedText(observation.code.text).includes('code status')
            || normalizedText(observation.code.text).includes('resuscitation status'),
        )
        .map(observation => ({
            observation,
            display: getObservationDisplayValue(observation),
        }))
        .filter(item => item.display !== null)
        .sort((left, right) =>
            right.observation.provenance.updatedAt.localeCompare(
                left.observation.provenance.updatedAt,
            ),
        );

    const value = matches[0]?.display?.value;
    return value === undefined || value === null ? null : String(value);
};

export const selectConfirmedPatientSummary = (
    record: PatientClinicalRecord,
): ConfirmedPatientSummary => ({
    profile: record.profile,
    allergies: selectConfirmedAllergies(record),
    conditions: selectConfirmedConditions(record),
    medications: selectConfirmedMedications(record),
    observations: selectConfirmedObservations(record),
    codeStatus: selectConfirmedCodeStatus(record),
    vitals: selectConfirmedVitals(record),
    candidateCount: selectCandidateResources(record).length
        + selectDiagnosticReportCandidateGraphCount(record),
});