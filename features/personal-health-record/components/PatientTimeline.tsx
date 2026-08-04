import React, { useMemo, useState } from 'react';
import {
    AlertTriangleIcon,
    ClockIcon,
    DocumentTextIcon,
    EyeIcon,
    MagnifyingGlassIcon,
} from '../../../components/icons';
import type {
    PatientClinicalRecord,
    SourceDocumentReference,
} from '../../clinical-record';
import DocumentSourcePreview from '../../clinical-record/components/DocumentSourcePreview';
import type {
    TimelineDisplayItem,
    TimelineResourceFilter,
} from '../types';
import {
    buildTimelineViewModel,
    RESOURCE_TYPE_LABELS,
} from '../viewModels';

interface PatientTimelineProps {
    record: PatientClinicalRecord;
}

const TimelineCard: React.FC<{
    item: TimelineDisplayItem;
    onOpenSource: (source: SourceDocumentReference) => void;
}> = ({ item, onOpenSource }) => (
    <article className="relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-soft dark:border-slate-800 dark:bg-slate-950/80">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                        {item.resourceTypeLabel}
                    </span>
                    {item.status && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {item.status}
                        </span>
                    )}
                </div>
                <h3 className="mt-2 text-base font-semibold text-slate-900 dark:text-white">
                    {item.label}
                </h3>
                {item.detail && (
                    <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                        {item.detail}
                    </p>
                )}
            </div>

            <div className="flex-shrink-0 text-left sm:text-right">
                <p className={`text-xs font-bold ${item.knownClinicalDate
                    ? 'text-slate-700 dark:text-slate-200'
                    : 'text-amber-700 dark:text-amber-300'
                }`}>
                    {item.dateLabel}
                </p>
                <p className="mt-1 text-[9px] font-mono uppercase tracking-wide text-slate-400">
                    {item.recordedLabel}
                </p>
            </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <div className="flex min-w-0 items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                <DocumentTextIcon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{item.sourceLabel}</span>
            </div>
            {item.sourceDocument && (
                <button
                    type="button"
                    onClick={() => onOpenSource(item.sourceDocument!)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300"
                >
                    <EyeIcon className="h-3.5 w-3.5" />
                    View source
                </button>
            )}
        </div>
    </article>
);

const PatientTimeline: React.FC<PatientTimelineProps> = ({ record }) => {
    const [resourceType, setResourceType] = useState<TimelineResourceFilter>('all');
    const [search, setSearch] = useState('');
    const [showUndated, setShowUndated] = useState(true);
    const [previewSource, setPreviewSource] = useState<
        SourceDocumentReference | null
    >(null);

    const allItems = useMemo(
        () => buildTimelineViewModel(record),
        [record],
    );
    const timeline = useMemo(
        () => buildTimelineViewModel(record, { resourceType, search }),
        [record, resourceType, search],
    );

    const availableTypes = useMemo(() => {
        const counts = new Map<string, number>();
        [...allItems.dated, ...allItems.undated].forEach(item => {
            counts.set(item.resourceType, (counts.get(item.resourceType) || 0) + 1);
        });
        return Object.entries(RESOURCE_TYPE_LABELS)
            .map(([value, label]) => ({
                value: value as Exclude<TimelineResourceFilter, 'all'>,
                label,
                count: counts.get(value) || 0,
            }))
            .filter(option => option.count > 0);
    }, [allItems]);

    const datedGroups = useMemo(() => {
        const groups: Array<{
            key: string;
            label: string;
            items: TimelineDisplayItem[];
        }> = [];
        timeline.dated.forEach(item => {
            const previous = groups[groups.length - 1];
            if (previous?.key === item.dateGroupKey) {
                previous.items.push(item);
            } else {
                groups.push({
                    key: item.dateGroupKey,
                    label: item.dateGroupLabel,
                    items: [item],
                });
            }
        });
        return groups;
    }, [timeline.dated]);

    const visibleCount = timeline.dated.length
        + (showUndated ? timeline.undated.length : 0);

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-6 md:py-7">
                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-blue-600">
                            Confirmed longitudinal record
                        </p>
                        <h1 className="mt-1 text-2xl font-display font-bold text-slate-950 dark:text-white">
                            Patient timeline
                        </h1>
                        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                            Dated clinical events are ordered by their known event date. Records without a clinical date remain in a separate undated section.
                        </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-mono uppercase tracking-wide text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                        {visibleCount} visible · {allItems.total} confirmed total
                    </div>
                </div>

                <section className="mb-6 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 md:grid-cols-[1fr_220px_auto] md:items-center">
                    <label className="relative block">
                        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                            type="search"
                            value={search}
                            onChange={event => setSearch(event.target.value)}
                            placeholder="Search labels, details, status, or source"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-600"
                        />
                    </label>

                    <select
                        value={resourceType}
                        onChange={event => setResourceType(
                            event.target.value as TimelineResourceFilter,
                        )}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        aria-label="Filter timeline by resource type"
                    >
                        <option value="all">All record types ({allItems.total})</option>
                        {availableTypes.map(option => (
                            <option key={option.value} value={option.value}>
                                {option.label} ({option.count})
                            </option>
                        ))}
                    </select>

                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        <input
                            type="checkbox"
                            checked={showUndated}
                            onChange={event => setShowUndated(event.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600"
                        />
                        Show undated
                    </label>
                </section>

                {visibleCount === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-950/70">
                        <ClockIcon className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
                        <h2 className="mt-3 text-base font-bold text-slate-800 dark:text-slate-100">
                            No matching confirmed events
                        </h2>
                        <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                            Change the search or filter, or review pending candidates before expecting them in the confirmed timeline.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {datedGroups.map(group => (
                            <section key={group.key}>
                                <div className="mb-3 flex items-center gap-3">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm shadow-blue-500/20">
                                        <ClockIcon className="h-4 w-4" />
                                    </span>
                                    <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                                        {group.label}
                                    </h2>
                                    <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                                </div>
                                <div className="ml-4 space-y-3 border-l border-slate-200 pl-7 dark:border-slate-800">
                                    {group.items.map(item => (
                                        <div key={item.resourceId} className="relative">
                                            <span className="absolute -left-[32px] top-6 h-2.5 w-2.5 rounded-full border-2 border-white bg-blue-500 shadow dark:border-slate-950" />
                                            <TimelineCard
                                                item={item}
                                                onOpenSource={setPreviewSource}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}

                        {showUndated && timeline.undated.length > 0 && (
                            <section>
                                <div className="mb-3 flex items-center gap-3">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                                        <AlertTriangleIcon className="h-4 w-4" />
                                    </span>
                                    <div>
                                        <h2 className="text-sm font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                                            Clinical date unknown
                                        </h2>
                                        <p className="text-[10px] text-amber-700/70 dark:text-amber-300/70">
                                            Storage time is shown only as provenance, not as the event date.
                                        </p>
                                    </div>
                                    <span className="h-px flex-1 bg-amber-200 dark:bg-amber-900/50" />
                                </div>
                                <div className="ml-4 space-y-3 border-l border-amber-200 pl-7 dark:border-amber-900/50">
                                    {timeline.undated.map(item => (
                                        <div key={item.resourceId} className="relative">
                                            <span className="absolute -left-[32px] top-6 h-2.5 w-2.5 rounded-full border-2 border-white bg-amber-500 shadow dark:border-slate-950" />
                                            <TimelineCard
                                                item={item}
                                                onOpenSource={setPreviewSource}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                )}
            </div>

            {previewSource && (
                <DocumentSourcePreview
                    patientId={record.patientId}
                    source={previewSource}
                    onClose={() => setPreviewSource(null)}
                />
            )}
        </div>
    );
};

export default PatientTimeline;
