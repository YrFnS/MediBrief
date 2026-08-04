import React, { useMemo, useState } from 'react';
import {
    AlertTriangleIcon,
    ChevronRightIcon,
    DocumentTextIcon,
    DownloadIcon,
    MagnifyingGlassIcon,
    ShieldCheckIcon,
} from '../../../components/icons';
import { useAuditStore } from '../../audit/useAuditStore';
import DocumentSourcePreview from '../../clinical-record/components/DocumentSourcePreview';
import type {
    ClinicalRecordResource,
    ClinicalResourceType,
    PatientClinicalRecord,
    SourceDocumentReference,
} from '../../clinical-record';
import { buildResourceProvenanceView } from '../coreModuleViewModels';
import {
    buildCompletePatientSummary,
    completeSummaryFileStem,
    createCompletePatientSummaryHtml,
    createCompletePatientSummaryJson,
    searchPatientRecord,
    type RecordSearchDateFilter,
    type RecordSearchVerificationFilter,
} from '../recordSearchAndExport';
import {
    EmptyModuleState,
    MetricGrid,
    ModuleHeader,
    ModuleSelect,
    ProvenancePanel,
    StatusBadge,
} from './CoreModulePrimitives';

interface RecordSearchAndExportProps {
    record: PatientClinicalRecord;
    onReviewCandidates: () => void;
}

const verificationTone = (
    status: ClinicalRecordResource['verificationStatus'],
): 'positive' | 'warning' | 'danger' | 'neutral' => {
    if (status === 'confirmed') return 'positive';
    if (status === 'entered-in-error') return 'danger';
    if (status === 'candidate') return 'warning';
    return 'neutral';
};

const downloadText = (
    content: string,
    fileName: string,
    mimeType: string,
): void => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
};

const RecordSearchAndExport: React.FC<RecordSearchAndExportProps> = ({
    record,
    onReviewCandidates,
}) => {
    const auditActions = useAuditStore(state => state.actions);
    const [query, setQuery] = useState('');
    const [resourceType, setResourceType] = useState<'all' | ClinicalResourceType>('all');
    const [verificationStatus, setVerificationStatus] =
        useState<RecordSearchVerificationFilter>('confirmed');
    const [dateState, setDateState] =
        useState<RecordSearchDateFilter>('all');
    const [source, setSource] = useState<SourceDocumentReference | null>(null);
    const [exportFeedback, setExportFeedback] = useState<string | null>(null);

    const search = useMemo(() => searchPatientRecord(record, {
        query,
        resourceType,
        verificationStatus,
        dateState,
    }), [dateState, query, record, resourceType, verificationStatus]);

    const exportPreview = useMemo(
        () => buildCompletePatientSummary(record, record.updatedAt),
        [record],
    );

    const handleExport = (format: 'json' | 'html'): void => {
        const summary = buildCompletePatientSummary(record);
        const fileStem = completeSummaryFileStem(summary);
        if (format === 'json') {
            downloadText(
                createCompletePatientSummaryJson(summary),
                `${fileStem}.json`,
                'application/json;charset=utf-8',
            );
        } else {
            downloadText(
                createCompletePatientSummaryHtml(summary),
                `${fileStem}.html`,
                'text/html;charset=utf-8',
            );
        }

        auditActions.logEvent(
            'PATIENT_SUMMARY_EXPORTED',
            record.patientId,
            `Exported the complete confirmed-record summary as ${format.toUpperCase()}.`,
            'USER',
            {
                format,
                confirmedResourceCount: summary.confirmedResourceCount,
                candidateCountExcluded: summary.excludedHistoryCounts.candidate,
                enteredInErrorCountExcluded:
                    summary.excludedHistoryCounts.enteredInError,
            },
        );
        setExportFeedback(
            `${format.toUpperCase()} summary created locally. Pending, rejected, and entered-in-error records were excluded from the clinical summary.`,
        );
    };

    const nonConfirmedView = verificationStatus !== 'confirmed';

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/70 dark:bg-slate-950">
            <div className="mx-auto w-full max-w-7xl space-y-4 px-4 py-5 md:px-6 md:py-7">
                <ModuleHeader
                    eyebrow="Record-wide tools"
                    title="Search and export"
                    description="Search every structured resource in the active patient record and create a deterministic complete summary. Confirmed patient-applicable records are the default search scope."
                    candidateCount={search.countsByVerification.candidate}
                    onReviewCandidates={onReviewCandidates}
                >
                    <MetricGrid metrics={[
                        {
                            label: 'Indexed resources',
                            value: search.totalIndexed,
                            helper: 'including retained history',
                        },
                        {
                            label: 'Confirmed',
                            value: search.countsByVerification.confirmed,
                        },
                        {
                            label: 'Pending review',
                            value: search.countsByVerification.candidate,
                            emphasis: search.countsByVerification.candidate > 0
                                ? 'warning'
                                : 'default',
                        },
                        {
                            label: 'Entered in error',
                            value: search.countsByVerification['entered-in-error'],
                            emphasis: search.countsByVerification['entered-in-error'] > 0
                                ? 'warning'
                                : 'default',
                        },
                    ]} />
                </ModuleHeader>

                <section
                    aria-labelledby="complete-summary-export-heading"
                    className="rounded-3xl border border-blue-200 bg-blue-50/70 p-5 dark:border-blue-900/60 dark:bg-blue-950/20 md:p-6"
                >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-3xl">
                            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                                <ShieldCheckIcon className="h-5 w-5" />
                                <h2
                                    id="complete-summary-export-heading"
                                    className="text-sm font-bold"
                                >
                                    Complete confirmed-record summary
                                </h2>
                            </div>
                            <p
                                id="complete-summary-export-description"
                                className="mt-2 text-xs leading-relaxed text-blue-900/80 dark:text-blue-100/75"
                            >
                                Exports are generated entirely in this browser without AI. The JSON file preserves the complete confirmed structured resources and provenance. The self-contained HTML file is readable, printable, and includes the same structured records. Unknown clinical dates remain unknown.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold text-blue-800 dark:text-blue-200">
                                <span className="rounded-full bg-white/80 px-2.5 py-1 dark:bg-slate-950/50">
                                    {exportPreview.confirmedResourceCount} confirmed resources
                                </span>
                                <span className="rounded-full bg-white/80 px-2.5 py-1 dark:bg-slate-950/50">
                                    {exportPreview.excludedHistoryCounts.candidate} candidates excluded
                                </span>
                                <span className="rounded-full bg-white/80 px-2.5 py-1 dark:bg-slate-950/50">
                                    {exportPreview.excludedHistoryCounts.enteredInError} error-history records excluded
                                </span>
                            </div>
                        </div>

                        <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-[320px]">
                            <button
                                type="button"
                                onClick={() => handleExport('json')}
                                aria-describedby="complete-summary-export-description"
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100"
                            >
                                <DownloadIcon className="h-4 w-4" />
                                Download JSON
                            </button>
                            <button
                                type="button"
                                onClick={() => handleExport('html')}
                                aria-describedby="complete-summary-export-description"
                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-blue-300 bg-white px-4 py-3 text-xs font-bold uppercase tracking-wide text-blue-800 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-slate-950 dark:text-blue-200 dark:hover:bg-blue-950/50"
                            >
                                <DocumentTextIcon className="h-4 w-4" />
                                Download HTML
                            </button>
                        </div>
                    </div>
                    {exportFeedback && (
                        <p
                            role="status"
                            aria-live="polite"
                            className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
                        >
                            {exportFeedback}
                        </p>
                    )}
                </section>

                <section
                    aria-labelledby="record-search-heading"
                    className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 md:p-5"
                >
                    <div className="flex items-center gap-2">
                        <MagnifyingGlassIcon className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                        <h2
                            id="record-search-heading"
                            className="text-sm font-bold text-slate-950 dark:text-white"
                        >
                            Search the complete local record
                        </h2>
                    </div>

                    <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(280px,1fr)_repeat(3,minmax(150px,auto))] xl:items-end">
                        <label className="min-w-0">
                            <span className="mb-1 block text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                Search terms
                            </span>
                            <span className="relative block">
                                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                <input
                                    id="record-wide-search"
                                    type="search"
                                    value={query}
                                    onChange={event => setQuery(event.target.value)}
                                    placeholder="Medication, diagnosis, note text, result value, source, or identifier"
                                    className="min-h-11 w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                />
                            </span>
                        </label>
                        <ModuleSelect
                            label="Resource type"
                            value={resourceType}
                            onChange={value => setResourceType(
                                value as 'all' | ClinicalResourceType,
                            )}
                            options={[
                                { value: 'all', label: 'All resource types' },
                                ...search.availableResourceTypes.map(value => ({
                                    value,
                                    label: value.replace(/([a-z])([A-Z])/g, '$1 $2'),
                                })),
                            ]}
                        />
                        <ModuleSelect
                            label="Verification"
                            value={verificationStatus}
                            onChange={value => setVerificationStatus(
                                value as RecordSearchVerificationFilter,
                            )}
                            options={[
                                { value: 'confirmed', label: 'Confirmed only' },
                                { value: 'candidate', label: 'Candidates' },
                                { value: 'rejected', label: 'Rejected history' },
                                { value: 'entered-in-error', label: 'Entered-in-error history' },
                                { value: 'all', label: 'All verification states' },
                            ]}
                        />
                        <ModuleSelect
                            label="Clinical date"
                            value={dateState}
                            onChange={value => setDateState(
                                value as RecordSearchDateFilter,
                            )}
                            options={[
                                { value: 'all', label: 'Known and unknown' },
                                { value: 'dated', label: 'Known clinical date' },
                                { value: 'undated', label: 'Clinical date unknown' },
                            ]}
                        />
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p
                            role="status"
                            aria-live="polite"
                            className="text-xs font-semibold text-slate-600 dark:text-slate-300"
                        >
                            {search.items.length} matching resource{search.items.length === 1 ? '' : 's'}
                        </p>
                        <p className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                            Every query term must match. Search includes structured values, note text, source details, tags, and amendment history.
                        </p>
                    </div>
                </section>

                {nonConfirmedView && (
                    <section
                        role="note"
                        className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/25"
                    >
                        <div className="flex items-start gap-3">
                            <AlertTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-300" />
                            <div>
                                <h2 className="text-sm font-bold text-amber-950 dark:text-amber-100">
                                    Review or error history is visible
                                </h2>
                                <p className="mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                                    Candidate, rejected, and entered-in-error resources are retained for traceability. They are not current confirmed patient facts and are excluded from the complete patient-summary export.
                                </p>
                            </div>
                        </div>
                    </section>
                )}

                {search.items.length === 0 ? (
                    <EmptyModuleState
                        title="No record matches this search"
                        description="Change the terms or broaden the resource, verification, or clinical-date filters."
                        caution="An empty result does not prove that the information does not exist outside this local record."
                    />
                ) : (
                    <ul
                        aria-label="Record search results"
                        className="space-y-3"
                    >
                        {search.items.map(item => (
                            <li key={`${item.resourceType}-${item.id}`}>
                                <details className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm open:border-blue-200 dark:border-slate-800 dark:bg-slate-950/80 dark:open:border-blue-800">
                                    <summary className="flex cursor-pointer list-none items-start gap-3 p-4 md:p-5">
                                        <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                            <DocumentTextIcon className="h-4 w-4" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex flex-wrap items-center gap-2">
                                                <span className="break-words text-sm font-bold text-slate-950 dark:text-white">
                                                    {item.label}
                                                </span>
                                                <StatusBadge tone={verificationTone(item.verificationStatus)}>
                                                    {item.verificationStatus.replace(/-/g, ' ')}
                                                </StatusBadge>
                                                <StatusBadge>{item.resourceTypeLabel}</StatusBadge>
                                            </span>
                                            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                                                {item.statusLabel} · {item.clinicalDateLabel} · {item.sourceLabel}
                                            </span>
                                        </span>
                                        <ChevronRightIcon className="mt-2 h-4 w-4 flex-shrink-0 text-slate-300 transition-transform group-open:rotate-90" />
                                    </summary>

                                    <div className="border-t border-slate-100 p-4 dark:border-slate-800 md:p-5">
                                        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                            {[
                                                ['Resource ID', item.id],
                                                ['Clinical date', item.clinicalDateLabel],
                                                ['Stored', item.recordedLabel],
                                                ['Amendments', String(item.amendmentCount)],
                                            ].map(([label, value]) => (
                                                <div
                                                    key={label}
                                                    className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900/70"
                                                >
                                                    <dt className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                        {label}
                                                    </dt>
                                                    <dd className="mt-1 break-words text-xs font-semibold text-slate-700 dark:text-slate-200">
                                                        {value}
                                                    </dd>
                                                </div>
                                            ))}
                                        </dl>

                                        {item.detailLines.length > 0 && (
                                            <section className="mt-4" aria-label="Matched structured details">
                                                <h3 className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                    Structured details
                                                </h3>
                                                <ul className="mt-2 grid gap-2 lg:grid-cols-2">
                                                    {item.detailLines.map(line => (
                                                        <li
                                                            key={line}
                                                            className="break-words rounded-xl border border-slate-200 p-3 text-xs leading-relaxed text-slate-700 dark:border-slate-800 dark:text-slate-200"
                                                        >
                                                            {line}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </section>
                                        )}

                                        <ProvenancePanel
                                            provenance={buildResourceProvenanceView(item.resource)}
                                            onViewSource={item.sourceDocument
                                                ? () => setSource(item.sourceDocument!)
                                                : undefined}
                                        />
                                    </div>
                                </details>
                            </li>
                        ))}
                    </ul>
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

export default RecordSearchAndExport;
