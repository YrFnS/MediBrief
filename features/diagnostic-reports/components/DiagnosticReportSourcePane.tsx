import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangleIcon,
    DocumentTextIcon,
    DownloadIcon,
} from '../../../components/icons';
import { blobStorage } from '../../../services/blobStorageService';
import { useClinicalRecordStore } from '../../clinical-record';

interface DiagnosticReportSourcePaneProps {
    patientId: string;
    documentId: string;
    pageNumber?: number;
}

const base64ToBytes = (value: string): Uint8Array => {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
};

const isTextMimeType = (mimeType: string): boolean =>
    mimeType.startsWith('text/')
    || mimeType === 'application/json'
    || mimeType === 'application/xml';

const DiagnosticReportSourcePane: React.FC<
    DiagnosticReportSourcePaneProps
> = ({ patientId, documentId, pageNumber }) => {
    const record = useClinicalRecordStore(state => state.records[patientId]);
    const document = useMemo(
        () => record?.resources.documents.find(item => item.id === documentId),
        [documentId, record],
    );
    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    const [textContent, setTextContent] = useState<string | null>(null);
    const [mimeType, setMimeType] = useState(
        document?.mimeType || 'application/octet-stream',
    );
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        let nextUrl: string | null = null;

        const load = async () => {
            setLoading(true);
            setError(null);
            setObjectUrl(null);
            setTextContent(null);

            if (!document) {
                setError(
                    'The original report is not present in this patient’s local record.',
                );
                setLoading(false);
                return;
            }

            try {
                const stored = await blobStorage.getFile(document.storageId);
                if (cancelled) return;
                if (!stored) {
                    setError(
                        'The report metadata exists, but the local file payload is unavailable.',
                    );
                    return;
                }
                const resolvedMimeType = stored.mimeType
                    || document.mimeType
                    || 'application/octet-stream';
                const bytes = base64ToBytes(stored.data);
                setMimeType(resolvedMimeType);
                if (isTextMimeType(resolvedMimeType)) {
                    setTextContent(new TextDecoder('utf-8').decode(bytes));
                } else {
                    nextUrl = URL.createObjectURL(
                        new Blob([bytes], { type: resolvedMimeType }),
                    );
                    setObjectUrl(nextUrl);
                }
            } catch (loadError) {
                console.error('Unable to load diagnostic source:', loadError);
                if (!cancelled) {
                    setError('The original report could not be loaded locally.');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
            if (nextUrl) URL.revokeObjectURL(nextUrl);
        };
    }, [document]);

    const previewUrl = objectUrl
        && mimeType === 'application/pdf'
        && pageNumber
        ? `${objectUrl}#page=${pageNumber}`
        : objectUrl;

    return (
        <section
            aria-labelledby="diagnostic-source-title"
            className="flex min-h-[24rem] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-black"
        >
            <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <DocumentTextIcon className="h-4 w-4 flex-shrink-0 text-blue-500" />
                        <h3
                            id="diagnostic-source-title"
                            className="truncate text-xs font-bold text-slate-900 dark:text-white"
                        >
                            Original report
                        </h3>
                    </div>
                    <p className="mt-1 truncate font-mono text-[10px] text-slate-500 dark:text-slate-400">
                        {document?.fileName || documentId}
                        {pageNumber ? ` · Page ${pageNumber}` : ''}
                    </p>
                </div>
                {objectUrl && document && (
                    <a
                        href={objectUrl}
                        download={document.fileName}
                        className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:border-blue-300 hover:text-blue-600 dark:border-slate-700"
                        aria-label="Save a copy of the original report"
                    >
                        <DownloadIcon className="h-4 w-4" />
                    </a>
                )}
            </div>

            <div className="relative min-h-0 flex-1 overflow-auto">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500">
                        <div className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                        Loading local source…
                    </div>
                )}

                {!loading && error && (
                    <div className="flex min-h-[20rem] items-center justify-center p-6">
                        <div className="max-w-md rounded-2xl border border-amber-200 bg-white p-5 text-center dark:border-amber-900/50 dark:bg-slate-900">
                            <AlertTriangleIcon className="mx-auto mb-3 h-7 w-7 text-amber-500" />
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                                Source unavailable
                            </p>
                            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                                {error}
                            </p>
                            <p className="mt-3 break-all font-mono text-[10px] text-slate-400">
                                Document ID: {documentId}
                            </p>
                        </div>
                    </div>
                )}

                {!loading && !error && textContent !== null && (
                    <pre className="min-h-full whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200">
                        {textContent}
                    </pre>
                )}

                {!loading
                    && !error
                    && previewUrl
                    && mimeType === 'application/pdf' && (
                    <iframe
                        src={previewUrl}
                        title="Original diagnostic report PDF"
                        className="h-full min-h-[36rem] w-full border-0 bg-white"
                    />
                )}

                {!loading
                    && !error
                    && previewUrl
                    && mimeType.startsWith('image/') && (
                    <div className="flex min-h-full items-start justify-center overflow-auto p-3">
                        <img
                            src={previewUrl}
                            alt="Original diagnostic report"
                            className="max-w-full rounded-lg bg-white object-contain shadow"
                        />
                    </div>
                )}

                {!loading
                    && !error
                    && previewUrl
                    && !mimeType.startsWith('image/')
                    && mimeType !== 'application/pdf'
                    && textContent === null && (
                    <div className="flex min-h-[20rem] items-center justify-center p-6 text-center">
                        <div>
                            <DocumentTextIcon className="mx-auto mb-3 h-8 w-8 text-slate-400" />
                            <p className="text-sm text-slate-600 dark:text-slate-300">
                                This file type cannot be previewed inline.
                            </p>
                            {document && (
                                <a
                                    href={previewUrl}
                                    download={document.fileName}
                                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white"
                                >
                                    <DownloadIcon className="h-4 w-4" />
                                    Save source copy
                                </a>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
};

export default DiagnosticReportSourcePane;
