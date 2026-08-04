import React, { useMemo, useState } from 'react';
import {
    ActivityIcon,
    AlertTriangleIcon,
    ChevronRightIcon,
    DocumentTextIcon,
    ShieldCheckIcon,
} from '../../../components/icons';
import DocumentSourcePreview from '../../clinical-record/components/DocumentSourcePreview';
import type {
    PatientClinicalRecord,
    SourceDocumentReference,
} from '../../clinical-record/types';
import type { ClinicalHistoryScope } from '../coreModuleTypes';
import { buildProcedureModuleViewModel } from '../longitudinalModuleViewModels';
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

interface ProceduresModuleProps {
    record: PatientClinicalRecord;
    onReviewCandidates: () => void;
}

const statusTone = (
    status: string,
): 'positive' | 'info' | 'warning' | 'danger' | 'neutral' => {
    if (status === 'completed') return 'positive';
    if (status === 'in-progress') return 'info';
    if (status === 'preparation' || status === 'on-hold') return 'warning';
    if (status === 'not-done' || status === 'stopped') return 'danger';
    return 'neutral';
};

const LinkedList: React.FC<{
    title: string;
    items: Array<{
        id: string;
        resourceType: string;
        label: string;
        dateLabel?: string;
        missing?: boolean;
    }>;
}> = ({ title, items }) => (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
            {title}
        </p>
        {items.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                None linked
            </p>
        ) : (
            <div className="mt-2 space-y-1.5">
                {items.map(item => (
                    <div
                        key={`${item.resourceType}-${item.id}`}
                        className={`rounded-lg px-2.5 py-2 ${item.missing
                            ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-200'
                            : 'bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-200'
                        }`}
                    >
                        <p className="text-xs font-semibold">{item.label}</p>
                        <p className="mt-0.5 text-[9px] font-mono uppercase tracking-wide opacity-60">
                            {item.resourceType}{item.dateLabel ? ` · ${item.dateLabel}` : ''}
                        </p>
                    </div>
                ))}
            </div>
        )}
    </div>
);

const ProceduresModule: React.FC<ProceduresModuleProps> = ({
    record,
    onReviewCandidates,
}) => {
    const [search, setSearch] = useState('');
    const [scope, setScope] = useState<ClinicalHistoryScope>('all');
    const [status, setStatus] = useState('all');
    const [deviceRelatedOnly, setDeviceRelatedOnly] = useState(false);
    const [source, setSource] = useState<SourceDocumentReference | null>(null);
    const viewModel = useMemo(() => buildProcedureModuleViewModel(record, {
        search,
        scope,
        status,
        deviceRelatedOnly,
    }), [deviceRelatedOnly, record, scope, search, status]);

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-5 md:px-6 md:py-7">
                <ModuleHeader
                    eyebrow="Interventions and device evidence"
                    title="Procedures and device-related records"
                    description="Confirmed procedure history with dates, body sites, reasons, outcomes, complications, performers, encounter links, reports, documents, and deterministic device-related evidence from procedure and document text."
                    candidateCount={viewModel.candidateCount}
                    onReviewCandidates={onReviewCandidates}
                >
                    <MetricGrid metrics={[
                        {
                            label: 'Current / planned',
                            value: viewModel.currentCount,
                        },
                        {
                            label: 'Historical',
                            value: viewModel.historicalCount,
                        },
                        {
                            label: 'Device-related evidence',
                            value: viewModel.deviceRelatedCount,
                            helper: 'confirmed mentions',
                        },
                        {
                            label: 'Confirmed procedures',
                            value: viewModel.totalConfirmed,
                        },
                    ]} />
                </ModuleHeader>

                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/25">
                    <div className="flex items-start gap-3">
                        <AlertTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-300" />
                        <div>
                            <h2 className="text-sm font-bold text-amber-950 dark:text-amber-100">
                                Device information boundary
                            </h2>
                            <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                                MediBrief does not yet maintain a standalone implant or assistive-device inventory. The device section below shows only confirmed procedure or document records containing device-related terms such as implant, pacemaker, stent, prosthesis, catheter, port, or pump. A keyword match is evidence to review, not proof of a currently implanted device.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                        <ModuleSearch
                            value={search}
                            onChange={setSearch}
                            placeholder="Search procedure, body site, reason, outcome, complication, device term, performer, or source"
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
                        <button
                            type="button"
                            onClick={() => setDeviceRelatedOnly(value => !value)}
                            aria-pressed={deviceRelatedOnly}
                            className={`rounded-xl border px-4 py-3 text-[10px] font-bold uppercase tracking-wide transition-colors ${deviceRelatedOnly
                                ? 'border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300'
                            }`}
                        >
                            Device-related only
                        </button>
                    </div>
                </section>

                {viewModel.deviceRelatedRecords.length > 0 && (
                    <section className="rounded-3xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900/50 dark:bg-violet-950/20 md:p-5">
                        <div className="flex items-center gap-2 text-violet-800 dark:text-violet-200">
                            <ShieldCheckIcon className="h-5 w-5" />
                            <h2 className="text-sm font-bold">
                                Device-related confirmed evidence
                            </h2>
                        </div>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            {viewModel.deviceRelatedRecords.map(item => (
                                <div
                                    key={`${item.sourceType}-${item.id}`}
                                    className="rounded-2xl border border-violet-100 bg-white p-4 dark:border-violet-900/40 dark:bg-slate-950"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                                                {item.label}
                                            </p>
                                            <p className="mt-0.5 text-[9px] font-mono uppercase tracking-wide text-violet-600 dark:text-violet-300">
                                                {item.sourceType} · {item.dateLabel}
                                            </p>
                                        </div>
                                        {!item.knownClinicalDate && (
                                            <StatusBadge tone="warning">
                                                Date unknown
                                            </StatusBadge>
                                        )}
                                    </div>
                                    {item.detail && (
                                        <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                            {item.detail}
                                        </p>
                                    )}
                                    <div className="mt-3 flex flex-wrap gap-1">
                                        {item.matchedTerms.map(term => (
                                            <span
                                                key={term}
                                                className="rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                                            >
                                                {term}
                                            </span>
                                        ))}
                                    </div>
                                    {item.sourceType === 'document' && (
                                        <button
                                            type="button"
                                            onClick={() => setSource({ documentId: item.id })}
                                            className="mt-3 flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300"
                                        >
                                            <DocumentTextIcon className="h-3.5 w-3.5" />
                                            Open document
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {viewModel.items.length === 0 ? (
                    <EmptyModuleState
                        title="No confirmed procedures match these filters"
                        description="Adjust the search, status, scope, or device-related filter. Pending procedure candidates remain outside this list until reviewed."
                        caution="An empty procedure list does not prove that no surgery or intervention occurred outside this local record."
                    />
                ) : (
                    <div className="space-y-3">
                        {viewModel.items.map(item => (
                            <details
                                key={item.id}
                                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm open:border-blue-200 dark:border-slate-800 dark:bg-slate-950/80 dark:open:border-blue-800"
                            >
                                <summary className="flex cursor-pointer list-none items-start gap-3 p-4 md:p-5">
                                    <span className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${item.deviceRelated
                                        ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300'
                                        : 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                    }`}>
                                        <ActivityIcon className="h-5 w-5" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-bold text-slate-950 dark:text-white">
                                                {item.name}
                                            </span>
                                            <StatusBadge tone={statusTone(item.status)}>
                                                {item.statusLabel}
                                            </StatusBadge>
                                            {item.deviceRelated && (
                                                <StatusBadge tone="info">
                                                    Device-related evidence
                                                </StatusBadge>
                                            )}
                                            {!item.knownClinicalDate && (
                                                <StatusBadge tone="warning">
                                                    Clinical date unknown
                                                </StatusBadge>
                                            )}
                                        </span>
                                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                            {item.performedLabel}
                                        </span>
                                        {item.bodySites.length > 0 && (
                                            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                                Body site: {item.bodySites.join(', ')}
                                            </span>
                                        )}
                                    </span>
                                    <ChevronRightIcon className="mt-2 h-4 w-4 flex-shrink-0 text-slate-300 transition-transform group-open:rotate-90" />
                                </summary>

                                <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800 md:px-5 md:pb-5">
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        {[
                                            ['Reasons', item.reasons.join(', ') || 'Not recorded'],
                                            ['Outcome', item.outcome || 'Not recorded'],
                                            ['Complications', item.complications.join(', ') || 'None recorded'],
                                            ['Performers', item.performers.join(', ') || 'Not recorded'],
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

                                    {item.encounter && (
                                        <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-950/20">
                                            <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-blue-500">
                                                Linked encounter
                                            </p>
                                            <p className="mt-1 text-sm font-semibold text-blue-900 dark:text-blue-100">
                                                {item.encounter.label}
                                                {item.encounter.dateLabel
                                                    ? ` · ${item.encounter.dateLabel}`
                                                    : ''}
                                            </p>
                                        </div>
                                    )}

                                    {item.note && (
                                        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                                            {item.note}
                                        </div>
                                    )}

                                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                                        <LinkedList title="Reports" items={item.linkedReports} />
                                        <LinkedList title="Documents" items={item.linkedDocuments} />
                                    </div>

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

export default ProceduresModule;
