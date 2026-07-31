import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UploadedFile } from '../types';
import {
    extractLocalTextFromUpload,
    extractOpenMedCandidatesFromUpload,
    mapOpenMedEntitiesToCandidates,
} from '../features/openmed';
import { useClinicalRecordStore } from '../features/clinical-record';

const upload = ({
    name,
    type,
    text,
}: {
    name: string;
    type: string;
    text: string;
}): UploadedFile => ({
    file: {
        name,
        type,
        size: Buffer.byteLength(text),
    } as File,
    type,
    base64: Buffer.from(text, 'utf8').toString('base64'),
    storageId: 'storage-1',
});

const extractionSettings = {
    baseUrl: 'http://127.0.0.1:8080',
    timeoutMs: 100,
    confidenceThreshold: 0.6,
    diseaseModel: 'disease_detection_superclinical',
    medicationModel: 'pharma_detection_superclinical',
    keepAlive: '10m',
};

describe('OpenMed local text intake', () => {
    it('decodes supported text locally while preserving exact character positions', () => {
        const result = extractLocalTextFromUpload(upload({
            name: 'note.json',
            type: '',
            text: '\uFEFF{"note":"Asthma treated with albuterol."}\r\n',
        }));

        expect(result.status).toBe('ready');
        expect(result.text).toBe('{"note":"Asthma treated with albuterol."}\n');
    });

    it('does not pretend PDF or image files have already been converted to text', () => {
        const result = extractLocalTextFromUpload(upload({
            name: 'scan.pdf',
            type: 'application/pdf',
            text: '%PDF-binary-placeholder',
        }));

        expect(result).toMatchObject({
            status: 'unsupported',
            message: expect.stringContaining('PDF and image OCR are not enabled'),
        });
    });

    it('rejects binary and oversized text before any OpenMed request', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const binaryUpload = upload({
            name: 'not-really-text.txt',
            type: 'text/plain',
            text: 'clinical\u0000binary',
        });
        const binary = extractLocalTextFromUpload(binaryUpload);
        expect(binary.status).toBe('invalid');

        const oversized = extractLocalTextFromUpload(upload({
            name: 'large.txt',
            type: 'text/plain',
            text: '12345678901',
        }), { maxCharacters: 10 });
        expect(oversized.status).toBe('too-large');

        const extraction = await extractOpenMedCandidatesFromUpload({
            file: binaryUpload,
            settings: extractionSettings,
        });
        expect(extraction.status).toBe('invalid');
        expect(extraction.entities).toEqual([]);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('OpenMed extraction orchestration and clinical mapping', () => {
    beforeEach(() => {
        useClinicalRecordStore.setState({ records: {} });
    });

    it('runs specialized disease and medication models and maps exact source spans', async () => {
        const text = 'Asthma treated with albuterol.';
        const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
            const body = JSON.parse(String(init?.body)) as {
                model_name: string;
                text: string;
            };
            const entities = body.model_name.includes('disease')
                ? [{
                    text: 'Asthma',
                    label: 'DISEASE',
                    confidence: 0.97,
                    start: 0,
                    end: 6,
                }]
                : [{
                    text: 'albuterol',
                    label: 'DRUG',
                    confidence: 0.94,
                    start: 20,
                    end: 29,
                }];
            return new Response(JSON.stringify({
                text: body.text,
                model_name: body.model_name,
                version: '2.0.0',
                entities,
            }), { status: 200 });
        });
        vi.stubGlobal('fetch', fetchMock);

        const result = await extractOpenMedCandidatesFromUpload({
            file: upload({ name: 'visit.txt', type: 'text/plain', text }),
            settings: extractionSettings,
        });

        expect(result.status).toBe('success');
        expect(result.entities).toHaveLength(2);
        expect(result.entities.map(entity => entity.kind))
            .toEqual(['condition', 'medication']);
        expect(fetchMock).toHaveBeenCalledTimes(2);

        const candidates = mapOpenMedEntitiesToCandidates({
            patientId: 'patient-1',
            documentId: 'document-1',
            fileName: 'visit.txt',
            entities: result.entities,
            now: '2026-07-31T12:00:00.000Z',
        });
        expect(candidates).toHaveLength(2);

        const condition = candidates.find(candidate =>
            candidate.resourceType === 'Condition');
        expect(condition).toMatchObject({
            verificationStatus: 'candidate',
            effective: {
                value: null,
                precision: 'unknown',
            },
            assertion: {
                polarity: 'unknown',
                certainty: 'unknown',
                temporality: 'unknown',
                experiencer: 'unknown',
            },
            provenance: {
                source: {
                    externalSystem: 'openmed:rest',
                    document: {
                        documentId: 'document-1',
                        fileName: 'visit.txt',
                        startOffset: 0,
                        endOffset: 6,
                        excerpt: 'Asthma',
                    },
                },
                extraction: {
                    engine: 'OpenMed local REST NER',
                    model: 'disease_detection_superclinical',
                    engineVersion: '2.0.0',
                    confidence: 0.97,
                },
            },
        });

        const actions = useClinicalRecordStore.getState().actions;
        actions.initializePatientRecord({
            patientId: 'patient-1',
            displayName: 'Test Patient',
            now: '2026-07-31T12:00:00.000Z',
        });
        const firstWrite = actions.addResource(candidates[0]);
        const duplicateWrite = actions.addResource({
            ...candidates[0],
            id: 'another-id',
        });
        expect(firstWrite.status).toBe('created');
        expect(duplicateWrite.status).toBe('duplicate');
        expect(actions.getTimeline('patient-1')).toEqual([]);
    });

    it('returns unavailable without creating invented output when every local model fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(
            new TypeError('Connection refused'),
        ));

        const result = await extractOpenMedCandidatesFromUpload({
            file: upload({
                name: 'visit.txt',
                type: 'text/plain',
                text: 'Patient has asthma.',
            }),
            settings: {
                ...extractionSettings,
                timeoutMs: 20,
            },
        });

        expect(result.status).toBe('unavailable');
        expect(result.entities).toEqual([]);
        expect(result.warnings).toHaveLength(2);
    });
});
