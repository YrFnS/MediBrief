import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIcon,
    AlertTriangleIcon,
    ClockIcon,
    DocumentTextIcon,
    ListChecksIcon,
    ShieldCheckIcon,
} from '../../../components/icons';
import { MODEL_CONFIGS } from '../../../constants';
import { ChatMode } from '../../../types';
import { useAuditStore } from '../../audit/useAuditStore';
import DocumentSourcePreview from '../../clinical-record/components/DocumentSourcePreview';
import type {
    PatientClinicalRecord,
    SourceDocumentReference,
} from '../../clinical-record/types';
import { useClinicalRecordStore } from '../../clinical-record/useClinicalRecordStore';
import {
    finalizeTrendModelExplanation,
    buildTrendGroundingRequest,
} from '../grounding';
import { generateTrendModelExplanationText } from '../modelExplanation';
import {
    buildExplicitReminderViewModel,
    createReminderFollowUpTaskRecord,
} from '../reminders';
import {
    buildDeterministicTrendViewModel,
    trendExplanationMatchesSearch,
} from '../trends';
import type {
    DeterministicTrendExplanation,
    ExplicitReminderItem,
    ExplicitReminderState,
} from '../types';
import { AIProvider, useSettingsStore } from '../../settings/useSettingsStore';
import { StatusBadge } from '../../personal-health-record/components/CoreModulePrimitives';

interface TrendAndReminderWorkspaceProps {
    record: PatientClinicalRecord;
    onReviewCandidates: () => void;
}

type WorkspaceView = 'trends' | 'reminders';

interface ModelOutputState {
    loading?: boolean;
    accepted?: boolean;
    text?: string;
    error?: string;
}

const formatNumber = (value: number): string => new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 6,
}).format(value);

const reminderTone = (
    state: ExplicitReminderState,
): 'positive' | 'warning' | 'info' | 'neutral' => {
    if (state === 'completed') return 'positive';
    if (state === 'overdue' || state === 'due-today') return 'warning';
    if (state === 'upcoming' || state === 'later') return 'info';
    return 'neutral';
};

const sourceTypeLabel = (reminder: ExplicitReminderItem): string => {
    switch (reminder.sourceType) {
        case 'appointment': return 'Appointment';
        case 'task': return 'Task';
        case 'care-plan': return 'Care plan';
        case 'medication': return 'Medication date';
        case 'validated-advisory': return 'Reviewed advisory task';
    }
};

const MetricCard: React.FC<{
    label: string;
    value: number;
    helper: string;
    warning?: boolean;
}> = ({ label, value, helper, warning = false }) => (
    <div className={`rounded-2xl border p-4 ${warning
        ? 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20'
        : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/80'
    }`}>
        <p className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-slate-400">
            {label}
        </p>
        <p className="mt-1 text-2xl font-display font-bold text-slate-950 dark:text-white">
            {value}
        </p>
        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
            {helper}
        </p>
    </div>
);

const TrendCard: React.FC<{
    record: PatientClinicalRecord;
    explanation: DeterministicTrendExplanation;
    providerReady: boolean;
    modelOutput?: ModelOutputState;
    onOpenSource: (source: SourceDocumentReference) => void;
    onGenerateModelWording: (explanation: DeterministicTrendExplanation) => void;
    onCancelModelWording: () => void;
}> = ({
    explanation,
    providerReady,
    modelOutput,
    onOpenSource,
    onGenerateModelWording,
    onCancelModelWording,
}) => (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
        <div className="p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <ActivityIcon className="h-5 w-5" />
                        </span>
                        <div>
                            <h3 className="text-lg font-bold text-slate-950 dark:text-white">
                                {explanation.name}
                            </h3>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                {explanation.pointCount} eligible exact-day points · {explanation.unit}
                            </p>
                        </div>
                        {explanation.loincCode && (
                            <StatusBadge tone="info">LOINC {explanation.loincCode}</StatusBadge>
                        )}
                        <StatusBadge>{explanation.groupingBasis.replace(/-/g, ' ')}</StatusBadge>
                    </div>
                    <p className="mt-3 max-w-3xl text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {explanation.specimenLabel
                            ? `Specimen context: ${explanation.specimenLabel}. `
                            : 'Specimen context is not recorded. '}
                        This card describes recorded arithmetic only and does not determine clinical significance.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {modelOutput?.loading ? (
                        <button
                            type="button"
                            onClick={onCancelModelWording}
                            className="min-h-10 rounded-xl border border-red-200 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-red-700 dark:border-red-900 dark:text-red-300"
                        >
                            Cancel wording
                        </button>
                    ) : (
                        <button
                            type="button"
                            disabled={!providerReady}
                            onClick={() => onGenerateModelWording(explanation)}
                            className="min-h-10 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-blue-700 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300"
                            title={providerReady
                                ? 'Generate optional citation-gated wording without web tools'
                                : 'Configure an AI provider key to use optional model wording'}
                        >
                            Optional model wording
                        </button>
                    )}
                </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
                    <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">First</p>
                    <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                        {formatNumber(explanation.firstPoint.value)} {explanation.unit}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">{explanation.firstPoint.dateLabel}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
                    <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Last</p>
                    <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                        {formatNumber(explanation.lastPoint.value)} {explanation.unit}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">{explanation.lastPoint.dateLabel}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
                    <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Recorded direction</p>
                    <p className="mt-1 text-sm font-bold capitalize text-slate-900 dark:text-white">
                        {explanation.direction}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">
                        Difference {formatNumber(explanation.absoluteChange)} {explanation.unit}
                    </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
                    <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Date span</p>
                    <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                        {explanation.elapsedDays} day{explanation.elapsedDays === 1 ? '' : 's'}
                    </p>
                    <p className="mt-1 text-[10px] text-slate-500">Exact-day points only</p>
                </div>
            </div>

            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                    Deterministic description · no AI required
                </p>
                <ul className="mt-2 space-y-2 text-xs leading-relaxed text-blue-950 dark:text-blue-100">
                    {explanation.deterministicStatements.map(statement => (
                        <li key={statement}>• {statement}</li>
                    ))}
                </ul>
            </div>

            <details className="mt-4 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <summary className="cursor-pointer text-xs font-bold text-slate-900 dark:text-white">
                    Included plotted points and source evidence
                </summary>
                <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-xs">
                        <thead className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                            <tr>
                                <th className="pb-2 pr-3">Date</th>
                                <th className="pb-2 pr-3">Plotted value</th>
                                <th className="pb-2 pr-3">Original source value</th>
                                <th className="pb-2 pr-3">Normalized view</th>
                                <th className="pb-2 pr-3">Evidence</th>
                                <th className="pb-2">Source</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {explanation.points.map(point => (
                                <tr key={point.observationId}>
                                    <td className="py-3 pr-3 font-semibold text-slate-800 dark:text-slate-100">{point.dateLabel}</td>
                                    <td className="py-3 pr-3">{formatNumber(point.value)} {point.unit}</td>
                                    <td className="py-3 pr-3">{point.originalValueLabel}</td>
                                    <td className="py-3 pr-3">{point.normalizedValueLabel || 'Not used'}</td>
                                    <td className="py-3 pr-3 font-mono text-[10px]">{point.evidenceId}</td>
                                    <td className="py-3">
                                        {point.source ? (
                                            <button
                                                type="button"
                                                onClick={() => onOpenSource(point.source!)}
                                                className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-blue-200 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-blue-700 dark:border-blue-900 dark:text-blue-300"
                                            >
                                                <DocumentTextIcon className="h-3.5 w-3.5" />
                                                Original{point.source.pageNumber ? ` p.${point.source.pageNumber}` : ''}
                                            </button>
                                        ) : 'No local document link'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </details>

            {(explanation.matchingExclusions.length > 0
                || explanation.unitConflictMessages.length > 0) && (
                <details className="mt-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <summary className="cursor-pointer text-xs font-bold text-amber-900 dark:text-amber-100">
                        Excluded matching evidence and unit conflicts
                    </summary>
                    <div className="mt-3 space-y-2 text-[10px] leading-relaxed text-amber-800 dark:text-amber-200">
                        {explanation.matchingExclusions.map(item => (
                            <p key={`${item.observationId}-${item.reason}`}>
                                {item.observationId} · {item.reason}: {item.message}
                            </p>
                        ))}
                        {explanation.unitConflictMessages.map(message => (
                            <p key={message}>{message}</p>
                        ))}
                    </div>
                </details>
            )}

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                <p className="font-bold">Interpretation boundary</p>
                {explanation.limitations.map(limit => (
                    <p key={limit} className="mt-1">• {limit}</p>
                ))}
            </div>

            {modelOutput && !modelOutput.loading && (
                <div className={`mt-4 rounded-2xl border p-4 ${modelOutput.accepted
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                    : 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20'
                }`}>
                    <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-500">
                        Citation-gated model wording
                    </p>
                    {modelOutput.error ? (
                        <p className="mt-2 text-xs text-red-700 dark:text-red-300">{modelOutput.error}</p>
                    ) : (
                        <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-800 dark:text-slate-100">
                            {modelOutput.text}
                        </pre>
                    )}
                </div>
            )}
        </div>
    </article>
);

const ReminderCard: React.FC<{
    reminder: ExplicitReminderItem;
    taskDraft?: string;
    taskNotice?: string;
    onOpenSource: (source: SourceDocumentReference) => void;
    onStartTask: (reminderId: string) => void;
    onCancelTask: () => void;
    onTaskReasonChange: (value: string) => void;
    onCreateTask: (reminder: ExplicitReminderItem) => void;
}> = ({
    reminder,
    taskDraft,
    taskNotice,
    onOpenSource,
    onStartTask,
    onCancelTask,
    onTaskReasonChange,
    onCreateTask,
}) => (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 md:p-5">
        <div className="flex items-start gap-3">
            <span className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${reminder.state === 'overdue' || reminder.state === 'due-today'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
            }`}>
                <ClockIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                        {reminder.title}
                    </h3>
                    <StatusBadge tone={reminderTone(reminder.state)}>
                        {reminder.stateLabel}
                    </StatusBadge>
                    <StatusBadge>{sourceTypeLabel(reminder)}</StatusBadge>
                    <StatusBadge>{reminder.sourceStatus.replace(/-/g, ' ')}</StatusBadge>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {reminder.description || 'No additional source description is recorded.'}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Source date</p>
                        <p className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-100">{reminder.dateLabel}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Evidence</p>
                        <p className="mt-1 break-all font-mono text-[10px] text-slate-700 dark:text-slate-200">{reminder.evidenceId}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Source</p>
                        <p className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-100">{reminder.sourceLabel}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Date precision</p>
                        <p className="mt-1 text-xs font-bold capitalize text-slate-800 dark:text-slate-100">{reminder.datePrecision}</p>
                    </div>
                </div>
                <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                    {reminder.timingMeaning} {reminder.actionBoundary}
                </p>
                {reminder.warnings.map(warning => (
                    <p key={warning} className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                        {warning}
                    </p>
                ))}
                <div className="mt-3 flex flex-wrap gap-2">
                    {reminder.sourceDocument && (
                        <button
                            type="button"
                            onClick={() => onOpenSource(reminder.sourceDocument!)}
                            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-blue-200 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:border-blue-900 dark:text-blue-300"
                        >
                            <DocumentTextIcon className="h-4 w-4" />
                            View original source
                        </button>
                    )}
                    {reminder.existingFollowUpTaskId && (
                        <StatusBadge tone="positive">
                            Follow-up task {reminder.existingFollowUpTaskId} exists
                        </StatusBadge>
                    )}
                    {reminder.canCreateFollowUpTask && taskDraft === undefined && (
                        <button
                            type="button"
                            onClick={() => onStartTask(reminder.id)}
                            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white dark:bg-white dark:text-slate-950"
                        >
                            <ListChecksIcon className="h-4 w-4" />
                            Create local review task
                        </button>
                    )}
                </div>

                {taskDraft !== undefined && (
                    <div className="mt-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                        <label className="block">
                            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                                Required review reason
                            </span>
                            <textarea
                                value={taskDraft}
                                onChange={event => onTaskReasonChange(event.target.value)}
                                rows={3}
                                className="mt-2 w-full rounded-xl border border-blue-200 bg-white p-3 text-xs outline-none focus:border-blue-500 dark:border-blue-900 dark:bg-slate-950 dark:text-white"
                                placeholder="Why should this local follow-up task be created?"
                            />
                        </label>
                        <p className="mt-2 text-[10px] text-blue-800 dark:text-blue-200">
                            The task is a routine local proposal. It does not send a notification, contact a clinic, place an order, or instruct medication changes.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => onCreateTask(reminder)}
                                disabled={!taskDraft.trim()}
                                className="min-h-10 rounded-xl bg-blue-600 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Save proposal task
                            </button>
                            <button
                                type="button"
                                onClick={onCancelTask}
                                className="min-h-10 rounded-xl border border-slate-300 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-700 dark:text-slate-300"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
                {taskNotice && (
                    <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[10px] text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">
                        {taskNotice}
                    </p>
                )}
            </div>
        </div>
    </article>
);

const TrendAndReminderWorkspace: React.FC<TrendAndReminderWorkspaceProps> = ({
    record,
    onReviewCandidates,
}) => {
    const [view, setView] = useState<WorkspaceView>('trends');
    const [search, setSearch] = useState('');
    const [reminderState, setReminderState] = useState<ExplicitReminderState | 'all'>('all');
    const [source, setSource] = useState<SourceDocumentReference | null>(null);
    const [modelOutputs, setModelOutputs] = useState<Record<string, ModelOutputState>>({});
    const [taskDraft, setTaskDraft] = useState<{ reminderId: string; reason: string } | null>(null);
    const [taskNotices, setTaskNotices] = useState<Record<string, string>>({});
    const modelAbortRef = useRef<AbortController | null>(null);
    const auditActions = useAuditStore(state => state.actions);
    const addResource = useClinicalRecordStore(state => state.actions.addResource);
    const {
        provider,
        geminiApiKey,
        openRouterApiKey,
        customModels,
    } = useSettingsStore();
    const referenceDate = useMemo(() => new Date(), [record.updatedAt]);
    const trends = useMemo(
        () => buildDeterministicTrendViewModel(record),
        [record],
    );
    const reminders = useMemo(
        () => buildExplicitReminderViewModel(record, {
            referenceDate,
            search,
            state: reminderState,
        }),
        [record, referenceDate, reminderState, search],
    );
    const visibleTrends = trends.explanations.filter(explanation =>
        trendExplanationMatchesSearch(explanation, search));
    const apiKey = provider === AIProvider.Gemini
        ? geminiApiKey || process.env.API_KEY || ''
        : openRouterApiKey;
    const model = customModels[ChatMode.Standard]
        || MODEL_CONFIGS[ChatMode.Standard]?.model
        || 'gemini-flash-lite-latest';
    const providerReady = Boolean(apiKey.trim() && model.trim());

    useEffect(() => () => modelAbortRef.current?.abort(), []);

    const handleGenerateModelWording = async (
        explanation: DeterministicTrendExplanation,
    ): Promise<void> => {
        modelAbortRef.current?.abort();
        const controller = new AbortController();
        modelAbortRef.current = controller;
        setModelOutputs(current => ({
            ...current,
            [explanation.seriesKey]: { loading: true },
        }));

        try {
            const request = buildTrendGroundingRequest({
                record,
                explanation,
            });
            auditActions.logEvent(
                'TREND_GROUNDING_BUNDLE_GENERATED',
                record.patientId,
                'Selected only Phase 4-eligible plotted points for an optional trend explanation.',
                'SYSTEM',
                {
                    seriesKey: explanation.seriesKey,
                    seriesName: explanation.name,
                    selectedEvidence: request.bundle.selection.selected,
                    evidenceIds: explanation.points.map(point => point.evidenceId),
                },
            );
            const rawText = await generateTrendModelExplanationText({
                prompt: request.prompt,
                provider,
                apiKey,
                model,
                signal: controller.signal,
            });
            const result = finalizeTrendModelExplanation(rawText, request);
            setModelOutputs(current => ({
                ...current,
                [explanation.seriesKey]: {
                    loading: false,
                    accepted: result.finalization.accepted,
                    text: result.finalization.displayText,
                },
            }));
            auditActions.logEvent(
                result.finalization.accepted
                    ? 'TREND_ASSISTANT_COMPLETED'
                    : 'TREND_ASSISTANT_REJECTED',
                record.patientId,
                result.finalization.accepted
                    ? 'Completed optional citation-gated wording for a deterministic trend.'
                    : 'Withheld optional trend wording that failed the local citation gate.',
                'AI',
                {
                    seriesKey: explanation.seriesKey,
                    seriesName: explanation.name,
                    status: result.finalization.status,
                    citedEvidenceCount: result.finalization.citedEvidenceCount,
                    referencedEvidenceIds:
                        result.finalization.assessment?.referencedEvidenceIds || [],
                },
            );
        } catch (error) {
            const cancelled = error instanceof DOMException
                && error.name === 'AbortError';
            const message = cancelled
                ? 'Optional model wording was cancelled.'
                : error instanceof Error
                    ? error.message
                    : 'Optional model wording failed.';
            setModelOutputs(current => ({
                ...current,
                [explanation.seriesKey]: {
                    loading: false,
                    accepted: false,
                    error: message,
                },
            }));
            auditActions.logEvent(
                'TREND_ASSISTANT_REJECTED',
                record.patientId,
                cancelled
                    ? 'Optional trend wording was cancelled.'
                    : 'Optional trend wording failed before citation validation.',
                'AI',
                {
                    seriesKey: explanation.seriesKey,
                    seriesName: explanation.name,
                    reason: cancelled ? 'cancelled' : 'provider-error',
                    error: message,
                },
            );
        } finally {
            if (modelAbortRef.current === controller) {
                modelAbortRef.current = null;
            }
        }
    };

    const handleCreateTask = (reminder: ExplicitReminderItem): void => {
        if (!taskDraft || taskDraft.reminderId !== reminder.id) return;
        try {
            const result = createReminderFollowUpTaskRecord({
                patientId: record.patientId,
                reminder,
                reason: taskDraft.reason,
                createdBy: 'USER',
            });
            const write = addResource(result.task);
            if (!write.ok) {
                throw new Error(write.message || 'The local proposal task could not be saved.');
            }
            auditActions.logEvent(
                'REMINDER_TASK_CREATED',
                record.patientId,
                'Created a local proposal task from an explicit record-derived reminder.',
                'USER',
                {
                    reminderId: reminder.id,
                    reminderState: reminder.state,
                    sourceResourceType: reminder.resourceType,
                    sourceResourceId: reminder.resourceId,
                    taskId: result.task.id,
                    copiedExactDate: result.task.due
                        && 'precision' in result.task.due
                        && result.task.due.precision === 'day'
                        ? result.task.due.value
                        : null,
                    warnings: result.warnings,
                },
            );
            setTaskNotices(current => ({
                ...current,
                [reminder.id]: [
                    `Local proposal task ${result.task.id} was saved.`,
                    ...result.warnings,
                    'No notification, booking, order, prescription, or external action was sent.',
                ].join(' '),
            }));
            setTaskDraft(null);
        } catch (error) {
            setTaskNotices(current => ({
                ...current,
                [reminder.id]: error instanceof Error
                    ? error.message
                    : 'The local proposal task could not be created.',
            }));
        }
    };

    const candidateCount = trends.candidateCount + reminders.candidateCount;

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 md:px-6 md:py-7">
                <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 md:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">
                                Grounded assistance
                            </p>
                            <h1 className="mt-2 text-2xl font-display font-bold text-slate-950 dark:text-white">
                                Recorded trends and explicit reminders
                            </h1>
                            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                Trend descriptions consume only Phase 4-eligible current points. Reminders derive only from confirmed appointments, tasks, care plans, medication dates, and reviewed advisory tasks.
                            </p>
                        </div>
                        {candidateCount > 0 && (
                            <button
                                type="button"
                                onClick={onReviewCandidates}
                                className="min-h-11 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white"
                            >
                                Review {candidateCount} excluded candidate{candidateCount === 1 ? '' : 's'}
                            </button>
                        )}
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        <MetricCard label="Trend series" value={trends.seriesCount} helper="two or more comparable points" />
                        <MetricCard label="Plotted points" value={trends.pointCount} helper="confirmed exact-day quantities" />
                        <MetricCard label="Excluded results" value={trends.exclusionCount} helper="remain visible outside explanations" warning={trends.exclusionCount > 0} />
                        <MetricCard label="Open reminders" value={reminders.openCount} helper="derived from durable source fields" />
                        <MetricCard label="Due / overdue" value={reminders.actionableCount} helper="no notification is sent" warning={reminders.actionableCount > 0} />
                    </div>
                </header>

                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/25">
                    <div className="flex items-start gap-3">
                        <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-300" />
                        <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-100">
                            These features organize recorded evidence. They do not diagnose change, determine urgency, recommend treatment, verify medication safety, send notifications, contact a clinic, or prove that an action was completed.
                        </p>
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <label className="flex-1">
                            <span className="sr-only">Search trends and reminders</span>
                            <input
                                type="search"
                                value={search}
                                onChange={event => setSearch(event.target.value)}
                                placeholder="Search test, value, date, reminder, source, status, or evidence ID"
                                className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                        </label>
                        <div className="flex rounded-xl border border-slate-200 p-1 dark:border-slate-700" role="tablist" aria-label="Trend and reminder views">
                            {([
                                ['trends', 'Trend explanations'],
                                ['reminders', 'Explicit reminders'],
                            ] as Array<[WorkspaceView, string]>).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    role="tab"
                                    aria-selected={view === value}
                                    onClick={() => setView(value)}
                                    className={`min-h-10 rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wider ${view === value
                                        ? 'bg-blue-600 text-white'
                                        : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {view === 'trends' && (
                    <section className="space-y-4" aria-label="Deterministic trend explanations">
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                            <div className="flex items-start gap-3">
                                <ShieldCheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-700 dark:text-emerald-300" />
                                <p className="text-xs leading-relaxed text-emerald-900 dark:text-emerald-100">
                                    The deterministic description works without AI. Optional model wording receives only the selected plotted points, uses no web tools or prior chat, remains hidden until citations validate, and is withheld unless every plotted point is cited.
                                </p>
                            </div>
                        </div>
                        {visibleTrends.length > 0 ? visibleTrends.map(explanation => (
                            <TrendCard
                                key={explanation.seriesKey}
                                record={record}
                                explanation={explanation}
                                providerReady={providerReady}
                                modelOutput={modelOutputs[explanation.seriesKey]}
                                onOpenSource={setSource}
                                onGenerateModelWording={handleGenerateModelWording}
                                onCancelModelWording={() => modelAbortRef.current?.abort()}
                            />
                        )) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                                <ActivityIcon className="mx-auto h-8 w-8 text-slate-300" />
                                <p className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-100">No eligible trend explanation matches</p>
                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                    This does not mean no results exist. Comparator, qualitative, superseded, undated, partial-date, single-point, and incompatible-unit evidence remains outside eligible series.
                                </p>
                            </div>
                        )}
                    </section>
                )}

                {view === 'reminders' && (
                    <section className="space-y-4" aria-label="Explicit record-derived reminders">
                        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/80 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Reminder state</p>
                                <select
                                    value={reminderState}
                                    onChange={event => setReminderState(event.target.value as ExplicitReminderState | 'all')}
                                    className="mt-1 min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                                >
                                    <option value="all">All states</option>
                                    <option value="overdue">Recorded date passed</option>
                                    <option value="due-today">Due today</option>
                                    <option value="upcoming">Upcoming within 7 days</option>
                                    <option value="later">Scheduled later</option>
                                    <option value="unknown-date">Date unknown or imprecise</option>
                                    <option value="unscheduled">Unscheduled</option>
                                    <option value="completed">Recorded completed</option>
                                    <option value="cancelled">Recorded cancelled / closed</option>
                                </select>
                            </div>
                            <p className="max-w-2xl text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                                Reminder states use explicit due, appointment, care-plan boundary, medication end, or future medication start fields. `recordedAt`, upload time, extraction time, review time, and model output are never used as due dates.
                            </p>
                        </div>
                        {reminders.items.length > 0 ? reminders.items.map(reminder => (
                            <ReminderCard
                                key={reminder.id}
                                reminder={reminder}
                                taskDraft={taskDraft?.reminderId === reminder.id
                                    ? taskDraft.reason
                                    : undefined}
                                taskNotice={taskNotices[reminder.id]}
                                onOpenSource={setSource}
                                onStartTask={reminderId => setTaskDraft({ reminderId, reason: '' })}
                                onCancelTask={() => setTaskDraft(null)}
                                onTaskReasonChange={reason => setTaskDraft(current =>
                                    current ? { ...current, reason } : null)}
                                onCreateTask={handleCreateTask}
                            />
                        )) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                                <ClockIcon className="mx-auto h-8 w-8 text-slate-300" />
                                <p className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-100">No reminder matches</p>
                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                    Adjust the search or state filter. Candidate and non-patient records are excluded from reminder content.
                                </p>
                            </div>
                        )}
                    </section>
                )}
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

export default TrendAndReminderWorkspace;
