import React, { useCallback, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { isOpenMedTextFile } from '../features/openmed/documentText';
import { blobStorage } from '../services/blobStorageService';
import type { UploadedFile } from '../types';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
    csv: 'text/csv',
    gif: 'image/gif',
    htm: 'text/html',
    html: 'text/html',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    json: 'application/json',
    markdown: 'text/markdown',
    md: 'text/markdown',
    pdf: 'application/pdf',
    png: 'image/png',
    text: 'text/plain',
    tsv: 'text/tab-separated-values',
    txt: 'text/plain',
    webp: 'image/webp',
    xml: 'application/xml',
};

const fileExtension = (name: string): string =>
    name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '';

const resolvedMimeType = (file: File): string =>
    file.type
    || MIME_BY_EXTENSION[fileExtension(file.name)]
    || 'application/octet-stream';

const isSupportedUpload = (file: File): boolean => {
    const mimeType = resolvedMimeType(file);
    return mimeType.startsWith('image/')
        || mimeType === 'application/pdf'
        || isOpenMedTextFile({ file, type: mimeType });
};

export const useFileDragAndDrop = () => {
    const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;
        if (!event.dataTransfer.types.includes('Files')) return;
        if (!isDragging) setIsDragging(true);
    }, [isDragging]);

    const handleDragLeave = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        if (event.currentTarget.contains(event.relatedTarget as Node)) return;
        setIsDragging(false);
    }, []);

    const processFile = useCallback(async (file: File) => {
        if (file.size > MAX_UPLOAD_BYTES) {
            alert('File is too large. Please select a file smaller than 10 MB.');
            return;
        }
        if (!isSupportedUpload(file)) {
            alert(
                'Unsupported file type. Upload an image, PDF, TXT, Markdown, CSV, TSV, JSON, XML, or HTML file.',
            );
            return;
        }

        const mimeType = resolvedMimeType(file);
        const reader = new FileReader();
        reader.onloadend = async () => {
            if (typeof reader.result !== 'string') {
                alert('The selected file could not be read.');
                return;
            }
            const base64 = reader.result.split(',')[1];
            if (!base64) {
                alert('The selected file did not contain readable data.');
                return;
            }
            const storageId = uuidv4();

            try {
                await blobStorage.saveFile(storageId, base64, mimeType);
            } catch (error) {
                console.error('Failed to save the uploaded file locally.', error);
                alert('The file could not be saved in the local vault.');
                return;
            }

            const uploadPayload: UploadedFile = {
                file,
                base64,
                type: mimeType,
                storageId,
            };

            if (mimeType.startsWith('image/')) {
                uploadPayload.url = URL.createObjectURL(file);
            }
            setUploadedFile(uploadPayload);
        };
        reader.onerror = () => {
            alert('The selected file could not be read.');
        };
        reader.readAsDataURL(file);
    }, []);

    const handleDrop = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        setIsDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) void processFile(file);
    }, [processFile]);

    const clearFile = useCallback(() => {
        setUploadedFile(current => {
            if (current?.url) URL.revokeObjectURL(current.url);
            return null;
        });
    }, []);

    return {
        uploadedFile,
        setUploadedFile,
        processFile,
        isDragging,
        clearFile,
        dragHandlers: {
            onDragOver: handleDragOver,
            onDragLeave: handleDragLeave,
            onDrop: handleDrop,
        },
    };
};
