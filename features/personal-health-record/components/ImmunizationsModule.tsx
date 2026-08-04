import React, { useMemo, useState } from 'react';
import {
    ChevronRightIcon,
    ShieldCheckIcon,
} from '../../../components/icons';
import DocumentSourcePreview from '../../clinical-record/components/DocumentSourcePreview';
import type {
    PatientClinicalRecord,
    SourceDocumentReference,
} from '../../clinical-record/types';
import { buildImmunizationModuleViewModel } from '../longitudinalModuleViewModels';
import {
    EmptyModuleState,
    MetricGrid,
    ModuleHeader,
    ModuleSearch,
    ModuleSelect,
    ProvenancePanel,
    StatusBadge,
} from './CoreModulePrimitives';

interface ImmunizationsModuleProps {
    record: PatientClinicalRecord;
    onReviewCandidates: () => void;
}

const statusTone = (
    status: string,
): 'positive' | 'warning' | 'neutral' => {
    if (status === 'completed') return 'positive';
    if (status === 'not-done') return 'warning';
    return 'neutral';
};

const ImmunizationsModule: React.FC<ImmunizationsModuleProps> = ({
    record,
    onReviewCandidates,
}) => {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('all');
    const [source, setSource] = useState<SourceDocumentReference | null>(null);
    const viewModel = useMemo(() => buildImmunizationModuleViewModel(record, {
        search,
        status,
    }), [record, search, status]);

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-5 md:px-6 md:py-7">
                <ModuleHeader
                    eyebrow="Preventive-care history"
                    title="Immunizations"
                    description="Confirmed vaccine records with occurrence date, status, manufacturer, lot number, original dose, normalized dose, route, site, reason, performer, notes, and source history."
                    candidateCount={viewModel.candidateCount}
                    onReviewCandidates={onReviewCandidates}
                >
                    <MetricGrid metrics={[
                        {
                            label: 'Completed',
                            value: viewModel.completedCount,
                        },
                        {
                            label: 'Not given',
                            value: viewModel.notDoneCount,
                            helper: 'recorded not-done status',
                        },
                        {
                            label: 'Date unknown',
                            value: viewModel.unknownDateCount,
                            emphasis: viewModel.unknownDateCount > 0
                                ? 'warning'
                                : 'default',
                        },
                        {
                            label: 'Confirmed total',
                            value: viewModel.totalConfirmed,
                        },
                    ]} />
                </ModuleHeader>

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                        <ModuleSearch
                            value={search}
                            onChange={setSearch}
                            placeholder="Search vaccine, manufacturer, lot, dose, route, site, performer, note, or source"
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
                    </div>
                </section>

                {viewModel.items.length === 0 ? (
                    <EmptyModuleState
                        title="No confirmed immunizations match these filters"
                        description="Confirmed vaccine records appear here after manual entry, import, or candidate review."
                        caution="An empty local immunization list does not prove that the patient is unvaccinated or not due for any vaccine."
                    />
                ) : (
                    <div className="grid gap-3 xl:grid-cols-2">
                        {viewModel.items.map(item => (
                            <details
                                key={item.id}
                                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm open:border-emerald-200 dark:border-slate-800 dark:bg-slate-950/80 dark:open:border-emerald-800"
                            >
                                <summary className="flex cursor-pointer list-none items-start gap-3 p-4 md:p-5">
                                    <span className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                        <ShieldCheckIcon className="h-5 w-5" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-bold text-slate-950 dark:text-white">
                                                {item.vaccine}
                                            </span>
                                            <StatusBadge tone={statusTone(item.status)}>
                                                {item.statusLabel}
                                            </StatusBadge>
                                            {!item.knownClinicalDate && (
                                                <StatusBadge tone="warning">
                                                    Clinical date unknown
                                                </StatusBadge>
                                            )}
                                        </span>
                                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                            {item.occurrenceLabel}
                                        </span>
                                        {(item.manufacturer || item.lotNumber) && (
                                            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                                {[item.manufacturer, item.lotNumber
                                                    ? `Lot ${item.lotNumber}`
                                                    : undefined]
                                                    .filter(Boolean)
                                                    .join(' · ')}
                                            </span>
                                        )}
                                    </span>
                                    <ChevronRightIcon className="mt-2 h-4 w-4 flex-shrink-0 text-slate-300 transition-transform group-open:rotate-90" />
                                </summary>

                                <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800 md:px-5 md:pb-5">
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                        {[
                                            ['Manufacturer', item.manufacturer || 'Not recorded'],
                                            ['Lot number', item.lotNumber || 'Not recorded'],
                                            ['Original dose', item.dose || 'Not recorded'],
                                            ['Normalized dose', item.normalizedDose || 'Not available'],
                                            ['Route', item.route || 'Not recorded'],
                                            ['Site', item.site || 'Not recorded'],
                                            ['Performer', item.performer || 'Not recorded'],
                                            ['Reason', item.reasons.join(', ') || 'Not recorded'],
                                            ['Occurrence', item.occurrenceLabel],
                                        ].map(([label, value]) => (
                                            <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
                                                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                    {label}
                                                </p>
                                                <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-100">
                                                    {value}
                                                </p>
                                            </div>
                                        ))}
                                    </div>

                                    {item.note && (
                                        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
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

export default ImmunizationsModule;
