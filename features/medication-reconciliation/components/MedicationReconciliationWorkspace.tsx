import React, { useMemo, useState } from 'react';
import {
    AlertTriangleIcon,
    ChevronRightIcon,
    DocumentTextIcon,
    DrugsIcon,
    ListChecksIcon,
    ShieldCheckIcon,
} from '../../../components/icons';
import { useAuditStore } from '../../audit/useAuditStore';
import DocumentSourcePreview from '../../clinical-record/components/DocumentSourcePreview';
import type {
    PatientClinicalRecord,
    SourceDocumentReference,
} from '../../clinical-record/types';
import { useClinicalRecordStore } from '../../clinical-record/useClinicalRecordStore';
import {
    buildMedicationReconciliationViewModel,
    createMedicationReconciliationTaskRecord,
    medicationReconciliationDecisionLabel,
} from '../reconciliation';
import type {
    MedicationReconciliationDecisionType,
    MedicationReconciliationIssue,
    MedicationReconciliationIssueSeverity,
} from '../types';

interface MedicationReconciliationWorkspaceProps {
    record: PatientClinicalRecord;
    onReviewCandidates: () => void;
}

type ReviewFilter = 'needs-attention' | 'reviewed' | 'all';

const DECISION_OPTIONS: Array<{
    value: MedicationReconciliationDecisionType;
    label: string;
    helper: string;
}> = [
    {
        value: 'keep-separate',
        label: 'Keep records separate',
        helper: 'The records describe distinct events or sources and should remain independently reviewable.',
    },
    {
        value: 'duplicate-needs-correction',
        label: 'Likely duplicate — correction required',
        helper: 'A separate human-authored correction or entered-in-error decision is still required in Manage Records.',
    },
    {
        value: 'record-correction-needed',
        label: 'One or more records need correction',
        helper: 'Status, directions, date, or other source-backed fields should be amended through Manage Records.',
    },
    {
        value: 'insufficient-evidence',
        label: 'Insufficient evidence — no record change',
        helper: 'The available sources do not justify changing either confirmed medication record.',
    },
    {
        value: 'reviewed-no-change',
        label: 'Reviewed — no change needed',
        helper: 'The apparent discrepancy is expected or already accurately represented by the separate records.',
    },
];

const severityClasses = (
    severity: MedicationReconciliationIssueSeverity,
): string => {
    if (severity === 'action-required') {
        return 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-200';
    }
    if (severity === 'review') {
        return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-200';
    }
    return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/25 dark:text-blue-200';
};

const resolutionLabel = (issue: MedicationReconciliationIssue): string => {
    if (!issue.requiresDecision) return 'Context only';
    if (issue.resolutionState === 'unreviewed') return 'Needs review';
    if (issue.resolutionState === 'action-pending') return 'Reviewed — action pending';
    return 'Reviewed';
};

const dateTimeLabel = (value: string): string => {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
        ? value
        : parsed.toLocaleString();
};

const MedicationReconciliationWorkspace: React.FC<MedicationReconciliationWorkspaceProps> = ({
    record,
    onReviewCandidates,
}) => {
    const logs = useAuditStore(state => state.logs);
    const auditActions = useAuditStore(state => state.actions);
    const clinicalActions = useClinicalRecordStore(state => state.actions);

    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<ReviewFilter>('needs-attention');
    const [activeIssueId, setActiveIssueId] = useState<string | null>(null);
    const [decision, setDecision] = useState<MedicationReconciliationDecisionType>(
        'reviewed-no-change',
    );
    const [reason, setReason] = useState('');
    const [createTask, setCreateTask] = useState(false);
    const [source, setSource] = useState<SourceDocumentReference | null>(null);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const viewModel = useMemo(
        () => buildMedicationReconciliationViewModel(record, logs),
        [logs, record],
    );

    const filteredIssues = useMemo(() => {
        const normalizedSearch = search.trim().toLocaleLowerCase();
        return viewModel.issues.filter(issue => {
            const matchesSearch = !normalizedSearch
                || issue.searchText.includes(normalizedSearch);
            if (!matchesSearch) return false;
            if (filter === 'reviewed') {
                return issue.requiresDecision
                    && issue.resolutionState === 'reviewed';
            }
            if (filter === 'needs-attention') {
                return issue.requiresDecision
                    && issue.resolutionState !== 'reviewed';
            }
            return true;
        });
    }, [filter, search, viewModel.issues]);

    const beginReview = (issue: MedicationReconciliationIssue): void => {
        setActiveIssueId(issue.id);
        setDecision(issue.decision?.decision || 'reviewed-no-change');
        setReason(issue.decision?.reason || '');
        setCreateTask(Boolean(issue.decision?.taskId));
        setFeedback(null);
        setError(null);
    };

    const cancelReview = (): void => {
        setActiveIssueId(null);
        setReason('');
        setCreateTask(false);
        setError(null);
    };

    const submitReview = (): void => {
        const issue = viewModel.issues.find(item => item.id === activeIssueId);
        const cleanReason = reason.trim();
        if (!issue) {
            setError('The reconciliation issue is no longer available.');
            return;
        }
        if (!cleanReason) {
            setError('A review reason is required before recording a reconciliation decision.');
            return;
        }

        const reviewedAt = new Date().toISOString();
        let taskId: string | undefined;
        let taskWarnings: string[] = [];

        if (createTask) {
            try {
                const taskResult = createMedicationReconciliationTaskRecord({
                    patientId: record.patientId,
                    issue,
                    decision,
                    reason: cleanReason,
                    createdAt: reviewedAt,
                    createdBy: 'Local user',
                });
                const write = clinicalActions.addResource(taskResult.task);
                if (!write.ok) {
                    setError(
                        write.message
                        || 'The local reconciliation follow-up task could not be saved.',
                    );
                    return;
                }
                taskId = taskResult.task.id;
                taskWarnings = taskResult.warnings;
                auditActions.logEvent(
                    'MEDICATION_RECONCILIATION_TASK_CREATED',
                    record.patientId,
                    'Created a local medication reconciliation follow-up task.',
                    'USER',
                    {
                        issueId: issue.id,
                        issueType: issue.type,
                        decision,
                        medicationName: issue.medicationName,
                        recordIds: issue.recordIds,
                        taskId,
                        warnings: taskWarnings,
                    },
                );
            } catch (taskError) {
                setError(
                    taskError instanceof Error
                        ? taskError.message
                        : 'The reconciliation task could not be created.',
                );
                return;
            }
        }

        const decisionLabel = medicationReconciliationDecisionLabel(decision);
        auditActions.logEvent(
            'MEDICATION_RECONCILIATION_REVIEWED',
            record.patientId,
            'Recorded a human medication reconciliation review decision without automatically changing medication records.',
            'USER',
            {
                issueId: issue.id,
                fingerprint: issue.fingerprint,
                issueType: issue.type,
                decision,
                decisionLabel,
                reason: cleanReason,
                medicationName: issue.medicationName,
                recordIds: issue.recordIds,
                sourceLabels: issue.records.map(item => item.sourceLabel),
                reviewedAt,
                reviewedBy: 'Local user',
                ...(taskId ? { taskId } : {}),
            },
        );

        setFeedback([
            `${decisionLabel} recorded for ${issue.medicationName}.`,
            taskId ? `Follow-up task ${taskId} was created.` : '',
            taskWarnings.length > 0
                ? `Task warnings: ${taskWarnings.join(' ')}`
                : '',
            'No medication status, directions, dates, or confirmed facts were changed.',
        ].filter(Boolean).join(' '));
        setActiveIssueId(null);
        setReason('');
        setCreateTask(false);
        setError(null);
    };

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-5 md:px-6 md:py-7">
                <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                    <div className="grid gap-5 p-5 md:grid-cols-[1.4fr_1fr] md:p-7">
                        <div>
                            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-purple-600 dark:text-purple-300">
                                Human review workspace
                            </p>
                            <h1 className="mt-2 text-2xl font-display font-bold tracking-tight text-slate-950 dark:text-white md:text-3xl">
                                Medication reconciliation
                            </h1>
                            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                Compare confirmed medication statements, requests, and administrations while preserving every source. Detected differences are review questions, not automatic proof that a record is wrong or that one source is authoritative.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-purple-100 bg-purple-50/70 p-4 dark:border-purple-900/50 dark:bg-purple-950/25">
                            <div className="flex items-center gap-2 text-purple-800 dark:text-purple-200">
                                <ShieldCheckIcon className="h-5 w-5" />
                                <h2 className="text-sm font-bold">No automatic medication changes</h2>
                            </div>
                            <p className="mt-2 text-xs leading-relaxed text-purple-800/75 dark:text-purple-200/70">
                                Recording a reconciliation decision writes workflow audit evidence only. Status, dose, route, frequency, dates, and active use change only through an explicit human correction in Manage Records.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
                    {[
                        ['Confirmed meds', viewModel.medicationCount],
                        ['Medication groups', viewModel.groupCount],
                        ['Unreviewed', viewModel.unreviewedCount],
                        ['Action pending', viewModel.actionPendingCount],
                        ['Reviewed', viewModel.reviewedCount],
                        ['Possible duplicates', viewModel.possibleDuplicateCount],
                        ['Conflicts', viewModel.conflictCount],
                        ['Missing info', viewModel.missingInformationCount],
                    ].map(([label, value]) => (
                        <div
                            key={label}
                            className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80"
                        >
                            <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                {label}
                            </p>
                            <p className="mt-2 text-xl font-display font-bold text-slate-900 dark:text-white">
                                {value}
                            </p>
                        </div>
                    ))}
                </section>

                {viewModel.candidateMedicationCount > 0 && (
                    <section className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/25 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-300" />
                            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                                {viewModel.candidateMedicationCount} medication candidate{viewModel.candidateMedicationCount === 1 ? '' : 's'} remain excluded from reconciliation because they are not confirmed facts.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onReviewCandidates}
                            className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
                        >
                            Review candidates
                        </button>
                    </section>
                )}

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                        <label className="min-w-0 flex-1">
                            <span className="mb-1 block text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                Search reconciliation evidence
                            </span>
                            <input
                                type="search"
                                value={search}
                                onChange={event => setSearch(event.target.value)}
                                placeholder="Medication, status, directions, source, record ID, or review reason"
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-purple-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                        </label>
                        <label className="w-full lg:w-60">
                            <span className="mb-1 block text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                Review state
                            </span>
                            <select
                                value={filter}
                                onChange={event => setFilter(event.target.value as ReviewFilter)}
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-purple-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            >
                                <option value="needs-attention">Needs attention</option>
                                <option value="reviewed">Reviewed and closed</option>
                                <option value="all">All detected evidence</option>
                            </select>
                        </label>
                    </div>
                </section>

                {feedback && (
                    <div
                        role="status"
                        className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs leading-relaxed text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-200"
                    >
                        {feedback}
                    </div>
                )}

                {viewModel.medicationCount === 0 ? (
                    <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-950/80">
                        <DrugsIcon className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
                        <h2 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">
                            No confirmed medication records to reconcile
                        </h2>
                        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                            This does not prove that the patient takes no medication. Confirm source-backed medication candidates or add reviewed records before using reconciliation.
                        </p>
                    </section>
                ) : filteredIssues.length === 0 ? (
                    <section className="rounded-3xl border border-dashed border-emerald-300 bg-emerald-50/60 p-8 text-center dark:border-emerald-900/60 dark:bg-emerald-950/20">
                        <ShieldCheckIcon className="mx-auto h-10 w-10 text-emerald-500" />
                        <h2 className="mt-3 text-lg font-bold text-emerald-900 dark:text-emerald-100">
                            No reconciliation items match this view
                        </h2>
                        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-emerald-800/70 dark:text-emerald-200/70">
                            No tracked issue is visible under the current filter. This does not establish medication-list completeness, adherence, regimen safety, or prescribing intent.
                        </p>
                    </section>
                ) : (
                    <div className="space-y-4">
                        {filteredIssues.map(issue => (
                            <article
                                key={issue.id}
                                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/80"
                            >
                                <div className="p-4 md:p-5">
                                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <span className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border ${severityClasses(issue.severity)}`}>
                                                {issue.severity === 'information'
                                                    ? <DocumentTextIcon className="h-4 w-4" />
                                                    : <AlertTriangleIcon className="h-4 w-4" />}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-[9px] font-mono font-bold uppercase tracking-[0.16em] text-purple-600 dark:text-purple-300">
                                                    {issue.medicationName}
                                                </p>
                                                <h2 className="mt-1 text-base font-bold text-slate-950 dark:text-white">
                                                    {issue.title}
                                                </h2>
                                                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                                    {issue.description}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${severityClasses(issue.severity)}`}>
                                                {issue.severity.replace(/-/g, ' ')}
                                            </span>
                                            <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide ${issue.resolutionState === 'reviewed'
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                                : issue.resolutionState === 'action-pending'
                                                    ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                            }`}>
                                                {resolutionLabel(issue)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                        {issue.records.map(recordItem => (
                                            <section
                                                key={recordItem.id}
                                                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                            {recordItem.name}
                                                        </p>
                                                        <p className="mt-1 text-[10px] font-mono uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                                            {recordItem.kindLabel} · {recordItem.statusLabel}
                                                        </p>
                                                    </div>
                                                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                        {recordItem.evidenceId}
                                                    </span>
                                                </div>

                                                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                                                    <div>
                                                        <dt className="text-[9px] font-mono font-bold uppercase text-slate-400">Directions</dt>
                                                        <dd className="mt-0.5 leading-relaxed text-slate-700 dark:text-slate-200">
                                                            {recordItem.dosageText.join('; ') || 'Not recorded'}
                                                        </dd>
                                                    </div>
                                                    <div>
                                                        <dt className="text-[9px] font-mono font-bold uppercase text-slate-400">Clinical dates</dt>
                                                        <dd className="mt-0.5 leading-relaxed text-slate-700 dark:text-slate-200">
                                                            Start: {recordItem.startLabel}<br />
                                                            End: {recordItem.endLabel}<br />
                                                            Effective: {recordItem.effectiveLabel}
                                                        </dd>
                                                    </div>
                                                    <div>
                                                        <dt className="text-[9px] font-mono font-bold uppercase text-slate-400">Source</dt>
                                                        <dd className="mt-0.5 leading-relaxed text-slate-700 dark:text-slate-200">
                                                            {recordItem.sourceLabel}
                                                        </dd>
                                                    </div>
                                                    <div>
                                                        <dt className="text-[9px] font-mono font-bold uppercase text-slate-400">History</dt>
                                                        <dd className="mt-0.5 leading-relaxed text-slate-700 dark:text-slate-200">
                                                            {recordItem.amendmentCount} amendment{recordItem.amendmentCount === 1 ? '' : 's'}
                                                            {recordItem.prescriber ? ` · Prescriber ${recordItem.prescriber}` : ''}
                                                        </dd>
                                                    </div>
                                                </dl>

                                                {recordItem.sourceDocument && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setSource(recordItem.sourceDocument!)}
                                                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 transition-colors hover:border-purple-300 hover:text-purple-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                                                    >
                                                        <DocumentTextIcon className="h-3.5 w-3.5" />
                                                        View original source
                                                    </button>
                                                )}
                                            </section>
                                        ))}
                                    </div>

                                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                            Evidence-backed review questions
                                        </p>
                                        <ul className="mt-2 space-y-1.5">
                                            {issue.questions.map(question => (
                                                <li
                                                    key={question}
                                                    className="flex items-start gap-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300"
                                                >
                                                    <ChevronRightIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-purple-500" />
                                                    {question}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {issue.decision && (
                                        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/25">
                                            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                                                <ShieldCheckIcon className="h-4 w-4" />
                                                <p className="text-xs font-bold">
                                                    {issue.decision.decisionLabel}
                                                </p>
                                            </div>
                                            <p className="mt-2 text-xs leading-relaxed text-emerald-800/80 dark:text-emerald-200/80">
                                                {issue.decision.reason}
                                            </p>
                                            <p className="mt-2 text-[9px] font-mono uppercase tracking-wide text-emerald-700/70 dark:text-emerald-300/70">
                                                Reviewed {dateTimeLabel(issue.decision.reviewedAt)}
                                                {issue.decision.reviewedBy
                                                    ? ` by ${issue.decision.reviewedBy}`
                                                    : ''}
                                                {issue.decision.taskId
                                                    ? ` · Task ${issue.decision.taskId}`
                                                    : ''}
                                            </p>
                                        </div>
                                    )}

                                    {issue.requiresDecision && activeIssueId !== issue.id && (
                                        <button
                                            type="button"
                                            onClick={() => beginReview(issue)}
                                            className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-md shadow-purple-500/20 transition-colors hover:bg-purple-500"
                                        >
                                            <ListChecksIcon className="h-4 w-4" />
                                            {issue.decision ? 'Update review decision' : 'Review discrepancy'}
                                        </button>
                                    )}

                                    {activeIssueId === issue.id && (
                                        <div className="mt-4 rounded-2xl border border-purple-200 bg-purple-50/60 p-4 dark:border-purple-900/60 dark:bg-purple-950/20">
                                            <h3 className="text-sm font-bold text-purple-950 dark:text-purple-100">
                                                Record a human reconciliation decision
                                            </h3>
                                            <p className="mt-1 text-xs leading-relaxed text-purple-800/75 dark:text-purple-200/70">
                                                This decision does not edit medication facts. Use Manage Records separately for any source-backed correction.
                                            </p>

                                            <label className="mt-4 block">
                                                <span className="mb-1 block text-[9px] font-mono font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                                                    Decision
                                                </span>
                                                <select
                                                    value={decision}
                                                    onChange={event => setDecision(
                                                        event.target.value as MedicationReconciliationDecisionType,
                                                    )}
                                                    className="w-full rounded-xl border border-purple-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-purple-500 dark:border-purple-800 dark:bg-slate-950 dark:text-white"
                                                >
                                                    {DECISION_OPTIONS.map(option => (
                                                        <option key={option.value} value={option.value}>
                                                            {option.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <span className="mt-1 block text-[10px] leading-relaxed text-purple-700/70 dark:text-purple-300/70">
                                                    {DECISION_OPTIONS.find(option => option.value === decision)?.helper}
                                                </span>
                                            </label>

                                            <label className="mt-3 block">
                                                <span className="mb-1 block text-[9px] font-mono font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                                                    Required reason
                                                </span>
                                                <textarea
                                                    value={reason}
                                                    onChange={event => setReason(event.target.value)}
                                                    rows={3}
                                                    placeholder="State what was reviewed, which source supports the decision, and what remains unknown."
                                                    className="w-full resize-y rounded-xl border border-purple-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-900 outline-none focus:border-purple-500 dark:border-purple-800 dark:bg-slate-950 dark:text-white"
                                                />
                                            </label>

                                            <label className="mt-3 flex items-start gap-2 rounded-xl border border-purple-100 bg-white/70 p-3 text-xs leading-relaxed text-purple-900 dark:border-purple-900/60 dark:bg-slate-950/60 dark:text-purple-100">
                                                <input
                                                    type="checkbox"
                                                    checked={createTask}
                                                    onChange={event => setCreateTask(event.target.checked)}
                                                    className="mt-0.5 h-4 w-4"
                                                />
                                                <span>
                                                    Create a local follow-up task. The task has proposal intent, no due date unless one is added later, and is not a prescription or order.
                                                </span>
                                            </label>

                                            {error && (
                                                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
                                                    {error}
                                                </div>
                                            )}

                                            <div className="mt-4 flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={submitReview}
                                                    className="rounded-xl bg-purple-600 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-purple-500"
                                                >
                                                    Save review decision
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={cancelReview}
                                                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </article>
                        ))}
                    </div>
                )}

                <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/60 dark:bg-blue-950/25">
                    <div className="flex items-start gap-3">
                        <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-300" />
                        <p className="text-xs leading-relaxed text-blue-800 dark:text-blue-200">
                            This workspace does not determine adherence, prescribing intent, discontinuation, dose appropriateness, interaction safety, renal or liver adjustment, pregnancy suitability, or whether a medication should be started or stopped. It organizes discrepancies for source review and human correction.
                        </p>
                    </div>
                </section>
            </div>

            {source && (
                <DocumentSourcePreview
                    patientId={record.patientId}
                    source={source}
                    onClose={() => setSource(null)}
                />
            )}
        </div>
    );
};

export default MedicationReconciliationWorkspace;
