import React, { useMemo, useState } from 'react';
import {
    AlertTriangleIcon,
    CheckIcon,
    ClockIcon,
    DocumentTextIcon,
} from '../../../components/icons';
import { useEntityExtractor } from '../../../hooks/useEntityExtractor';
import { blobStorage } from '../../../services/blobStorageService';
import type { UploadedFile } from '../../../types';
import type { DocumentReferenceRecord } from '../../clinical-record/types';
import {
    documentExtractionKey,
    useDocumentExtractionStore,
} from '../useDocumentExtractionStore';
import type {
    DocumentExtractionRunRecord,
    DocumentExtractionRunStatus,
} from '../documentTypes';

interface DocumentExtractionStatusPanelProps {
    patientId: string;
    document: DocumentReferenceRecord;
}

const statusLabel = (status: DocumentExtractionRunStatus): string => ({
    queued: 'Queued',
    running: 'Running',
    completed: 'Completed',
    partial: 'Partial',
    empty: 'No mapped entities',
    unsupported: 'Unsupported',
    failed: 'Failed',
    cancelled: 'Cancelled',
})[status];

const statusTone = (
    status: DocumentExtractionRunStatus,
): 'neutral' | 'positive' | 'warning' | 'danger' | 'info' => {
    if (status === 'completed') return 'positive';
    if (status === 'queued' || status === 'running') return 'info';
    if (status === 'failed') return 'danger';
    if (
        status === 'partial'
        || status === 'unsupported'
        || status === 'cancelled'
    ) return 'warning';
    return 'neutral';
};

const toneClasses = (
    tone: ReturnType<typeof statusTone>,
): string => {
    if (tone === 'positive') {
        return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200';
    }
    if (tone === 'danger') {
        return 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-200';
    }
    if (tone === 'warning') {
        return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200';
    }
    if (tone === 'info') {
        return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-200';
    }
    return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300';
};

const base64File = ({
    data,
    fileName,
    mimeType,
    storageId,
}: {
    data: string;
    fileName: string;
    mimeType: string;
    storageId: string;
}): UploadedFile => {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    const file = new File([bytes], fileName, { type: mimeType });
    return {
        file,
        base64: data,
        type: mimeType,
        storageId,
        ...(mimeType.startsWith('image/')
            ? { url: URL.createObjectURL(file) }
            : {}),
    };
};

const metric = (
    label: string,
    value: string | number | undefined,
): React.ReactNode => value === undefined ? null : (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950">
        <p className="text-[8px] font-mono font-bold uppercase tracking-wider text-slate-400">
            {label}
        </p>
        <p className="mt-0.5 break-words text-xs font-semibold text-slate-800 dark:text-slate-100">
            {value}
        </p>
    </div>
);

const ExtractionDetails: React.FC<{
    record: DocumentExtractionRunRecord;
}> = ({ record }) => (
    <div className="mt-3 space-y-3">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {metric('Attempts', record.attempts)}
            {metric('Method', record.method?.replace(/-/g, ' '))}
            {metric(
                'Pages with text',
                record.pageCount === undefined
                    ? undefined
                    : `${record.pagesWithText || 0} / ${record.pageCount}`,
            )}
            {metric(
                'Derived characters',
                record.characterCount?.toLocaleString(),
            )}
            {metric('New candidates', record.createdCandidates)}
            {metric('Same-source duplicates', record.duplicateCandidates)}
            {metric('OCR engine', record.ocrEngine)}
            {metric('OCR languages', record.languages?.join(', '))}
        </div>

        {record.failedPages.length > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
                Failed page{record.failedPages.length === 1 ? '' : 's'}: {record.failedPages.join(', ')}
            </p>
        )}

        {record.warnings.length > 0 && (
            <details className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 dark:border-amber-900/60 dark:bg-amber-950/20">
                <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                    {record.warnings.length} extraction warning{record.warnings.length === 1 ? '' : 's'}
                </summary>
                <ul className="mt-2 space-y-1.5">
                    {record.warnings.map((warning, index) => (
                        <li
                            key={`${warning}-${index}`}
                            className="text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/75"
                        >
                            {warning}
                        </li>
                    ))}
                </ul>
            </details>
        )}

        {(record.sourceSha256 || record.textSha256) && (
            <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
                <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Local integrity identifiers
                </summary>
                <div className="mt-2 space-y-1 font-mono text-[9px] text-slate-500 dark:text-slate-400">
                    {record.sourceSha256 && (
                        <p className="break-all">Original file SHA-256: {record.sourceSha256}</p>
                    )}
                    {record.textSha256 && (
                        <p className="break-all">Derived text SHA-256: {record.textSha256}</p>
                    )}
                </div>
            </details>
        )}
    </div>
);

const DocumentExtractionStatusPanel: React.FC<
    DocumentExtractionStatusPanelProps
> = ({ patientId, document }) => {
    const key = documentExtractionKey(patientId, document.id);
    const extraction = useDocumentExtractionStore(state => state.records[key]);
    const { triggerExtraction } = useEntityExtractor();
    const [retrying, setRetrying] = useState(false);
    const [retryError, setRetryError] = useState<string | null>(null);
    const busy = retrying
        || extraction?.status === 'queued'
        || extraction?.status === 'running';
    const tone = extraction ? statusTone(extraction.status) : 'neutral';
    const updatedLabel = useMemo(() => {
        if (!extraction) return null;
        const parsed = Date.parse(extraction.updatedAt);
        return Number.isNaN(parsed)
            ? extraction.updatedAt
            : new Date(parsed).toLocaleString();
    }, [extraction]);

    const retry = async () => {
        setRetryError(null);
        setRetrying(true);
        let transientUrl: string | undefined;
        try {
            const stored = await blobStorage.getFile(document.storageId);
            if (!stored) {
                throw new Error(
                    'The document metadata exists, but its binary file is missing from the local browser vault.',
                );
            }
            const upload = base64File({
                data: stored.data,
                fileName: document.fileName,
                mimeType: document.mimeType || stored.mimeType,
                storageId: document.storageId,
            });
            transientUrl = upload.url;
            await triggerExtraction(upload, patientId, {
                documentId: document.id,
            });
        } catch (error) {
            setRetryError(error instanceof Error
                ? error.message
                : 'The document could not be submitted for local extraction.');
        } finally {
            if (transientUrl) URL.revokeObjectURL(transientUrl);
            setRetrying(false);
        }
    };

    return (
        <section
            aria-label={`Local extraction status for ${document.fileName}`}
            className={`mt-4 rounded-xl border p-3 ${toneClasses(tone)}`}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-2">
                    <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/70 dark:bg-slate-950/60">
                        {!extraction
                            ? <DocumentTextIcon className="h-4 w-4" />
                            : extraction.status === 'completed'
                                ? <CheckIcon className="h-4 w-4" />
                                : extraction.status === 'queued'
                                    || extraction.status === 'running'
                                    ? <ClockIcon className="h-4 w-4 animate-pulse" />
                                    : <AlertTriangleIcon className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider opacity-70">
                            Local OpenMed document pipeline
                        </p>
                        <p className="mt-1 text-xs font-bold">
                            {extraction
                                ? statusLabel(extraction.status)
                                : 'Not processed locally'}
                        </p>
                        <p className="mt-1 text-[10px] leading-relaxed opacity-80">
                            {extraction?.message
                                || 'Run local extraction to read embedded PDF text or perform configured OCR before OpenMed creates review candidates.'}
                        </p>
                        {updatedLabel && (
                            <p className="mt-1 text-[9px] font-mono uppercase tracking-wide opacity-60">
                                Updated {updatedLabel}
                            </p>
                        )}
                    </div>
                </div>
                <button
                    type="button"
                    onClick={retry}
                    disabled={busy}
                    className="flex-shrink-0 rounded-lg border border-current/20 bg-white/70 px-3 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-950/60 dark:hover:bg-slate-950"
                    aria-label={`${extraction ? 'Retry' : 'Run'} local extraction for ${document.fileName}`}
                >
                    {busy
                        ? 'Processing…'
                        : extraction
                            ? 'Retry local extraction'
                            : 'Run local extraction'}
                </button>
            </div>

            {extraction && <ExtractionDetails record={extraction} />}

            {(extraction?.fallbackUsed || retryError) && (
                <div
                    role={retryError ? 'alert' : 'status'}
                    className="mt-3 rounded-lg border border-amber-300 bg-white/70 px-3 py-2 text-xs leading-relaxed dark:bg-slate-950/60"
                >
                    {retryError || (
                        'Gemini compatibility fallback was used after local extraction did not complete. Any fallback candidates keep separate cloud-extraction provenance.'
                    )}
                </div>
            )}

            <p className="mt-3 text-[10px] leading-relaxed opacity-75">
                The original uploaded file remains authoritative. Embedded text and OCR output are derived local evidence; candidate confirmation still requires source review. Re-running the same document is idempotent and same-source candidates are deduplicated.
            </p>
        </section>
    );
};

export default DocumentExtractionStatusPanel;
