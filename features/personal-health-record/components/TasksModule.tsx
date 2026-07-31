import React, { useMemo, useState } from 'react';
import {
    AlertTriangleIcon,
    ChevronRightIcon,
    ListChecksIcon,
} from '../../../components/icons';
import DocumentSourcePreview from '../../clinical-record/components/DocumentSourcePreview';
import type {
    PatientClinicalRecord,
    SourceDocumentReference,
} from '../../clinical-record/types';
import type { ClinicalHistoryScope } from '../coreModuleTypes';
import type { TaskReminderFilter } from '../planningModuleTypes';
import { buildClinicalTasksModuleViewModel } from '../planningModuleViewModels';
import {
    EmptyModuleState,
    MetricGrid,
    ModuleHeader,
    ModuleSearch,
    ModuleSelect,
    ProvenancePanel,
    ScopeTabs,
    StatusBadge,
} from './CoreModulePrimitives';

interface TasksModuleProps {
    record: PatientClinicalRecord;
    onReviewCandidates: () => void;
}

const reminderTone = (
    state: string,
): 'danger' | 'warning' | 'positive' | 'neutral' | 'info' => {
    if (state === 'overdue') return 'danger';
    if (state === 'due-today' || state === 'no-date') return 'warning';
    if (state === 'upcoming') return 'info';
    if (state === 'closed') return 'neutral';
    return 'positive';
};

const priorityTone = (
    priority: string,
): 'danger' | 'warning' | 'neutral' => {
    if (priority === 'stat' || priority === 'asap') return 'danger';
    if (priority === 'urgent') return 'warning';
    return 'neutral';
};

const TasksModule: React.FC<TasksModuleProps> = ({
    record,
    onReviewCandidates,
}) => {
    const [search, setSearch] = useState('');
    const [scope, setScope] = useState<ClinicalHistoryScope>('current');
    const [status, setStatus] = useState('all');
    const [intent, setIntent] = useState('all');
    const [priority, setPriority] = useState('all');
    const [reminder, setReminder] = useState<TaskReminderFilter>('all');
    const [source, setSource] = useState<SourceDocumentReference | null>(null);

    const viewModel = useMemo(() => buildClinicalTasksModuleViewModel(record, {
        search,
        scope,
        status,
        intent,
        priority,
        reminder,
    }), [intent, priority, record, reminder, scope, search, status]);

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-5 md:px-6 md:py-7">
                <ModuleHeader
                    eyebrow="Follow-up record"
                    title="Tasks and reminders"
                    description="Confirmed local tasks with due-state reminders, priority, intent, ownership, and related records. Reminder states are calculated locally from the recorded due date."
                    candidateCount={viewModel.candidateCount}
                    onReviewCandidates={onReviewCandidates}
                >
                    <MetricGrid metrics={[
                        {
                            label: 'Open',
                            value: viewModel.openCount,
                            helper: 'not completed or closed',
                        },
                        {
                            label: 'Overdue',
                            value: viewModel.overdueCount,
                            emphasis: viewModel.overdueCount > 0
                                ? 'danger'
                                : 'default',
                        },
                        {
                            label: 'Due soon',
                            value: viewModel.dueSoonCount,
                            helper: 'today or within 7 days',
                            emphasis: viewModel.dueSoonCount > 0
                                ? 'warning'
                                : 'default',
                        },
                        {
                            label: 'Open without date',
                            value: viewModel.noDateOpenCount,
                            emphasis: viewModel.noDateOpenCount > 0
                                ? 'warning'
                                : 'default',
                        },
                    ]} />
                </ModuleHeader>

                <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/60 dark:bg-blue-950/25">
                    <div className="flex items-start gap-3">
                        <ListChecksIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-300" />
                        <div>
                            <h2 className="text-sm font-bold text-blue-950 dark:text-blue-100">
                                Reminder and execution boundary
                            </h2>
                            <p className="mt-1 text-xs leading-relaxed text-blue-800 dark:text-blue-200">
                                A reminder is derived from a confirmed local task and its due date. It does not send an external order, notify a clinic, or prove that care was performed. Order-like intents are displayed exactly as recorded with execution explicitly unconfirmed.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                    <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-end">
                        <ModuleSearch
                            value={search}
                            onChange={setSearch}
                            placeholder="Search task, description, owner, due date, intent, related record, or source"
                        />
                        <ScopeTabs
                            value={scope}
                            onChange={value => setScope(value as ClinicalHistoryScope)}
                            options={[
                                {
                                    value: 'current',
                                    label: 'Open',
                                    count: viewModel.openCount,
                                },
                                {
                                    value: 'history',
                                    label: 'History',
                                    count: viewModel.historicalCount,
                                },
                                {
                                    value: 'all',
                                    label: 'All',
                                    count: viewModel.totalConfirmed,
                                },
                            ]}
                        />
                        <ModuleSelect
                            label="Reminder"
                            value={reminder}
                            onChange={value => setReminder(value as TaskReminderFilter)}
                            options={[
                                { value: 'all', label: 'All due states' },
                                { value: 'overdue', label: 'Overdue' },
                                { value: 'due-today', label: 'Due today' },
                                { value: 'upcoming', label: 'Within 7 days' },
                                { value: 'later', label: 'Later' },
                                { value: 'no-date', label: 'Unknown due date' },
                                { value: 'closed', label: 'Closed' },
                            ]}
                        />
                        <ModuleSelect
                            label="Status"
                            value={status}
                            onChange={setStatus}
                            options={[
                                { value: 'all', label: 'All statuses' },
                                ...viewModel.statusOptions.map(value => ({
                                    value,
                                    label: value.replace(/-/g, ' '),
                                })),
                            ]}
                        />
                        <ModuleSelect
                            label="Intent"
                            value={intent}
                            onChange={setIntent}
                            options={[
                                { value: 'all', label: 'All intents' },
                                ...viewModel.intentOptions.map(value => ({
                                    value,
                                    label: value.replace(/-/g, ' '),
                                })),
                            ]}
                        />
                        <ModuleSelect
                            label="Priority"
                            value={priority}
                            onChange={setPriority}
                            options={[
                                { value: 'all', label: 'All priorities' },
                                ...viewModel.priorityOptions.map(value => ({
                                    value,
                                    label: value,
                                })),
                            ]}
                        />
                    </div>
                </section>

                {viewModel.items.length === 0 ? (
                    <EmptyModuleState
                        title={viewModel.totalConfirmed === 0
                            ? 'No task or reminder is confirmed'
                            : 'No tasks match these filters'}
                        description={viewModel.totalConfirmed === 0
                            ? 'Follow-up tasks and local reminders will appear here after they are saved and confirmed.'
                            : 'Adjust the open/history, due-state, status, intent, priority, or text filters.'}
                        caution="An empty task list does not establish that no follow-up is needed. It only describes this local structured record."
                    />
                ) : (
                    <div className="space-y-3">
                        {viewModel.items.map(item => (
                            <details
                                key={item.id}
                                className={`group overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-950/80 ${item.reminderState === 'overdue'
                                    ? 'border-red-300 open:border-red-400 dark:border-red-900/70'
                                    : 'border-slate-200 open:border-blue-200 dark:border-slate-800 dark:open:border-blue-800'
                                }`}
                            >
                                <summary className="flex cursor-pointer list-none items-start gap-3 p-4 md:p-5">
                                    <span className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${item.reminderState === 'overdue'
                                        ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                                        : item.reminderState === 'due-today' || item.reminderState === 'no-date'
                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                            : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                    }`}>
                                        {item.reminderState === 'overdue'
                                            ? <AlertTriangleIcon className="h-4 w-4" />
                                            : <ListChecksIcon className="h-4 w-4" />}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-bold text-slate-950 dark:text-white">
                                                {item.title}
                                            </span>
                                            <StatusBadge tone={reminderTone(item.reminderState)}>
                                                {item.reminderLabel}
                                            </StatusBadge>
                                            <StatusBadge tone={priorityTone(item.priority)}>
                                                {item.priorityLabel}
                                            </StatusBadge>
                                            <StatusBadge tone={item.current ? 'info' : 'neutral'}>
                                                {item.statusLabel}
                                            </StatusBadge>
                                        </span>
                                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                            {item.dueLabel} · {item.intentMeaning}
                                            {item.owner ? ` · Owner: ${item.owner}` : ''}
                                        </span>
                                    </span>
                                    <ChevronRightIcon className="mt-2 h-4 w-4 flex-shrink-0 text-slate-300 transition-transform group-open:rotate-90" />
                                </summary>

                                <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800 md:px-5 md:pb-5">
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        {[
                                            ['Status', item.statusLabel],
                                            ['Intent', item.intentLabel],
                                            ['Due', item.dueLabel],
                                            ['Priority', item.priorityLabel],
                                        ].map(([label, value]) => (
                                            <div
                                                key={label}
                                                className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70"
                                            >
                                                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                    {label}
                                                </p>
                                                <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-100">
                                                    {value}
                                                </p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
                                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300">
                                            Intent meaning
                                        </p>
                                        <p className="mt-1 text-xs leading-relaxed text-blue-800 dark:text-blue-200">
                                            {item.intentMeaning}
                                        </p>
                                    </div>

                                    {(item.code || item.description || item.completedAtLabel) && (
                                        <div className="mt-4 grid gap-3 lg:grid-cols-3">
                                            {item.code && (
                                                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                                                    <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                        Task code
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-700 dark:text-slate-200">
                                                        {item.code}
                                                    </p>
                                                </div>
                                            )}
                                            {item.description && (
                                                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800 lg:col-span-2">
                                                    <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                        Description
                                                    </p>
                                                    <p className="mt-1 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                                                        {item.description}
                                                    </p>
                                                </div>
                                            )}
                                            {item.completedAtLabel && (
                                                <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                                                    <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                        Completed at
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-700 dark:text-slate-200">
                                                        {item.completedAtLabel}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="mt-4">
                                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                            Related structured records
                                        </p>
                                        {item.relatedResources.length === 0 ? (
                                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                No related record is linked.
                                            </p>
                                        ) : (
                                            <div className="mt-2 grid gap-2 lg:grid-cols-2">
                                                {item.relatedResources.map(related => (
                                                    <div
                                                        key={`${item.id}-${related.resourceType}-${related.id}`}
                                                        className={`rounded-xl border p-3 ${related.missing
                                                            ? 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20'
                                                            : 'border-slate-200 dark:border-slate-800'
                                                        }`}
                                                    >
                                                        <p className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
                                                            {related.resourceType}
                                                        </p>
                                                        <p className={`mt-1 text-xs font-semibold ${related.missing
                                                            ? 'text-amber-800 dark:text-amber-200'
                                                            : 'text-slate-700 dark:text-slate-200'
                                                        }`}>
                                                            {related.label}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {item.note && (
                                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300">
                                            {item.note}
                                        </div>
                                    )}

                                    <ProvenancePanel
                                        provenance={item.provenance}
                                        onViewSource={item.provenance.sourceDocument
                                            ? () => setSource(item.provenance.sourceDocument!)
                                            : undefined}
                                    />
                                </div>
                            </details>
                        ))}
                    </div>
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

export default TasksModule;
