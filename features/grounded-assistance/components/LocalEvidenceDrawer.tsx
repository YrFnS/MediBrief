import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangleIcon,
    DocumentTextIcon,
    ShieldCheckIcon,
    XCircleIcon,
} from '../../../components/icons';
import { useAuditStore } from '../../audit/useAuditStore';
import DocumentSourcePreview from '../../clinical-record/components/DocumentSourcePreview';
import type {
    PatientClinicalRecord,
    SourceDocumentReference,
} from '../../clinical-record/types';
import { resolveLocalEvidence } from '../evidenceReview';

export type LocalEvidenceReviewContext =
    | 'deterministic-summary'
    | 'grounded-assistant'
    | 'validated-advisory'
    | 'audit-event'
    | 'other';

interface LocalEvidenceDrawerProps {
    record: PatientClinicalRecord;
    evidenceIds: string[];
    title: string;
    description?: string;
    context?: LocalEvidenceReviewContext;
    onClose: () => void;
}

const dateLabel = (value: string | null, precision: string): string => {
    if (!value || precision === 'unknown') return 'Clinical date unknown';
    return precision === 'day' ? value : `${value} (${precision} precision)`;
};

const LocalEvidenceDrawer: React.FC<LocalEvidenceDrawerProps> = ({
    record,
    evidenceIds,
    title,
    description,
    context = 'other',
    onClose,
}) => {
    const auditActions = useAuditStore(state => state.actions);
    const [source, setSource] = useState<SourceDocumentReference | null>(null);
    const resolution = useMemo(
        () => resolveLocalEvidence(record, evidenceIds),
        [evidenceIds, record],
    );

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent): void => {
            if (event.key === 'Escape' && !source) onClose();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose, source]);

    const handleOpenSource = (
        evidenceId: string,
        sourceReference: SourceDocumentReference,
    ): void => {
        auditActions.logEvent(
            'CLINICAL_SOURCE_VIEWED',
            record.patientId,
            `Opened the original local source for evidence ${evidenceId}.`,
            'USER',
            {
                evidenceId,
                context,
                documentId: sourceReference.documentId,
                fileName: sourceReference.fileName,
                pageNumber: sourceReference.pageNumber,
                section: sourceReference.section,
            },
        );
        setSource(sourceReference);
    };

    return (
        <div
            className="fixed inset-0 z-[80] flex justify-end bg-slate-950/55 backdrop-blur-sm animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="local-evidence-review-title"
        >
            <button
                type="button"
                aria-label="Close evidence review"
                className="min-w-0 flex-1 cursor-default"
                onClick={onClose}
            />
            <section className="flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
                <header className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 dark:border-slate-800 md:px-6">
                    <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                            <ShieldCheckIcon className="h-5 w-5" />
                        </span>
                        <div className="min-w-0">
                            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                                Confirmed local evidence
                            </p>
                            <h2
                                id="local-evidence-review-title"
                                className="mt-1 text-xl font-display font-bold text-slate-950 dark:text-white"
                            >
                                {title}
                            </h2>
                            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                {description || 'Review the exact patient-record items referenced by this workflow.'}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                        aria-label="Close evidence review"
                    >
                        <XCircleIcon className="h-5 w-5" />
                    </button>
                </header>

                <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5 md:px-6">
                    <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/25">
                        <div className="flex items-start gap-3">
                            <ShieldCheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-700 dark:text-blue-300" />
                            <p className="text-xs leading-relaxed text-blue-900 dark:text-blue-100">
                                Evidence identifiers and bundle membership are checked locally. This view does not prove sentence-level entailment, completeness, clinical correctness, urgency, or treatment significance.
                            </p>
                        </div>
                    </section>

                    <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide">
                        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {resolution.evidence.length} resolved item{resolution.evidence.length === 1 ? '' : 's'}
                        </span>
                        {resolution.missingIds.length > 0 && (
                            <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                                {resolution.missingIds.length} unavailable identifier{resolution.missingIds.length === 1 ? '' : 's'}
                            </span>
                        )}
                    </div>

                    {resolution.evidence.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                            <DocumentTextIcon className="mx-auto h-8 w-8 text-slate-300" />
                            <p className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-100">
                                No referenced evidence is available
                            </p>
                            <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                The referenced resource may have been removed, marked entered in error, or may no longer meet the confirmed patient-evidence boundary.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {resolution.evidence.map(item => (
                                <article
                                    key={item.id}
                                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50"
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-600 shadow-sm dark:bg-slate-950 dark:text-slate-300">
                                                    {item.resourceType}
                                                </span>
                                                <span className="rounded-full bg-white px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-600 shadow-sm dark:bg-slate-950 dark:text-slate-300">
                                                    {item.scope}
                                                </span>
                                                {item.qualifiers.map(qualifier => (
                                                    <span
                                                        key={qualifier}
                                                        className="rounded-full bg-amber-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                                                    >
                                                        {qualifier}
                                                    </span>
                                                ))}
                                            </div>
                                            <h3 className="mt-3 text-sm font-bold text-slate-950 dark:text-white">
                                                {item.label}
                                            </h3>
                                            <p className="mt-2 text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                                                {item.statement}
                                            </p>
                                        </div>
                                        {item.source && (
                                            <button
                                                type="button"
                                                onClick={() => handleOpenSource(item.id, item.source!)}
                                                className="inline-flex min-h-10 flex-shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-900 dark:bg-slate-950 dark:text-blue-300 dark:hover:bg-blue-950/30"
                                            >
                                                <DocumentTextIcon className="h-4 w-4" />
                                                View source
                                            </button>
                                        )}
                                    </div>

                                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                        <div className="rounded-xl bg-white p-3 dark:bg-slate-950">
                                            <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                Clinical date
                                            </p>
                                            <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                                                {dateLabel(item.clinicalDate, item.datePrecision)}
                                            </p>
                                        </div>
                                        <div className="rounded-xl bg-white p-3 dark:bg-slate-950">
                                            <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                                                Source
                                            </p>
                                            <p className="mt-1 text-xs font-semibold text-slate-700 dark:text-slate-200">
                                                {item.sourceLabel}
                                            </p>
                                        </div>
                                    </div>

                                    <code className="mt-3 block break-all rounded-xl bg-slate-950 px-3 py-2 text-[9px] text-blue-200">
                                        [{item.id}]
                                    </code>
                                </article>
                            ))}
                        </div>
                    )}

                    {resolution.missingIds.length > 0 && (
                        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                            <div className="flex items-start gap-3">
                                <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700 dark:text-amber-300" />
                                <div>
                                    <h3 className="text-xs font-bold text-amber-900 dark:text-amber-100">
                                        Unresolved evidence identifiers
                                    </h3>
                                    <div className="mt-2 space-y-1">
                                        {resolution.missingIds.map(id => (
                                            <code
                                                key={id}
                                                className="block break-all text-[9px] text-amber-800 dark:text-amber-200"
                                            >
                                                {id}
                                            </code>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}
                </div>
            </section>

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

export default LocalEvidenceDrawer;
