import React, { useMemo, useState } from 'react';
import {
    ActivityIcon,
    AlertTriangleIcon,
    ChevronRightIcon,
    DocumentTextIcon,
} from '../../../components/icons';
import DocumentSourcePreview from '../../clinical-record/components/DocumentSourcePreview';
import type {
    PatientClinicalRecord,
    SourceDocumentReference,
} from '../../clinical-record/types';
import type {
    ResultsContentFilter,
    ResultsInterpretationFilter,
} from '../coreModuleTypes';
import { buildResultsModuleViewModel } from '../coreModuleViewModels';
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

interface ResultsModuleProps {
    record: PatientClinicalRecord;
    onReviewCandidates: () => void;
}

const reportTone = (
    status: string,
): 'positive' | 'warning' | 'neutral' => {
    if (['final', 'amended', 'corrected'].includes(status)) return 'positive';
    if (['partial', 'preliminary', 'registered', 'unknown'].includes(status)) {
        return 'warning';
    }
    return 'neutral';
};

const ResultsModule: React.FC<ResultsModuleProps> = ({
    record,
    onReviewCandidates,
}) => {
    const [search, setSearch] = useState('');
    const [content, setContent] = useState<ResultsContentFilter>('all');
    const [interpretation, setInterpretation] =
        useState<ResultsInterpretationFilter>('all');
    const [category, setCategory] = useState('all');
    const [source, setSource] = useState<SourceDocumentReference | null>(null);
    const viewModel = useMemo(() => buildResultsModuleViewModel(record, {
        search,
        content,
        interpretation,
        category,
    }), [category, content, interpretation, record, search]);
    const visibleCount = viewModel.reports.length + viewModel.observations.length;

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-5 md:px-6 md:py-7">
                <ModuleHeader
                    eyebrow="Results record"
                    title="Labs and diagnostic reports"
                    description="Confirmed reports and individual observations with original values, optional normalized values, interpretations, reference ranges, clinical dates, and source history."
                    candidateCount={viewModel.candidateCount}
                    onReviewCandidates={onReviewCandidates}
                >
                    <MetricGrid metrics={[
                        {
                            label: 'Reports',
                            value: viewModel.reportCount,
                            helper: 'confirmed diagnostic reports',
                        },
                        {
                            label: 'Laboratory results',
                            value: viewModel.laboratoryCount,
                            helper: 'confirmed observations',
                        },
                        {
                            label: 'Other observations',
                            value: viewModel.otherObservationCount,
                        },
                        {
                            label: 'Flagged results',
                            value: viewModel.flaggedCount,
                            emphasis: viewModel.flaggedCount > 0
                                ? 'warning'
                                : 'default',
                        },
                    ]} />
                </ModuleHeader>

                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/25">
                    <div className="flex items-start gap-3">
                        <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-300" />
                        <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                            A flag or reference range is reproduced from the confirmed record and is not a diagnosis. Normalized values never replace the original source value. Results with an unknown clinical date stay explicitly undated.
                        </p>
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                        <ModuleSearch
                            value={search}
                            onChange={setSearch}
                            placeholder="Search test, value, report, interpretation, range, performer, or source"
                        />
                        <ScopeTabs
                            value={content}
                            onChange={value => setContent(
                                value as ResultsContentFilter,
                            )}
                            options={[
                                {
                                    value: 'all',
                                    label: 'All',
                                    count: viewModel.totalConfirmed,
                                },
                                {
                                    value: 'reports',
                                    label: 'Reports',
                                    count: viewModel.reportCount,
                                },
                                {
                                    value: 'laboratory',
                                    label: 'Lab results',
                                    count: viewModel.laboratoryCount,
                                },
                                {
                                    value: 'other-observations',
                                    label: 'Other',
                                    count: viewModel.otherObservationCount,
                                },
                            ]}
                        />
                        <ModuleSelect
                            label="Interpretation"
                            value={interpretation}
                            onChange={value => setInterpretation(
                                value as ResultsInterpretationFilter,
                            )}
                            options={[
                                { value: 'all', label: 'All results' },
                                { value: 'flagged', label: 'Flagged only' },
                                { value: 'unflagged', label: 'Unflagged only' },
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

                {visibleCount === 0 ? (
                    <EmptyModuleState
                        title={viewModel.totalConfirmed === 0
                            ? 'No result or diagnostic report is confirmed'
                            : 'No results match these filters'}
                        description={viewModel.totalConfirmed === 0
                            ? 'The confirmed structured record does not yet contain diagnostic reports or individual observations. Pending candidates may still require review.'
                            : 'Adjust the search, content type, interpretation, or category filter.'}
                        caution={viewModel.totalConfirmed === 0
                            ? 'This empty state does not prove that no tests were performed.'
                            : undefined}
                    />
                ) : (
                    <>
                        {viewModel.reports.length > 0 && (
                            <section>
                                <div className="mb-2 flex items-center justify-between">
                                    <div>
                                        <p className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-slate-400">
                                            Report-level records
                                        </p>
                                        <h2 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
                                            Diagnostic reports
                                        </h2>
                                    </div>
                                    <StatusBadge>{viewModel.reports.length} shown</StatusBadge>
                                </div>
                                <div className="space-y-3">
                                    {viewModel.reports.map(report => (
                                        <details
                                            key={report.id}
                                            className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm open:border-blue-200 dark:border-slate-800 dark:bg-slate-950/80 dark:open:border-blue-800"
                                        >
                                            <summary className="flex cursor-pointer list-none items-start gap-3 p-4 md:p-5">
                                                <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                                                    <DocumentTextIcon className="h-4 w-4" />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex flex-wrap items-center gap-2">
                                                        <span className="text-sm font-bold text-slate-950 dark:text-white">
                                                            {report.name}
                                                        </span>
                                                        <StatusBadge tone={reportTone(report.status)}>
                                                            {report.statusLabel}
                                                        </StatusBadge>
                                                        {!report.knownClinicalDate && (
                                                            <StatusBadge tone="warning">
                                                                Clinical date unknown
                                                            </StatusBadge>
                                                        )}
                                                    </span>
                                                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                                        {report.conclusion
                                                            || report.conclusionCodes.join(', ')
                                                            || 'No report conclusion is recorded'}
                                                    </span>
                                                    <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-400">
                                                        <span>Clinical date: {report.clinicalDateLabel}</span>
                                                        <span>{report.resultCount} linked result{report.resultCount === 1 ? '' : 's'}</span>
                                                        <span>{report.specimenCount} specimen reference{report.specimenCount === 1 ? '' : 's'}</span>
                                                    </span>
                                                </span>
                                                <ChevronRightIcon className="mt-2 h-4 w-4 flex-shrink-0 text-slate-300 transition-transform group-open:rotate-90" />
                                            </summary>

                                            <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800 md:px-5 md:pb-5">
                                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                                    {[
                                                        ['Status', report.statusLabel],
                                                        ['Clinical date', report.clinicalDateLabel],
                                                        ['Issued', report.issuedLabel],
                                                        ['Categories', report.categoryLabels.join(', ') || 'Not recorded'],
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

                                                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                                    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                                                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Results</p>
                                                        <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{report.resultCount}</p>
                                                    </div>
                                                    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                                                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Specimens</p>
                                                        <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{report.specimenCount}</p>
                                                    </div>
                                                    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                                                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Documents</p>
                                                        <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{report.documentCount}</p>
                                                    </div>
                                                </div>

                                                {report.linkedResults.length > 0 && (
                                                    <div className="mt-4">
                                                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                            Linked result preview
                                                        </p>
                                                        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                                            {report.linkedResults.map(result => (
                                                                <div
                                                                    key={result.id}
                                                                    className={`rounded-xl border p-3 ${result.flagged
                                                                        ? 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20'
                                                                        : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60'
                                                                    }`}
                                                                >
                                                                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                                                                        {result.name}
                                                                    </p>
                                                                    <p className="mt-1 text-sm font-bold text-slate-950 dark:text-white">
                                                                        {result.valueLabel}
                                                                    </p>
                                                                    {result.flagged && (
                                                                        <p className="mt-1 text-[9px] font-bold uppercase text-amber-700 dark:text-amber-300">
                                                                            Flag recorded
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {(report.conclusion || report.conclusionCodes.length > 0) && (
                                                    <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-sm leading-relaxed text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-100">
                                                        {report.conclusion || report.conclusionCodes.join(', ')}
                                                    </div>
                                                )}

                                                {report.performer.length > 0 && (
                                                    <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                                                        Performer: {report.performer.join(', ')}
                                                    </p>
                                                )}

                                                <ProvenancePanel
                                                    provenance={report.provenance}
                                                    onViewSource={report.provenance.sourceDocument
                                                        ? () => setSource(
                                                            report.provenance.sourceDocument!,
                                                        )
                                                        : undefined}
                                                />
                                            </div>
                                        </details>
                                    ))}
                                </div>
                            </section>
                        )}

                        {viewModel.observations.length > 0 && (
                            <section>
                                <div className="mb-2 flex items-center justify-between">
                                    <div>
                                        <p className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-slate-400">
                                            Individual structured results
                                        </p>
                                        <h2 className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white">
                                            Observations
                                        </h2>
                                    </div>
                                    <StatusBadge>{viewModel.observations.length} shown</StatusBadge>
                                </div>
                                <div className="grid gap-3 xl:grid-cols-2">
                                    {viewModel.observations.map(observation => (
                                        <details
                                            key={observation.id}
                                            className={`group overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-slate-950/80 ${observation.flagged
                                                ? 'border-amber-300 open:border-amber-400 dark:border-amber-900/70'
                                                : 'border-slate-200 open:border-blue-200 dark:border-slate-800 dark:open:border-blue-800'
                                            }`}
                                        >
                                            <summary className="flex cursor-pointer list-none items-start gap-3 p-4">
                                                <span className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${observation.flagged
                                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                                                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                }`}>
                                                    {observation.flagged
                                                        ? <AlertTriangleIcon className="h-4 w-4" />
                                                        : <ActivityIcon className="h-4 w-4" />}
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex flex-wrap items-center gap-2">
                                                        <span className="text-sm font-bold text-slate-950 dark:text-white">
                                                            {observation.name}
                                                        </span>
                                                        {observation.flagged && (
                                                            <StatusBadge tone="warning">Flagged</StatusBadge>
                                                        )}
                                                        <StatusBadge>{observation.statusLabel}</StatusBadge>
                                                        {!observation.knownClinicalDate && (
                                                            <StatusBadge tone="warning">Undated</StatusBadge>
                                                        )}
                                                    </span>
                                                    <span className="mt-1 block text-lg font-display font-bold text-slate-900 dark:text-white">
                                                        {observation.valueLabel}
                                                    </span>
                                                    <span className="mt-1 block text-[10px] text-slate-400">
                                                        {observation.clinicalDateLabel}
                                                        {observation.categoryLabels.length > 0
                                                            ? ` · ${observation.categoryLabels.join(', ')}`
                                                            : ''}
                                                    </span>
                                                </span>
                                                <ChevronRightIcon className="mt-2 h-4 w-4 flex-shrink-0 text-slate-300 transition-transform group-open:rotate-90" />
                                            </summary>

                                            <div className="border-t border-slate-100 px-4 pb-4 pt-3 dark:border-slate-800">
                                                <div className="grid gap-2 sm:grid-cols-2">
                                                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
                                                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Clinical date</p>
                                                        <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-100">{observation.clinicalDateLabel}</p>
                                                    </div>
                                                    <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
                                                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Issued</p>
                                                        <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-100">{observation.issuedLabel}</p>
                                                    </div>
                                                </div>

                                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                                    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                                                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Original source value</p>
                                                        <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                                                            {observation.originalValueLabel || observation.valueLabel}
                                                        </p>
                                                    </div>
                                                    <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                                                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Normalized value</p>
                                                        <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                                                            {observation.normalizedValueLabel || 'Not available'}
                                                        </p>
                                                    </div>
                                                </div>

                                                {observation.normalizationWarning && (
                                                    <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                                                        Data-quality warning: {observation.normalizationWarning}
                                                    </p>
                                                )}

                                                <div className="mt-3">
                                                    <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                        Interpretation
                                                    </p>
                                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                                        {observation.interpretationLabels.length > 0
                                                            ? observation.interpretationLabels.map(label => (
                                                                <StatusBadge
                                                                    key={label}
                                                                    tone={observation.flagged
                                                                        ? 'warning'
                                                                        : 'neutral'}
                                                                >
                                                                    {label}
                                                                </StatusBadge>
                                                            ))
                                                            : <span className="text-xs text-slate-500 dark:text-slate-400">No interpretation recorded</span>}
                                                    </div>
                                                </div>

                                                <div className="mt-3">
                                                    <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                        Reference ranges
                                                    </p>
                                                    <div className="mt-1 flex flex-wrap gap-1.5">
                                                        {observation.referenceRanges.length > 0
                                                            ? observation.referenceRanges.map(range => (
                                                                <StatusBadge key={range.text}>{range.text}</StatusBadge>
                                                            ))
                                                            : <span className="text-xs text-slate-500 dark:text-slate-400">No reference range recorded</span>}
                                                    </div>
                                                </div>

                                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                                    <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
                                                        Performer: {observation.performer.join(', ') || 'Not recorded'}
                                                    </div>
                                                    <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-900/70 dark:text-slate-300">
                                                        Linked report: {observation.diagnosticReportId || 'Not linked'}
                                                    </div>
                                                </div>

                                                {observation.note && (
                                                    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                                                        {observation.note}
                                                    </div>
                                                )}

                                                <ProvenancePanel
                                                    provenance={observation.provenance}
                                                    onViewSource={observation.provenance.sourceDocument
                                                        ? () => setSource(
                                                            observation.provenance.sourceDocument!,
                                                        )
                                                        : undefined}
                                                />
                                            </div>
                                        </details>
                                    ))}
                                </div>
                            </section>
                        )}
                    </>
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

export default ResultsModule;
