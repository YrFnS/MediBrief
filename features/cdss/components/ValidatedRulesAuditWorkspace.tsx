import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangleIcon,
    ChevronRightIcon,
    ClockIcon,
    DocumentTextIcon,
    DownloadIcon,
    ListChecksIcon,
    RecordIcon,
    ShieldCheckIcon,
} from '../../../components/icons';
import type { AuditActor, AuditEvent, AuditEventType } from '../../audit/types';
import { useAuditStore } from '../../audit/useAuditStore';
import { selectCandidateResources } from '../../clinical-record/selectors';
import type {
    ClinicalResourceType,
    PatientClinicalRecord,
} from '../../clinical-record/types';
import { useClinicalRecordStore } from '../../clinical-record/useClinicalRecordStore';
import {
    localEvidenceIdForResource,
    uniqueLocalEvidenceIds,
} from '../../grounded-assistance/evidenceReview';
import LocalEvidenceDrawer from '../../grounded-assistance/components/LocalEvidenceDrawer';
import { buildDeterministicPatientSummary } from '../../grounded-assistance/summary';
import type { CDSSAlert } from '../types';
import {
    buildValidatedRuleReviewViewModel,
    createValidatedAdvisoryReviewTask,
    type ValidatedAdvisoryReviewItem,
} from '../validatedRuleReview';

interface ValidatedRulesAuditWorkspaceProps {
    record: PatientClinicalRecord;
    onReviewCandidates?: () => void;
    onClose?: () => void;
}

type WorkspaceView = 'advisories' | 'registry' | 'audit';
type ReviewMode = 'acknowledge' | 'task';

interface ReviewDraft {
    fingerprint: string;
    mode: ReviewMode;
    reason: string;
}

interface EvidenceDrawerState {
    evidenceIds: string[];
    title: string;
    description: string;
}

const PHASE_5_AUDIT_TYPES: AuditEventType[] = [
    'DETERMINISTIC_SUMMARY_GENERATED',
    'GROUNDING_BUNDLE_GENERATED',
    'GROUNDED_ASSISTANT_COMPLETED',
    'GROUNDED_ASSISTANT_REJECTED',
    'MEDICATION_RECONCILIATION_REVIEWED',
    'MEDICATION_RECONCILIATION_TASK_CREATED',
    'TREND_SUMMARY_GENERATED',
    'TREND_GROUNDING_BUNDLE_GENERATED',
    'TREND_ASSISTANT_COMPLETED',
    'TREND_ASSISTANT_REJECTED',
    'REMINDER_TASK_CREATED',
    'VALIDATED_RULE_SET_EVALUATED',
    'VALIDATED_ADVISORY_GENERATED',
    'VALIDATED_ADVISORY_ACKNOWLEDGED',
    'VALIDATED_ADVISORY_TASK_CREATED',
    'VALIDATED_ADVISORY_EVIDENCE_REVIEWED',
    'GROUNDED_EVIDENCE_REVIEWED',
    'AUDIT_REVIEW_EXPORTED',
];

const eventDateLabel = (timestamp: number): string => {
    const parsed = new Date(timestamp);
    return Number.isNaN(parsed.getTime())
        ? String(timestamp)
        : parsed.toLocaleString();
};

const stateClasses = (state: ValidatedAdvisoryReviewItem['state']): string => {
    if (state === 'task-created') {
        return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/25 dark:text-blue-200';
    }
    if (state === 'acknowledged') {
        return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/25 dark:text-emerald-200';
    }
    return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-200';
};

const stateLabel = (state: ValidatedAdvisoryReviewItem['state']): string => {
    if (state === 'task-created') return 'Local review task created';
    if (state === 'acknowledged') return 'Evidence snapshot acknowledged';
    return 'Needs human review';
};

const evidenceIdsForAuditEvent = (
    event: AuditEvent,
    record: PatientClinicalRecord,
    deterministicSummaryIds: string[],
): string[] => {
    const values: unknown[] = [];
    const metadata = event.metadata || {};

    if (Array.isArray(metadata.referencedEvidenceIds)) {
        values.push(...metadata.referencedEvidenceIds);
    }
    if (Array.isArray(metadata.evidenceIds)) {
        values.push(...metadata.evidenceIds);
    }

    if (event.type === 'DETERMINISTIC_SUMMARY_GENERATED') {
        values.push(...deterministicSummaryIds);
    }

    if (
        [
            'MEDICATION_RECONCILIATION_REVIEWED',
            'MEDICATION_RECONCILIATION_TASK_CREATED',
        ].includes(event.type)
        && Array.isArray(metadata.recordIds)
    ) {
        metadata.recordIds.forEach((id: unknown) => {
            if (typeof id !== 'string') return;
            values.push(localEvidenceIdForResource({
                resourceType: 'Medication',
                id,
            }));
        });
    }

    if (
        typeof metadata.sourceResourceType === 'string'
        && typeof metadata.sourceResourceId === 'string'
    ) {
        values.push(localEvidenceIdForResource({
            resourceType: metadata.sourceResourceType as ClinicalResourceType,
            id: metadata.sourceResourceId,
        }));
    }

    if (typeof metadata.taskId === 'string') {
        const taskExists = record.resources.tasks.some(task =>
            task.id === metadata.taskId);
        if (taskExists) {
            values.push(localEvidenceIdForResource({
                resourceType: 'ClinicalTask',
                id: metadata.taskId,
            }));
        }
    }

    return uniqueLocalEvidenceIds(values);
};

const ruleSearchText = (item: ValidatedAdvisoryReviewItem): string => [
    item.advisory.title,
    item.advisory.description,
    item.advisory.ruleId,
    item.advisory.advisoryKind || '',
    item.state,
    ...(item.advisory.triggers || []),
    ...(item.advisory.evidenceIds || []),
].join(' ').toLocaleLowerCase();

const ValidatedRulesAuditWorkspace: React.FC<ValidatedRulesAuditWorkspaceProps> = ({
    record,
    onReviewCandidates,
    onClose,
}) => {
    const logs = useAuditStore(state => state.logs);
    const auditActions = useAuditStore(state => state.actions);
    const clinicalActions = useClinicalRecordStore(state => state.actions);

    const [view, setView] = useState<WorkspaceView>('advisories');
    const [search, setSearch] = useState('');
    const [actorFilter, setActorFilter] = useState<AuditActor | 'all'>('all');
    const [typeFilter, setTypeFilter] = useState<AuditEventType | 'all'>('all');
    const [draft, setDraft] = useState<ReviewDraft | null>(null);
    const [evidenceDrawer, setEvidenceDrawer] = useState<EvidenceDrawerState | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const review = useMemo(
        () => buildValidatedRuleReviewViewModel(record, logs),
        [logs, record],
    );
    const candidateCount = useMemo(
        () => selectCandidateResources(record).length,
        [record],
    );
    const deterministicSummaryIds = useMemo(
        () => buildDeterministicPatientSummary(record)
            .evidenceBundle.evidence.map(item => item.id),
        [record],
    );

    useEffect(() => {
        const alreadyLogged = logs.some(event =>
            event.patientId === record.patientId
            && event.type === 'VALIDATED_RULE_SET_EVALUATED'
            && event.metadata?.evaluationFingerprint === review.evaluationFingerprint);
        if (!alreadyLogged) {
            auditActions.logEvent(
                'VALIDATED_RULE_SET_EVALUATED',
                record.patientId,
                'Evaluated the reviewed low-risk workflow and data-quality rule registry against confirmed patient-applicable record evidence.',
                'SYSTEM',
                {
                    evaluationFingerprint: review.evaluationFingerprint,
                    registryRuleCount: review.registry.length,
                    matchedCount: review.matchedCount,
                    skippedCount: review.skippedCount,
                    ruleResults: review.evaluations.map(item => ({
                        ruleId: item.ruleId,
                        version: item.version,
                        executed: item.executed,
                        matched: item.matched,
                        skippedReason: item.skippedReason || null,
                    })),
                },
            );
        }

        review.advisories.forEach(item => {
            const generatedLogged = logs.some(event =>
                event.patientId === record.patientId
                && event.type === 'VALIDATED_ADVISORY_GENERATED'
                && event.metadata?.fingerprint === item.fingerprint);
            if (generatedLogged) return;
            auditActions.logEvent(
                'VALIDATED_ADVISORY_GENERATED',
                record.patientId,
                `Generated low-risk validated advisory: ${item.advisory.title}`,
                'SYSTEM',
                {
                    fingerprint: item.fingerprint,
                    ruleId: item.advisory.ruleId,
                    advisoryKind: item.advisory.advisoryKind,
                    alertLevel: item.advisory.level,
                    evidenceIds: item.evidenceIds,
                    validationPackageId: item.advisory.validationPackageId,
                },
            );
        });
    }, [auditActions, logs, record.patientId, review]);

    const normalizedSearch = search.trim().toLocaleLowerCase();
    const visibleAdvisories = review.advisories.filter(item =>
        !normalizedSearch || ruleSearchText(item).includes(normalizedSearch));

    const auditEvents = useMemo(() => logs
        .filter(event => event.patientId === record.patientId)
        .filter(event => PHASE_5_AUDIT_TYPES.includes(event.type))
        .filter(event => actorFilter === 'all' || event.actor === actorFilter)
        .filter(event => typeFilter === 'all' || event.type === typeFilter)
        .filter(event => {
            if (!normalizedSearch) return true;
            return [
                event.type,
                event.actor,
                event.details,
                JSON.stringify(event.metadata || {}),
            ].join(' ').toLocaleLowerCase().includes(normalizedSearch);
        })
        .sort((left, right) => right.timestamp - left.timestamp), [
        actorFilter,
        logs,
        normalizedSearch,
        record.patientId,
        typeFilter,
    ]);

    const openAdvisoryEvidence = (item: ValidatedAdvisoryReviewItem): void => {
        setEvidenceDrawer({
            evidenceIds: item.evidenceIds,
            title: item.advisory.title,
            description: 'Exact confirmed patient-record items that triggered this low-risk workflow or data-quality advisory.',
        });
        auditActions.logEvent(
            'VALIDATED_ADVISORY_EVIDENCE_REVIEWED',
            record.patientId,
            `Opened source-linked evidence for validated advisory: ${item.advisory.title}`,
            'USER',
            {
                fingerprint: item.fingerprint,
                ruleId: item.advisory.ruleId,
                evidenceIds: item.evidenceIds,
            },
        );
    };

    const openAuditEvidence = (event: AuditEvent): void => {
        const evidenceIds = evidenceIdsForAuditEvent(
            event,
            record,
            deterministicSummaryIds,
        );
        if (evidenceIds.length === 0) return;
        setEvidenceDrawer({
            evidenceIds,
            title: event.type.replace(/_/g, ' '),
            description: 'Patient-record evidence linked to this recorded Phase 5 workflow event.',
        });
        auditActions.logEvent(
            'GROUNDED_EVIDENCE_REVIEWED',
            record.patientId,
            `Opened local evidence linked to audit event ${event.type}.`,
            'USER',
            {
                sourceAuditEventId: event.id,
                sourceAuditEventType: event.type,
                evidenceIds,
            },
        );
    };

    const handleExportAudit = (): void => {
        const generatedAt = new Date().toISOString();
        const payload = {
            schemaVersion: 1,
            exportType: 'medibrief-phase5-patient-audit-review',
            patientId: record.patientId,
            generatedAt,
            filters: {
                actor: actorFilter,
                eventType: typeFilter,
                search: search.trim(),
            },
            eventCount: auditEvents.length,
            events: auditEvents,
            limitations: [
                'This export contains patient-scoped application audit data and is not anonymous or PHI-free.',
                'Audit events describe software workflow and do not prove clinical correctness, medical urgency, or external execution.',
            ],
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
            type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        const safePatientId = record.patientId.replace(/[^A-Za-z0-9._-]/g, '_');
        anchor.href = url;
        anchor.download = `medibrief-phase5-audit-${safePatientId}-${generatedAt.slice(0, 10)}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);

        auditActions.logEvent(
            'AUDIT_REVIEW_EXPORTED',
            record.patientId,
            `Exported ${auditEvents.length} filtered patient-scoped Phase 5 audit event${auditEvents.length === 1 ? '' : 's'}.`,
            'USER',
            {
                generatedAt,
                eventCount: auditEvents.length,
                actorFilter,
                typeFilter,
                search: search.trim(),
                phiFree: false,
            },
        );
        setFeedback('Patient-scoped audit JSON exported. It contains private record workflow data and is not PHI-free.');
    };

    const beginReview = (
        item: ValidatedAdvisoryReviewItem,
        mode: ReviewMode,
    ): void => {
        setDraft({ fingerprint: item.fingerprint, mode, reason: '' });
        setFeedback(null);
        setError(null);
    };

    const submitReview = (item: ValidatedAdvisoryReviewItem): void => {
        if (!draft || draft.fingerprint !== item.fingerprint) return;
        const reason = draft.reason.trim();
        if (!reason) {
            setError('A review reason is required before recording this decision.');
            return;
        }

        const reviewedAt = new Date().toISOString();
        if (draft.mode === 'acknowledge') {
            auditActions.logEvent(
                'VALIDATED_ADVISORY_ACKNOWLEDGED',
                record.patientId,
                `Acknowledged the current evidence snapshot for validated advisory: ${item.advisory.title}`,
                'USER',
                {
                    fingerprint: item.fingerprint,
                    ruleId: item.advisory.ruleId,
                    advisoryKind: item.advisory.advisoryKind,
                    evidenceIds: item.evidenceIds,
                    reason,
                    reviewedAt,
                    reviewedBy: 'Local user',
                    boundary: 'Acknowledgment records workflow review only and changes no clinical fact.',
                },
            );
            setFeedback('Evidence snapshot acknowledged. No patient record, treatment, order, or external action was changed.');
            setDraft(null);
            setError(null);
            return;
        }

        try {
            const task = createValidatedAdvisoryReviewTask({
                patientId: record.patientId,
                advisory: item.advisory,
                reason,
                createdAt: reviewedAt,
                createdBy: 'Local user',
            });
            const write = clinicalActions.addResource(task);
            if (!write.ok) {
                setError(write.message || 'The local review task could not be saved.');
                return;
            }
            auditActions.logEvent(
                'VALIDATED_ADVISORY_TASK_CREATED',
                record.patientId,
                `Created a local routine proposal task from validated advisory: ${item.advisory.title}`,
                'USER',
                {
                    fingerprint: item.fingerprint,
                    ruleId: item.advisory.ruleId,
                    advisoryKind: item.advisory.advisoryKind,
                    evidenceIds: item.evidenceIds,
                    reason,
                    reviewedAt,
                    reviewedBy: 'Local user',
                    taskId: task.id,
                    taskIntent: task.intent,
                    taskPriority: task.priority,
                    boundary: 'No notification, booking, order, prescription, treatment instruction, urgency assignment, or external action was sent.',
                },
            );
            setFeedback(`Local routine proposal task ${task.id} was saved. No external action was sent.`);
            setDraft(null);
            setError(null);
        } catch (taskError) {
            setError(
                taskError instanceof Error
                    ? taskError.message
                    : 'The local review task could not be created.',
            );
        }
    };

    const renderAdvisory = (item: ValidatedAdvisoryReviewItem) => {
        const advisory: CDSSAlert = item.advisory;
        const isDraft = draft?.fingerprint === item.fingerprint;
        return (
            <article
                key={item.fingerprint}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/80"
            >
                <div className="p-5 md:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-blue-800 dark:bg-blue-950/50 dark:text-blue-200">
                                    Validated {advisory.advisoryKind || 'workflow'}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                    {advisory.level}
                                </span>
                                <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${stateClasses(item.state)}`}>
                                    {stateLabel(item.state)}
                                </span>
                            </div>
                            <h3 className="mt-3 text-lg font-display font-bold text-slate-950 dark:text-white">
                                {advisory.title}
                            </h3>
                            <p className="mt-2 max-w-4xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                {advisory.description}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {advisory.triggers.map(trigger => (
                                    <span
                                        key={trigger}
                                        className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[9px] font-mono text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                                    >
                                        {trigger}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 lg:max-w-sm lg:justify-end">
                            <button
                                type="button"
                                onClick={() => openAdvisoryEvidence(item)}
                                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300"
                            >
                                <DocumentTextIcon className="h-4 w-4" />
                                Review {item.evidenceIds.length} evidence item{item.evidenceIds.length === 1 ? '' : 's'}
                            </button>
                            {item.state === 'unreviewed' && (
                                <button
                                    type="button"
                                    onClick={() => beginReview(item, 'acknowledge')}
                                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                                >
                                    <ShieldCheckIcon className="h-4 w-4" />
                                    Acknowledge snapshot
                                </button>
                            )}
                            {item.state !== 'task-created' && (
                                <button
                                    type="button"
                                    onClick={() => beginReview(item, 'task')}
                                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-white dark:bg-white dark:text-slate-950"
                                >
                                    <ListChecksIcon className="h-4 w-4" />
                                    Create local review task
                                </button>
                            )}
                        </div>
                    </div>

                    {item.decision && (
                        <section className={`mt-4 rounded-2xl border p-4 ${stateClasses(item.state)}`}>
                            <p className="text-xs font-bold">{stateLabel(item.state)}</p>
                            <p className="mt-2 text-xs leading-relaxed">{item.decision.reason}</p>
                            <p className="mt-2 text-[9px] font-mono uppercase tracking-wide opacity-70">
                                {item.decision.reviewedAt}
                                {item.decision.reviewedBy ? ` · ${item.decision.reviewedBy}` : ''}
                                {item.decision.taskId ? ` · Task ${item.decision.taskId}` : ''}
                            </p>
                        </section>
                    )}

                    <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                        <summary className="cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-100">
                            Reviewed rule metadata and safety boundaries
                        </summary>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            <div>
                                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Rule</p>
                                <code className="mt-1 block break-all text-[10px] text-blue-700 dark:text-blue-300">{advisory.ruleId}</code>
                                <p className="mt-3 text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Validation package</p>
                                <code className="mt-1 block break-all text-[10px] text-slate-600 dark:text-slate-300">{advisory.validationPackageId || 'Not recorded'}</code>
                                <p className="mt-3 text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Reviewed by</p>
                                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                                    {advisory.reviewedBy || 'Not recorded'}{advisory.reviewedAt ? ` · ${advisory.reviewedAt}` : ''}
                                </p>
                            </div>
                            <div>
                                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Boundaries</p>
                                <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                    {(advisory.limitations || []).map(limit => (
                                        <li key={limit}>• {limit}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        {advisory.sourceCitation && (
                            <p className="mt-3 text-[9px] font-mono leading-relaxed text-slate-500 dark:text-slate-400">
                                Reviewed sources: {advisory.sourceCitation}
                            </p>
                        )}
                    </details>

                    {isDraft && (
                        <section className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/25">
                            <h4 className="text-sm font-bold text-blue-950 dark:text-blue-100">
                                {draft.mode === 'task'
                                    ? 'Create a local routine proposal task'
                                    : 'Acknowledge this exact evidence snapshot'}
                            </h4>
                            <p className="mt-2 text-xs leading-relaxed text-blue-800 dark:text-blue-200">
                                A required reason makes the decision auditable. This action does not correct the source record and does not send anything outside MediBrief.
                            </p>
                            <label className="mt-3 block">
                                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                                    Required review reason
                                </span>
                                <textarea
                                    value={draft.reason}
                                    onChange={event => setDraft(current => current
                                        ? { ...current, reason: event.target.value }
                                        : null)}
                                    rows={3}
                                    placeholder="State what evidence you reviewed and what follow-up, if any, remains necessary."
                                    className="mt-2 w-full rounded-xl border border-blue-200 bg-white p-3 text-sm leading-relaxed outline-none focus:border-blue-500 dark:border-blue-900 dark:bg-slate-950 dark:text-white"
                                />
                            </label>
                            {error && (
                                <p className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
                                    {error}
                                </p>
                            )}
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => submitReview(item)}
                                    disabled={!draft.reason.trim()}
                                    className="min-h-10 rounded-xl bg-blue-600 px-4 py-2 text-[9px] font-bold uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {draft.mode === 'task' ? 'Save proposal task' : 'Save acknowledgment'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDraft(null);
                                        setError(null);
                                    }}
                                    className="min-h-10 rounded-xl border border-slate-300 bg-white px-4 py-2 text-[9px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                                >
                                    Cancel
                                </button>
                            </div>
                        </section>
                    )}
                </div>
            </article>
        );
    };

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 md:px-6 md:py-7">
                <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 md:p-7">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-blue-700 dark:text-blue-300">
                                Phase 5 acceptance workspace
                            </p>
                            <h1 className="mt-2 text-2xl font-display font-bold text-slate-950 dark:text-white md:text-3xl">
                                Validated rules, evidence, and audit review
                            </h1>
                            <p className="mt-3 max-w-4xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                Runs only reviewed low-risk workflow and data-quality pilots. Every matched advisory is tied to an exact confirmed evidence snapshot, supports source review, requires a reason for durable actions, and changes no clinical fact automatically.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {candidateCount > 0 && onReviewCandidates && (
                                <button
                                    type="button"
                                    onClick={onReviewCandidates}
                                    className="min-h-11 rounded-xl bg-amber-500 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-white"
                                >
                                    Review {candidateCount} excluded candidate{candidateCount === 1 ? '' : 's'}
                                </button>
                            )}
                            {onClose && (
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                >
                                    Close workspace
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                        {[
                            ['Registered pilots', review.registry.length],
                            ['Matched now', review.matchedCount],
                            ['Needs review', review.unreviewedCount],
                            ['Acknowledged', review.acknowledgedCount],
                            ['Tasks created', review.taskCreatedCount],
                            ['Skipped fail-closed', review.skippedCount],
                        ].map(([label, value]) => (
                            <div key={String(label)} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">{label}</p>
                                <p className="mt-1 text-2xl font-display font-bold text-slate-950 dark:text-white">{value}</p>
                            </div>
                        ))}
                    </div>
                </header>

                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <div className="flex items-start gap-3">
                        <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700 dark:text-amber-300" />
                        <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-100">
                            Diagnosis, treatment, prescribing, dose adjustment, medication-safety verdicts, emergency triage, protocol-state decisions, and automatic record mutation remain disabled. These pilots report documentation or local workflow gaps only.
                        </p>
                    </div>
                </section>

                {feedback && (
                    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs leading-relaxed text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">
                        {feedback}
                    </section>
                )}

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <label className="flex-1">
                            <span className="sr-only">Search validated rules and audit events</span>
                            <input
                                type="search"
                                value={search}
                                onChange={event => setSearch(event.target.value)}
                                placeholder="Search rule, evidence ID, workflow event, actor, or review reason"
                                className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                        </label>
                        <div className="flex overflow-x-auto rounded-xl border border-slate-200 p-1 dark:border-slate-700" role="tablist" aria-label="Validated rule review views">
                            {([
                                ['advisories', 'Current advisories', ShieldCheckIcon],
                                ['registry', 'Reviewed registry', RecordIcon],
                                ['audit', 'Phase 5 audit', ClockIcon],
                            ] as Array<[WorkspaceView, string, React.ComponentType<{ className?: string }>]>).map(([value, label, Icon]) => (
                                <button
                                    key={value}
                                    type="button"
                                    role="tab"
                                    aria-selected={view === value}
                                    onClick={() => setView(value)}
                                    className={`inline-flex min-h-10 flex-shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[9px] font-bold uppercase tracking-wider ${view === value
                                        ? 'bg-blue-600 text-white'
                                        : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {view === 'advisories' && (
                    <section className="space-y-4" aria-label="Current low-risk validated advisories">
                        {visibleAdvisories.length > 0 ? (
                            visibleAdvisories.map(renderAdvisory)
                        ) : (
                            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-950/70">
                                <ShieldCheckIcon className="mx-auto h-9 w-9 text-emerald-500" />
                                <h2 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
                                    No current pilot advisory matches
                                </h2>
                                <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                    This means the reviewed pilot checks did not find their narrowly defined workflow or data-quality conditions. It is not a statement that the clinical record is complete or clinically correct.
                                </p>
                            </div>
                        )}
                    </section>
                )}

                {view === 'registry' && (
                    <section className="space-y-4" aria-label="Reviewed validated rule registry">
                        {review.registry.map(rule => {
                            const evaluation = review.evaluations.find(item =>
                                item.ruleId === rule.id && item.version === rule.version);
                            const matchesSearch = !normalizedSearch || [
                                rule.id,
                                rule.version,
                                rule.name,
                                rule.description,
                                rule.owner,
                                rule.intendedPopulation,
                                rule.riskClass || '',
                                ...(rule.requiredInputs || []),
                                ...(rule.exclusions || []),
                                ...(rule.safetyBoundaries || []),
                            ].join(' ').toLocaleLowerCase().includes(normalizedSearch);
                            if (!matchesSearch) return null;
                            return (
                                <article key={`${rule.id}@${rule.version}`} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 md:p-6">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-blue-800 dark:bg-blue-950/50 dark:text-blue-200">{rule.riskClass}</span>
                                                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">{rule.validationStatus}</span>
                                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-200">Info only</span>
                                            </div>
                                            <h2 className="mt-3 text-lg font-bold text-slate-950 dark:text-white">{rule.name}</h2>
                                            <code className="mt-1 block break-all text-[10px] text-blue-700 dark:text-blue-300">{rule.id}@{rule.version}</code>
                                            <p className="mt-3 max-w-4xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">{rule.description}</p>
                                        </div>
                                        <span className={`rounded-full border px-3 py-1.5 text-[9px] font-bold uppercase tracking-wide ${evaluation?.matched
                                            ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200'
                                            : evaluation?.executed
                                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200'
                                                : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200'
                                        }`}>
                                            {evaluation?.matched
                                                ? 'Matched current record'
                                                : evaluation?.executed
                                                    ? 'Executed — no match'
                                                    : `Skipped: ${evaluation?.skippedReason || 'unknown'}`}
                                        </span>
                                    </div>

                                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                                        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                                            <h3 className="text-xs font-bold text-slate-900 dark:text-white">Inputs and exclusions</h3>
                                            <p className="mt-3 text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Required inputs</p>
                                            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                                {rule.requiredInputs.map(item => <li key={item}>• {item}</li>)}
                                            </ul>
                                            <p className="mt-3 text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Exclusions</p>
                                            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                                {rule.exclusions.map(item => <li key={item}>• {item}</li>)}
                                            </ul>
                                        </section>
                                        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                                            <h3 className="text-xs font-bold text-blue-950 dark:text-blue-100">Safety and validation package</h3>
                                            <ul className="mt-3 space-y-1 text-xs leading-relaxed text-blue-900 dark:text-blue-100">
                                                {(rule.safetyBoundaries || []).map(item => <li key={item}>• {item}</li>)}
                                            </ul>
                                            <div className="mt-3 rounded-xl bg-white/70 p-3 text-[10px] text-blue-800 dark:bg-slate-950/50 dark:text-blue-200">
                                                <p><strong>Owner:</strong> {rule.owner}</p>
                                                <p className="mt-1"><strong>Reviewed:</strong> {rule.reviewedAt} by {rule.reviewedBy}</p>
                                                <p className="mt-1"><strong>Package:</strong> {rule.regressionPackage?.id}</p>
                                                <p className="mt-1"><strong>PHI-free cases:</strong> {rule.regressionPackage?.caseCount}</p>
                                            </div>
                                        </section>
                                    </div>

                                    <details className="mt-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                                        <summary className="cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-100">Reviewed evidence citations</summary>
                                        <div className="mt-3 space-y-3">
                                            {rule.evidence.map(citation => (
                                                <div key={citation.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{citation.title}</p>
                                                    <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{citation.publisher} · {citation.versionOrDate}{citation.locator ? ` · ${citation.locator}` : ''}</p>
                                                    {citation.note && <p className="mt-1 text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">{citation.note}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </details>
                                </article>
                            );
                        })}
                    </section>
                )}

                {view === 'audit' && (
                    <section className="space-y-4" aria-label="Phase 5 audit review">
                        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/80 sm:flex-row sm:items-end">
                            <label>
                                <span className="block text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Actor</span>
                                <select
                                    value={actorFilter}
                                    onChange={event => setActorFilter(event.target.value as AuditActor | 'all')}
                                    className="mt-1 min-h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                >
                                    <option value="all">All actors</option>
                                    <option value="SYSTEM">System</option>
                                    <option value="USER">User</option>
                                    <option value="AI">AI</option>
                                </select>
                            </label>
                            <label className="min-w-0 flex-1">
                                <span className="block text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Event type</span>
                                <select
                                    value={typeFilter}
                                    onChange={event => setTypeFilter(event.target.value as AuditEventType | 'all')}
                                    className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                >
                                    <option value="all">All Phase 5 events</option>
                                    {PHASE_5_AUDIT_TYPES.map(type => (
                                        <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                                    ))}
                                </select>
                            </label>
                            <button
                                type="button"
                                onClick={handleExportAudit}
                                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-[9px] font-bold uppercase tracking-wider text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300"
                            >
                                <DownloadIcon className="h-4 w-4" />
                                Export filtered JSON
                            </button>
                        </div>
                        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-relaxed text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                            Export is explicitly user initiated and limited to this patient and the current filters. The JSON contains private patient-scoped workflow data and is not anonymous or PHI-free.
                        </p>

                        {auditEvents.length > 0 ? auditEvents.map(event => {
                            const linkedEvidenceIds = evidenceIdsForAuditEvent(
                                event,
                                record,
                                deterministicSummaryIds,
                            );
                            return (
                                <article key={event.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 md:p-5">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-200">{event.actor}</span>
                                                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-blue-800 dark:bg-blue-950/50 dark:text-blue-200">{event.type.replace(/_/g, ' ')}</span>
                                            </div>
                                            <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-800 dark:text-slate-100">{event.details}</p>
                                            <p className="mt-2 text-[9px] font-mono text-slate-400">{eventDateLabel(event.timestamp)} · {event.id}</p>
                                        </div>
                                        {linkedEvidenceIds.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => openAuditEvidence(event)}
                                                className="inline-flex min-h-10 flex-shrink-0 items-center gap-2 rounded-xl border border-blue-200 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-blue-700 dark:border-blue-900 dark:text-blue-300"
                                            >
                                                <DocumentTextIcon className="h-4 w-4" />
                                                Review {linkedEvidenceIds.length} evidence item{linkedEvidenceIds.length === 1 ? '' : 's'}
                                            </button>
                                        )}
                                    </div>
                                    {event.metadata && (
                                        <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                                            <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">Audit metadata</summary>
                                            <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words text-[9px] leading-relaxed text-slate-600 dark:text-slate-300">{JSON.stringify(event.metadata, null, 2)}</pre>
                                        </details>
                                    )}
                                </article>
                            );
                        }) : (
                            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-950/70">
                                <ClockIcon className="mx-auto h-9 w-9 text-slate-300" />
                                <h2 className="mt-3 text-base font-bold text-slate-900 dark:text-white">No audit event matches</h2>
                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Adjust the search, actor, or event-type filter.</p>
                            </div>
                        )}
                    </section>
                )}

                <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                    <div className="flex items-start gap-3">
                        <ChevronRightIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-700 dark:text-blue-300" />
                        <p className="text-xs leading-relaxed text-blue-900 dark:text-blue-100">
                            Source-backed corrections remain in Manage Records. Acknowledgments and proposal tasks are durable workflow evidence only; they never change the advisory evidence, prescribe treatment, or establish that an external action occurred.
                        </p>
                    </div>
                </section>
            </div>

            {evidenceDrawer && (
                <LocalEvidenceDrawer
                    record={record}
                    evidenceIds={evidenceDrawer.evidenceIds}
                    title={evidenceDrawer.title}
                    description={evidenceDrawer.description}
                    context={view === 'audit' ? 'audit-event' : 'validated-advisory'}
                    onClose={() => setEvidenceDrawer(null)}
                />
            )}
        </div>
    );
};

export default ValidatedRulesAuditWorkspace;
