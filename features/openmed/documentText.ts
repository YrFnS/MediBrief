import type { UploadedFile } from '../../types';
import type { LocalTextExtractionResult } from './types';

export const DEFAULT_OPENMED_MAX_TEXT_CHARS = 250_000;

const SUPPORTED_TEXT_MIME_TYPES = new Set([
    'application/csv',
    'application/json',
    'application/ld+json',
    'application/xml',
    'application/xhtml+xml',
    'text/csv',
    'text/html',
    'text/markdown',
    'text/plain',
    'text/tab-separated-values',
    'text/xml',
]);

const SUPPORTED_TEXT_EXTENSIONS = new Set([
    'csv',
    'htm',
    'html',
    'json',
    'md',
    'markdown',
    'text',
    'tsv',
    'txt',
    'xml',
]);

const fileExtension = (name: string): string => {
    const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
    return match?.[1] || '';
};

export const isOpenMedTextFile = (
    file: Pick<UploadedFile, 'file' | 'type'>,
): boolean => {
    const mimeType = (file.type || file.file.type || '').toLowerCase();
    if (mimeType.startsWith('text/')) return true;
    if (SUPPORTED_TEXT_MIME_TYPES.has(mimeType)) return true;
    return SUPPORTED_TEXT_EXTENSIONS.has(fileExtension(file.file.name));
};

const decodeBase64Utf8 = (base64: string): string => {
    const normalized = base64.replace(/\s+/g, '');
    if (!normalized) return '';

    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
};

export const extractLocalTextFromUpload = (
    file: UploadedFile,
    options: { maxCharacters?: number } = {},
): LocalTextExtractionResult => {
    const fileName = file.file.name;
    const mimeType = file.type || file.file.type || 'application/octet-stream';

    if (!isOpenMedTextFile(file)) {
        return {
            status: 'unsupported',
            fileName,
            mimeType,
            message:
                'OpenMed Slice 1 accepts files that already contain text. PDF and image OCR are not enabled yet.',
        };
    }

    let decoded: string;
    try {
        decoded = decodeBase64Utf8(file.base64);
    } catch {
        return {
            status: 'invalid',
            fileName,
            mimeType,
            message: 'The local text file could not be decoded as UTF-8.',
        };
    }

    const text = decoded.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    if (text.includes('\u0000')) {
        return {
            status: 'invalid',
            fileName,
            mimeType,
            message: 'The selected file appears to contain binary data rather than text.',
        };
    }
    if (!text.trim()) {
        return {
            status: 'empty',
            fileName,
            mimeType,
            message: 'The selected text file is empty.',
        };
    }

    const maxCharacters = options.maxCharacters
        ?? DEFAULT_OPENMED_MAX_TEXT_CHARS;
    if (text.length > maxCharacters) {
        return {
            status: 'too-large',
            fileName,
            mimeType,
            message:
                `The decoded text contains ${text.length.toLocaleString()} characters. `
                + `Slice 1 limits one OpenMed request to ${maxCharacters.toLocaleString()} characters.`,
        };
    }

    return {
        status: 'ready',
        fileName,
        mimeType,
        text,
        message: 'Local text is ready for OpenMed analysis.',
    };
};
