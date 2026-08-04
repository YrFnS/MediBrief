import React, { useMemo } from 'react';
import {
    AlertTriangleIcon,
    DocumentTextIcon,
    ShieldCheckIcon,
} from '../../../components/icons';
import type { PatientClinicalRecord } from '../../clinical-record/types';
import { buildDeterministicPatientSummary } from '../summary';

interface DeterministicPatientSummaryPanelProps {
    record: PatientClinicalRecord;
}

const DeterministicPatientSummaryPanel: React.FC<
    DeterministicPatientSummaryPanelProps
> = ({ record }) => {
    const summary = useMemo(
        () => buildDeterministicPatientSummary(record),
        [record],
    );

    return (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                        <ShieldCheckIcon className="h-5 w-5" />
                    </span>
                    <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                            No AI required
                        </p>
                        <h2 className="mt-1 text-xl font-display font-bold text-slate-950 dark:text-white">
                            Deterministic confirmed-record summary
                        </h2>
                        <p className="mt-2 max-w-3xl text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                            Built locally from the same confirmed, patient-applicable evidence boundary used for grounded Assistant questions. Candidate content is counted but not shown as patient fact.
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide">
                    <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                        {summary.pendingCandidateCount} pending candidate{summary.pendingCandidateCount === 1 ? '' : 's'}
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {summary.diagnosticConflictCount} diagnostic conflict{summary.diagnosticConflictCount === 1 ? '' : 's'}
                    </span>
                </div>
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {summary.sections.map(currentSection => (
                    <section
                        key={currentSection.key}
                        className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50"
                    >
                        <div className="flex items-start gap-2">
                            <DocumentTextIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                    {currentSection.title}
                                </h3>
                                <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                                    {currentSection.description}
                                </p>
                            </div>
                        </div>

                        {currentSection.items.length === 0 ? (
                            <p className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white px-3 py-3 text-xs leading-relaxed text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                                {currentSection.emptyState}
                            </p>
                        ) : (
                            <div className="mt-3 space-y-2">
                                {currentSection.items.map(item => (
                                    <article
                                        key={item.evidenceId}
                                        className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-950"
                                    >
                                        <p className="text-xs font-semibold leading-relaxed text-slate-800 dark:text-slate-100">
                                            {item.statement}
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-mono text-slate-500 dark:text-slate-400">
                                            <span>{item.dateLabel}</span>
                                            <span>{item.sourceLabel}</span>
                                        </div>
                                        <code className="mt-2 block break-all text-[9px] text-blue-700 dark:text-blue-300">
                                            [{item.evidenceId}]
                                        </code>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                ))}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
                        <AlertTriangleIcon className="h-4 w-4" />
                        <h3 className="text-xs font-bold uppercase tracking-wider">
                            Missing or incomplete information
                        </h3>
                    </div>
                    <ul className="mt-3 space-y-2 text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/80">
                        {summary.missingInformation.length === 0 ? (
                            <li>No tracked summary gap was detected. The record may still be incomplete.</li>
                        ) : summary.missingInformation.map(item => (
                            <li key={item}>• {item}</li>
                        ))}
                    </ul>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                        Summary limits
                    </h3>
                    <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {summary.limitations.map(item => (
                            <li key={item}>• {item}</li>
                        ))}
                    </ul>
                </section>
            </div>
        </section>
    );
};

export default DeterministicPatientSummaryPanel;
