import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangleIcon,
    DocumentTextIcon,
    DownloadIcon,
    XCircleIcon,
} from '../../../components/icons';
import { blobStorage } from '../../../services/blobStorageService';
import {
    encryptedSourceStorage,
    isEncryptedSourceStorageId,
} from '../../../services/encryptedSourceStorage';
import {
    getSourcePreviewKind,
    resolveDocumentSource,
    sourceFileUnavailableMessage,
} from '../sourceDocuments';
import type { SourceDocumentReference } from '../types';
import { useClinicalRecordStore } from '../useClinicalRecordStore';

interface DocumentSourcePreviewProps {
    patientId: string;
    source: SourceDocumentReference;
    onClose: () => void;
}

const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return new Blob([bytes], { type: mimeType });
};

const DocumentSourcePreview: React.FC<DocumentSourcePreviewProps> = ({
    patientId,
    source,
    onClose,
}) => {
    const record = useClinicalRecordStore(state => state.records[patientId]);
    const resolvedSource = useMemo(
        () => resolveDocumentSource(record, source),
        [record, source],
    );
    const {
        storageId,
        fileName,
    } = resolvedSource;

    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    const [mimeType, setMimeType] = useState(resolvedSource.mimeType);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    useEffect(() => {
        let cancelled = false;
        let nextUrl: string | null = null;

        const load = async () => {
            setIsLoading(true);
            setError(null);
            setObjectUrl(null);

            try {
                let blob: Blob | null = null;
                let resolvedMimeType = resolvedSource.mimeType
                    || 'application/octet-stream';

                if (isEncryptedSourceStorageId(storageId)) {
                    const stored = await encryptedSourceStorage.getSource(
                        storageId,
                    );
                    if (!stored) {
                        if (!cancelled) {
                            setError(sourceFileUnavailableMessage(storageId));
                        }
                        return;
                    }
                    resolvedMimeType = stored.mimeType
                        || resolvedMimeType;
                    blob = new Blob([stored.text], {
                        type: resolvedMimeType,
                    });
                } else {
                    const stored = await blobStorage.getFile(storageId);
                    if (!stored) {
                        if (!cancelled) {
                            setError(sourceFileUnavailableMessage(storageId));
                        }
                        return;
                    }
                    resolvedMimeType = stored.mimeType
                        || resolvedMimeType;
                    blob = base64ToBlob(
                        stored.data,
                        resolvedMimeType,
                    );
                }

                if (cancelled || !blob) return;
                nextUrl = URL.createObjectURL(blob);
                setMimeType(resolvedMimeType);
                setObjectUrl(nextUrl);
            } catch (loadError) {
                console.error('Unable to load source document:', loadError);
                if (!cancelled) {
                    setError(
                        loadError instanceof Error
                            ? loadError.message
                            : 'The source document could not be loaded from local storage.',
                    );
                }
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
            if (nextUrl) URL.revokeObjectURL(nextUrl);
        };
    }, [resolvedSource.mimeType, storageId]);

    const previewUrl = objectUrl
        && mimeType === 'application/pdf'
        && source.pageNumber
        ? `${objectUrl}#page=${source.pageNumber}`
        : objectUrl;

    const previewKind = getSourcePreviewKind(mimeType);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm">
            <div className="flex h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl dark:bg-slate-950">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <DocumentTextIcon className="h-4 w-4 flex-shrink-0 text-blue-500" />
                            <h2 className="truncate text-sm font-bold text-slate-900 dark:text-white">
                                {fileName}
                            </h2>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                            {source.pageNumber && <span>Page {source.pageNumber}</span>}
                            {source.section && <span>Section: {source.section}</span>}
                            <span>{mimeType}</span>
                            {isEncryptedSourceStorageId(storageId) && (
                                <span>Integrity verified after decryption</span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {objectUrl && (
                            <a
                                href={objectUrl}
                                download={fileName}
                                className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:border-blue-300 hover:text-blue-600 dark:border-slate-700"
                                title="Save a copy of the source document"
                            >
                                <DownloadIcon className="h-4 w-4" />
                            </a>
                        )}
                        <button
                            onClick={onClose}
                            className="rounded-lg border border-slate-200 p-2 text-slate-500 transition-colors hover:border-red-300 hover:text-red-600 dark:border-slate-700"
                            aria-label="Close source preview"
                        >
                            <XCircleIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {source.excerpt && (
                    <div className="border-b border-amber-100 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                        <span className="mr-2 font-mono text-[10px] font-bold uppercase tracking-wider">
                            Source excerpt
                        </span>
                        {source.excerpt}
                    </div>
                )}

                <div className="relative flex-1 overflow-hidden bg-slate-100 dark:bg-black">
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="flex items-center gap-3 text-sm text-slate-500">
                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                                Loading local source…
                            </div>
                        </div>
                    )}

                    {!isLoading && error && (
                        <div className="absolute inset-0 flex items-center justify-center p-6">
                            <div className="max-w-xl rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-lg dark:border-amber-900/50 dark:bg-slate-900">
                                <AlertTriangleIcon className="mx-auto mb-3 h-8 w-8 text-amber-500" />
                                <h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">
                                    Source file unavailable
                                </h3>
                                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                    {error}
                                </p>
                                <p className="mt-3 break-all font-mono text-[10px] text-slate-400">
                                    Storage reference: {storageId}
                                </p>
                            </div>
                        </div>
                    )}

                    {!isLoading && !error && previewUrl && previewKind === 'image' && (
                        <div className="h-full w-full overflow-auto p-4">
                            <img
                                src={previewUrl}
                                alt={fileName}
                                className="mx-auto max-h-full max-w-full rounded-lg bg-black object-contain shadow-2xl"
                            />
                        </div>
                    )}

                    {!isLoading && !error && previewUrl && previewKind === 'embedded' && (
                        <iframe
                            src={previewUrl}
                            title={fileName}
                            className="h-full w-full border-0 bg-white"
                        />
                    )}

                    {!isLoading && !error && previewUrl && previewKind === 'download' && (
                        <div className="absolute inset-0 flex items-center justify-center p-6">
                            <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg dark:border-slate-700 dark:bg-slate-900">
                                <DocumentTextIcon className="mx-auto mb-3 h-10 w-10 text-blue-500" />
                                <h3 className="mb-2 text-sm font-bold text-slate-900 dark:text-white">
                                    Preview is not available for this file type
                                </h3>
                                <p className="mb-4 text-sm text-slate-500 dark:text-slate-300">
                                    The original local file is present and can be saved for review.
                                </p>
                                <a
                                    href={objectUrl || undefined}
                                    download={fileName}
                                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-blue-500"
                                >
                                    <DownloadIcon className="h-4 w-4" />
                                    Save source file
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DocumentSourcePreview;
