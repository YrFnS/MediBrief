import React, { useMemo } from 'react';
import {
    ActivityIcon,
    AlertTriangleIcon,
    BeakerIcon,
    ChevronRightIcon,
    DocumentTextIcon,
} from '../../../components/icons';
import type { PatientClinicalRecord } from '../../clinical-record';
import { buildDiagnosticLoincSuggestions } from '../codingSuggestions';
import { buildDiagnosticPanelGroups } from '../panels';
import {
    buildDiagnosticTrendModel,
    type DiagnosticTrendPoint,
    type DiagnosticTrendSeries,
} from '../trends';

interface DiagnosticInsightsPanelProps {
    record: PatientClinicalRecord;
}

const compactNumber = (value: number): string =>
    Number.isInteger(value)
        ? String(value)
        : Number(value.toPrecision(6)).toString();

const Sparkline: React.FC<{ series: DiagnosticTrendSeries }> = ({ series }) => {
    const width = 260;
    const height = 72;
    const padding = 8;
    const values = series.points.map(point => point.value);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const range = maximum - minimum;
    const denominator = Math.max(1, series.points.length - 1);
    const coordinates = series.points.map((point, index) => {
        const x = padding + (index / denominator) * (width - padding * 2);
        const y = range === 0
            ? height / 2
            : height - padding
                - ((point.value - minimum) / range) * (height - padding * 2);
        return { x, y, point };
    });
    const points = coordinates.map(value =>
        `${value.x.toFixed(2)},${value.y.toFixed(2)}`).join(' ');

    return (
        <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={`${series.analyteName} trend with ${series.points.length} comparable points`}
            className="h-20 w-full text-blue-600 dark:text-blue-300"
        >
            <title>
                {series.analyteName}: {series.points
                    .map(point => `${point.date} ${point.value} ${point.unit}`)
                    .join('; ')}
            </title>
            <line
                x1={padding}
                x2={width - padding}
                y1={height - padding}
                y2={height - padding}
                stroke="currentColor"
                strokeOpacity="0.18"
            />
            <polyline
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={points}
            />
            {coordinates.map(({ x, y, point }) => (
                <circle
                    key={point.observationId}
                    cx={x}
                    cy={y}
                    r="3.5"
                    fill="currentColor"
                >
                    <title>
                        {point.date}: {point.value} {point.unit}
                    </title>
                </circle>
            ))}
        </svg>
    );
};

const TrendPointList: React.FC<{ points: DiagnosticTrendPoint[] }> = ({
    points,
}) => (
    <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {points.map(point => (
            <div
                key={point.observationId}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] dark:border-slate-700 dark:bg-slate-950/70"
            >
                <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-slate-500 dark:text-slate-400">
                        {point.date}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                        {compactNumber(point.value)} {point.unit}
                    </span>
                </div>
                {point.normalizedLabel
                    && point.normalizedLabel !== point.originalLabel && (
                    <p className="mt-1 text-slate-500 dark:text-slate-400">
                        Source: {point.originalLabel}
                    </p>
                )}
            </div>
        ))}
    </div>
);

const DiagnosticInsightsPanel: React.FC<DiagnosticInsightsPanelProps> = ({
    record,
}) => {
    const panelGroups = useMemo(
        () => buildDiagnosticPanelGroups(record),
        [record],
    );
    const trends = useMemo(
        () => buildDiagnosticTrendModel(record),
        [record],
    );
    const codingSuggestions = useMemo(
        () => buildDiagnosticLoincSuggestions(record),
        [record],
    );
    const excludedCount = trends.exclusions.length;

    return (
        <details className="group overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm dark:border-blue-900/60 dark:bg-slate-950/90">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 md:px-5">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                    <ActivityIcon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-slate-950 dark:text-white">
                        Diagnostic structure, normalization, and trends
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                        {panelGroups.length} report group{panelGroups.length === 1 ? '' : 's'} · {trends.series.length} comparable trend{trends.series.length === 1 ? '' : 's'} · {codingSuggestions.length} review-only coding suggestion{codingSuggestions.length === 1 ? '' : 's'}
                    </span>
                </span>
                <ChevronRightIcon className="h-4 w-4 flex-shrink-0 text-slate-400 transition-transform group-open:rotate-90" />
            </summary>

            <div className="border-t border-blue-100 p-4 dark:border-blue-900/40 md:p-5">
                <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <div className="flex items-start gap-2.5">
                        <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-300" />
                        <p className="text-[10px] leading-relaxed text-amber-900 dark:text-amber-100">
                            Trends include only confirmed, final/amended/corrected, exact numeric results with an exact clinical day and a compatible unit. Comparator, qualitative, absent, narrative, preliminary, and undated results remain visible in the record but stay outside charts. Normalized values never replace source values.
                        </p>
                    </div>
                </section>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                    {[
                        ['Report groups', panelGroups.length],
                        ['Trend series', trends.series.length],
                        ['Charted points', trends.chartedObservationCount],
                        ['Transparent exclusions', excludedCount],
                    ].map(([label, value]) => (
                        <div
                            key={label}
                            className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60"
                        >
                            <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                {label}
                            </p>
                            <p className="mt-1 text-xl font-bold text-slate-950 dark:text-white">
                                {value}
                            </p>
                        </div>
                    ))}
                </div>

                {panelGroups.length > 0 && (
                    <section className="mt-5">
                        <div className="flex items-center gap-2">
                            <DocumentTextIcon className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                                Explicit report and panel membership
                            </h3>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                            Membership comes from each confirmed DiagnosticReport.resultIds relationship. Family labels are advisory summaries of the member set, never inferred from the report title alone.
                        </p>
                        <div className="mt-3 grid gap-3 xl:grid-cols-2">
                            {panelGroups.map(group => (
                                <article
                                    key={group.reportId}
                                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <p className="text-xs font-bold text-slate-950 dark:text-white">
                                                {group.reportName}
                                            </p>
                                            <p className="mt-1 text-[9px] font-mono uppercase tracking-wider text-slate-400">
                                                {group.familySuggestion.label} · {group.groupingBasis}
                                            </p>
                                        </div>
                                        <span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold text-slate-600 dark:bg-slate-950 dark:text-slate-300">
                                            {group.members.length} member{group.members.length === 1 ? '' : 's'}
                                        </span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {group.members.map(member => (
                                            <span
                                                key={member.observationId}
                                                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[9px] text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                                            >
                                                {member.name}
                                                {member.loincCode ? ` · ${member.loincCode}` : ''}
                                            </span>
                                        ))}
                                    </div>
                                    {group.missingResultIds.length > 0 && (
                                        <p className="mt-2 text-[10px] text-red-600 dark:text-red-300">
                                            {group.missingResultIds.length} linked result reference{group.missingResultIds.length === 1 ? '' : 's'} could not be resolved.
                                        </p>
                                    )}
                                </article>
                            ))}
                        </div>
                    </section>
                )}

                <section className="mt-5">
                    <div className="flex items-center gap-2">
                        <ActivityIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                            Comparable numeric trends
                        </h3>
                    </div>
                    {trends.series.length === 0 ? (
                        <p className="mt-3 rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                            No analyte currently has at least two comparable confirmed exact-date numeric results.
                        </p>
                    ) : (
                        <div className="mt-3 grid gap-3 xl:grid-cols-2">
                            {trends.series.map(series => (
                                <article
                                    key={series.key}
                                    className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                            <p className="text-xs font-bold text-slate-950 dark:text-white">
                                                {series.analyteName}
                                            </p>
                                            <p className="mt-1 text-[9px] font-mono uppercase tracking-wider text-slate-400">
                                                {series.points.length} points · {series.unit}
                                                {series.loincCode ? ` · LOINC ${series.loincCode}` : ''}
                                            </p>
                                        </div>
                                        <span className="rounded-full bg-white px-2 py-1 text-[9px] font-bold text-slate-700 dark:bg-slate-950 dark:text-slate-200">
                                            Δ {compactNumber(series.absoluteChange)} {series.unit}
                                        </span>
                                    </div>
                                    <Sparkline series={series} />
                                    <TrendPointList points={series.points} />
                                    {series.warning && (
                                        <p className="mt-2 text-[10px] leading-relaxed text-amber-700 dark:text-amber-300">
                                            {series.warning}
                                        </p>
                                    )}
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                {excludedCount > 0 && (
                    <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                            Why some results are not charted
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {Object.entries(trends.exclusionCounts)
                                .filter(([, count]) => count > 0)
                                .map(([reason, count]) => (
                                    <span
                                        key={reason}
                                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[9px] text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                                    >
                                        {reason.replace(/-/g, ' ')}: {count}
                                    </span>
                                ))}
                        </div>
                    </section>
                )}

                {codingSuggestions.length > 0 && (
                    <section className="mt-5">
                        <div className="flex items-center gap-2">
                            <BeakerIcon className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                            <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                                Review-only LOINC suggestions
                            </h3>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                            These exact-alias suggestions are not written to the record. A reviewer must verify the analyte, specimen, method, and code before applying one in a correction workflow.
                        </p>
                        <div className="mt-3 grid gap-2 xl:grid-cols-2">
                            {codingSuggestions.map(suggestion => (
                                <article
                                    key={`${suggestion.observationId}-${suggestion.code}`}
                                    className="rounded-xl border border-violet-200 bg-violet-50 p-3 dark:border-violet-900/50 dark:bg-violet-950/20"
                                >
                                    <p className="text-xs font-bold text-violet-950 dark:text-violet-100">
                                        {suggestion.observationName}
                                    </p>
                                    <p className="mt-1 font-mono text-[10px] text-violet-700 dark:text-violet-300">
                                        LOINC {suggestion.code} · {suggestion.display}
                                    </p>
                                    <p className="mt-2 text-[10px] leading-relaxed text-violet-800 dark:text-violet-200">
                                        {suggestion.reason}
                                    </p>
                                </article>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </details>
    );
};

export default DiagnosticInsightsPanel;
