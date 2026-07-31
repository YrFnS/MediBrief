import React, { useMemo, useState } from 'react';
import {
    AlertTriangleIcon,
    BriefingIcon,
    ChevronRightIcon,
} from '../../../components/icons';
import DocumentSourcePreview from '../../clinical-record/components/DocumentSourcePreview';
import type {
    PatientClinicalRecord,
    SourceDocumentReference,
} from '../../clinical-record/types';
import type { ClinicalHistoryScope } from '../coreModuleTypes';
import { buildCarePlansModuleViewModel } from '../planningModuleViewModels';
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

interface CarePlansModuleProps {
    record: PatientClinicalRecord;
    onReviewCandidates: () => void;
}

const statusTone = (
    status: string,
): 'positive' | 'warning' | 'danger' | 'neutral' | 'info' => {
    if (status === 'active') return 'positive';
    if (status === 'draft' || status === 'on-hold' || status === 'unknown') {
        return 'warning';
    }
    if (status === 'revoked' || status === 'entered-in-error') return 'danger';
    if (status === 'completed') return 'neutral';
    return 'info';
};

const CarePlansModule: React.FC<CarePlansModuleProps> = ({
    record,
    onReviewCandidates,
}) => {
    const [search, setSearch] = useState('');
    const [scope, setScope] = useState<ClinicalHistoryScope>('current');
    const [status, setStatus] = useState('all');
    const [intent, setIntent] = useState('all');
    const [source, setSource] = useState<SourceDocumentReference | null>(null);

    const viewModel = useMemo(() => buildCarePlansModuleViewModel(record, {
        search,
        scope,
        status,
        intent,
    }), [intent, record, scope, search, status]);

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-5 md:px-6 md:py-7">
                <ModuleHeader
                    eyebrow="Longitudinal planning"
                    title="Care plans"
                    description="Confirmed care-plan records with period, intent, addressed conditions, activity tasks, encounter links, and source history."
                    candidateCount={viewModel.candidateCount}
                    onReviewCandidates={onReviewCandidates}
                >
                    <MetricGrid metrics={[
                        {
                            label: 'Current',
                            value: viewModel.currentCount,
                            helper: 'draft, active, on hold, or unknown',
                        },
                        {
                            label: 'Active',
                            value: viewModel.activeCount,
                            emphasis: viewModel.activeCount > 0
                                ? 'default'
                                : 'warning',
                        },
                        {
                            label: 'History',
                            value: viewModel.historicalCount,
                            helper: 'completed or revoked',
                        },
                        {
                            label: 'Pending review',
                            value: viewModel.candidateCount,
                            emphasis: viewModel.candidateCount > 0
                                ? 'warning'
                                : 'default',
                        },
                    ]} />
                </ModuleHeader>

                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/25">
                    <div className="flex items-start gap-3">
                        <AlertTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-300" />
                        <div>
                            <h2 className="text-sm font-bold text-amber-950 dark:text-amber-100">
                                Plan state is not execution evidence
                            </h2>
                            <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                                A proposal, plan, option, or recorded order intent describes the structured record. It does not prove that an external order was transmitted, that every activity was accepted, or that care was completed.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                        <ModuleSearch
                            value={search}
                            onChange={setSearch}
                            placeholder="Search plan, condition, task, encounter, period, intent, note, or source"
                        />
                        <ScopeTabs
                            value={scope}
                            onChange={value => setScope(value as ClinicalHistoryScope)}
                            options={[
                                {
                                    value: 'current',
                                    label: 'Current',
                                    count: viewModel.currentCount,
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
                    </div>
                </section>

                {viewModel.items.length === 0 ? (
                    <EmptyModuleState
                        title={viewModel.totalConfirmed === 0
                            ? 'No care plan is confirmed'
                            : 'No care plans match these filters'}
                        description={viewModel.totalConfirmed === 0
                            ? 'Structured care proposals and plans will appear here after they are entered or imported and confirmed.'
                            : 'Adjust the current/history, status, intent, or text filters.'}
                        caution="An empty local list does not prove that no care plan exists outside MediBrief."
                    />
                ) : (
                    <div className="space-y-3">
                        {viewModel.items.map(item => (
                            <details
                                key={item.id}
                                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm open:border-blue-200 dark:border-slate-800 dark:bg-slate-950/80 dark:open:border-blue-800"
                            >
                                <summary className="flex cursor-pointer list-none items-start gap-3 p-4 md:p-5">
                                    <span className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${item.status === 'active'
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                        : item.current
                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                    }`}>
                                        <BriefingIcon className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-bold text-slate-950 dark:text-white">
                                                {item.title}
                                            </span>
                                            <StatusBadge tone={statusTone(item.status)}>
                                                {item.statusLabel}
                                            </StatusBadge>
                                            <StatusBadge tone="info">
                                                {item.intentLabel}
                                            </StatusBadge>
                                            {!item.knownClinicalDate && (
                                                <StatusBadge tone="warning">
                                                    Clinical date unknown
                                                </StatusBadge>
                                            )}
                                        </span>
                                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                            {item.periodLabel} · {item.intentMeaning}
                                        </span>
                                    </span>
                                    <ChevronRightIcon className="mt-2 h-4 w-4 flex-shrink-0 text-slate-300 transition-transform group-open:rotate-90" />
                                </summary>

                                <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800 md:px-5 md:pb-5">
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        {[
                                            ['Status', item.statusLabel],
                                            ['Intent', item.intentLabel],
                                            ['Period', item.periodLabel],
                                            ['Encounter', item.encounter?.label || 'Not linked'],
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

                                    {item.description && (
                                        <div className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                                            <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                Description
                                            </p>
                                            <p className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                                                {item.description}
                                            </p>
                                        </div>
                                    )}

                                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                        <div>
                                            <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                Addressed conditions
                                            </p>
                                            {item.addressedConditions.length === 0 ? (
                                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                    No condition is linked.
                                                </p>
                                            ) : (
                                                <div className="mt-2 space-y-2">
                                                    {item.addressedConditions.map(condition => (
                                                        <div
                                                            key={`${item.id}-condition-${condition.id}`}
                                                            className={`rounded-xl border p-3 ${condition.missing
                                                                ? 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20'
                                                                : 'border-slate-200 dark:border-slate-800'
                                                            }`}
                                                        >
                                                            <p className={`text-xs font-semibold ${condition.missing
                                                                ? 'text-amber-800 dark:text-amber-200'
                                                                : 'text-slate-700 dark:text-slate-200'
                                                            }`}>
                                                                {condition.label}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                Activity tasks
                                            </p>
                                            {item.activityTasks.length === 0 ? (
                                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                    No activity task is linked.
                                                </p>
                                            ) : (
                                                <div className="mt-2 space-y-2">
                                                    {item.activityTasks.map(task => (
                                                        <div
                                                            key={`${item.id}-task-${task.id}`}
                                                            className={`rounded-xl border p-3 ${task.missing
                                                                ? 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20'
                                                                : 'border-slate-200 dark:border-slate-800'
                                                            }`}
                                                        >
                                                            <p className={`text-xs font-semibold ${task.missing
                                                                ? 'text-amber-800 dark:text-amber-200'
                                                                : 'text-slate-700 dark:text-slate-200'
                                                            }`}>
                                                                {task.label}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {item.encounter?.missing && (
                                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                                            The linked encounter reference could not be resolved in this patient record.
                                        </div>
                                    )}

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

export default CarePlansModule;
