import React, { useMemo } from 'react';
import {
    ActivityIcon,
    AlertTriangleIcon,
    ChevronRightIcon,
    ClockIcon,
    DocumentTextIcon,
    DrugsIcon,
    ListChecksIcon,
    ShieldCheckIcon,
    UserIcon,
} from '../../../components/icons';
import type { PatientClinicalRecord } from '../../clinical-record';
import { buildPatientOverviewViewModel } from '../viewModels';

interface PatientOverviewProps {
    record: PatientClinicalRecord;
    onOpenTimeline: () => void;
    onOpenEmergency: () => void;
}

const EmptyMessage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs leading-relaxed text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
        {children}
    </div>
);

const SectionCard: React.FC<{
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    accentClass: string;
    children: React.ReactNode;
}> = ({ title, icon: Icon, accentClass, children }) => (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mb-3 flex items-center gap-2">
            <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${accentClass}`}>
                <Icon className="h-4 w-4" />
            </span>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                {title}
            </h2>
        </div>
        {children}
    </section>
);

const PatientOverview: React.FC<PatientOverviewProps> = ({
    record,
    onOpenTimeline,
    onOpenEmergency,
}) => {
    const overview = useMemo(
        () => buildPatientOverviewViewModel(record),
        [record],
    );

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-slate-950">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 md:px-6 md:py-7">
                <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-950">
                    <div className="grid gap-5 p-5 md:grid-cols-[1.4fr_1fr] md:p-7">
                        <div className="min-w-0">
                            <div className="mb-4 flex items-start gap-3">
                                <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
                                    <UserIcon className="h-6 w-6" />
                                </span>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-blue-600">
                                        Confirmed personal record
                                    </p>
                                    <h1 className="mt-1 truncate text-2xl font-display font-bold tracking-tight text-slate-950 dark:text-white md:text-3xl">
                                        {overview.patientName}
                                    </h1>
                                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-wide text-slate-500">
                                        {overview.primaryIdentifier && (
                                            <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                                                {overview.primaryIdentifier}
                                            </span>
                                        )}
                                        <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                                            Updated {overview.updatedLabel}
                                        </span>
                                        {overview.pendingCandidates > 0 && (
                                            <span className="rounded-full bg-amber-100 px-2.5 py-1 font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                                                {overview.pendingCandidates} pending review
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-5 gap-y-4 text-sm sm:grid-cols-3">
                                {[
                                    ['Date of birth', overview.dateOfBirthLabel],
                                    ['Age', overview.ageLabel || 'Not calculated'],
                                    ['Sex', overview.administrativeSexLabel],
                                    ['Blood type', overview.bloodTypeLabel],
                                    ['Language', overview.preferredLanguageLabel],
                                    ['Contact', overview.contactLabel],
                                ].map(([label, value]) => (
                                    <div key={label} className="min-w-0">
                                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                            {label}
                                        </p>
                                        <p className="mt-1 truncate font-medium text-slate-800 dark:text-slate-200" title={value}>
                                            {value}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/50 dark:bg-blue-950/30">
                            <div>
                                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                                    <ShieldCheckIcon className="h-5 w-5" />
                                    <h2 className="text-sm font-bold">Emergency-ready view</h2>
                                </div>
                                <p className="mt-2 text-xs leading-relaxed text-blue-800/75 dark:text-blue-200/70">
                                    Open a deterministic summary built only from confirmed structured records. Missing information stays clearly marked as unknown.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onOpenEmergency}
                                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-blue-500/20 transition-colors hover:bg-blue-500"
                            >
                                Open emergency summary
                                <ChevronRightIcon className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </section>

                <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                    {overview.metrics.map(metric => (
                        <div
                            key={metric.key}
                            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80"
                        >
                            <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                {metric.label}
                            </p>
                            <p className="mt-2 text-2xl font-display font-bold text-slate-900 dark:text-white">
                                {metric.value}
                            </p>
                            <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                                {metric.helper}
                            </p>
                        </div>
                    ))}
                </section>

                <section className="grid gap-4 xl:grid-cols-3">
                    <SectionCard
                        title="Active conditions"
                        icon={ActivityIcon}
                        accentClass="bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                    >
                        {overview.activeConditions.length === 0 ? (
                            <EmptyMessage>
                                No active condition is currently confirmed. This does not prove that none exist.
                            </EmptyMessage>
                        ) : (
                            <div className="space-y-2">
                                {overview.activeConditions.slice(0, 6).map(condition => (
                                    <div key={condition.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                {condition.name}
                                            </p>
                                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold uppercase text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                                                {condition.status}
                                            </span>
                                        </div>
                                        {condition.detail && (
                                            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                                {condition.detail}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </SectionCard>

                    <SectionCard
                        title="Allergies"
                        icon={AlertTriangleIcon}
                        accentClass="bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                    >
                        {overview.activeAllergies.length === 0 ? (
                            <EmptyMessage>
                                Allergy status is unknown because no active allergy record is confirmed.
                            </EmptyMessage>
                        ) : (
                            <div className="space-y-2">
                                {overview.activeAllergies.slice(0, 6).map(allergy => (
                                    <div key={allergy.id} className="rounded-xl border border-red-100 bg-red-50/70 p-3 dark:border-red-900/40 dark:bg-red-950/25">
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="text-sm font-semibold text-red-900 dark:text-red-100">
                                                {allergy.name}
                                            </p>
                                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold uppercase text-red-700 dark:bg-red-950 dark:text-red-300">
                                                {allergy.criticality}
                                            </span>
                                        </div>
                                        {allergy.reactions.length > 0 && (
                                            <p className="mt-1 text-xs leading-relaxed text-red-800/70 dark:text-red-200/70">
                                                {allergy.reactions.join('; ')}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </SectionCard>

                    <SectionCard
                        title="Active medications"
                        icon={DrugsIcon}
                        accentClass="bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300"
                    >
                        {overview.activeMedications.length === 0 ? (
                            <EmptyMessage>
                                No active medication is confirmed in the structured record.
                            </EmptyMessage>
                        ) : (
                            <div className="space-y-2">
                                {overview.activeMedications.slice(0, 6).map(medication => (
                                    <div key={medication.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                {medication.name}
                                            </p>
                                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold uppercase text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                                                {medication.status}
                                            </span>
                                        </div>
                                        {medication.dosage && (
                                            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                                {medication.dosage}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </SectionCard>
                </section>

                <section className="grid gap-4 xl:grid-cols-[1fr_1.35fr_1fr]">
                    <SectionCard
                        title="Follow-up"
                        icon={ListChecksIcon}
                        accentClass="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                    >
                        {overview.pendingFollowUp.length === 0 ? (
                            <EmptyMessage>
                                No open confirmed task or appointment proposal is recorded.
                            </EmptyMessage>
                        ) : (
                            <div className="space-y-2">
                                {overview.pendingFollowUp.slice(0, 6).map(item => (
                                    <div key={item.id} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                                        <div className="flex items-start gap-2">
                                            <ClockIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                    {item.title}
                                                </p>
                                                <p className="mt-0.5 text-[10px] font-mono uppercase tracking-wide text-slate-400">
                                                    {item.kind} · {item.status} · {item.dateLabel}
                                                </p>
                                                {item.detail && (
                                                    <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
                                                        {item.detail}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </SectionCard>

                    <SectionCard
                        title="Recent record history"
                        icon={DocumentTextIcon}
                        accentClass="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    >
                        {overview.recentTimeline.length === 0 ? (
                            <EmptyMessage>
                                No confirmed timeline event is available yet.
                            </EmptyMessage>
                        ) : (
                            <div className="space-y-2">
                                {overview.recentTimeline.map(item => (
                                    <div key={item.resourceId} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800">
                                        <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                    {item.label}
                                                </p>
                                                <span className="text-[9px] font-mono uppercase tracking-wide text-slate-400">
                                                    {item.dateLabel}
                                                </span>
                                            </div>
                                            <p className="mt-0.5 text-[9px] font-mono uppercase tracking-wide text-blue-600 dark:text-blue-400">
                                                {item.resourceTypeLabel}
                                            </p>
                                            {item.detail && (
                                                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                                    {item.detail}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={onOpenTimeline}
                                    className="flex w-full items-center justify-center gap-1 rounded-xl border border-slate-200 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300"
                                >
                                    View full timeline
                                    <ChevronRightIcon className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        )}
                    </SectionCard>

                    <SectionCard
                        title="Record gaps"
                        icon={AlertTriangleIcon}
                        accentClass="bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                    >
                        {overview.dataGaps.length === 0 ? (
                            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-xs leading-relaxed text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                                No tracked overview gap is currently detected. The record may still be incomplete.
                            </div>
                        ) : (
                            <ul className="space-y-2">
                                {overview.dataGaps.map(gap => (
                                    <li key={gap} className="flex items-start gap-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
                                        <span>{gap}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </SectionCard>
                </section>
            </div>
        </div>
    );
};

export default PatientOverview;
