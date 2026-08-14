import type {
    ClinicalCoding,
    ClinicalQuantityValue,
    ClinicalResourceType,
} from '../clinical-record/types';

export type TerminologySystemId =
    | 'loinc'
    | 'ucum'
    | 'rxnorm'
    | 'snomed-ct';

export type TerminologyMappingMethod =
    | 'deterministic-exact-alias'
    | 'source-provided'
    | 'source-reviewed-manual'
    | 'licensed-manual';

export type TerminologyReviewTarget =
    | 'Observation.code'
    | 'Observation.value.quantity'
    | 'Medication.medication'
    | 'Condition.code'
    | 'AllergyIntolerance.substance'
    | 'Procedure.code';

export interface TerminologySystemDefinition {
    id: TerminologySystemId;
    name: string;
    canonicalUri: string;
    contentVersion?: string;
    lookupMode: 'bundled-reviewed-subset' | 'source-provided' | 'external-licensed';
    description: string;
    boundary: string;
    licenseNotice: string;
}

interface BaseTerminologySuggestion {
    id: string;
    patientId: string;
    resourceId: string;
    resourceType: ClinicalResourceType;
    target: TerminologyReviewTarget;
    sourceText: string;
    system: TerminologySystemId;
    method: TerminologyMappingMethod;
    rationale: string;
    warnings: string[];
    reviewRequired: true;
}

export interface CodeMappingSuggestion extends BaseTerminologySuggestion {
    kind: 'code';
    coding: ClinicalCoding;
}

export interface QuantityMappingSuggestion extends BaseTerminologySuggestion {
    kind: 'quantity';
    normalizedQuantity: ClinicalQuantityValue;
    conversionApplied: boolean;
}

export type TerminologySuggestion =
    | CodeMappingSuggestion
    | QuantityMappingSuggestion;

export interface SourceRxNormInput {
    medicationId: string;
    rxcui: string;
    display: string;
    sourceDescription: string;
    sourceReviewed: boolean;
}

export interface TerminologyCoverage {
    observations: number;
    observationsWithLoinc: number;
    quantityObservations: number;
    quantitiesWithUcum: number;
    medications: number;
    medicationsWithRxNorm: number;
    conditionAllergyProcedureResources: number;
    resourcesWithSnomedCt: number;
    deterministicSuggestions: number;
    unresolvedObservationCodes: number;
    unrecognizedQuantityUnits: number;
}

export interface LicensedSnomedInput {
    resourceType: 'Condition' | 'AllergyIntolerance' | 'Procedure';
    resourceId: string;
    code: string;
    display: string;
    versionUri: string;
    licenseAcknowledged: boolean;
}
