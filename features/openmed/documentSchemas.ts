import { z } from 'zod';
import type {
    OpenMedDocumentExtractionResponse,
    OpenMedDocumentHealth,
} from './documentTypes';

const IsoDateTimeSchema = z.string().min(1).refine(
    value => !Number.isNaN(Date.parse(value)),
    'Expected a valid date-time',
);
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/i);
const DocumentMethodSchema = z.enum([
    'local-text',
    'embedded-pdf',
    'ocr',
    'hybrid',
    'none',
]);
const OcrEngineSchema = z.enum([
    'auto',
    'doctr',
    'tesseract',
    'easyocr',
    'paddleocr',
]);
const BboxSchema = z.tuple([
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
    z.number().finite(),
]);

const PageWireSchema = z.object({
    page_number: z.number().int().positive(),
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    method: DocumentMethodSchema,
    word_count: z.number().int().nonnegative(),
    character_count: z.number().int().nonnegative(),
    engine: z.string().min(1).optional(),
    average_confidence: z.number().min(0).max(1).optional(),
    minimum_confidence: z.number().min(0).max(1).optional(),
}).strict();

const SourceSpanWireSchema = z.object({
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    page_number: z.number().int().positive(),
    method: DocumentMethodSchema,
    bbox: BboxSchema.optional(),
    confidence: z.number().min(0).max(1).optional(),
}).strict();

const DocumentResponseWireSchema = z.object({
    status: z.enum(['completed', 'partial', 'empty', 'unsupported']),
    document_id: z.string().min(1),
    file_name: z.string().min(1),
    mime_type: z.string().min(1),
    source_sha256: Sha256Schema,
    text: z.string(),
    text_sha256: Sha256Schema,
    method: DocumentMethodSchema,
    page_count: z.number().int().nonnegative(),
    pages: z.array(PageWireSchema),
    source_spans: z.array(SourceSpanWireSchema),
    warnings: z.array(z.string().min(1)),
    failed_pages: z.array(z.number().int().positive()),
    engine: z.string().min(1),
    bridge_version: z.string().min(1),
    extracted_at: IsoDateTimeSchema,
    ocr_engine: OcrEngineSchema,
    languages: z.array(z.string().min(1)).min(1),
}).strict().superRefine((response, ctx) => {
    if (response.pages.length !== response.page_count) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['pages'],
            message: 'Page metadata must contain exactly page_count entries',
        });
    }
    response.pages.forEach((page, index) => {
        if (page.page_number !== index + 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['pages', index, 'page_number'],
                message: 'Pages must use consecutive one-based page numbers',
            });
        }
        if (page.end < page.start || page.end > response.text.length) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['pages', index, 'end'],
                message: 'Page offsets must fit inside derived text',
            });
        }
        if (page.character_count !== page.end - page.start) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['pages', index, 'character_count'],
                message: 'Page character_count must match its text interval',
            });
        }
    });
    response.source_spans.forEach((span, index) => {
        if (
            span.end <= span.start
            || span.end > response.text.length
            || span.page_number > response.page_count
        ) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['source_spans', index],
                message: 'Source span must fit the derived text and page range',
            });
        }
        if (!response.text.slice(span.start, span.end).trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['source_spans', index],
                message: 'Source span must reference non-empty derived text',
            });
        }
    });
    if (
        ['completed', 'partial'].includes(response.status)
        && !response.text.trim()
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['text'],
            message: 'Completed or partial extraction requires derived text',
        });
    }
    if (
        ['empty', 'unsupported'].includes(response.status)
        && response.source_spans.length > 0
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['source_spans'],
            message: 'Empty or unsupported extraction cannot contain source spans',
        });
    }
});

const HealthWireSchema = z.object({
    status: z.string().min(1),
    service: z.string().min(1).optional(),
    engine: z.string().min(1).optional(),
    bridge_version: z.string().min(1).optional(),
    features: z.array(z.string().min(1)).default([]),
    available_ocr_engines: z.array(z.string().min(1)).default([]),
    ocr_available: z.boolean().default(false),
    message: z.string().min(1).optional(),
    advisory: z.boolean().optional(),
}).strict();

export const parseOpenMedDocumentResponse = ({
    input,
    expectedDocumentId,
    expectedFileName,
}: {
    input: unknown;
    expectedDocumentId: string;
    expectedFileName: string;
}): OpenMedDocumentExtractionResponse => {
    const response = DocumentResponseWireSchema.parse(input);
    if (response.document_id !== expectedDocumentId) {
        throw new Error('Document extraction response used a different document ID.');
    }
    if (response.file_name !== expectedFileName) {
        throw new Error('Document extraction response used a different filename.');
    }
    return {
        status: response.status,
        documentId: response.document_id,
        fileName: response.file_name,
        mimeType: response.mime_type,
        sourceSha256: response.source_sha256,
        text: response.text,
        textSha256: response.text_sha256,
        method: response.method,
        pageCount: response.page_count,
        pages: response.pages.map(page => ({
            pageNumber: page.page_number,
            start: page.start,
            end: page.end,
            method: page.method,
            wordCount: page.word_count,
            characterCount: page.character_count,
            ...(page.engine ? { engine: page.engine } : {}),
            ...(page.average_confidence !== undefined
                ? { averageConfidence: page.average_confidence }
                : {}),
            ...(page.minimum_confidence !== undefined
                ? { minimumConfidence: page.minimum_confidence }
                : {}),
        })),
        sourceSpans: response.source_spans.map(span => ({
            start: span.start,
            end: span.end,
            pageNumber: span.page_number,
            method: span.method,
            ...(span.bbox
                ? {
                    bbox: [
                        span.bbox[0],
                        span.bbox[1],
                        span.bbox[2],
                        span.bbox[3],
                    ] as [number, number, number, number],
                }
                : {}),
            ...(span.confidence !== undefined
                ? { confidence: span.confidence }
                : {}),
        })),
        warnings: response.warnings,
        failedPages: response.failed_pages,
        engine: response.engine,
        bridgeVersion: response.bridge_version,
        extractedAt: response.extracted_at,
        ocrEngine: response.ocr_engine,
        languages: response.languages,
    };
};

export const parseOpenMedDocumentHealth = (
    input: unknown,
    endpoint: string,
): OpenMedDocumentHealth => {
    const health = HealthWireSchema.parse(input);
    const available = health.status.trim().toLowerCase() === 'ready';
    return {
        available,
        endpoint,
        status: available ? 'available' : 'unavailable',
        message: available
            ? health.ocr_available
                ? 'OpenMed document extraction and at least one OCR engine are available.'
                : 'Embedded PDF text extraction is available, but no OCR engine was detected.'
            : health.message || `Document bridge reported status “${health.status}”.`,
        ...(health.service ? { service: health.service } : {}),
        ...(health.engine ? { engine: health.engine } : {}),
        ...(health.bridge_version
            ? { bridgeVersion: health.bridge_version }
            : {}),
        features: health.features,
        availableOcrEngines: health.available_ocr_engines,
        ocrAvailable: health.ocr_available,
    };
};
