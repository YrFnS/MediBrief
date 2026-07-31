import type { SourceDocumentReference } from '../clinical-record/types';

export type HealthDataModule =
    | 'conditions'
    | 'allergies'
    | 'medications'
    | 'results';

export type ClinicalHistoryScope = 'current' | 'history' | 'all';

export interface ResourceProvenanceView {
    sourceKindLabel: string;
    sourceLabel: string;
    recordedLabel: string;
    updatedLabel: string;
    amendmentCount: number;
    extractionConfidence?: number;
    sourceDocument?: SourceDocumentReference;
    tags: string[];
}

export interface ConditionModuleItem {
    id: string;
    name: string;
    clinicalStatus: string;
    clinicalStatusLabel: string;
    current: boolean;
    severity?: string;
    bodySites: string[];
    onsetLabel: string;
    abatementLabel: string;
    note?: string;
    provenance: ResourceProvenanceView;
    searchText: string;
    sortTimestamp: number;
}

export interface ConditionModuleViewModel {
    items: ConditionModuleItem[];
    totalConfirmed: number;
    currentCount: number;
    historicalCount: number;
    candidateCount: number;
    statusOptions: string[];
}

export interface AllergyReactionView {
    manifestations: string[];
    description?: string;
    severity: string;
    onsetLabel: string;
    route?: string;
}

export interface AllergyModuleItem {
    id: string;
    substance: string;
    clinicalStatus: string;
    clinicalStatusLabel: string;
    current: boolean;
    criticality: string;
    criticalityLabel: string;
    categories: string[];
    reactions: AllergyReactionView[];
    lastOccurrenceLabel: string;
    note?: string;
    provenance: ResourceProvenanceView;
    searchText: string;
    sortTimestamp: number;
}

export interface AllergyModuleViewModel {
    items: AllergyModuleItem[];
    totalConfirmed: number;
    currentCount: number;
    historicalCount: number;
    candidateCount: number;
    allergyStatusKnown: boolean;
    statusOptions: string[];
    categoryOptions: string[];
}

export interface MedicationDosageView {
    text: string;
    dose?: string;
    normalizedDose?: string;
    route?: string;
    frequency?: string;
    timing?: string;
    asNeeded: boolean;
    maximumDose?: string;
}

export interface MedicationModuleItem {
    id: string;
    name: string;
    kind: string;
    kindLabel: string;
    status: string;
    statusLabel: string;
    current: boolean;
    dosages: MedicationDosageView[];
    reasons: string[];
    startLabel: string;
    endLabel: string;
    prescriber?: string;
    note?: string;
    provenance: ResourceProvenanceView;
    searchText: string;
    sortTimestamp: number;
}

export interface MedicationModuleViewModel {
    items: MedicationModuleItem[];
    totalConfirmed: number;
    currentCount: number;
    historicalCount: number;
    candidateCount: number;
    statusOptions: string[];
    kindOptions: string[];
}

export type ResultsContentFilter =
    | 'all'
    | 'reports'
    | 'laboratory'
    | 'other-observations';

export type ResultsInterpretationFilter =
    | 'all'
    | 'flagged'
    | 'unflagged';

export interface ReferenceRangeView {
    text: string;
}

export interface ObservationResultItem {
    id: string;
    name: string;
    status: string;
    statusLabel: string;
    categoryLabels: string[];
    laboratory: boolean;
    valueLabel: string;
    originalValueLabel?: string;
    normalizedValueLabel?: string;
    normalizationWarning?: string;
    interpretationLabels: string[];
    flagged: boolean;
    referenceRanges: ReferenceRangeView[];
    clinicalDateLabel: string;
    knownClinicalDate: boolean;
    issuedLabel: string;
    performer: string[];
    note?: string;
    diagnosticReportId?: string;
    specimenId?: string;
    provenance: ResourceProvenanceView;
    searchText: string;
    sortTimestamp: number;
}

export interface DiagnosticReportModuleItem {
    id: string;
    name: string;
    status: string;
    statusLabel: string;
    categoryLabels: string[];
    clinicalDateLabel: string;
    knownClinicalDate: boolean;
    issuedLabel: string;
    conclusion?: string;
    conclusionCodes: string[];
    performer: string[];
    resultCount: number;
    specimenCount: number;
    documentCount: number;
    linkedResults: Array<{
        id: string;
        name: string;
        valueLabel: string;
        flagged: boolean;
    }>;
    provenance: ResourceProvenanceView;
    searchText: string;
    sortTimestamp: number;
}

export interface ResultsModuleViewModel {
    reports: DiagnosticReportModuleItem[];
    observations: ObservationResultItem[];
    totalConfirmed: number;
    reportCount: number;
    laboratoryCount: number;
    otherObservationCount: number;
    flaggedCount: number;
    candidateCount: number;
    categoryOptions: string[];
}
