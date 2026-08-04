import type { AuditEvent } from '../audit/types';
import type {
    ClinicalTaskRecord,
    MedicationRecordKind,
    MedicationStatus,
    SourceDocumentReference,
} from '../clinical-record/types';

export type MedicationReconciliationIssueType =
    | 'possible-duplicate'
    | 'status-conflict'
    | 'direction-conflict'
    | 'missing-directions'
    | 'missing-clinical-date'
    | 'uncertain-active-status'
    | 'cross-kind-context';

export type MedicationReconciliationIssueSeverity =
    | 'action-required'
    | 'review'
    | 'information';

export type MedicationReconciliationDecisionType =
    | 'keep-separate'
    | 'duplicate-needs-correction'
    | 'record-correction-needed'
    | 'insufficient-evidence'
    | 'reviewed-no-change';

export type MedicationReconciliationResolutionState =
    | 'unreviewed'
    | 'reviewed'
    | 'action-pending';

export interface MedicationReconciliationRecordView {
    id: string;
    evidenceId: string;
    name: string;
    identityKey: string;
    kind: MedicationRecordKind;
    kindLabel: string;
    status: MedicationStatus;
    statusLabel: string;
    dosageText: string[];
    dosageSignature: string;
    startLabel: string;
    endLabel: string;
    effectiveLabel: string;
    knownClinicalDate: boolean;
    prescriber?: string;
    reasons: string[];
    note?: string;
    sourceLabel: string;
    sourceDocument?: SourceDocumentReference;
    amendmentCount: number;
    snapshotSignature: string;
    searchText: string;
}

export interface MedicationReconciliationReviewDecision {
    issueId: string;
    decision: MedicationReconciliationDecisionType;
    decisionLabel: string;
    reason: string;
    reviewedAt: string;
    reviewedBy?: string;
    taskId?: string;
    auditEventId: string;
}

export interface MedicationReconciliationIssue {
    id: string;
    fingerprint: string;
    type: MedicationReconciliationIssueType;
    severity: MedicationReconciliationIssueSeverity;
    requiresDecision: boolean;
    title: string;
    description: string;
    medicationName: string;
    recordIds: string[];
    records: MedicationReconciliationRecordView[];
    questions: string[];
    resolutionState: MedicationReconciliationResolutionState;
    decision?: MedicationReconciliationReviewDecision;
    searchText: string;
}

export interface MedicationReconciliationGroup {
    id: string;
    identityKey: string;
    medicationName: string;
    records: MedicationReconciliationRecordView[];
    issues: MedicationReconciliationIssue[];
    sourceKinds: MedicationRecordKind[];
}

export interface MedicationReconciliationViewModel {
    groups: MedicationReconciliationGroup[];
    issues: MedicationReconciliationIssue[];
    medicationCount: number;
    groupCount: number;
    candidateMedicationCount: number;
    unreviewedCount: number;
    actionPendingCount: number;
    reviewedCount: number;
    informationalCount: number;
    possibleDuplicateCount: number;
    conflictCount: number;
    missingInformationCount: number;
}

export interface MedicationReconciliationTaskInput {
    patientId: string;
    issue: MedicationReconciliationIssue;
    decision: MedicationReconciliationDecisionType;
    reason: string;
    createdAt?: string;
    createdBy?: string;
}

export interface MedicationReconciliationTaskResult {
    task: ClinicalTaskRecord;
    warnings: string[];
}

export interface MedicationReconciliationAuditMetadata {
    issueId: string;
    fingerprint: string;
    issueType: MedicationReconciliationIssueType;
    decision: MedicationReconciliationDecisionType;
    decisionLabel: string;
    reason: string;
    medicationName: string;
    recordIds: string[];
    sourceLabels: string[];
    reviewedAt: string;
    reviewedBy?: string;
    taskId?: string;
}

export type MedicationReconciliationAuditEvent = AuditEvent & {
    type: 'MEDICATION_RECONCILIATION_REVIEWED';
    metadata: MedicationReconciliationAuditMetadata;
};
