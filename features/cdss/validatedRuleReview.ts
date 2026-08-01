import type { AuditEvent } from '../audit/types';
import { createAdvisoryTaskRecord } from '../clinical-record/durableActions';
import { createUnknownClinicalDate } from '../clinical-record/factories';
import type {
    ClinicalTaskRecord,
    PatientClinicalRecord,
} from '../clinical-record/types';
import { parseLocalEvidenceId } from '../grounded-assistance/evidenceReview';
import type { CDSSAlert } from './types';
import {
    evaluateValidatedRuleSet,
    VALIDATED_RULE_REGISTRY,
    type ValidatedClinicalRuleDefinition,
    type ValidatedRuleEvaluation,
} from './validatedRules';

export type ValidatedAdvisoryReviewState =
    | 'unreviewed'
    | 'acknowledged'
    | 'task-created';

export interface ValidatedAdvisoryDecision {
    state: Exclude<ValidatedAdvisoryReviewState, 'unreviewed'>;
    reason: string;
    reviewedAt: string;
    reviewedBy?: string;
    taskId?: string;
    auditEventId: string;
}

export interface ValidatedAdvisoryReviewItem {
    advisory: CDSSAlert;
    fingerprint: string;
    evidenceIds: string[];
    state: ValidatedAdvisoryReviewState;
    decision?: ValidatedAdvisoryDecision;
}

export interface ValidatedRuleReviewViewModel {
    registry: ValidatedClinicalRuleDefinition<PatientClinicalRecord>[];
    evaluations: ValidatedRuleEvaluation[];
    advisories: ValidatedAdvisoryReviewItem[];
    matchedCount: number;
    unreviewedCount: number;
    acknowledgedCount: number;
    taskCreatedCount: number;
    skippedCount: number;
    evaluationFingerprint: string;
}

const eventTime = (event: AuditEvent): number => event.timestamp || 0;

const latestDecision = (
    logs: AuditEvent[],
    patientId: string,
    fingerprint: string,
): ValidatedAdvisoryDecision | undefined => {
    const event = logs
        .filter(log =>
            log.patientId === patientId
            && [
                'VALIDATED_ADVISORY_ACKNOWLEDGED',
                'VALIDATED_ADVISORY_TASK_CREATED',
            ].includes(log.type)
            && log.metadata?.fingerprint === fingerprint)
        .sort((left, right) => eventTime(right) - eventTime(left))[0];
    if (!event) return undefined;

    const taskCreated = event.type === 'VALIDATED_ADVISORY_TASK_CREATED';
    return {
        state: taskCreated ? 'task-created' : 'acknowledged',
        reason: typeof event.metadata?.reason === 'string'
            ? event.metadata.reason
            : event.details,
        reviewedAt: typeof event.metadata?.reviewedAt === 'string'
            ? event.metadata.reviewedAt
            : new Date(event.timestamp).toISOString(),
        ...(typeof event.metadata?.reviewedBy === 'string'
            ? { reviewedBy: event.metadata.reviewedBy }
            : {}),
        ...(typeof event.metadata?.taskId === 'string'
            ? { taskId: event.metadata.taskId }
            : {}),
        auditEventId: event.id,
    };
};

const stableHash = (value: string): string => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
};

const evaluationFingerprint = (
    record: PatientClinicalRecord,
    evaluations: ValidatedRuleEvaluation[],
): string => `phase5-rules:${stableHash(JSON.stringify({
    patientId: record.patientId,
    recordUpdatedAt: record.updatedAt,
    evaluations: evaluations.map(evaluation => ({
        ruleId: evaluation.ruleId,
        version: evaluation.version,
        executed: evaluation.executed,
        matched: evaluation.matched,
        skippedReason: evaluation.skippedReason || null,
        advisoryFingerprint: evaluation.advisory?.fingerprint || null,
    })),
}))}`;

export const buildValidatedRuleReviewViewModel = (
    record: PatientClinicalRecord,
    logs: AuditEvent[],
): ValidatedRuleReviewViewModel => {
    const registry = VALIDATED_RULE_REGISTRY as
        ValidatedClinicalRuleDefinition<PatientClinicalRecord>[];
    const evaluated = evaluateValidatedRuleSet(registry, record);
    const advisories = evaluated.advisories.map(advisory => {
        const fingerprint = advisory.fingerprint || advisory.id;
        const decision = latestDecision(
            logs,
            record.patientId,
            fingerprint,
        );
        return {
            advisory,
            fingerprint,
            evidenceIds: advisory.evidenceIds || [],
            state: decision?.state || 'unreviewed',
            ...(decision ? { decision } : {}),
        } satisfies ValidatedAdvisoryReviewItem;
    });

    return {
        registry,
        evaluations: evaluated.evaluations,
        advisories,
        matchedCount: advisories.length,
        unreviewedCount: advisories.filter(item => item.state === 'unreviewed').length,
        acknowledgedCount: advisories.filter(item => item.state === 'acknowledged').length,
        taskCreatedCount: advisories.filter(item => item.state === 'task-created').length,
        skippedCount: evaluated.evaluations.filter(item => !item.executed).length,
        evaluationFingerprint: evaluationFingerprint(record, evaluated.evaluations),
    };
};

export interface CreateValidatedAdvisoryTaskInput {
    patientId: string;
    advisory: CDSSAlert;
    reason: string;
    createdAt?: string;
    createdBy?: string;
}

/**
 * Creates a local routine proposal task after explicit user action. The task
 * links the exact evidence snapshot and never becomes an order, prescription,
 * deadline, treatment instruction, or proof of external execution.
 */
export const createValidatedAdvisoryReviewTask = ({
    patientId,
    advisory,
    reason,
    createdAt = new Date().toISOString(),
    createdBy = 'Local user',
}: CreateValidatedAdvisoryTaskInput): ClinicalTaskRecord => {
    const cleanReason = reason.trim();
    if (!cleanReason) {
        throw new Error('A review reason is required before creating a validated-advisory task.');
    }

    const task = createAdvisoryTaskRecord({
        patientId,
        advisoryTitle: advisory.title,
        actionLabel: 'Review validated workflow or data-quality advisory',
        details: [
            advisory.description,
            `Review reason: ${cleanReason}.`,
            ...(advisory.limitations || []),
        ].join('\n'),
        sourceRuleId: advisory.ruleId,
        priority: 'routine',
        createdAt,
        createdBy,
    });

    const relatedResources = (advisory.evidenceIds || [])
        .map(parseLocalEvidenceId)
        .filter((item): item is NonNullable<ReturnType<typeof parseLocalEvidenceId>> => Boolean(item))
        .map(item => ({
            resourceType: item.resourceType,
            id: item.resourceId,
            display: item.id,
        }));

    return {
        ...task,
        tags: [
            ...(task.tags || []),
            'validated-low-risk-rule',
            advisory.advisoryKind === 'workflow'
                ? 'workflow-review'
                : 'data-quality-review',
            `rule-${advisory.ruleId.replace(/[^A-Za-z0-9._-]/g, '_')}`,
        ],
        due: createUnknownClinicalDate(
            'No due date was assigned by validated advisory review.',
        ),
        relatedResources,
        note: [
            task.note,
            'This task was created from a reviewed low-risk workflow or data-quality advisory.',
            'It does not send a notification, book an appointment, place an order or prescription, assign clinical urgency, recommend treatment, or prove that any external action occurred.',
        ].filter(Boolean).join(' '),
    };
};
