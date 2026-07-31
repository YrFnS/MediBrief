import type {
    ClinicalResourceType,
    DatePrecision,
    SourceDocumentReference,
} from '../clinical-record/types';

export type GroundingEvidenceScope = 'current' | 'planning' | 'history';

export type GroundingExclusionReason =
    | 'candidate'
    | 'rejected'
    | 'entered-in-error'
    | 'negated'
    | 'hypothetical'
    | 'non-patient'
    | 'history-not-requested'
    | 'resource-type-filtered'
    | 'query-filtered'
    | 'limit-truncated';

export interface GroundingEvidence {
    id: string;
    patientId: string;
    resourceType: ClinicalResourceType;
    resourceId: string;
    label: string;
    statement: string;
    scope: GroundingEvidenceScope;
    clinicalDate: string | null;
    datePrecision: DatePrecision;
    recordedAt: string;
    sourceLabel: string;
    source?: SourceDocumentReference;
    qualifiers: string[];
    searchableText: string;
}

export interface GroundingBundleOptions {
    query?: string;
    includeHistory?: boolean;
    resourceTypes?: ClinicalResourceType[];
    maxEvidence?: number;
    generatedAt?: string;
}

export interface PatientGroundingBundle {
    schemaVersion: 1;
    patientId: string;
    generatedAt: string;
    query?: string;
    evidence: GroundingEvidence[];
    excludedCounts: Partial<Record<GroundingExclusionReason, number>>;
    selection: {
        eligibleBeforeSelection: number;
        selected: number;
        includeHistory: boolean;
        maxEvidence: number;
        resourceTypes?: ClinicalResourceType[];
    };
    boundaries: string[];
}

export interface GroundedAnswerAssessmentOptions {
    requireCitation?: boolean;
}

export interface GroundedAnswerAssessment {
    valid: boolean;
    referencedEvidenceIds: string[];
    unknownEvidenceIds: string[];
    supportedEvidence: GroundingEvidence[];
    warnings: string[];
    limitation: string;
}
