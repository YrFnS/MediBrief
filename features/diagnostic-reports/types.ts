import type {
    ClinicalDate,
    ClinicalRecordResource,
    DiagnosticReportRecord,
    ObservationRecord,
    SpecimenRecord,
    VerificationStatus,
} from '../clinical-record';

export type DiagnosticReportReviewStatus = Extract<
    VerificationStatus,
    'candidate' | 'confirmed'
>;

export type ReviewedReportStatus = DiagnosticReportRecord['status'];
export type ReviewedObservationStatus = ObservationRecord['status'];
export type ReviewedSpecimenStatus = SpecimenRecord['status'];

export interface ReviewedDiagnosticIdentifier {
    value: string;
    system?: string;
    type?: string;
}

export interface ReviewedDiagnosticSource {
    documentId: string;
    fileName?: string;
    pageNumber?: number;
    section?: string;
    startOffset?: number;
    endOffset?: number;
    excerpt?: string;
}

export interface ReviewedSpecimenDraft {
    localId: string;
    status?: ReviewedSpecimenStatus;
    typeText?: string;
    collectedDate?: string | null;
    receivedDate?: string | null;
    bodySiteText?: string;
    collectionMethodText?: string;
    collector?: string;
    identifiers?: ReviewedDiagnosticIdentifier[];
    note?: string;
}

export interface ReviewedObservationDraft {
    localId: string;
    testName: string;
    loincCode?: string;
    status?: ReviewedObservationStatus;
    categoryTexts?: string[];
    valueText?: string | null;
    unitText?: string | null;
    referenceRangeText?: string | null;
    interpretationText?: string | null;
    absentReasonText?: string | null;
    clinicalDate?: string | null;
    issuedAt?: string | null;
    performer?: string[];
    specimenLocalId?: string;
    methodText?: string;
    bodySiteText?: string;
    note?: string;
    source?: Partial<Omit<ReviewedDiagnosticSource, 'documentId'>>;
}

export interface ReviewedDiagnosticReportDraft {
    patientId: string;
    reportTitle: string;
    status?: ReviewedReportStatus;
    categoryTexts?: string[];
    effectiveDate?: string | null;
    issuedAt?: string | null;
    performer?: string[];
    conclusion?: string;
    identifiers?: ReviewedDiagnosticIdentifier[];
    accessionIdentifier?: ReviewedDiagnosticIdentifier;
    specimens?: ReviewedSpecimenDraft[];
    results: ReviewedObservationDraft[];
    source: ReviewedDiagnosticSource;
    verificationStatus?: DiagnosticReportReviewStatus;
    reviewedAt?: string;
    reviewedBy?: string;
}

export type ParsedObservationValueKind =
    | 'quantity'
    | 'qualitative'
    | 'text'
    | 'absent';

export interface DiagnosticParsingWarning {
    code:
        | 'decimal-comma-unparsed'
        | 'unit-not-normalized'
        | 'date-unparsed'
        | 'datetime-unparsed'
        | 'reference-range-unparsed'
        | 'report-status-mapped'
        | 'missing-value'
        | 'unknown-specimen-reference'
        | 'identifier-preserved-in-provenance';
    message: string;
    field?: string;
    resultLocalId?: string;
    specimenLocalId?: string;
}

export interface ParsedObservationValue {
    kind: ParsedObservationValueKind;
    value?: ObservationRecord['value'];
    absentReason?: string;
    originalText?: string;
    warnings: DiagnosticParsingWarning[];
}

export interface ParsedReferenceRange {
    ranges: ObservationRecord['referenceRanges'];
    warnings: DiagnosticParsingWarning[];
}

export interface DiagnosticReportBundle {
    report: DiagnosticReportRecord;
    specimens: SpecimenRecord[];
    observations: ObservationRecord[];
    resources: ClinicalRecordResource[];
    warnings: DiagnosticParsingWarning[];
}

export type DiagnosticGraphValidationCode =
    | 'empty-bundle'
    | 'patient-mismatch'
    | 'duplicate-resource-id'
    | 'missing-report'
    | 'multiple-reports'
    | 'missing-result'
    | 'unexpected-result'
    | 'missing-specimen'
    | 'observation-report-mismatch'
    | 'observation-specimen-mismatch'
    | 'missing-source-document'
    | 'source-document-patient-mismatch'
    | 'resource-id-conflict'
    | 'duplicate-report-source';

export interface DiagnosticGraphValidationIssue {
    code: DiagnosticGraphValidationCode;
    message: string;
    resourceId?: string;
}

export interface DiagnosticGraphValidationResult {
    valid: boolean;
    issues: DiagnosticGraphValidationIssue[];
}

export type DiagnosticBundleCommitStatus =
    | 'created'
    | 'duplicate'
    | 'patient-not-found'
    | 'invalid-graph'
    | 'conflict';

export interface DiagnosticBundleCommitResult {
    ok: boolean;
    status: DiagnosticBundleCommitStatus;
    reportId?: string;
    createdResourceIds: string[];
    duplicateOf?: string;
    issues: DiagnosticGraphValidationIssue[];
    message?: string;
}

export interface ParsedClinicalDate {
    date: ClinicalDate;
    warnings: DiagnosticParsingWarning[];
}
