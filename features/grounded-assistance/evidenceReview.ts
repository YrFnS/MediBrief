import { flattenPatientResources } from '../clinical-record/resourceUtils';
import type {
    ClinicalRecordResource,
    ClinicalResourceType,
    PatientClinicalRecord,
} from '../clinical-record/types';
import { buildPatientGroundingBundle } from './grounding';
import type { GroundingEvidence } from './types';

const CLINICAL_RESOURCE_TYPES: ClinicalResourceType[] = [
    'PatientProfile',
    'Encounter',
    'Condition',
    'AllergyIntolerance',
    'Medication',
    'Observation',
    'DiagnosticReport',
    'Specimen',
    'Procedure',
    'Immunization',
    'Appointment',
    'ClinicalTask',
    'CarePlan',
    'DocumentReference',
    'ClinicalNote',
];

const CLINICAL_RESOURCE_TYPE_SET = new Set<ClinicalResourceType>(
    CLINICAL_RESOURCE_TYPES,
);

const sanitizeEvidenceIdPart = (value: string): string =>
    value.replace(/[^A-Za-z0-9._:-]/g, '_');

export interface ParsedLocalEvidenceId {
    id: string;
    resourceType: ClinicalResourceType;
    resourceId: string;
}

export interface LocalEvidenceResolution {
    evidence: GroundingEvidence[];
    missingIds: string[];
}

export const localEvidenceIdForResource = (
    resource: Pick<ClinicalRecordResource, 'resourceType' | 'id'>,
): string => `MB:${resource.resourceType}:${sanitizeEvidenceIdPart(resource.id)}`;

export const parseLocalEvidenceId = (
    value: string,
): ParsedLocalEvidenceId | null => {
    const match = value.match(/^MB:([A-Za-z]+):(.+)$/);
    if (!match) return null;

    const resourceType = match[1] as ClinicalResourceType;
    if (!CLINICAL_RESOURCE_TYPE_SET.has(resourceType)) return null;
    if (!match[2].trim()) return null;

    return {
        id: value,
        resourceType,
        resourceId: match[2],
    };
};

export const uniqueLocalEvidenceIds = (values: unknown[]): string[] => [
    ...new Set(values
        .filter((value): value is string => typeof value === 'string')
        .map(value => value.trim())
        .filter(value => parseLocalEvidenceId(value) !== null)),
];

/**
 * Resolves exact local evidence identifiers against the same confirmed-record
 * grounding boundary used by the Assistant. Each resource type is queried
 * independently so a large patient record cannot hide a referenced item behind
 * the normal bundle display limit.
 */
export const resolveLocalEvidence = (
    record: PatientClinicalRecord,
    evidenceIds: string[],
): LocalEvidenceResolution => {
    const requestedIds = uniqueLocalEvidenceIds(evidenceIds);
    const parsed = requestedIds
        .map(parseLocalEvidenceId)
        .filter((item): item is ParsedLocalEvidenceId => Boolean(item));
    const evidenceById = new Map<string, GroundingEvidence>();

    const resourceTypes = [...new Set(parsed.map(item => item.resourceType))];
    resourceTypes.forEach(resourceType => {
        const bundle = buildPatientGroundingBundle(record, {
            includeHistory: true,
            resourceTypes: [resourceType],
            maxEvidence: 200,
        });
        bundle.evidence.forEach(item => evidenceById.set(item.id, item));
    });

    // Exact-ID query fallback for unusually large collections of one resource
    // type. Resolve the original resource ID first because the citation-safe ID
    // may contain sanitized characters that are not reversible.
    const resources = flattenPatientResources(record, true);
    parsed.forEach(item => {
        if (evidenceById.has(item.id)) return;
        const exactResource = resources.find(resource =>
            localEvidenceIdForResource(resource) === item.id);
        const bundle = buildPatientGroundingBundle(record, {
            includeHistory: true,
            resourceTypes: [item.resourceType],
            query: exactResource?.id || item.resourceId,
            maxEvidence: 20,
        });
        bundle.evidence.forEach(evidence => evidenceById.set(evidence.id, evidence));
    });

    return {
        evidence: requestedIds
            .map(id => evidenceById.get(id))
            .filter((item): item is GroundingEvidence => Boolean(item)),
        missingIds: requestedIds.filter(id => !evidenceById.has(id)),
    };
};
