import React, { useMemo, useState } from 'react';
import {
    AlertTriangleIcon,
    ChevronRightIcon,
    ClockIcon,
} from '../../../components/icons';
import DocumentSourcePreview from '../../clinical-record/components/DocumentSourcePreview';
import type {
    PatientClinicalRecord,
    SourceDocumentReference,
} from '../../clinical-record/types';
import type { ClinicalHistoryScope } from '../coreModuleTypes';
import type { AppointmentTimingFilter } from '../planningModuleTypes';
import { buildAppointmentsModuleViewModel } from '../planningModuleViewModels';
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

interface AppointmentsModuleProps {
    record: PatientClinicalRecord;
    onReviewCandidates: () => void;
}

const statusTone = (
    status: string,
): 'positive' | 'warning' | 'danger' | 'neutral' | 'info' => {
    if (status === 'booked' || status === 'arrived' || status === 'fulfilled') {
        return 'positive';
    }
    if (status === 'proposed' || status === 'pending' || status === 'unknown') {
        return 'warning';
    }
    if (status === 'cancelled' || status === 'no-show' || status === 'entered-in-error') {
        return 'danger';
    }
    return 'neutral';
};

const timingTone = (
    timing: string,
): 'positive' | 'warning' | 'neutral' => {
    if (timing === 'upcoming') return 'positive';
    if (timing === 'unknown') return 'warning';
    return 'neutral';
};

const AppointmentsModule: React.FC<AppointmentsModuleProps> = ({
    record,
    onReviewCandidates,
}) => {
    const [search, setSearch] = useState('');
    const [scope, setScope] = useState<ClinicalHistoryScope>('current');
    const [status, setStatus] = useState('all');
    const [timing, setTiming] = useState<AppointmentTimingFilter>('all');
    const [source, setSource] = useState<SourceDocumentReference | null>(null);

    const viewModel = useMemo(() => buildAppointmentsModuleViewModel(record, {
        search,
        scope,
        status,
        timing,
    }), [record, scope, search, status, timing]);

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-5 md:px-6 md:py-7">
                <ModuleHeader
                    eyebrow="Scheduling record"
                    title="Appointments"
                    description="Local appointment proposals and recorded appointment states. A date or time never proves that a clinic accepted or booked the request."
                    candidateCount={viewModel.candidateCount}
                    onReviewCandidates={onReviewCandidates}
                >
                    <MetricGrid metrics={[
                        {
                            label: 'Current',
                            value: viewModel.currentCount,
                            helper: 'proposed, pending, booked, or active',
                        },
                        {
                            label: 'Proposed',
                            value: viewModel.proposedCount,
                            helper: 'not booked',
                            emphasis: viewModel.proposedCount > 0
                                ? 'warning'
                                : 'default',
                        },
                        {
                            label: 'Recorded booked',
                            value: viewModel.bookedCount,
                            helper: 'verify with source',
                        },
                        {
                            label: 'Unknown date',
                            value: viewModel.unknownDateCount,
                            emphasis: viewModel.unknownDateCount > 0
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
                                Booking state is explicit
                            </h2>
                            <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                                Proposed and pending records are not bookings. A record marked booked reflects its confirmed local source, but MediBrief does not contact a clinic or independently verify availability.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                        <ModuleSearch
                            value={search}
                            onChange={setSearch}
                            placeholder="Search title, reason, participant, location, date, status, or source"
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
                            label="Requested time"
                            value={timing}
                            onChange={value => setTiming(value as AppointmentTimingFilter)}
                            options={[
                                { value: 'all', label: 'All times' },
                                { value: 'upcoming', label: 'Upcoming' },
                                { value: 'past', label: 'Past' },
                                { value: 'unknown', label: 'Unknown date' },
                            ]}
                        />
                    </div>
                </section>

                {viewModel.items.length === 0 ? (
                    <EmptyModuleState
                        title={viewModel.totalConfirmed === 0
                            ? 'No appointment record is confirmed'
                            : 'No appointments match these filters'}
                        description={viewModel.totalConfirmed === 0
                            ? 'Appointment proposals and imported appointment states will appear here after they are confirmed.'
                            : 'Adjust the current/history, status, requested-time, or text filters.'}
                        caution="An empty local list does not prove that the patient has no appointments with an external clinic."
                    />
                ) : (
                    <div className="space-y-3">
                        {viewModel.items.map(item => (
                            <details
                                key={item.id}
                                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm open:border-blue-200 dark:border-slate-800 dark:bg-slate-950/80 dark:open:border-blue-800"
                            >
                                <summary className="flex cursor-pointer list-none items-start gap-3 p-4 md:p-5">
                                    <span className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${item.status === 'booked'
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                        : item.status === 'proposed' || item.status === 'pending'
                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                            : 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                                    }`}>
                                        <ClockIcon className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span className="text-sm font-bold text-slate-950 dark:text-white">
                                                {item.title}
                                            </span>
                                            <StatusBadge tone={statusTone(item.status)}>
                                                {item.statusLabel}
                                            </StatusBadge>
                                            <StatusBadge tone={timingTone(item.timing)}>
                                                {item.timingLabel}
                                            </StatusBadge>
                                        </span>
                                        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                            {item.bookingMeaning} · {item.startLabel}
                                            {item.location ? ` · ${item.location}` : ''}
                                        </span>
                                    </span>
                                    <ChevronRightIcon className="mt-2 h-4 w-4 flex-shrink-0 text-slate-300 transition-transform group-open:rotate-90" />
                                </summary>

                                <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800 md:px-5 md:pb-5">
                                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                        {[
                                            ['Booking meaning', item.bookingMeaning],
                                            ['Start / requested', item.startLabel],
                                            ['End', item.endLabel],
                                            ['Location', item.location || 'Not recorded'],
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

                                    {item.requestedPeriodLabels.length > 0 && (
                                        <div className="mt-4">
                                            <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                Requested periods
                                            </p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {item.requestedPeriodLabels.map((period, index) => (
                                                    <StatusBadge key={`${item.id}-period-${index}`} tone="info">
                                                        {period}
                                                    </StatusBadge>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                                        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                                            <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                Reasons
                                            </p>
                                            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                                {item.reasons.join(', ') || 'Not recorded'}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                                            <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                Linked encounter
                                            </p>
                                            <p className={`mt-2 text-xs font-semibold ${item.encounter?.missing
                                                ? 'text-amber-700 dark:text-amber-300'
                                                : 'text-slate-700 dark:text-slate-200'
                                            }`}>
                                                {item.encounter?.label || 'Not linked'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4">
                                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                            Participants
                                        </p>
                                        {item.participants.length === 0 ? (
                                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                                                No participants are recorded.
                                            </p>
                                        ) : (
                                            <div className="mt-2 grid gap-2 lg:grid-cols-2">
                                                {item.participants.map((participant, index) => (
                                                    <div
                                                        key={`${item.id}-participant-${index}`}
                                                        className="rounded-xl border border-slate-200 p-3 dark:border-slate-800"
                                                    >
                                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                                            {participant.name}
                                                        </p>
                                                        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                                                            {participant.role || 'Role not recorded'}
                                                            {participant.statusLabel
                                                                ? ` · ${participant.statusLabel}`
                                                                : ''}
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

export default AppointmentsModule;
