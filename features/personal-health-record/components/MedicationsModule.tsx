import React, { useMemo, useState } from 'react';
import {
    AlertTriangleIcon,
    ChevronRightIcon,
    DrugsIcon,
} from '../../../components/icons';
import DocumentSourcePreview from '../../clinical-record/components/DocumentSourcePreview';
import type {
    PatientClinicalRecord,
    SourceDocumentReference,
} from '../../clinical-record/types';
import type { ClinicalHistoryScope } from '../coreModuleTypes';
import { buildMedicationModuleViewModel } from '../coreModuleViewModels';
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

interface MedicationsModuleProps {
    record: PatientClinicalRecord;
    onReviewCandidates: () => void;
}

const medicationTone = (
    status: string,
): 'positive' | 'warning' | 'info' | 'neutral' => {
    if (status === 'active') return 'positive';
    if (status === 'on-hold' || status === 'unknown') return 'warning';
    if (status === 'not-taken') return 'info';
    return 'neutral';
};

const MedicationsModule: React.FC<MedicationsModuleProps> = ({
    record,
    onReviewCandidates,
}) => {
    const [search, setSearch] = useState('');
    const [scope, setScope] = useState<ClinicalHistoryScope>('current');
    const [status, setStatus] = useState('all');
    const [kind, setKind] = useState('all');
    const [source, setSource] = useState<SourceDocumentReference | null>(null);
    const viewModel = useMemo(() => buildMedicationModuleViewModel(record, {
        search,
        scope,
        status,
        kind,
    }), [kind, record, scope, search, status]);

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-5 md:px-6 md:py-7">
                <ModuleHeader
                    eyebrow="Medication record"
                    title="Medications and history"
                    description="Confirmed medication statements, requests, and administrations with dosage text, dates, reason, prescriber, and source history. This list records information; it does not verify that a regimen is safe or appropriate."
                    candidateCount={viewModel.candidateCount}
                    onReviewCandidates={onReviewCandidates}
                >
                    <MetricGrid metrics={[
                        {
                            label: 'Current',
                            value: viewModel.currentCount,
                            helper: 'active, on hold, or unknown',
                        },
                        {
                            label: 'Historical',
                            value: viewModel.historicalCount,
                            helper: 'completed, stopped, or not taken',
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

                <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/60 dark:bg-blue-950/25">
                    <div className="flex items-start gap-3">
                        <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-300" />
                        <p className="text-xs leading-relaxed text-blue-800 dark:text-blue-200">
                            Medication records may be incomplete and may describe historical, proposed, or patient-reported use. This module does not evaluate interactions, allergies, dose, frequency, kidney/liver function, pregnancy, indication, or patient-specific suitability.
                        </p>
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                        <ModuleSearch
                            value={search}
                            onChange={setSearch}
                            placeholder="Search medication, dosage, route, reason, prescriber, note, or source"
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
                            label="Record kind"
                            value={kind}
                            onChange={setKind}
                            options={[
                                { value: 'all', label: 'All kinds' },
                                ...viewModel.kindOptions.map(value => ({
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
                            ? 'No active medication is confirmed'
                            : 'No medication records match these filters'}
                        description={viewModel.currentCount === 0 && scope === 'current'
                            ? 'The confirmed structured record does not currently contain an active medication. Historical records or pending candidates may still exist.'
                            : 'Adjust the search, record kind, status, or current/history filter.'}
                        caution={viewModel.currentCount === 0 && scope === 'current'
                            ? 'This does not prove that the patient takes no medications.'
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
                                    <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300">
                                        <DrugsIcon className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-bold text-slate-950 dark:text-white">
                                                {item.name}
                                            </span>
                                            <StatusBadge tone={medicationTone(item.status)}>
                                                {item.statusLabel}
                                            </StatusBadge>
                                            <StatusBadge>{item.kindLabel}</StatusBadge>
                                            {!item.current && (
                                                <StatusBadge>Historical</StatusBadge>
                                            )}
                                        </span>
                                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                            {item.dosages.length > 0
                                                ? item.dosages.map(dosage => dosage.text).join('; ')
                                                : 'Dosage instructions not recorded'}
                                        </span>
                                        <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400">
                                            <span>Start: {item.startLabel}</span>
                                            <span>End: {item.endLabel}</span>
                                            {item.prescriber && (
                                                <span>Prescriber: {item.prescriber}</span>
                                            )}
                                        </span>
                                    </span>
                                    <ChevronRightIcon className="mt-2 h-4 w-4 flex-shrink-0 text-slate-300 transition-transform group-open:rotate-90" />
                                </summary>

                                <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800 md:px-5 md:pb-5">
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        {[
                                            ['Status', item.statusLabel],
                                            ['Record kind', item.kindLabel],
                                            ['Start', item.startLabel],
                                            ['End', item.endLabel],
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
                                            Dosage instructions
                                        </p>
                                        {item.dosages.length === 0 ? (
                                            <p className="mt-2 rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                                Dosage, route, frequency, and timing are not recorded.
                                            </p>
                                        ) : (
                                            <div className="mt-2 grid gap-2 lg:grid-cols-2">
                                                {item.dosages.map((dosage, index) => (
                                                    <div
                                                        key={`${item.id}-dosage-${index}`}
                                                        className="rounded-xl border border-purple-100 bg-purple-50/50 p-3 dark:border-purple-900/40 dark:bg-purple-950/20"
                                                    >
                                                        <p className="text-xs font-bold text-purple-950 dark:text-purple-100">
                                                            {dosage.text}
                                                        </p>
                                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                                            {dosage.dose && (
                                                                <StatusBadge tone="info">
                                                                    Dose {dosage.dose}
                                                                </StatusBadge>
                                                            )}
                                                            {dosage.normalizedDose && (
                                                                <StatusBadge>
                                                                    Normalized {dosage.normalizedDose}
                                                                </StatusBadge>
                                                            )}
                                                            {dosage.route && (
                                                                <StatusBadge>{dosage.route}</StatusBadge>
                                                            )}
                                                            {dosage.frequency && (
                                                                <StatusBadge>{dosage.frequency}</StatusBadge>
                                                            )}
                                                            {dosage.timing && (
                                                                <StatusBadge>{dosage.timing}</StatusBadge>
                                                            )}
                                                            {dosage.asNeeded && (
                                                                <StatusBadge tone="warning">As needed</StatusBadge>
                                                            )}
                                                            {dosage.maximumDose && (
                                                                <StatusBadge tone="warning">
                                                                    Maximum {dosage.maximumDose}
                                                                </StatusBadge>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
                                            <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                Reason / indication
                                            </p>
                                            <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-100">
                                                {item.reasons.join(', ') || 'Not recorded'}
                                            </p>
                                        </div>
                                        <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
                                            <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                Prescriber
                                            </p>
                                            <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-100">
                                                {item.prescriber || 'Not recorded'}
                                            </p>
                                        </div>
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

export default MedicationsModule;
