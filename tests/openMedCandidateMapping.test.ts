import { describe, expect, it } from 'vitest';
import {
    getOpenMedContextEvidence,
    getOpenMedDocumentEvidence,
    mapOpenMedEntityToCandidate,
} from '../features/openmed';
import type { OpenMedCandidateEntity } from '../features/openmed';

const documentEvidence = {
    documentId: 'document-1',
    fileName: 'report.pdf',
    mimeType: 'application/pdf',
    sourceSha256: 'a'.repeat(64),
    textSha256: 'b'.repeat(64),
    method: 'ocr' as const,
    pageNumber: 2,
    pageNumbers: [2],
    bbox: [10, 20, 50, 34] as [number, number, number, number],
    averageOcrConfidence: 0.93,
    ocrEngine: 'tesseract' as const,
    languages: ['en'],
    engine: 'OpenMed multimodal document extraction',
    bridgeVersion: '1',
    extractedAt: '2026-07-31T12:00:00Z',
};

const negatedCondition: OpenMedCandidateEntity = {
    text: 'asthma',
    label: 'DISEASE',
    confidence: 0.98,
    start: 15,
    end: 21,
    kind: 'condition',
    modelName: 'disease_detection_superclinical',
    engineVersion: '2.0.0',
    documentEvidence,
    context: {
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
        section: {
            label: 'Assessment',
            canonical: 'assessment',
            start: 0,
            end: 40,
        },
        experiencerEvidence: { source: 'default' },
        engine: 'OpenMed clinical ConText',
        engineVersion: '2.0.0',
        bridgeVersion: '1',
        language: 'en',
        evaluatedAt: '2026-07-31T12:00:01Z',
    },
};

describe('OpenMed candidate mapping', () => {
    it('preserves NER provenance plus separate context and page-aware document evidence', () => {
        const candidate = mapOpenMedEntityToCandidate({
            patientId: 'patient-1',
            documentId: 'document-1',
            fileName: 'report.pdf',
            entity: negatedCondition,
            now: '2026-07-31T12:00:02Z',
        });

        expect(candidate).toMatchObject({
            resourceType: 'Condition',
            verificationStatus: 'candidate',
            assertion: {
                polarity: 'negated',
                certainty: 'unknown',
                temporality: 'unknown',
                experiencer: 'unknown',
            },
            provenance: {
                source: {
                    externalSystem: 'openmed:rest',
                    document: {
                        documentId: 'document-1',
                        fileName: 'report.pdf',
                        pageNumber: 2,
                        startOffset: 15,
                        endOffset: 21,
                        excerpt: 'asthma',
                    },
                },
                extraction: {
                    engine: 'OpenMed local REST NER',
                    model: 'disease_detection_superclinical',
                    engineVersion: '2.0.0',
                    confidence: 0.98,
                },
            },
        });
        expect(candidate.amendments).toHaveLength(2);
        expect(candidate.amendments.map(amendment => amendment.previousValues))
            .toEqual(expect.arrayContaining([
                expect.objectContaining({
                    openMedDocumentEvidence: expect.objectContaining({
                        pageNumber: 2,
                        method: 'ocr',
                        textSha256: 'b'.repeat(64),
                    }),
                }),
                expect.objectContaining({
                    openMedContextEvidence: expect.objectContaining({
                        engine: 'OpenMed clinical ConText',
                        assertion: expect.objectContaining({
                            polarity: 'negated',
                        }),
                    }),
                }),
            ]));
        expect(getOpenMedDocumentEvidence(candidate)).toMatchObject({
            pageNumber: 2,
            bbox: [10, 20, 50, 34],
            averageOcrConfidence: 0.93,
        });
        expect(getOpenMedContextEvidence(candidate)).toMatchObject({
            id: 'condition:15:21:0',
            cues: [expect.objectContaining({ category: 'negation' })],
        });
        expect(candidate.tags).toEqual(expect.arrayContaining([
            'needs-review',
            'openmed-extracted',
            'openmed-document-text',
            'openmed-ocr',
            'openmed-context',
        ]));
    });

    it('keeps default positive context unknown while retaining medication-sig evidence', () => {
        const medication: OpenMedCandidateEntity = {
            text: 'albuterol',
            label: 'DRUG',
            confidence: 0.95,
            start: 5,
            end: 14,
            kind: 'medication',
            modelName: 'pharma_detection_superclinical',
            documentEvidence: {
                ...documentEvidence,
                pageNumber: 1,
                pageNumbers: [1],
                method: 'embedded-pdf',
                bbox: undefined,
                averageOcrConfidence: undefined,
            },
            context: {
                id: 'medication:5:14:0',
                kind: 'medication',
                text: 'albuterol',
                start: 5,
                end: 14,
                assertion: {
                    polarity: 'affirmed',
                    certainty: 'certain',
                    temporality: 'recent',
                    experiencer: 'patient',
                },
                cues: [],
                experiencerEvidence: { source: 'default' },
                medicationSig: {
                    raw: 'Take albuterol 2 puffs twice daily.',
                    windowStart: 0,
                    windowEnd: 37,
                    dose: 2,
                    unit: 'puffs',
                    frequencyPerDay: 2,
                    asNeeded: false,
                    missing: ['route'],
                },
                engine: 'OpenMed clinical ConText',
                bridgeVersion: '1',
                language: 'en',
                evaluatedAt: '2026-07-31T12:00:01Z',
            },
        };

        const candidate = mapOpenMedEntityToCandidate({
            patientId: 'patient-1',
            documentId: 'document-1',
            fileName: 'report.pdf',
            entity: medication,
            now: '2026-07-31T12:00:02Z',
        });

        expect(candidate.resourceType).toBe('Medication');
        if (candidate.resourceType !== 'Medication') {
            throw new Error('Expected a medication candidate.');
        }
        expect(candidate.assertion).toEqual({
            polarity: 'unknown',
            certainty: 'unknown',
            temporality: 'unknown',
            experiencer: 'unknown',
        });
        expect(candidate.dosageInstructions).toEqual([
            expect.objectContaining({
                text: 'Take albuterol 2 puffs twice daily.',
                dose: {
                    original: {
                        value: 2,
                        unit: 'puffs',
                    },
                },
                frequency: '2 per day',
                asNeeded: false,
            }),
        ]);
        expect(candidate.amendments).toHaveLength(2);
        expect(candidate.tags).toEqual(expect.arrayContaining([
            'openmed-medication-sig',
            'openmed-embedded-pdf',
        ]));
    });
});
