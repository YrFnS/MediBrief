import type { UploadedFile } from '../../types';
import { extractLocalTextFromUpload } from './documentText';
import { extractOpenMedDocument } from './openMedDocumentClient';
import { OpenMedClientError } from './openMedClient';
import type {
    OpenMedDocumentExtractionResponse,
} from './documentTypes';
import type {
    OpenMedExtractionSettings,
    OpenMedExtractionStatus,
} from './types';

export interface PreparedOpenMedDocument {
    status: 'ready' | OpenMedExtractionStatus;
    text?: string;
    warnings: string[];
    documentExtraction?: OpenMedDocumentExtractionResponse;
}

const fileExtension = (name: string): string =>
    name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || '';

const isPdfOrImage = (file: UploadedFile): boolean => {
    const mime = (file.type || file.file.type || '').toLowerCase();
    const extension = fileExtension(file.file.name);
    return mime === 'application/pdf'
        || mime.startsWith('image/')
        || extension === 'pdf'
        || ['bmp', 'gif', 'jpeg', 'jpg', 'png', 'tif', 'tiff', 'webp']
            .includes(extension);
};

export const prepareOpenMedDocument = async ({
    file,
    documentId,
    settings,
    signal,
}: {
    file: UploadedFile;
    documentId: string;
    settings: OpenMedExtractionSettings;
    signal?: AbortSignal;
}): Promise<PreparedOpenMedDocument> => {
    const localText = extractLocalTextFromUpload(file);
    if (localText.status === 'ready' && localText.text) {
        return {
            status: 'ready',
            text: localText.text,
            warnings: [],
        };
    }

    if (localText.status !== 'unsupported') {
        return {
            status: localText.status,
            warnings: [localText.message],
        };
    }

    if (!isPdfOrImage(file)) {
        return {
            status: 'unsupported',
            warnings: [localText.message],
        };
    }
    if (settings.documentExtractionEnabled === false) {
        return {
            status: 'unsupported',
            warnings: [
                'Local PDF and image extraction is disabled in OpenMed settings.',
            ],
        };
    }

    try {
        const extraction = await extractOpenMedDocument({
            config: {
                baseUrl: settings.baseUrl,
                timeoutMs: settings.timeoutMs,
            },
            options: {
                documentId,
                fileName: file.file.name,
                mimeType: file.type || file.file.type || 'application/octet-stream',
                base64: file.base64,
                ocrMode: settings.ocrMode || 'auto',
                ocrEngine: settings.ocrEngine || 'auto',
                languages: settings.ocrLanguages?.length
                    ? settings.ocrLanguages
                    : ['en'],
                resolution: settings.ocrResolution || 200,
                signal,
            },
        });
        if (
            ['completed', 'partial'].includes(extraction.status)
            && extraction.text.trim()
        ) {
            return {
                status: 'ready',
                text: extraction.text,
                warnings: extraction.warnings,
                documentExtraction: extraction,
            };
        }
        return {
            status: extraction.status === 'empty' ? 'empty' : 'unsupported',
            warnings: extraction.warnings,
            documentExtraction: extraction,
        };
    } catch (error) {
        if (
            signal?.aborted
            || (error instanceof OpenMedClientError && error.code === 'aborted')
        ) {
            return {
                status: 'aborted',
                warnings: ['Local document extraction was cancelled.'],
            };
        }
        return {
            status: 'unavailable',
            warnings: [
                error instanceof Error
                    ? error.message
                    : 'Local document extraction failed.',
            ],
        };
    }
};
