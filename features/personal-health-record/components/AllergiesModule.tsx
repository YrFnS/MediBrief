import React, { useMemo, useState } from 'react';
import {
    AlertTriangleIcon,
    ChevronRightIcon,
    ShieldCheckIcon,
} from '../../../components/icons';
import DocumentSourcePreview from '../../clinical-record/components/DocumentSourcePreview';
import type {
    PatientClinicalRecord,
    SourceDocumentReference,
} from '../../clinical-record/types';
import type { ClinicalHistoryScope } from '../coreModuleTypes';
import { buildAllergyModuleViewModel } from '../coreModuleViewModels';
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

interface AllergiesModuleProps {
    record: PatientClinicalRecord;
    onReviewCandidates: () => void;
}

const criticalityTone = (
    criticality: string,
): 'danger' | 'warning' | 'neutral' => {
    if (criticality === 'high') return 'danger';
    if (criticality === 'unable-to-assess') return 'warning';
    return 'neutral';
};

const AllergiesModule: React.FC<AllergiesModuleProps> = ({
    record,
    onReviewCandidates,
}) => {
    const [search, setSearch] = useState('');
    const [scope, setScope] = useState<ClinicalHistoryScope>('current');
    const [status, setStatus] = useState('all');
    const [category, setCategory] = useState('all');
    const [source, setSource] = useState<SourceDocumentReference | null>(null);
    const viewModel = useMemo(() => buildAllergyModuleViewModel(record, {
        search,
        scope,
        status,
        category,
    }), [category, record, scope, search, status]);

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-5 md:px-6 md:py-7">
                <ModuleHeader
                    eyebrow="Safety-critical record"
                    title="Allergies and intolerances"
                    description="Confirmed allergy and intolerance records with criticality, reactions, categories, dates, and source history. Missing data remains unknown rather than being treated as no known allergy."
                    candidateCount={viewModel.candidateCount}
                    onReviewCandidates={onReviewCandidates}
                >
                    <MetricGrid metrics={[
                        {
                            label: 'Current',
                            value: viewModel.currentCount,
                            helper: 'active or unknown status',
                            emphasis: viewModel.currentCount === 0
                                ? 'warning'
                                : 'default',
                        },
                        {
                            label: 'Historical',
                            value: viewModel.historicalCount,
                            helper: 'inactive or resolved',
                        },
                        {
                            label: 'Confirmed total',
                            value: viewModel.totalConfirmed,
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

                {!viewModel.allergyStatusKnown && (
                    <section className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                        <div className="flex items-start gap-3">
                            <AlertTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-300" />
                            <div>
                                <h2 className="text-sm font-bold text-amber-950 dark:text-amber-100">
                                    Allergy status unknown
                                </h2>
                                <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                                    No current allergy or intolerance record is confirmed. This does not mean the patient has no allergies. Review pending candidates and source documents before relying on this section.
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                        <ModuleSearch
                            value={search}
                            onChange={setSearch}
                            placeholder="Search substance, reaction, category, route, note, or source"
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
                            label="Clinical status"
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
                            label="Category"
                            value={category}
                            onChange={setCategory}
                            options={[
                                { value: 'all', label: 'All categories' },
                                ...viewModel.categoryOptions.map(value => ({
                                    value,
                                    label: value,
                                })),
                            ]}
                        />
                    </div>
                </section>

                {viewModel.items.length === 0 ? (
                    <EmptyModuleState
                        title={viewModel.currentCount === 0 && scope === 'current'
                            ? 'No current allergy record is confirmed'
                            : 'No allergy records match these filters'}
                        description={viewModel.currentCount === 0 && scope === 'current'
                            ? 'Current allergy status remains unknown. Historical records may still be available, and pending candidates may require review.'
                            : 'Adjust the search, status, category, or current/history filter.'}
                        caution={viewModel.currentCount === 0 && scope === 'current'
                            ? 'Do not interpret this empty state as NKDA or as proof that no allergy exists.'
                            : undefined}
                    />
                ) : (
                    <div className="space-y-3">
                        {viewModel.items.map(item => (
                            <details
                                key={item.id}
                                className={`group overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-950/80 ${item.criticality === 'high'
                                    ? 'border-red-300 open:border-red-400 dark:border-red-900/70'
                                    : 'border-slate-200 open:border-blue-200 dark:border-slate-800 dark:open:border-blue-800'
                                }`}
                            >
                                <summary className="flex cursor-pointer list-none items-start gap-3 p-4 md:p-5">
                                    <span className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${item.criticality === 'high'
                                        ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
                                        : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300'
                                    }`}>
                                        {item.criticality === 'high'
                                            ? <AlertTriangleIcon className="h-4 w-4" />
                                            : <ShieldCheckIcon className="h-4 w-4" />}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-bold text-slate-950 dark:text-white">
                                                {item.substance}
                                            </span>
                                            <StatusBadge tone={criticalityTone(item.criticality)}>
                                                {item.criticalityLabel} criticality
                                            </StatusBadge>
                                            <StatusBadge tone={item.current ? 'positive' : 'neutral'}>
                                                {item.clinicalStatusLabel}
                                            </StatusBadge>
                                        </span>
                                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                            {item.reactions.length > 0
                                                ? item.reactions.map(reaction => [
                                                    ...reaction.manifestations,
                                                    reaction.description,
                                                ].filter(Boolean).join(', ')).join('; ')
                                                : 'Reaction details not recorded'}
                                        </span>
                                    </span>
                                    <ChevronRightIcon className="mt-2 h-4 w-4 flex-shrink-0 text-slate-300 transition-transform group-open:rotate-90" />
                                </summary>

                                <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800 md:px-5 md:pb-5">
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        {[
                                            ['Clinical status', item.clinicalStatusLabel],
                                            ['Criticality', item.criticalityLabel],
                                            ['Categories', item.categories.join(', ') || 'Not recorded'],
                                            ['Last occurrence', item.lastOccurrenceLabel],
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

                                    <div className="mt-4">
                                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                            Recorded reactions
                                        </p>
                                        {item.reactions.length === 0 ? (
                                            <p className="mt-2 rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                                Reaction details are not recorded. The allergy record remains active, but manifestation and severity are unknown.
                                            </p>
                                        ) : (
                                            <div className="mt-2 grid gap-2 lg:grid-cols-2">
                                                {item.reactions.map((reaction, index) => (
                                                    <div
                                                        key={`${item.id}-reaction-${index}`}
                                                        className="rounded-xl border border-red-100 bg-red-50/60 p-3 dark:border-red-900/40 dark:bg-red-950/20"
                                                    >
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <p className="text-xs font-bold text-red-950 dark:text-red-100">
                                                                {reaction.manifestations.join(', ')
                                                                    || reaction.description
                                                                    || 'Manifestation not recorded'}
                                                            </p>
                                                            <StatusBadge tone={reaction.severity === 'Severe'
                                                                ? 'danger'
                                                                : reaction.severity === 'Unknown'
                                                                    ? 'warning'
                                                                    : 'neutral'}>
                                                                {reaction.severity}
                                                            </StatusBadge>
                                                        </div>
                                                        {reaction.description && reaction.manifestations.length > 0 && (
                                                            <p className="mt-1 text-xs text-red-800/75 dark:text-red-200/75">
                                                                {reaction.description}
                                                            </p>
                                                        )}
                                                        <p className="mt-2 text-[10px] text-red-700/70 dark:text-red-300/70">
                                                            Onset: {reaction.onsetLabel}
                                                            {reaction.route ? ` · Route: ${reaction.route}` : ''}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {item.note && (
                                        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                                            {item.note}
                                        </div>
                                    )}

                                    <ProvenancePanel
                                        provenance={item.provenance}
                                        onViewSource={item.provenance.sourceDocument
                                            ? () => setSource(
                                                item.provenance.sourceDocument!,
                                            )
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

export default AllergiesModule;
