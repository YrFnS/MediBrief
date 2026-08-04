import { beforeEach, describe, expect, it } from 'vitest';
import {
    documentExtractionKey,
    useDocumentExtractionStore,
} from '../features/openmed';
import type { OpenMedDocumentExtractionResponse } from '../features/openmed';

const response: OpenMedDocumentExtractionResponse = {
    status: 'partial',
    documentId: 'document-1',
    fileName: 'report.pdf',
    mimeType: 'application/pdf',
    sourceSha256: 'a'.repeat(64),
    text: 'Asthma',
    textSha256: 'b'.repeat(64),
    method: 'hybrid',
    pageCount: 2,
    pages: [
        {
            pageNumber: 1,
            start: 0,
            end: 6,
            method: 'embedded-pdf',
            wordCount: 1,
            characterCount: 6,
        },
        {
            pageNumber: 2,
            start: 8,
            end: 8,
            method: 'none',
            wordCount: 0,
            characterCount: 0,
        },
    ],
    sourceSpans: [{
        start: 0,
        end: 6,
        pageNumber: 1,
        method: 'embedded-pdf',
    }],
    warnings: ['Page 2 OCR failed.'],
    failedPages: [2],
    engine: 'OpenMed multimodal document extraction',
    bridgeVersion: '1',
    extractedAt: '2026-07-31T12:00:00Z',
    ocrEngine: 'auto',
    languages: ['en'],
};

describe('document extraction status store', () => {
    beforeEach(() => {
        useDocumentExtractionStore.setState({ records: {} });
    });

    it('tracks queued, running, partial, and idempotent retry evidence', () => {
        const actions = useDocumentExtractionStore.getState().actions;
        actions.begin({
            patientId: 'patient-1',
            documentId: 'document-1',
            storageId: 'storage-1',
            fileName: 'report.pdf',
            mimeType: 'application/pdf',
            startedAt: '2026-07-31T12:00:00Z',
        });
        actions.markRunning('patient-1', 'document-1');
        actions.complete({
            patientId: 'patient-1',
            documentId: 'document-1',
            result: response,
            createdCandidates: 1,
            duplicateCandidates: 2,
            completedAt: '2026-07-31T12:00:01Z',
        });

        const key = documentExtractionKey('patient-1', 'document-1');
        expect(useDocumentExtractionStore.getState().records[key]).toMatchObject({
            status: 'partial',
            attempts: 1,
            method: 'hybrid',
            pageCount: 2,
            pagesWithText: 1,
            characterCount: 6,
            warnings: ['Page 2 OCR failed.'],
            failedPages: [2],
            createdCandidates: 1,
            duplicateCandidates: 2,
        });

        actions.begin({
            patientId: 'patient-1',
            documentId: 'document-1',
            storageId: 'storage-1',
            fileName: 'report.pdf',
            mimeType: 'application/pdf',
            startedAt: '2026-07-31T12:01:00Z',
        });
        expect(actions.get('patient-1', 'document-1')).toMatchObject({
            status: 'queued',
            attempts: 2,
            createdCandidates: 0,
            duplicateCandidates: 0,
        });
    });

    it('keeps failures, cancellation, and patient removal explicit', () => {
        const actions = useDocumentExtractionStore.getState().actions;
        actions.begin({
            patientId: 'patient-1',
            documentId: 'document-1',
            fileName: 'scan.jpg',
            mimeType: 'image/jpeg',
        });
        actions.fail({
            patientId: 'patient-1',
            documentId: 'document-1',
            message: 'OCR engine unavailable.',
            warnings: ['No OCR engine was detected.'],
        });
        expect(actions.get('patient-1', 'document-1')).toMatchObject({
            status: 'failed',
            message: 'OCR engine unavailable.',
        });

        actions.begin({
            patientId: 'patient-2',
            documentId: 'document-2',
            fileName: 'scan.pdf',
            mimeType: 'application/pdf',
        });
        actions.cancel('patient-2', 'document-2');
        expect(actions.get('patient-2', 'document-2')?.status).toBe('cancelled');

        actions.removePatient('patient-1');
        expect(actions.get('patient-1', 'document-1')).toBeUndefined();
        expect(actions.get('patient-2', 'document-2')).toBeDefined();
    });
});
