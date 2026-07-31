import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UploadedFile } from '../types';
import {
    extractLocalTextFromUpload,
    extractOpenMedCandidatesFromUpload,
    getOpenMedContextEvidence,
    mapOpenMedEntitiesToCandidates,
} from '../features/openmed';
import type { OpenMedCandidateEntity } from '../features/openmed';
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

const openMedResponse = ({
    text,
    modelName,
}: {
    text: string;
    modelName: string;
}) => ({
    text,
    model_name: modelName,
    version: '2.0.0',
    entities: modelName.includes('disease')
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
        }],
});

const contextResponse = (text: string) => ({
    text,
    engine: 'OpenMed clinical ConText',
    engine_version: '2.0.0',
    bridge_version: '1',
    language: 'en',
    evaluated_at: '2026-07-31T12:00:01.000Z',
    results: [
        {
            id: 'condition:0:6:0',
            kind: 'condition',
            text: 'Asthma',
            start: 0,
            end: 6,
            assertion: {
                polarity: 'affirmed',
                certainty: 'certain',
                temporality: 'recent',
                experiencer: 'patient',
            },
            cues: [],
            section: { label: 'unsectioned', start: 0, end: text.length },
            experiencer_evidence: { source: 'default' },
        },
        {
            id: 'medication:20:29:1',
            kind: 'medication',
            text: 'albuterol',
            start: 20,
            end: 29,
            assertion: {
                polarity: 'affirmed',
                certainty: 'certain',
                temporality: 'recent',
                experiencer: 'patient',
            },
            cues: [],
            section: { label: 'unsectioned', start: 0, end: text.length },
            experiencer_evidence: { source: 'default' },
            medication_sig: {
                raw: 'Asthma treated with albuterol.',
                window_start: 0,
                window_end: text.length,
                as_needed: false,
                missing: ['dose', 'route', 'frequency'],
            },
        },
    ],
});

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

    it('does not pretend the direct text decoder has already converted PDF or image content', () => {
        const result = extractLocalTextFromUpload(upload({
            name: 'scan.pdf',
            type: 'application/pdf',
            text: '%PDF-binary-placeholder',
        }));

        expect(result.status).toBe('unsupported');
        expect(result.message).toContain('PDF and image OCR are not enabled');
    });

    it('rejects binary and oversized text before any OpenMed request', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const binaryUpload = upload({
            name: 'not-really-text.txt',
            type: 'text/plain',
            text: 'clinical\u0000binary',
        });
        expect(extractLocalTextFromUpload(binaryUpload).status).toBe('invalid');
        expect(extractLocalTextFromUpload(upload({
            name: 'large.txt',
            type: 'text/plain',
            text: '12345678901',
        }), { maxCharacters: 10 }).status).toBe('too-large');

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

    it('runs NER and context on the evaluated English route while retaining exact source provenance', async () => {
        const text = 'Asthma treated with albuterol.';
        const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
            const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
            if (url.endsWith('/medibrief/context')) {
                return new Response(JSON.stringify(contextResponse(text)), {
                    status: 200,
                });
            }
            return new Response(JSON.stringify(openMedResponse({
                text: String(body.text),
                modelName: String(body.model_name),
            })), { status: 200 });
        });
        vi.stubGlobal('fetch', fetchMock);

        const result = await extractOpenMedCandidatesFromUpload({
            file: upload({ name: 'visit.txt', type: 'text/plain', text }),
            settings: extractionSettings,
        });

        expect(result.status).toBe('success');
        expect(result.contextStatus).toBe('applied');
        expect(result.contextAppliedCount).toBe(2);
        expect(result.languageAssessment).toMatchObject({
            route: 'evaluated-english-defaults',
            allowDefaultClinicalNer: true,
            allowEnglishContext: true,
        });
        expect(result.entities.map(entity => entity.kind))
            .toEqual(['condition', 'medication']);
        expect(fetchMock).toHaveBeenCalledTimes(3);

        const candidates = mapOpenMedEntitiesToCandidates({
            patientId: 'patient-1',
            documentId: 'document-1',
            fileName: 'visit.txt',
            entities: result.entities,
            now: '2026-07-31T12:00:00.000Z',
        });
        const condition = candidates.find(candidate =>
            candidate.resourceType === 'Condition');
        expect(condition).toMatchObject({
            verificationStatus: 'candidate',
            clinicalStatus: 'unknown',
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
            tags: expect.arrayContaining([
                'openmed-extracted',
                'openmed-context',
            ]),
        });
        expect(condition && getOpenMedContextEvidence(condition)).toMatchObject({
            engine: 'OpenMed clinical ConText',
            bridgeVersion: '1',
            assertion: { temporality: 'recent' },
        });

        const actions = useClinicalRecordStore.getState().actions;
        actions.initializePatientRecord({
            patientId: 'patient-1',
            displayName: 'Test Patient',
            now: '2026-07-31T12:00:00.000Z',
        });
        expect(actions.addResource(candidates[0]).status).toBe('created');
        expect(actions.addResource({
            ...candidates[0],
            id: 'another-id',
        }).status).toBe('duplicate');
        expect(actions.getTimeline('patient-1')).toEqual([]);
    });

    it('copies a scoped negation cue while leaving unsupported positive axes unknown', () => {
        const text = 'No evidence of pneumonia.';
        const entity: OpenMedCandidateEntity = {
            kind: 'condition',
            text: 'pneumonia',
            label: 'DISEASE',
            confidence: 0.98,
            start: 15,
            end: 24,
            modelName: 'disease_detection_superclinical',
            context: {
                id: 'condition:15:24:0',
                kind: 'condition',
                text: 'pneumonia',
                start: 15,
                end: 24,
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
                section: {
                    label: 'unsectioned',
                    start: 0,
                    end: text.length,
                },
                experiencerEvidence: { source: 'default' },
                engine: 'OpenMed clinical ConText',
                engineVersion: '2.0.0',
                bridgeVersion: '1',
                language: 'en',
                evaluatedAt: '2026-07-31T12:00:01.000Z',
            },
        };

        const [candidate] = mapOpenMedEntitiesToCandidates({
            patientId: 'patient-1',
            documentId: 'document-1',
            fileName: 'visit.txt',
            entities: [entity],
            now: '2026-07-31T12:00:00.000Z',
        });

        expect(candidate.assertion).toEqual({
            polarity: 'negated',
            certainty: 'unknown',
            temporality: 'unknown',
            experiencer: 'unknown',
        });
        expect(candidate.resourceType).toBe('Condition');
        if (candidate.resourceType === 'Condition') {
            expect(candidate.clinicalStatus).toBe('unknown');
        }
    });

    it('retains candidate NER with unknown context when the optional bridge is unavailable', async () => {
        const text = 'Asthma treated with albuterol.';
        vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
            const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
            if (url.endsWith('/medibrief/context')) {
                return new Response(JSON.stringify({ detail: 'Not Found' }), {
                    status: 404,
                });
            }
            return new Response(JSON.stringify(openMedResponse({
                text: String(body.text),
                modelName: String(body.model_name),
            })), { status: 200 });
        }));

        const result = await extractOpenMedCandidatesFromUpload({
            file: upload({ name: 'visit.txt', type: 'text/plain', text }),
            settings: extractionSettings,
        });

        expect(result.status).toBe('success');
        expect(result.contextStatus).toBe('unavailable');
        expect(result.entities.every(entity => entity.context === undefined)).toBe(true);
        expect(result.warnings.join(' ')).toContain('unknown assertion context');
    });

    it('preserves Arabic text but blocks the unevaluated default clinical models', async () => {
        const text = 'المريض لديه ربو.';
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const result = await extractOpenMedCandidatesFromUpload({
            file: upload({ name: 'arabic.txt', type: 'text/plain', text }),
            settings: extractionSettings,
        });

        expect(result.status).toBe('unsupported');
        expect(result.text).toBe(text);
        expect(result.contextStatus).toBe('skipped-language');
        expect(result.entities).toEqual([]);
        expect(result.languageAssessment).toMatchObject({
            route: 'unsupported-arabic-clinical-ner',
            inferredLanguage: 'ar',
            allowDefaultClinicalNer: false,
            allowEnglishContext: false,
            fallbackEligible: true,
        });
        expect(result.warnings.join(' ')).toContain('clinical NER was skipped');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('blocks mixed-script text before contacting the default models', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        const result = await extractOpenMedCandidatesFromUpload({
            file: upload({
                name: 'mixed.txt',
                type: 'text/plain',
                text: 'Diagnosis التشخيص: asthma ربو',
            }),
            settings: extractionSettings,
        });

        expect(result.status).toBe('unsupported');
        expect(result.languageAssessment?.route).toBe('mixed-script-review');
        expect(result.entities).toEqual([]);
        expect(fetchMock).not.toHaveBeenCalled();
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
        expect(result.languageAssessment?.route)
            .toBe('evaluated-english-defaults');
    });
});
