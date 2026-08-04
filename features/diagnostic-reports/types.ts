import type {
    ClinicalCodeableConcept,
    ClinicalDate,
    ClinicalPeriod,
    ClinicalQuantityValue,
    DiagnosticReportRecord,
    ObservationRecord,
    ObservationReferenceRange,
    SourceDocumentReference,
    SpecimenRecord,
} from '../clinical-record';

export const DIAGNOSTIC_REPORT_DRAFT_SCHEMA_VERSION = 1 as const;

export type DiagnosticReportDraftSchemaVersion =
    typeof DIAGNOSTIC_REPORT_DRAFT_SCHEMA_VERSION;

export type DiagnosticResultComparator = '<' | '<=' | '>=' | '>';

export type DiagnosticResultValueDraft =
    | {
        type: 'quantity';
        rawText: string;
        value: number;
        unit?: string;
        comparator?: DiagnosticResultComparator;
        normalized?: ClinicalQuantityValue;
        normalizationWarning?: string;
    }
    | {
        type: 'string';
        text: string;
    }
    | {
        type: 'boolean';
        value: boolean;
        sourceText?: string;
    }
    | {
        type: 'integer';
        value: number;
        sourceText?: string;
    }
    | {
        type: 'codeable-concept';
        concept: ClinicalCodeableConcept;
        sourceText?: string;
    };

export interface DiagnosticReferenceRangeDraft
    extends ObservationReferenceRange {
    sourceText?: string;
}

export interface DiagnosticSpecimenDraft {
    localId: string;
    status: SpecimenRecord['status'];
    type?: ClinicalCodeableConcept;
    collectedAt?: ClinicalDate;
    receivedAt?: ClinicalDate;
    bodySite?: ClinicalCodeableConcept;
    collectionMethod?: ClinicalCodeableConcept;
    note?: string;
    source?: SourceDocumentReference;
}

export interface DiagnosticResultDraft {
    localId: string;
    status: ObservationRecord['status'];
    code: ClinicalCodeableConcept;
    category?: ClinicalCodeableConcept[];
    value: DiagnosticResultValueDraft;
    interpretation?: ClinicalCodeableConcept[];
    referenceRanges: DiagnosticReferenceRangeDraft[];
    specimenLocalId?: string;
    effective?: ClinicalDate;
    issuedAt?: string;
    performer?: string[];
    note?: string;
    source?: SourceDocumentReference;
}

export interface DiagnosticReportDraft {
    schemaVersion: DiagnosticReportDraftSchemaVersion;
    draftId: string;
    patientId: string;
    documentId: string;
    fileName?: string;
    status: DiagnosticReportRecord['status'];
    code: ClinicalCodeableConcept;
    category?: ClinicalCodeableConcept[];
    effectivePeriod?: ClinicalPeriod;
    issuedAt?: string;
    conclusion?: string;
    conclusionCodes?: ClinicalCodeableConcept[];
    encounterId?: string;
    performer?: string[];
    reportSource?: SourceDocumentReference;
    specimens: DiagnosticSpecimenDraft[];
    results: DiagnosticResultDraft[];
    extraction?: {
        engine: string;
        model?: string;
        engineVersion?: string;
        confidence?: number;
        extractedAt: string;
    };
}

export interface DiagnosticReportCandidateGraph {
    graphId: string;
    draftId: string;
    patientId: string;
    documentId: string;
    report: DiagnosticReportRecord;
    observations: ObservationRecord[];
    specimens: SpecimenRecord[];
}

export type DiagnosticReportGraphWriteStatus =
    | 'created'
    | 'updated'
    | 'confirmed'
    | 'rejected'
    | 'duplicate'
    | 'unchanged'
    | 'not-found'
    | 'patient-not-found'
    | 'conflict'
    | 'invalid';

export interface DiagnosticReportGraphIssue {
    path: string;
    message: string;
}

export interface DiagnosticReportGraphResult {
    ok: boolean;
    status: DiagnosticReportGraphWriteStatus;
    graphId?: string;
    reportId?: string;
    issues: DiagnosticReportGraphIssue[];
    message?: string;
}

export interface DiagnosticReportGraphReviewInput {
    reviewedAt?: string;
    reviewedBy?: string;
    reason?: string;
}

export interface DiagnosticReportGraphSummary {
    graphId: string;
    draftId: string;
    report: DiagnosticReportRecord;
    observations: ObservationRecord[];
    specimens: SpecimenRecord[];
    source?: SourceDocumentReference;
}
