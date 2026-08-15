import React, { useMemo } from 'react';
import {
    ChevronRightIcon,
    ClockIcon,
    DrugsIcon,
    ListChecksIcon,
    RecordIcon,
    UserIcon,
} from '../../../components/icons';
import { useAuditStore } from '../../audit/useAuditStore';
import type { PatientClinicalRecord } from '../../clinical-record';
import type { PersonalHealthDataNavigationIntent } from '../navigationTypes';
import {
    buildTodayAttentionViewModel,
    type TodayAttentionKind,
} from '../todayAttention';

interface TodayAttentionPanelProps {
    record: PatientClinicalRecord;
    onOpenHealthDataSection: (
        intent: PersonalHealthDataNavigationIntent,
    ) => void;
}

const ATTENTION_ICONS: Record<
    TodayAttentionKind,
    React.ComponentType<{ className?: string }>
> = {
    'medication-reconciliation': DrugsIcon,
    'explicit-reminders': ClockIcon,
    tasks: ListChecksIcon,
    appointments: UserIcon,
    'record-gaps': RecordIcon,
};

const TodayAttentionPanel: React.FC<TodayAttentionPanelProps> = ({
    record,
    onOpenHealthDataSection,
}) => {
    const auditEvents = useAuditStore(state => state.logs);
    const attention = useMemo(
        () => buildTodayAttentionViewModel(record, auditEvents),
        [auditEvents, record],
    );

    return (
        <section
            aria-labelledby="today-attention-heading"
            className="flex-shrink-0 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95 md:px-6"
        >
            <div className="mx-auto w-full max-w-7xl">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                            Today
                        </p>
                        <h1
                            id="today-attention-heading"
                            className="mt-1 text-lg font-display font-bold tracking-tight text-slate-950 dark:text-white"
                        >
                            Review &amp; follow-up
                        </h1>
                        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                            Deterministic signals from existing review states, recorded due dates, and confirmed care records.
                        </p>
                    </div>

                    {attention.candidateCount > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                            <strong>{attention.candidateCount}</strong>{' '}
                            candidate {attention.candidateCount === 1
                                ? 'record is'
                                : 'records are'} available in the review banner above.
                        </div>
                    )}
                </div>

                {attention.hasTrackedAttention ? (
                    <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1 xl:grid xl:grid-cols-5 xl:overflow-visible">
                        {attention.items.map(item => {
                            const Icon = ATTENTION_ICONS[item.kind];
                            return (
                                <article
                                    key={item.id}
                                    className="flex min-w-[245px] flex-1 flex-col rounded-2xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/70 xl:min-w-0"
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300">
                                            <Icon className="h-4 w-4" />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                                                    {item.count}
                                                </span>
                                                <h2 className="truncate text-xs font-bold text-slate-900 dark:text-white">
                                                    {item.title}
                                                </h2>
                                            </div>
                                            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                                                {item.description}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => onOpenHealthDataSection(
                                            item.destination,
                                        )}
                                        className="mt-3 inline-flex min-h-11 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-blue-700 dark:hover:text-blue-300"
                                    >
                                        <span>{item.actionLabel}</span>
                                        <ChevronRightIcon className="h-4 w-4" />
                                    </button>
                                </article>
                            );
                        })}
                    </div>
                ) : (
                    <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                        No tracked review or follow-up signal is currently open. This does not mean the record is complete or provide a medical all-clear.
                    </div>
                )}

                <p className="mt-3 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {attention.evidenceBoundary}
                </p>
            </div>
        </section>
    );
};

export default TodayAttentionPanel;
