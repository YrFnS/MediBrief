import { describe, expect, it, vi } from 'vitest';
import {
    checkOpenMedDocumentHealth,
    extractOpenMedDocument,
    OpenMedClientError,
} from '../features/openmed';

const config = {
    baseUrl: 'http://127.0.0.1:8080/',
    timeoutMs: 100,
};

const validDocumentResponse = () => ({
    status: 'completed',
    document_id: 'document-1',
    file_name: 'report.pdf',
    mime_type: 'application/pdf',
    source_sha256: 'a'.repeat(64),
    text: 'Asthma\n\nalbuterol',
    text_sha256: 'b'.repeat(64),
    method: 'hybrid',
    page_count: 2,
    pages: [
        {
            page_number: 1,
            start: 0,
            end: 6,
            method: 'embedded-pdf',
            word_count: 1,
            character_count: 6,
            engine: 'pdfplumber',
        },
        {
            page_number: 2,
            start: 8,
            end: 17,
            method: 'ocr',
            word_count: 1,
            character_count: 9,
            engine: 'tesseract',
            average_confidence: 0.94,
            minimum_confidence: 0.94,
        },
    ],
    source_spans: [
        {
            start: 0,
            end: 6,
            page_number: 1,
            method: 'embedded-pdf',
            bbox: [1, 2, 20, 12],
        },
        {
            start: 8,
            end: 17,
            page_number: 2,
            method: 'ocr',
            bbox: [3, 4, 30, 14],
            confidence: 0.94,
        },
    ],
    warnings: [],
    failed_pages: [],
    engine: 'OpenMed multimodal document extraction',
    bridge_version: '1',
    extracted_at: '2026-07-31T12:00:00Z',
    ocr_engine: 'auto',
    languages: ['en'],
});

describe('OpenMed document bridge client', () => {
    it('reports embedded-text and OCR readiness without claiming document quality', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            status: 'ready',
            service: 'medibrief-openmed-document-bridge',
            engine: 'OpenMed multimodal document extraction',
            bridge_version: '1',
            features: ['embedded-pdf-text', 'image-ocr'],
            available_ocr_engines: ['tesseract'],
            ocr_available: true,
            advisory: true,
        }), { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);

        const health = await checkOpenMedDocumentHealth({ config });
        expect(health).toMatchObject({
            available: true,
            status: 'available',
            endpoint: 'http://127.0.0.1:8080',
            bridgeVersion: '1',
            availableOcrEngines: ['tesseract'],
            ocrAvailable: true,
        });
        expect(fetchMock).toHaveBeenCalledWith(
            'http://127.0.0.1:8080/medibrief/documents/health',
            expect.objectContaining({ method: 'GET' }),
        );
    });

    it('sends the exact local document configuration and maps page provenance', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(
            JSON.stringify(validDocumentResponse()),
            { status: 200 },
        ));
        vi.stubGlobal('fetch', fetchMock);

        const result = await extractOpenMedDocument({
            config,
            options: {
                documentId: 'document-1',
                fileName: 'report.pdf',
                mimeType: 'application/pdf',
                base64: 'UERG',
                ocrMode: 'auto',
                ocrEngine: 'tesseract',
                languages: ['en', 'ar'],
                resolution: 220,
            },
        });

        expect(result).toMatchObject({
            status: 'completed',
            method: 'hybrid',
            pageCount: 2,
            pages: [
                { pageNumber: 1, method: 'embedded-pdf' },
                {
                    pageNumber: 2,
                    method: 'ocr',
                    averageConfidence: 0.94,
                },
            ],
            sourceSpans: [
                { pageNumber: 1, bbox: [1, 2, 20, 12] },
                { pageNumber: 2, confidence: 0.94 },
            ],
        });
        const request = fetchMock.mock.calls[0];
        expect(request[0]).toBe(
            'http://127.0.0.1:8080/medibrief/documents/extract',
        );
        expect(JSON.parse(String(request[1]?.body))).toEqual({
            document_id: 'document-1',
            file_name: 'report.pdf',
            mime_type: 'application/pdf',
            document_base64: 'UERG',
            ocr_mode: 'auto',
            ocr_engine: 'tesseract',
            languages: ['en', 'ar'],
            resolution: 220,
        });
    });

    it('fails closed on a malformed page or source interval', async () => {
        const malformed = validDocumentResponse();
        malformed.source_spans[1].end = 999;
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
            JSON.stringify(malformed),
            { status: 200 },
        )));

        await expect(extractOpenMedDocument({
            config,
            options: {
                documentId: 'document-1',
                fileName: 'report.pdf',
                mimeType: 'application/pdf',
                base64: 'UERG',
                ocrMode: 'auto',
                ocrEngine: 'auto',
                languages: ['en'],
                resolution: 200,
            },
        })).rejects.toSatisfy(error =>
            error instanceof OpenMedClientError
            && error.code === 'invalid-response');
    });

    it('distinguishes caller cancellation from local bridge unavailability', async () => {
        const neverCompletes = vi.fn((_: unknown, init?: RequestInit) =>
            new Promise((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => {
                    reject(new DOMException('Aborted', 'AbortError'));
                }, { once: true });
            }));
        vi.stubGlobal('fetch', neverCompletes);
        const controller = new AbortController();
        const pending = extractOpenMedDocument({
            config: { ...config, timeoutMs: 1_000 },
            options: {
                documentId: 'document-1',
                fileName: 'report.pdf',
                mimeType: 'application/pdf',
                base64: 'UERG',
                ocrMode: 'auto',
                ocrEngine: 'auto',
                languages: ['en'],
                resolution: 200,
                signal: controller.signal,
            },
        });
        controller.abort();
        await expect(pending).rejects.toSatisfy(error =>
            error instanceof OpenMedClientError && error.code === 'aborted');
    });
});
