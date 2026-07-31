import type { SourceDocumentReference } from '../clinical-record/types';

export type HealthDataModule =
    | 'conditions'
    | 'allergies'
    | 'medications'
    | 'results'
    | 'visits'
    | 'notes'
    | 'procedures'
    | 'immunizations'
    | 'documents';

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

export interface LinkedRecordView {
    id: string;
    resourceType: string;
    label: string;
    detail?: string;
    dateLabel?: string;
    missing?: boolean;
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

export interface EncounterParticipantView {
    role?: string;
    person?: string;
    organization?: string;
}

export interface EncounterModuleItem {
    id: string;
    title: string;
    status: string;
    statusLabel: string;
    encounterClass: string;
    encounterClassLabel: string;
    current: boolean;
    periodLabel: string;
    startLabel: string;
    endLabel: string;
    knownClinicalDate: boolean;
    reasons: string[];
    participants: EncounterParticipantView[];
    location?: string;
    serviceProvider?: string;
    linkedNotes: LinkedRecordView[];
    linkedProcedures: LinkedRecordView[];
    linkedReports: LinkedRecordView[];
    linkedDocuments: LinkedRecordView[];
    provenance: ResourceProvenanceView;
    searchText: string;
    sortTimestamp: number;
}

export interface EncounterModuleViewModel {
    items: EncounterModuleItem[];
    totalConfirmed: number;
    currentCount: number;
    historicalCount: number;
    candidateCount: number;
    statusOptions: string[];
    classOptions: string[];
}

export interface ClinicalNoteSectionView {
    title: string;
    code?: string;
    text: string;
}

export interface ClinicalNoteModuleItem {
    id: string;
    title: string;
    status: string;
    statusLabel: string;
    noteType: string;
    noteTypeLabel: string;
    authoredLabel: string;
    author?: string;
    encounter?: LinkedRecordView;
    sections: ClinicalNoteSectionView[];
    sourceDocumentIds: string[];
    transcriptDocumentId?: string;
    amendsNoteId?: string;
    provenance: ResourceProvenanceView;
    searchText: string;
    sortTimestamp: number;
}

export interface ClinicalNotesModuleViewModel {
    items: ClinicalNoteModuleItem[];
    totalConfirmed: number;
    draftCount: number;
    finalCount: number;
    amendedCount: number;
    candidateCount: number;
    statusOptions: string[];
    typeOptions: string[];
}

export interface DeviceRelatedRecordView {
    id: string;
    sourceType: 'procedure' | 'document';
    label: string;
    detail?: string;
    dateLabel: string;
    knownClinicalDate: boolean;
    matchedTerms: string[];
    provenance: ResourceProvenanceView;
}

export interface ProcedureModuleItem {
    id: string;
    name: string;
    status: string;
    statusLabel: string;
    current: boolean;
    performedLabel: string;
    knownClinicalDate: boolean;
    bodySites: string[];
    reasons: string[];
    outcome?: string;
    complications: string[];
    performers: string[];
    encounter?: LinkedRecordView;
    linkedReports: LinkedRecordView[];
    linkedDocuments: LinkedRecordView[];
    note?: string;
    deviceRelated: boolean;
    matchedDeviceTerms: string[];
    provenance: ResourceProvenanceView;
    searchText: string;
    sortTimestamp: number;
}

export interface ProcedureModuleViewModel {
    items: ProcedureModuleItem[];
    deviceRelatedRecords: DeviceRelatedRecordView[];
    totalConfirmed: number;
    currentCount: number;
    historicalCount: number;
    deviceRelatedCount: number;
    candidateCount: number;
    statusOptions: string[];
}

export interface ImmunizationModuleItem {
    id: string;
    vaccine: string;
    status: string;
    statusLabel: string;
    occurrenceLabel: string;
    knownClinicalDate: boolean;
    lotNumber?: string;
    manufacturer?: string;
    dose?: string;
    normalizedDose?: string;
    site?: string;
    route?: string;
    reasons: string[];
    performer?: string;
    note?: string;
    provenance: ResourceProvenanceView;
    searchText: string;
    sortTimestamp: number;
}

export interface ImmunizationModuleViewModel {
    items: ImmunizationModuleItem[];
    totalConfirmed: number;
    completedCount: number;
    notDoneCount: number;
    unknownDateCount: number;
    candidateCount: number;
    statusOptions: string[];
}

export interface DocumentModuleItem {
    id: string;
    title: string;
    fileName: string;
    status: string;
    statusLabel: string;
    documentType?: string;
    authoredLabel: string;
    knownClinicalDate: boolean;
    uploadedLabel: string;
    mimeType: string;
    mimeFamily: string;
    pageCount?: number;
    hash?: string;
    description?: string;
    relatedResources: LinkedRecordView[];
    previewSource: SourceDocumentReference;
    provenance: ResourceProvenanceView;
    searchText: string;
    sortTimestamp: number;
}

export interface DocumentsModuleViewModel {
    items: DocumentModuleItem[];
    totalConfirmed: number;
    currentCount: number;
    supersededCount: number;
    candidateCount: number;
    mimeFamilyOptions: string[];
    documentTypeOptions: string[];
}
