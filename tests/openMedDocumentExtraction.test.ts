import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    extractOpenMedCandidatesFromUpload,
    getOpenMedDocumentEvidence,
    mapOpenMedEntitiesToCandidates,
    useDocumentExtractionStore,
} from '../features/openmed';
import { useClinicalRecordStore } from '../features/clinical-record';
import type { UploadedFile } from '../types';

const pdfUpload = (): UploadedFile => ({
    file: {
        name: 'report.pdf',
        type: 'application/pdf',
        size: 20,
    } as File,
    type: 'application/pdf',
    base64: Buffer.from('%PDF-synthetic', 'utf8').toString('base64'),
    storageId: 'storage-pdf',
});

const settings = {
    baseUrl: 'http://127.0.0.1:8080',
    timeoutMs: 100,
    confidenceThreshold: 0.6,
    diseaseModel: 'disease_detection_superclinical',
    medicationModel: 'pharma_detection_superclinical',
    keepAlive: '10m',
    documentExtractionEnabled: true,
    ocrMode: 'auto' as const,
    ocrEngine: 'auto' as const,
    ocrLanguages: ['en'],
    ocrResolution: 200,
};

const documentResponse = {
    status: 'completed',
    document_id: 'document-storage-pdf',
    file_name: 'report.pdf',
    mime_type: 'application/pdf',
    source_sha256: 'a'.repeat(64),
    text: 'No evidence of asthma.\n\nTake albuterol 2 puffs twice daily.',
    text_sha256: 'b'.repeat(64),
    method: 'hybrid',
    page_count: 2,
    pages: [
        {
            page_number: 1,
            start: 0,
            end: 22,
            method: 'embedded-pdf',
            word_count: 4,
            character_count: 22,
            engine: 'pdfplumber',
        },
        {
            page_number: 2,
            start: 24,
            end: 59,
            method: 'ocr',
            word_count: 6,
            character_count: 35,
            engine: 'tesseract',
            average_confidence: 0.92,
            minimum_confidence: 0.88,
        },
    ],
    source_spans: [
        {
            start: 15,
            end: 21,
            page_number: 1,
            method: 'embedded-pdf',
            bbox: [10, 20, 40, 30],
        },
        {
            start: 29,
            end: 38,
            page_number: 2,
            method: 'ocr',
            bbox: [15, 25, 55, 36],
            confidence: 0.92,
        },
    ],
    warnings: [],
    failed_pages: [],
    engine: 'OpenMed multimodal document extraction',
    bridge_version: '1',
    extracted_at: '2026-07-31T12:00:00Z',
    ocr_engine: 'auto',
    languages: ['en'],
};

const contextResponse = {
    text: documentResponse.text,
    engine: 'OpenMed clinical ConText',
    engine_version: '2.0.0',
    bridge_version: '1',
    language: 'en',
    evaluated_at: '2026-07-31T12:00:01Z',
    results: [
        {
            id: 'condition:15:21:0',
            kind: 'condition',
            text: 'asthma',
            start: 15,
            end: 21,
            assertion: {
                polarity: 'negated',
                certainty: 'certain',
                temporality: 'recent',
                experiencer: 'patient',
            },
            cues: [{
                text: 'No evidence of',
                category: 'negation',
                start: 0,
                end: 14,
                direction: 'forward',
            }],
            section: { label: 'unsectioned', start: 0, end: 59 },
            experiencer_evidence: { source: 'default' },
        },
        {
            id: 'medication:29:38:1',
            kind: 'medication',
            text: 'albuterol',
            start: 29,
            end: 38,
            assertion: {
                polarity: 'affirmed',
                certainty: 'certain',
                temporality: 'recent',
                experiencer: 'patient',
            },
            cues: [],
            section: { label: 'unsectioned', start: 0, end: 59 },
            experiencer_evidence: { source: 'default' },
            medication_sig: {
                raw: 'Take albuterol 2 puffs twice daily.',
                dose: 2,
                unit: 'puffs',
                frequency_per_day: 2,
                as_needed: false,
                missing: ['route'],
            },
        },
    ],
};

describe('OpenMed page-aware document extraction', () => {
    beforeEach(() => {
        useClinicalRecordStore.setState({ records: {} });
        useDocumentExtractionStore.setState({ records: {} });
    });

    it('routes a PDF through local extraction, NER, context, and page evidence', async () => {
        const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
            if (url.endsWith('/medibrief/documents/extract')) {
                return new Response(JSON.stringify(documentResponse), {
                    status: 200,
                });
            }
            if (url.endsWith('/medibrief/context')) {
                return new Response(JSON.stringify(contextResponse), {
                    status: 200,
                });
            }
            const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
            const disease = String(body.model_name).includes('disease');
            return new Response(JSON.stringify({
                text: documentResponse.text,
                model_name: body.model_name,
                version: '2.0.0',
                entities: disease
                    ? [{
                        text: 'asthma',
                        label: 'DISEASE',
                        confidence: 0.98,
                        start: 15,
                        end: 21,
                    }]
                    : [{
                        text: 'albuterol',
                        label: 'DRUG',
                        confidence: 0.95,
                        start: 29,
                        end: 38,
                    }],
            }), { status: 200 });
        });
        vi.stubGlobal('fetch', fetchMock);

        const result = await extractOpenMedCandidatesFromUpload({
            file: pdfUpload(),
            documentId: 'document-storage-pdf',
            settings,
        });

        expect(result.status).toBe('success');
        expect(result.documentExtraction).toMatchObject({
            method: 'hybrid',
            pageCount: 2,
            sourceSha256: 'a'.repeat(64),
        });
        expect(result.entities).toHaveLength(2);
        expect(result.entities[0].documentEvidence).toMatchObject({
            pageNumber: 1,
            pageNumbers: [1],
            method: 'embedded-pdf',
            bbox: [10, 20, 40, 30],
        });
        expect(result.entities[1].documentEvidence).toMatchObject({
            pageNumber: 2,
            pageNumbers: [2],
            method: 'ocr',
            averageOcrConfidence: 0.92,
        });

        const candidates = mapOpenMedEntitiesToCandidates({
            patientId: 'patient-1',
            documentId: 'document-storage-pdf',
            fileName: 'report.pdf',
            entities: result.entities,
            now: '2026-07-31T12:00:02Z',
        });
        expect(candidates[0].provenance.source.document).toMatchObject({
            pageNumber: 1,
            startOffset: 15,
            endOffset: 21,
            excerpt: 'asthma',
        });
        expect(candidates[0].assertion?.polarity).toBe('negated');
        expect(candidates[1].provenance.source.document?.pageNumber).toBe(2);
        expect(candidates[1].tags).toEqual(expect.arrayContaining([
            'openmed-document-text',
            'openmed-ocr',
            'openmed-context',
        ]));
        expect(getOpenMedDocumentEvidence(candidates[1])).toMatchObject({
            textSha256: 'b'.repeat(64),
            pageNumber: 2,
            method: 'ocr',
        });

        const actions = useClinicalRecordStore.getState().actions;
        actions.initializePatientRecord({
            patientId: 'patient-1',
            displayName: 'Synthetic Patient',
            now: '2026-07-31T12:00:00Z',
        });
        const first = candidates.map(candidate => actions.addResource(candidate));
        const retry = candidates.map(candidate => actions.addResource({
            ...candidate,
            id: `${candidate.id}-retry`,
        }));
        expect(first.every(resultItem => resultItem.status === 'created')).toBe(true);
        expect(retry.every(resultItem => resultItem.status === 'duplicate')).toBe(true);
        expect(actions.getTimeline('patient-1')).toEqual([]);
        expect(fetchMock).toHaveBeenCalledTimes(4);
    });

    it('does not send a PDF to NER when local document extraction is disabled', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const result = await extractOpenMedCandidatesFromUpload({
            file: pdfUpload(),
            documentId: 'document-storage-pdf',
            settings: {
                ...settings,
                documentExtractionEnabled: false,
            },
        });

        expect(result.status).toBe('unsupported');
        expect(result.entities).toEqual([]);
        expect(result.warnings.join(' ')).toContain('disabled');
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
