import React, { useMemo, useState } from 'react';
import {
    ChevronRightIcon,
    ClockIcon,
    DocumentTextIcon,
    UserIcon,
} from '../../../components/icons';
import DocumentSourcePreview from '../../clinical-record/components/DocumentSourcePreview';
import type {
    PatientClinicalRecord,
    SourceDocumentReference,
} from '../../clinical-record/types';
import type { ClinicalHistoryScope } from '../coreModuleTypes';
import { buildEncounterModuleViewModel } from '../longitudinalModuleViewModels';
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

interface VisitsModuleProps {
    record: PatientClinicalRecord;
    onReviewCandidates: () => void;
}

const encounterTone = (
    status: string,
): 'positive' | 'info' | 'warning' | 'danger' | 'neutral' => {
    if (status === 'finished') return 'positive';
    if (status === 'in-progress') return 'info';
    if (status === 'planned') return 'warning';
    if (status === 'cancelled') return 'danger';
    return 'neutral';
};

const LinkedGroup: React.FC<{
    title: string;
    items: Array<{
        id: string;
        resourceType: string;
        label: string;
        dateLabel?: string;
        missing?: boolean;
    }>;
}> = ({ title, items }) => (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
            {title}
        </p>
        {items.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                No linked record is available.
            </p>
        ) : (
            <div className="mt-2 space-y-1.5">
                {items.map(item => (
                    <div
                        key={`${item.resourceType}-${item.id}`}
                        className={`rounded-lg border px-2.5 py-2 ${item.missing
                            ? 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20'
                            : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'
                        }`}
                    >
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                            {item.label}
                        </p>
                        <p className="mt-0.5 text-[9px] font-mono uppercase tracking-wide text-slate-400">
                            {item.resourceType}{item.dateLabel ? ` · ${item.dateLabel}` : ''}
                        </p>
                    </div>
                ))}
            </div>
        )}
    </div>
);

const VisitsModule: React.FC<VisitsModuleProps> = ({
    record,
    onReviewCandidates,
}) => {
    const [search, setSearch] = useState('');
    const [scope, setScope] = useState<ClinicalHistoryScope>('all');
    const [status, setStatus] = useState('all');
    const [encounterClass, setEncounterClass] = useState('all');
    const [source, setSource] = useState<SourceDocumentReference | null>(null);
    const viewModel = useMemo(() => buildEncounterModuleViewModel(record, {
        search,
        scope,
        status,
        encounterClass,
    }), [encounterClass, record, scope, search, status]);

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-5 md:px-6 md:py-7">
                <ModuleHeader
                    eyebrow="Longitudinal care history"
                    title="Visits and encounters"
                    description="Confirmed planned, active, and historical encounters with participants, reasons, locations, service providers, linked notes, procedures, reports, documents, and source history."
                    candidateCount={viewModel.candidateCount}
                    onReviewCandidates={onReviewCandidates}
                >
                    <MetricGrid metrics={[
                        {
                            label: 'Current / planned',
                            value: viewModel.currentCount,
                            helper: 'planned, active, or unknown',
                        },
                        {
                            label: 'Historical',
                            value: viewModel.historicalCount,
                            helper: 'finished or cancelled',
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
                            placeholder="Search visit type, reason, participant, location, provider, linked record, or source"
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
                            label="Class"
                            value={encounterClass}
                            onChange={setEncounterClass}
                            options={[
                                { value: 'all', label: 'All classes' },
                                ...viewModel.classOptions.map(value => ({
                                    value,
                                    label: value.replace(/-/g, ' '),
                                })),
                            ]}
                        />
                    </div>
                </section>

                {viewModel.items.length === 0 ? (
                    <EmptyModuleState
                        title="No confirmed encounters match these filters"
                        description="Adjust the search, status, class, or current/history filter. Pending candidates remain outside this confirmed list until reviewed."
                        caution="An empty encounter list does not prove that the patient has never received care."
                    />
                ) : (
                    <div className="space-y-3">
                        {viewModel.items.map(item => (
                            <details
                                key={item.id}
                                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm open:border-blue-200 dark:border-slate-800 dark:bg-slate-950/80 dark:open:border-blue-800"
                            >
                                <summary className="flex cursor-pointer list-none items-start gap-3 p-4 md:p-5">
                                    <span className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                        <UserIcon className="h-5 w-5" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-bold text-slate-950 dark:text-white">
                                                {item.title}
                                            </span>
                                            <StatusBadge tone={encounterTone(item.status)}>
                                                {item.statusLabel}
                                            </StatusBadge>
                                            <StatusBadge tone="neutral">
                                                {item.encounterClassLabel}
                                            </StatusBadge>
                                            {!item.knownClinicalDate && (
                                                <StatusBadge tone="warning">
                                                    Clinical date unknown
                                                </StatusBadge>
                                            )}
                                        </span>
                                        <span className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                            <ClockIcon className="h-3.5 w-3.5" />
                                            {item.periodLabel}
                                        </span>
                                        {(item.location || item.serviceProvider) && (
                                            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                                {[item.location, item.serviceProvider]
                                                    .filter(Boolean)
                                                    .join(' · ')}
                                            </span>
                                        )}
                                    </span>
                                    <ChevronRightIcon className="mt-2 h-4 w-4 flex-shrink-0 text-slate-300 transition-transform group-open:rotate-90" />
                                </summary>

                                <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800 md:px-5 md:pb-5">
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        {[
                                            ['Start', item.startLabel],
                                            ['End', item.endLabel],
                                            ['Location', item.location || 'Not recorded'],
                                            ['Service provider', item.serviceProvider || 'Not recorded'],
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

                                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                                            <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                Reasons
                                            </p>
                                            <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                                                {item.reasons.join(', ') || 'Not recorded'}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                                            <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                Participants
                                            </p>
                                            {item.participants.length === 0 ? (
                                                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                                                    Not recorded
                                                </p>
                                            ) : (
                                                <div className="mt-2 space-y-2">
                                                    {item.participants.map((participant, index) => (
                                                        <div key={`${item.id}-participant-${index}`} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-900">
                                                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                                                {participant.person || participant.organization || 'Participant'}
                                                            </p>
                                                            {participant.role && (
                                                                <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                                                                    {participant.role}
                                                                </p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        <LinkedGroup title="Clinical notes" items={item.linkedNotes} />
                                        <LinkedGroup title="Procedures" items={item.linkedProcedures} />
                                        <LinkedGroup title="Reports" items={item.linkedReports} />
                                        <LinkedGroup title="Documents" items={item.linkedDocuments} />
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

export default VisitsModule;
