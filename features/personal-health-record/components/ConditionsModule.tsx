import React, { useMemo, useState } from 'react';
import { ActivityIcon, ChevronRightIcon } from '../../../components/icons';
import DocumentSourcePreview from '../../clinical-record/components/DocumentSourcePreview';
import type {
    PatientClinicalRecord,
    SourceDocumentReference,
} from '../../clinical-record/types';
import type { ClinicalHistoryScope } from '../coreModuleTypes';
import { buildConditionModuleViewModel } from '../coreModuleViewModels';
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

interface ConditionsModuleProps {
    record: PatientClinicalRecord;
    onReviewCandidates: () => void;
}

const conditionTone = (
    status: string,
): 'positive' | 'warning' | 'info' | 'neutral' => {
    if (status === 'active') return 'positive';
    if (status === 'remission') return 'info';
    if (status === 'unknown') return 'warning';
    return 'neutral';
};

const ConditionsModule: React.FC<ConditionsModuleProps> = ({
    record,
    onReviewCandidates,
}) => {
    const [search, setSearch] = useState('');
    const [scope, setScope] = useState<ClinicalHistoryScope>('current');
    const [status, setStatus] = useState('all');
    const [source, setSource] = useState<SourceDocumentReference | null>(null);
    const viewModel = useMemo(() => buildConditionModuleViewModel(record, {
        search,
        scope,
        status,
    }), [record, scope, search, status]);

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-5 md:px-6 md:py-7">
                <ModuleHeader
                    eyebrow="Problem list"
                    title="Conditions"
                    description="Confirmed diagnoses and health problems, separated into current and historical records. A missing condition record never proves that no condition exists."
                    candidateCount={viewModel.candidateCount}
                    onReviewCandidates={onReviewCandidates}
                >
                    <MetricGrid metrics={[
                        {
                            label: 'Current',
                            value: viewModel.currentCount,
                            helper: 'active, remission, or unknown',
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

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                        <ModuleSearch
                            value={search}
                            onChange={setSearch}
                            placeholder="Search condition, severity, body site, note, or source"
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
                    </div>
                </section>

                {viewModel.items.length === 0 ? (
                    <EmptyModuleState
                        title={viewModel.currentCount === 0 && scope === 'current'
                            ? 'No current condition is confirmed'
                            : 'No conditions match these filters'}
                        description={viewModel.currentCount === 0 && scope === 'current'
                            ? 'The confirmed structured record does not currently contain an active condition. Pending candidates may still require review.'
                            : 'Adjust the search, clinical status, or current/history filter.'}
                        caution={viewModel.currentCount === 0 && scope === 'current'
                            ? 'This empty state is not a statement that the patient has no medical conditions.'
                            : undefined}
                    />
                ) : (
                    <div className="space-y-3">
                        {viewModel.items.map(item => (
                            <details
                                key={item.id}
                                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm open:border-blue-200 dark:border-slate-800 dark:bg-slate-950/80 dark:open:border-blue-800"
                            >
                                <summary className="flex cursor-pointer list-none items-start gap-3 p-4 md:p-5">
                                    <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                                        <ActivityIcon className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-bold text-slate-950 dark:text-white">
                                                {item.name}
                                            </span>
                                            <StatusBadge tone={conditionTone(item.clinicalStatus)}>
                                                {item.clinicalStatusLabel}
                                            </StatusBadge>
                                            {!item.current && (
                                                <StatusBadge>Historical</StatusBadge>
                                            )}
                                        </span>
                                        <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                            <span>Onset: {item.onsetLabel}</span>
                                            {item.severity && <span>Severity: {item.severity}</span>}
                                            {item.bodySites.length > 0 && (
                                                <span>Site: {item.bodySites.join(', ')}</span>
                                            )}
                                        </span>
                                    </span>
                                    <ChevronRightIcon className="mt-2 h-4 w-4 flex-shrink-0 text-slate-300 transition-transform group-open:rotate-90" />
                                </summary>

                                <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800 md:px-5 md:pb-5">
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        {[
                                            ['Clinical status', item.clinicalStatusLabel],
                                            ['Onset', item.onsetLabel],
                                            ['Resolved / ended', item.abatementLabel],
                                            ['Severity', item.severity || 'Not recorded'],
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

                                    {item.bodySites.length > 0 && (
                                        <div className="mt-3">
                                            <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                Body sites
                                            </p>
                                            <div className="mt-1 flex flex-wrap gap-1.5">
                                                {item.bodySites.map(site => (
                                                    <StatusBadge key={site}>{site}</StatusBadge>
                                                ))}
                                            </div>
                                        </div>
                                    )}

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

export default ConditionsModule;
