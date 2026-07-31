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
import {
    buildDiagnosticResultsIntelligence,
    diagnosticPanelMatchesSearch,
    diagnosticResultMatchesSearch,
    type DiagnosticPanelView,
    type DiagnosticResultView,
    type DiagnosticTrendSeries,
    type ReviewCodingSuggestion,
    type TrendExclusion,
} from '../../diagnostic-reports/resultIntelligence';

interface ResultsModuleProps {
    record: PatientClinicalRecord;
    onReviewCandidates: () => void;
}

type WorkspaceView = 'overview' | 'panels' | 'trends' | 'other';

const compactNumber = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 3,
});

const panelTone = (status: string): string => {
    if (['final', 'amended', 'corrected'].includes(status)) {
        return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200';
    }
    if (['registered', 'partial', 'preliminary', 'unknown'].includes(status)) {
        return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200';
    }
    return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
};

const StatusPill: React.FC<{
    children: React.ReactNode;
    tone?: 'neutral' | 'warning' | 'positive';
}> = ({ children, tone = 'neutral' }) => {
    const className = tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200'
        : tone === 'positive'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200'
            : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
    return (
        <span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${className}`}>
            {children}
        </span>
    );
};

const MetricCard: React.FC<{
    label: string;
    value: number;
    helper: string;
    warning?: boolean;
}> = ({ label, value, helper, warning }) => (
    <div className={`rounded-2xl border p-4 ${warning
        ? 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20'
        : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/80'
    }`}>
        <p className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-slate-400">
            {label}
        </p>
        <p className="mt-1 text-2xl font-display font-bold text-slate-950 dark:text-white">
            {value}
        </p>
        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
            {helper}
        </p>
    </div>
);

const SourceButton: React.FC<{
    source?: SourceDocumentReference;
    onOpen: (source: SourceDocumentReference) => void;
}> = ({ source, onOpen }) => source ? (
    <button
        type="button"
        onClick={() => onOpen(source)}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300"
    >
        <DocumentTextIcon className="h-4 w-4" />
        Original source{source.pageNumber ? ` · page ${source.pageNumber}` : ''}
    </button>
) : null;

const CodingSuggestion: React.FC<{
    suggestion?: ReviewCodingSuggestion;
}> = ({ suggestion }) => suggestion ? (
    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-900/50 dark:bg-violet-950/20">
        <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
            Review-only coding suggestion
        </p>
        <p className="mt-1 text-xs font-bold text-violet-950 dark:text-violet-100">
            LOINC {suggestion.code} · {suggestion.display}
        </p>
        <p className="mt-1 text-[10px] leading-relaxed text-violet-800 dark:text-violet-200">
            {suggestion.basis}
        </p>
        <p className="mt-1 text-[10px] font-semibold leading-relaxed text-violet-900 dark:text-violet-100">
            {suggestion.caveat}
        </p>
    </div>
) : null;

const ResultCard: React.FC<{
    result: DiagnosticResultView;
    onOpenSource: (source: SourceDocumentReference) => void;
    compact?: boolean;
}> = ({ result, onOpenSource, compact = false }) => (
    <article className={`rounded-2xl border bg-white shadow-sm dark:bg-slate-950/80 ${result.flagged
        ? 'border-amber-300 dark:border-amber-900/70'
        : 'border-slate-200 dark:border-slate-800'
    } ${compact ? 'p-3' : 'p-4'}`}>
        <div className="flex items-start gap-3">
            <span className={`mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${result.flagged
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
            }`}>
                {result.flagged
                    ? <AlertTriangleIcon className="h-4 w-4" />
                    : <ActivityIcon className="h-4 w-4" />}
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                        {result.name}
                    </h3>
                    <StatusPill>{result.statusLabel}</StatusPill>
                    <StatusPill tone={result.clinicalDateValue ? 'neutral' : 'warning'}>
                        {result.clinicalDateValue ? result.clinicalDateLabel : 'Undated'}
                    </StatusPill>
                    {result.flagged && <StatusPill tone="warning">Source flag</StatusPill>}
                </div>
                <p className="mt-2 text-lg font-display font-bold text-slate-900 dark:text-white">
                    {result.originalValueLabel}
                </p>
                {result.normalizedValueLabel && (
                    <p className="mt-1 text-xs font-semibold text-blue-700 dark:text-blue-300">
                        Normalized view: {result.normalizedValueLabel}
                    </p>
                )}
                {result.normalizationWarning && (
                    <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[10px] leading-relaxed text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                        Normalization warning: {result.normalizationWarning}
                    </p>
                )}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
                    <span>Kind: {result.kind}</span>
                    {result.loincCode && <span>LOINC: {result.loincCode}</span>}
                    {result.specimenLabel && <span>Specimen: {result.specimenLabel}</span>}
                    {result.reportNames.length > 0 && (
                        <span>Panel/report: {result.reportNames.join(', ')}</span>
                    )}
                </div>
                {result.interpretationLabels.length > 0 && (
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                        Recorded interpretation: {result.interpretationLabels.join(', ')}
                    </p>
                )}
                {result.referenceRangeLabels.length > 0 && (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Source range: {result.referenceRangeLabels.join(' · ')}
                    </p>
                )}
                {result.note && !compact && (
                    <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {result.note}
                    </p>
                )}
                {!compact && <CodingSuggestion suggestion={result.codingSuggestion} />}
                {!compact && result.source && (
                    <div className="mt-3">
                        <SourceButton source={result.source} onOpen={onOpenSource} />
                    </div>
                )}
            </div>
        </div>
    </article>
);

const PanelCard: React.FC<{
    panel: DiagnosticPanelView;
    onOpenSource: (source: SourceDocumentReference) => void;
}> = ({ panel, onOpenSource }) => (
    <details className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm open:border-blue-300 dark:border-slate-800 dark:bg-slate-950/80 dark:open:border-blue-800">
        <summary className="flex cursor-pointer list-none items-start gap-3 p-4 md:p-5">
            <span className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                <DocumentTextIcon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-950 dark:text-white">
                        {panel.name}
                    </span>
                    <span className={`inline-flex rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${panelTone(panel.status)}`}>
                        {panel.statusLabel}
                    </span>
                    <StatusPill tone={panel.memberResults.length > 1 ? 'positive' : 'neutral'}>
                        {panel.memberResults.length > 1 ? 'Panel' : 'Report'}
                    </StatusPill>
                    {!panel.clinicalDateLabel.includes('unknown') && (
                        <StatusPill>{panel.clinicalDateLabel}</StatusPill>
                    )}
                </span>
                <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                    {panel.memberResults.length} explicit member result{panel.memberResults.length === 1 ? '' : 's'} from DiagnosticReport.resultIds
                </span>
                {panel.conclusion && (
                    <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">
                        {panel.conclusion}
                    </span>
                )}
            </span>
            <ChevronRightIcon className="mt-2 h-4 w-4 flex-shrink-0 text-slate-300 transition-transform group-open:rotate-90" />
        </summary>
        <div className="border-t border-slate-100 p-4 dark:border-slate-800 md:p-5">
            <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
                    <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Membership</p>
                    <p className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-100">
                        Explicit report relationship
                    </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
                    <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Specimens</p>
                    <p className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-100">
                        {panel.specimenLabels.join(', ') || 'Not recorded'}
                    </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70">
                    <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">Panel code</p>
                    <p className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-100">
                        {panel.loincCode ? `LOINC ${panel.loincCode}` : 'Not confirmed'}
                    </p>
                </div>
            </div>

            {panel.missingMemberIds.length > 0 && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200">
                    The report references missing or non-confirmed members: {panel.missingMemberIds.join(', ')}
                </div>
            )}

            <div className="mt-4 grid gap-3 xl:grid-cols-2">
                {panel.memberResults.map(result => (
                    <ResultCard
                        key={result.id}
                        result={result}
                        compact
                        onOpenSource={onOpenSource}
                    />
                ))}
            </div>

            <CodingSuggestion suggestion={panel.codingSuggestion} />
            {panel.source && (
                <div className="mt-4">
                    <SourceButton source={panel.source} onOpen={onOpenSource} />
                </div>
            )}
        </div>
    </details>
);

const TrendSparkline: React.FC<{
    series: DiagnosticTrendSeries;
}> = ({ series }) => {
    const width = 720;
    const height = 190;
    const padding = 24;
    const values = series.points.map(point => point.value);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const spread = maximum - minimum || 1;
    const usableWidth = width - (padding * 2);
    const usableHeight = height - (padding * 2);
    const coordinates = series.points.map((point, index) => {
        const x = series.points.length === 1
            ? width / 2
            : padding + (index / (series.points.length - 1)) * usableWidth;
        const y = padding + ((maximum - point.value) / spread) * usableHeight;
        return { x, y, point };
    });
    const polyline = coordinates.map(item => `${item.x},${item.y}`).join(' ');

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-950 dark:text-white">
                            {series.name}
                        </h3>
                        <StatusPill tone="positive">{series.points.length} points</StatusPill>
                        {series.loincCode && <StatusPill>LOINC {series.loincCode}</StatusPill>}
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                        Unit: {series.unit} · Grouped by {series.groupingBasis === 'loinc'
                            ? 'confirmed LOINC code and comparable unit'
                            : 'exact name, specimen, and comparable unit'}
                    </p>
                </div>
                {series.specimenLabel && (
                    <StatusPill>{series.specimenLabel}</StatusPill>
                )}
            </div>

            {series.qualityNotice && (
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-relaxed text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                    {series.qualityNotice}
                </p>
            )}

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-100 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-900/50">
                <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="h-48 min-w-[36rem] w-full"
                    role="img"
                    aria-label={`${series.name} trend with ${series.points.length} comparable confirmed points`}
                >
                    <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} className="stroke-slate-300 dark:stroke-slate-700" strokeWidth="1" />
                    <line x1={padding} y1={padding} x2={padding} y2={height - padding} className="stroke-slate-300 dark:stroke-slate-700" strokeWidth="1" />
                    <polyline
                        points={polyline}
                        fill="none"
                        className="stroke-blue-600 dark:stroke-blue-400"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                    {coordinates.map(({ x, y, point }) => (
                        <g key={point.observationId}>
                            <circle cx={x} cy={y} r="5" className="fill-white stroke-blue-600 dark:fill-slate-950 dark:stroke-blue-400" strokeWidth="3" />
                            <text x={x} y={Math.max(13, y - 10)} textAnchor="middle" className="fill-slate-700 text-[10px] dark:fill-slate-200">
                                {compactNumber.format(point.value)}
                            </text>
                            <text x={x} y={height - 7} textAnchor="middle" className="fill-slate-500 text-[9px] dark:fill-slate-400">
                                {point.dateLabel}
                            </text>
                        </g>
                    ))}
                </svg>
            </div>

            <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[38rem] text-left text-xs">
                    <thead>
                        <tr className="border-b border-slate-200 text-[9px] font-mono uppercase tracking-wider text-slate-400 dark:border-slate-800">
                            <th className="py-2 pr-3">Clinical date</th>
                            <th className="py-2 pr-3">Original value</th>
                            <th className="py-2 pr-3">Trend value</th>
                            <th className="py-2">Report</th>
                        </tr>
                    </thead>
                    <tbody>
                        {series.points.map(point => (
                            <tr key={point.observationId} className="border-b border-slate-100 last:border-0 dark:border-slate-900">
                                <td className="py-2 pr-3 font-mono text-slate-600 dark:text-slate-300">{point.dateLabel}</td>
                                <td className="py-2 pr-3 font-semibold text-slate-900 dark:text-white">{point.originalValueLabel}</td>
                                <td className="py-2 pr-3 text-blue-700 dark:text-blue-300">{point.normalizedValueLabel || `${compactNumber.format(point.value)} ${point.unit}`}</td>
                                <td className="py-2 text-slate-500 dark:text-slate-400">{point.reportNames.join(', ') || 'Unlinked result'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ExclusionList: React.FC<{
    exclusions: TrendExclusion[];
}> = ({ exclusions }) => {
    const counts: Record<string, number> = exclusions.reduce(
        (summary, item) => ({
            ...summary,
            [item.reason]: (summary[item.reason] || 0) + 1,
        }),
        {} as Record<string, number>,
    );
    return exclusions.length > 0 ? (
        <details className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/80">
            <summary className="cursor-pointer text-xs font-bold text-slate-800 dark:text-slate-100">
                Why {exclusions.length} result{exclusions.length === 1 ? '' : 's'} are not plotted
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(counts).map(([reason, count]) => (
                    <StatusPill key={reason}>{reason}: {count}</StatusPill>
                ))}
            </div>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
                {exclusions.map(item => (
                    <div key={`${item.observationId}-${item.reason}`} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
                        <p className="text-xs font-bold text-slate-900 dark:text-white">{item.name}</p>
                        <p className="mt-1 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">{item.message}</p>
                    </div>
                ))}
            </div>
        </details>
    ) : null;
};

const ResultsModule: React.FC<ResultsModuleProps> = ({
    record,
    onReviewCandidates,
}) => {
    const [search, setSearch] = useState('');
    const [view, setView] = useState<WorkspaceView>('overview');
    const [source, setSource] = useState<SourceDocumentReference | null>(null);
    const intelligence = useMemo(
        () => buildDiagnosticResultsIntelligence(record),
        [record],
    );

    const panels = useMemo(() => intelligence.panels.filter(panel =>
        diagnosticPanelMatchesSearch(panel, search)), [intelligence.panels, search]);
    const filterResults = (results: DiagnosticResultView[]) => results.filter(result =>
        diagnosticResultMatchesSearch(result, search));
    const comparatorResults = filterResults(intelligence.comparatorResults);
    const qualitativeResults = filterResults(intelligence.qualitativeResults);
    const narrativeResults = filterResults(intelligence.narrativeResults);
    const absentResults = filterResults(intelligence.absentResults);
    const otherResults = filterResults(intelligence.otherResults);
    const unlinkedResults = filterResults(intelligence.unlinkedResults);
    const trendSeries = intelligence.trendSeries.filter(series => [
        series.name,
        series.loincCode,
        series.specimenLabel,
        series.unit,
        ...series.points.flatMap(point => [
            point.dateLabel,
            point.originalValueLabel,
            point.normalizedValueLabel,
            point.reportNames.join(' '),
        ]),
    ].some(value => String(value || '').toLowerCase().includes(search.trim().toLowerCase())));

    const showPanels = view === 'overview' || view === 'panels';
    const showTrends = view === 'overview' || view === 'trends';
    const showOther = view === 'overview' || view === 'other';

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 md:px-6 md:py-7">
                <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 md:p-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.22em] text-blue-600 dark:text-blue-300">
                                Diagnostic record intelligence
                            </p>
                            <h1 className="mt-2 text-2xl font-display font-bold text-slate-950 dark:text-white">
                                Panels, results, and conservative trends
                            </h1>
                            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                Panel membership comes from explicit DiagnosticReport result links. Trends include only confirmed, patient-applicable, exact-day, comparator-free numeric results with compatible identity and units.
                            </p>
                        </div>
                        {intelligence.candidateCount > 0 && (
                            <button
                                type="button"
                                onClick={onReviewCandidates}
                                className="min-h-11 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-500"
                            >
                                Review {intelligence.candidateCount} candidate{intelligence.candidateCount === 1 ? '' : 's'}
                            </button>
                        )}
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <MetricCard label="Reports / panels" value={intelligence.reportCount} helper="confirmed report-defined groups" />
                        <MetricCard label="Confirmed results" value={intelligence.observationCount} helper="patient-applicable observations" />
                        <MetricCard label="Trend series" value={intelligence.trendSeries.length} helper="two or more comparable points" />
                        <MetricCard label="Source flags" value={intelligence.flaggedCount} helper="recorded interpretations, not diagnoses" warning={intelligence.flaggedCount > 0} />
                    </div>
                </header>

                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/25">
                    <div className="flex items-start gap-3">
                        <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-300" />
                        <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-100">
                            A chart shows recorded values; it does not diagnose change or determine clinical significance. Comparator values, qualitative results, narrative results, absent results, uncertain normalization, unknown dates, and incompatible units remain visible outside numeric trends. Original values always remain visible beside normalized views.
                        </p>
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <label className="flex-1">
                            <span className="sr-only">Search diagnostic results</span>
                            <input
                                value={search}
                                onChange={event => setSearch(event.target.value)}
                                placeholder="Search panel, test, value, unit, specimen, code, report, or source"
                                className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none transition-colors focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                            />
                        </label>
                        <div className="flex overflow-x-auto rounded-xl border border-slate-200 p-1 dark:border-slate-700" role="tablist" aria-label="Results workspace views">
                            {([
                                ['overview', 'Overview'],
                                ['panels', 'Panels'],
                                ['trends', 'Trends'],
                                ['other', 'Other values'],
                            ] as Array<[WorkspaceView, string]>).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
                                    role="tab"
                                    aria-selected={view === value}
                                    onClick={() => setView(value)}
                                    className={`min-h-10 whitespace-nowrap rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors ${view === value
                                        ? 'bg-blue-600 text-white'
                                        : 'text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {showPanels && (
                    <section className="space-y-3">
                        <div className="flex items-end justify-between gap-3">
                            <div>
                                <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-slate-400">
                                    Explicit membership
                                </p>
                                <h2 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">
                                    Diagnostic panels and reports
                                </h2>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    Members are resolved from each confirmed report’s result IDs, never from test-name guessing.
                                </p>
                            </div>
                            <StatusPill>{panels.length} shown</StatusPill>
                        </div>
                        {panels.length > 0 ? (
                            <div className="space-y-3">
                                {panels.map(panel => (
                                    <PanelCard key={panel.id} panel={panel} onOpenSource={setSource} />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">No report-defined panel matches</p>
                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">A result may still exist as an unlinked confirmed observation.</p>
                            </div>
                        )}
                    </section>
                )}

                {showTrends && (
                    <section className="space-y-3">
                        <div>
                            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-slate-400">
                                Conservative comparability
                            </p>
                            <h2 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">
                                Numeric trends
                            </h2>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                A trend requires at least two confirmed exact-day quantity results sharing a confirmed LOINC identity, or the same exact name, specimen, and compatible unit.
                            </p>
                        </div>

                        {intelligence.unitConflicts.length > 0 && (
                            <div className="space-y-2">
                                {intelligence.unitConflicts.map(conflict => (
                                    <div key={`${conflict.identityLabel}-${conflict.units.join('-')}`} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                                        <p className="text-xs font-bold text-amber-900 dark:text-amber-100">
                                            Unit groups kept separate: {conflict.identityLabel}
                                        </p>
                                        <p className="mt-1 text-[10px] text-amber-800 dark:text-amber-200">
                                            Recorded units: {conflict.units.join(', ')}. {conflict.message}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {trendSeries.length > 0 ? (
                            <div className="space-y-4">
                                {trendSeries.map(series => (
                                    <TrendSparkline key={series.key} series={series} />
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">No comparable trend series</p>
                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">This does not mean no results exist. Review the exclusion reasons below.</p>
                            </div>
                        )}
                        <ExclusionList exclusions={intelligence.trendExclusions.filter(item => !search.trim() || `${item.name} ${item.message}`.toLowerCase().includes(search.trim().toLowerCase()))} />
                    </section>
                )}

                {showOther && (
                    <section className="space-y-5">
                        <div>
                            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-slate-400">
                                Preserved outside charts
                            </p>
                            <h2 className="mt-1 text-lg font-bold text-slate-950 dark:text-white">
                                Comparator, qualitative, narrative, and absent results
                            </h2>
                        </div>

                        {([
                            ['Comparator values', comparatorResults, 'Values such as <5 and >100 are not exact chart points.'],
                            ['Qualitative results', qualitativeResults, 'Positive, negative, detected, reactive, boolean, and coded values.'],
                            ['Narrative results', narrativeResults, 'Free-text and narrative result content.'],
                            ['Absent results', absentResults, 'Results recorded as unavailable, not performed, insufficient, or otherwise absent.'],
                            ['Other structured values', otherResults, 'Structured values that are preserved but not eligible for a numeric trend.'],
                        ] as Array<[string, DiagnosticResultView[], string]>).map(([title, results, description]) => results.length > 0 && (
                            <div key={title}>
                                <div className="mb-2 flex items-end justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{title}</h3>
                                        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{description}</p>
                                    </div>
                                    <StatusPill>{results.length}</StatusPill>
                                </div>
                                <div className="grid gap-3 xl:grid-cols-2">
                                    {results.map(result => (
                                        <ResultCard key={result.id} result={result} onOpenSource={setSource} />
                                    ))}
                                </div>
                            </div>
                        ))}

                        {unlinkedResults.length > 0 && (
                            <div>
                                <div className="mb-2 flex items-end justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Unlinked confirmed observations</h3>
                                        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">These results are not members of a confirmed DiagnosticReport. MediBrief does not guess their panel.</p>
                                    </div>
                                    <StatusPill tone="warning">{unlinkedResults.length}</StatusPill>
                                </div>
                                <div className="grid gap-3 xl:grid-cols-2">
                                    {unlinkedResults.map(result => (
                                        <ResultCard key={result.id} result={result} onOpenSource={setSource} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {comparatorResults.length === 0
                            && qualitativeResults.length === 0
                            && narrativeResults.length === 0
                            && absentResults.length === 0
                            && otherResults.length === 0
                            && unlinkedResults.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                                <p className="text-sm font-bold text-slate-800 dark:text-slate-100">No non-trend result matches</p>
                                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Adjust the search or review the panel and trend views.</p>
                            </div>
                        )}
                    </section>
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
