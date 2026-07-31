import React, { useMemo, useState } from 'react';
import { useToast } from '../../../components/Toast';
import {
    AlertTriangleIcon,
    BeakerIcon,
    CheckIcon,
    DocumentTextIcon,
    XCircleIcon,
} from '../../../components/icons';
import { useAuditStore } from '../../audit/useAuditStore';
import DocumentSourcePreview from '../../clinical-record/components/DocumentSourcePreview';
import type {
    ClinicalDate,
    ClinicalPeriod,
    ObservationRecord,
    SourceDocumentReference,
} from '../../clinical-record';
import { useClinicalRecordStore } from '../../clinical-record';
import {
    confirmDiagnosticReportCandidateGraph,
    listDiagnosticReportGraphs,
    rejectDiagnosticReportCandidateGraph,
} from '../index';

interface DiagnosticReportGraphReviewProps {
    patientId: string;
}

const dateLabel = (
    value: ClinicalDate | ClinicalPeriod | undefined,
): string => {
    if (!value) return 'Clinical date unknown';
    if ('precision' in value) {
        return value.value || 'Clinical date unknown';
    }
    const start = value.start?.value;
    const end = value.end?.value;
    if (start && end && start !== end) return `${start} – ${end}`;
    return start || end || 'Clinical date unknown';
};

const quantityText = (
    observation: ObservationRecord,
): {
    original: string;
    normalized?: string;
} => {
    const value = observation.value;
    if (!value) return { original: 'No value recorded' };
    switch (value.type) {
        case 'quantity': {
            const original = value.quantity.original;
            const normalized = value.quantity.normalized;
            return {
                original: `${original.comparator || ''}${original.value}${original.unit ? ` ${original.unit}` : ''}`,
                ...(normalized
                    ? {
                        normalized: `${normalized.comparator || ''}${normalized.value}${normalized.unit ? ` ${normalized.unit}` : ''}`,
                    }
                    : {}),
            };
        }
        case 'string':
            return { original: value.text };
        case 'boolean':
            return { original: value.value ? 'True' : 'False' };
        case 'integer':
            return { original: String(value.value) };
        case 'codeable-concept':
            return { original: value.concept.text };
    }
};

const referenceRangeText = (observation: ObservationRecord): string => {
    const labels = observation.referenceRanges.map(range => {
        if (range.text) return range.text;
        const low = range.low
            ? `${range.low.comparator || ''}${range.low.value}${range.low.unit ? ` ${range.low.unit}` : ''}`
            : '';
        const high = range.high
            ? `${range.high.comparator || ''}${range.high.value}${range.high.unit ? ` ${range.high.unit}` : ''}`
            : '';
        return [low, high].filter(Boolean).join(' – ');
    }).filter(Boolean);
    return labels.join('; ') || 'No reference range recorded';
};

const DiagnosticReportGraphReview: React.FC<
    DiagnosticReportGraphReviewProps
> = ({ patientId }) => {
    const record = useClinicalRecordStore(state => state.records[patientId]);
    const logEvent = useAuditStore(state => state.actions.logEvent);
    const { showToast } = useToast();
    const [reviewReasons, setReviewReasons] = useState<Record<string, string>>({});
    const [busyGraphId, setBusyGraphId] = useState<string | null>(null);
    const [errorByGraph, setErrorByGraph] = useState<Record<string, string>>({});
    const [previewSource, setPreviewSource] =
        useState<SourceDocumentReference | null>(null);

    const graphs = useMemo(
        () => record
            ? listDiagnosticReportGraphs(record, 'candidate')
            : [],
        [record],
    );

    if (!record || graphs.length === 0) return null;

    const setError = (graphId: string, message?: string): void => {
        setErrorByGraph(current => ({
            ...current,
            [graphId]: message || '',
        }));
    };

    const confirmGraph = (graphId: string): void => {
        setBusyGraphId(graphId);
        setError(graphId);
        try {
            const result = confirmDiagnosticReportCandidateGraph(
                patientId,
                graphId,
                {
                    reviewedAt: new Date().toISOString(),
                    reviewedBy: 'Local user',
                    reason: reviewReasons[graphId]?.trim()
                        || 'Reviewed the complete report graph against the original source.',
                },
            );
            if (!result.ok) {
                const message = result.issues
                    .map(issue => `${issue.path}: ${issue.message}`)
                    .join(' · ')
                    || result.message
                    || 'The report graph could not be confirmed.';
                setError(graphId, message);
                showToast('Report graph was not confirmed.', 'error');
                return;
            }
            logEvent(
                'DIAGNOSTIC_REPORT_GRAPH_CONFIRMED',
                patientId,
                'Confirmed a diagnostic report, its linked results, and its linked specimens together.',
                'USER',
                { graphId, reportId: result.reportId },
            );
            showToast('Complete report graph confirmed.', 'success');
        } finally {
            setBusyGraphId(null);
        }
    };

    const rejectGraph = (graphId: string): void => {
        const reason = reviewReasons[graphId]?.trim();
        if (!reason) {
            setError(graphId, 'Enter a reason before rejecting the complete report graph.');
            return;
        }
        setBusyGraphId(graphId);
        setError(graphId);
        try {
            const result = rejectDiagnosticReportCandidateGraph(
                patientId,
                graphId,
                {
                    reviewedAt: new Date().toISOString(),
                    reviewedBy: 'Local user',
                    reason,
                },
            );
            if (!result.ok) {
                const message = result.issues
                    .map(issue => `${issue.path}: ${issue.message}`)
                    .join(' · ')
                    || result.message
                    || 'The report graph could not be rejected.';
                setError(graphId, message);
                showToast('Report graph was not rejected.', 'error');
                return;
            }
            logEvent(
                'DIAGNOSTIC_REPORT_GRAPH_REJECTED',
                patientId,
                'Rejected a diagnostic report, its linked results, and its linked specimens together.',
                'USER',
                { graphId, reason },
            );
            showToast('Complete report graph rejected.', 'success');
        } finally {
            setBusyGraphId(null);
        }
    };

    return (
        <section
            aria-labelledby="diagnostic-report-review-title"
            className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-900/60 dark:bg-blue-950/15 md:p-5"
        >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                        <BeakerIcon className="h-5 w-5" />
                    </span>
                    <div>
                        <h2
                            id="diagnostic-report-review-title"
                            className="text-sm font-bold text-slate-950 dark:text-white"
                        >
                            Diagnostic reports awaiting complete review
                        </h2>
                        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                            Each card is one connected report graph. Confirmation or rejection moves the report, every linked result, and every linked specimen together. These candidates are intentionally excluded from the generic one-resource review queue.
                        </p>
                    </div>
                </div>
                <span className="self-start rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">
                    {graphs.length} pending report{graphs.length === 1 ? '' : 's'}
                </span>
            </div>

            {graphs.map(graph => {
                const reason = reviewReasons[graph.graphId] || '';
                const source = graph.source;
                const busy = busyGraphId === graph.graphId;
                const graphStates = [
                    graph.report,
                    ...graph.observations,
                    ...graph.specimens,
                ].map(resource => resource.verificationStatus);
                const candidateOnly = graphStates.every(status => status === 'candidate');

                return (
                    <article
                        key={graph.graphId}
                        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950"
                    >
                        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 md:flex-row md:items-start md:justify-between">
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-base font-bold text-slate-950 dark:text-white">
                                        {graph.report.code.text}
                                    </h3>
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                                        Candidate graph
                                    </span>
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                        {graph.report.status}
                                    </span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                    <span>{dateLabel(graph.report.effectivePeriod || graph.report.effective)}</span>
                                    {graph.report.issuedAt && (
                                        <span>Issued {new Date(graph.report.issuedAt).toLocaleString()}</span>
                                    )}
                                    {graph.report.performer?.length && (
                                        <span>{graph.report.performer.join(', ')}</span>
                                    )}
                                    <span>{graph.observations.length} result{graph.observations.length === 1 ? '' : 's'}</span>
                                    <span>{graph.specimens.length} specimen{graph.specimens.length === 1 ? '' : 's'}</span>
                                </div>
                            </div>
                            {source && (
                                <button
                                    type="button"
                                    onClick={() => setPreviewSource(source)}
                                    className="flex items-center gap-2 self-start rounded-xl border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-900/60 dark:text-blue-300 dark:hover:bg-blue-950/30"
                                >
                                    <DocumentTextIcon className="h-4 w-4" />
                                    Open original report
                                </button>
                            )}
                        </div>

                        {!candidateOnly && (
                            <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-200">
                                <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                This graph has a mixed review state. Atomic confirmation and rejection are blocked until the graph is repaired.
                            </div>
                        )}

                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-left text-sm">
                                <thead className="bg-slate-50 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 dark:bg-slate-900/70">
                                    <tr>
                                        <th className="px-4 py-3">Result</th>
                                        <th className="px-3 py-3">Original value</th>
                                        <th className="px-3 py-3">Normalized</th>
                                        <th className="px-3 py-3">Reference range</th>
                                        <th className="px-3 py-3">Flag</th>
                                        <th className="px-3 py-3">Clinical date</th>
                                        <th className="px-3 py-3">Source</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {graph.observations.map(observation => {
                                        const display = quantityText(observation);
                                        const resultSource = observation.provenance.source.document;
                                        return (
                                            <tr key={observation.id} className="align-top">
                                                <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                                                    {observation.code.text}
                                                </td>
                                                <td className="px-3 py-3 font-mono text-slate-800 dark:text-slate-200">
                                                    {display.original}
                                                </td>
                                                <td className="px-3 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                                                    {display.normalized || 'Not normalized'}
                                                    {observation.value?.type === 'quantity'
                                                        && observation.value.quantity.normalizationWarning && (
                                                        <div className="mt-1 max-w-xs whitespace-normal text-amber-700 dark:text-amber-300">
                                                            {observation.value.quantity.normalizationWarning}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-300">
                                                    {referenceRangeText(observation)}
                                                </td>
                                                <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-300">
                                                    {observation.interpretation?.map(item => item.text).join(', ')
                                                        || 'No flag recorded'}
                                                </td>
                                                <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-300">
                                                    {dateLabel(observation.effective)}
                                                </td>
                                                <td className="px-3 py-3">
                                                    {resultSource ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => setPreviewSource(resultSource)}
                                                            className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300"
                                                        >
                                                            {resultSource.pageNumber
                                                                ? `Page ${resultSource.pageNumber}`
                                                                : 'View source'}
                                                        </button>
                                                    ) : (
                                                        <span className="text-[10px] text-red-500">Missing</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {graph.specimens.length > 0 && (
                            <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
                                <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                    Linked specimens
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {graph.specimens.map(specimen => (
                                        <span
                                            key={specimen.id}
                                            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                                        >
                                            <strong>{specimen.type?.text || 'Specimen'}</strong>
                                            {' · '}{dateLabel(specimen.collectedAt || specimen.effective)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {graph.report.conclusion && (
                            <div className="border-t border-slate-200 px-4 py-3 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:text-slate-200">
                                <span className="mr-2 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                    Report conclusion
                                </span>
                                {graph.report.conclusion}
                            </div>
                        )}

                        <div className="space-y-3 border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                            <label className="block">
                                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                    Review note / rejection reason
                                </span>
                                <textarea
                                    value={reason}
                                    onChange={event => setReviewReasons(current => ({
                                        ...current,
                                        [graph.graphId]: event.target.value,
                                    }))}
                                    rows={2}
                                    placeholder="Optional for confirmation; required for rejection"
                                    className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950"
                                />
                            </label>
                            {errorByGraph[graph.graphId] && (
                                <p role="alert" className="text-xs font-semibold text-red-600 dark:text-red-300">
                                    {errorByGraph[graph.graphId]}
                                </p>
                            )}
                            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                                <button
                                    type="button"
                                    onClick={() => rejectGraph(graph.graphId)}
                                    disabled={busy || !candidateOnly}
                                    className="flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-xs font-bold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/30"
                                >
                                    <XCircleIcon className="h-4 w-4" />
                                    Reject complete graph
                                </button>
                                <button
                                    type="button"
                                    onClick={() => confirmGraph(graph.graphId)}
                                    disabled={busy || !candidateOnly}
                                    className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <CheckIcon className="h-4 w-4" />
                                    {busy ? 'Saving…' : 'Confirm complete graph'}
                                </button>
                            </div>
                        </div>
                    </article>
                );
            })}

            {previewSource && (
                <DocumentSourcePreview
                    patientId={patientId}
                    source={previewSource}
                    onClose={() => setPreviewSource(null)}
                />
            )}
        </section>
    );
};

export default DiagnosticReportGraphReview;