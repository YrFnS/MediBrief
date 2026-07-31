import React from 'react';
import {
    AlertTriangleIcon,
    ClockIcon,
    DocumentTextIcon,
    MagnifyingGlassIcon,
} from '../../../components/icons';
import type { ResourceProvenanceView } from '../coreModuleTypes';

export const ModuleHeader: React.FC<{
    eyebrow: string;
    title: string;
    description: string;
    candidateCount: number;
    onReviewCandidates: () => void;
    children?: React.ReactNode;
}> = ({
    eyebrow,
    title,
    description,
    candidateCount,
    onReviewCandidates,
    children,
}) => (
    <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-950/80 md:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-blue-600 dark:text-blue-400">
                    {eyebrow}
                </p>
                <h1 className="mt-1 text-2xl font-display font-bold text-slate-950 dark:text-white">
                    {title}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                    {description}
                </p>
            </div>

            {candidateCount > 0 && (
                <button
                    type="button"
                    onClick={onReviewCandidates}
                    className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"
                >
                    <AlertTriangleIcon className="h-4 w-4" />
                    {candidateCount} pending candidate{candidateCount === 1 ? '' : 's'}
                </button>
            )}
        </div>
        {children && <div className="mt-5">{children}</div>}
    </header>
);

export const MetricGrid: React.FC<{
    metrics: Array<{
        label: string;
        value: number | string;
        helper?: string;
        emphasis?: 'default' | 'warning' | 'danger';
    }>;
}> = ({ metrics }) => (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(metric => (
            <div
                key={metric.label}
                className={`rounded-2xl border px-4 py-3 ${metric.emphasis === 'danger'
                    ? 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/20'
                    : metric.emphasis === 'warning'
                        ? 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20'
                        : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70'
                }`}
            >
                <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    {metric.label}
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-xl font-display font-bold text-slate-950 dark:text-white">
                        {metric.value}
                    </span>
                    {metric.helper && (
                        <span className="text-[10px] text-slate-400">
                            {metric.helper}
                        </span>
                    )}
                </div>
            </div>
        ))}
    </div>
);

export const ModuleSearch: React.FC<{
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
}> = ({ value, onChange, placeholder }) => (
    <label className="relative block min-w-0 flex-1">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
            type="search"
            value={value}
            onChange={event => onChange(event.target.value)}
            placeholder={placeholder}
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
        />
    </label>
);

export const ModuleSelect: React.FC<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
}> = ({ label, value, onChange, options }) => (
    <label className="flex min-w-[150px] flex-col gap-1">
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
            {label}
        </span>
        <select
            value={value}
            onChange={event => onChange(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none transition-colors focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        >
            {options.map(option => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    </label>
);

export const ScopeTabs: React.FC<{
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string; count?: number }>;
}> = ({ value, onChange, options }) => (
    <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-900">
        {options.map(option => {
            const active = option.value === value;
            return (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(option.value)}
                    className={`whitespace-nowrap rounded-lg px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors ${active
                        ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-300'
                        : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                    }`}
                >
                    {option.label}
                    {option.count !== undefined && (
                        <span className="ml-1.5 opacity-60">{option.count}</span>
                    )}
                </button>
            );
        })}
    </div>
);

export const StatusBadge: React.FC<{
    children: React.ReactNode;
    tone?: 'neutral' | 'positive' | 'warning' | 'danger' | 'info';
}> = ({ children, tone = 'neutral' }) => (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${tone === 'positive'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
        : tone === 'warning'
            ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300'
            : tone === 'danger'
                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300'
                : tone === 'info'
                    ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300'
                    : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
    }`}>
        {children}
    </span>
);

export const ProvenancePanel: React.FC<{
    provenance: ResourceProvenanceView;
    onViewSource?: () => void;
}> = ({ provenance, onViewSource }) => {
    const confidence = provenance.extractionConfidence;
    const confidenceLabel = confidence === undefined
        ? null
        : `${Math.round(confidence <= 1 ? confidence * 100 : confidence)}% extraction confidence`;

    return (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                        Source and record history
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        {provenance.sourceLabel}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                            <ClockIcon className="h-3 w-3" />
                            Stored {provenance.recordedLabel}
                        </span>
                        <span>Updated {provenance.updatedLabel}</span>
                        <span>{provenance.amendmentCount} amendment{provenance.amendmentCount === 1 ? '' : 's'}</span>
                        {confidenceLabel && <span>{confidenceLabel}</span>}
                    </div>
                    {provenance.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                            {provenance.tags.map(tag => (
                                <span
                                    key={tag}
                                    className="rounded-md bg-white px-1.5 py-0.5 text-[9px] text-slate-500 dark:bg-slate-950 dark:text-slate-400"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {provenance.sourceDocument && onViewSource && (
                    <button
                        type="button"
                        onClick={onViewSource}
                        className="flex flex-shrink-0 items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-800 dark:bg-slate-950 dark:text-blue-300 dark:hover:bg-blue-950/40"
                    >
                        <DocumentTextIcon className="h-3.5 w-3.5" />
                        View source
                    </button>
                )}
            </div>
        </div>
    );
};

export const EmptyModuleState: React.FC<{
    title: string;
    description: string;
    caution?: string;
}> = ({ title, description, caution }) => (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-950/70">
        <DocumentTextIcon className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
        <h2 className="mt-3 text-base font-bold text-slate-900 dark:text-white">
            {title}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {description}
        </p>
        {caution && (
            <p className="mx-auto mt-3 max-w-xl text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                {caution}
            </p>
        )}
    </div>
);
