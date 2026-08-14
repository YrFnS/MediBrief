import { describe, expect, it } from 'vitest';
import {
    applyOpenRouterPrivacyRouting,
    classifyCloudRequestPayload,
    evaluateCloudPolicy,
} from '../features/governance/cloudPolicy';

describe('clinical cloud policy', () => {
    it('classifies grounded patient evidence as a patient-record task', () => {
        const classification = classifyCloudRequestPayload({
            model: 'example/model',
            messages: [
                {
                    role: 'user',
                    content: 'MEDIBRIEF_GROUNDED_PATIENT_ANSWER_V1\nLOCAL PATIENT EVIDENCE',
                },
            ],
        });

        expect(classification).toMatchObject({
            modelId: 'example/model',
            task: 'patient-record',
            containsPatientSpecificEvidence: true,
            containsDocumentOrImage: false,
        });
    });

    it('classifies file input as a document-or-image task', () => {
        const classification = classifyCloudRequestPayload({
            model: 'example/model',
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: 'Review this file' },
                        {
                            type: 'file',
                            file: {
                                filename: 'synthetic.txt',
                                file_data: 'data:text/plain;base64,c3ludGhldGlj',
                            },
                        },
                    ],
                },
            ],
        });

        expect(classification.task).toBe('document-or-image');
        expect(classification.containsDocumentOrImage).toBe(true);
    });

    it('requires explicit session consent for every cloud request', () => {
        const classification = classifyCloudRequestPayload({
            model: 'example/model',
            messages: [{ role: 'user', content: 'General educational question' }],
        });

        expect(evaluateCloudPolicy({
            classification,
            consentGranted: false,
        })?.reason).toBe('consent-required');
    });

    it('allows general assistance after consent but blocks unreviewed patient tasks', () => {
        const general = classifyCloudRequestPayload({
            model: 'example/model',
            messages: [{ role: 'user', content: 'General educational question' }],
        });
        const patient = classifyCloudRequestPayload({
            model: 'example/model',
            messages: [{
                role: 'user',
                content: 'MEDIBRIEF_GROUNDED_PATIENT_ANSWER_V1',
            }],
        });

        expect(evaluateCloudPolicy({
            classification: general,
            consentGranted: true,
        })).toBeNull();
        expect(evaluateCloudPolicy({
            classification: patient,
            consentGranted: true,
        })?.reason).toBe('model-not-reviewed');
    });

    it('forces privacy-restricted provider routing', () => {
        const guarded = applyOpenRouterPrivacyRouting({
            model: 'example/model',
            provider: {
                sort: 'latency',
                allow_fallbacks: true,
            },
        });

        expect(guarded).toEqual({
            model: 'example/model',
            provider: {
                sort: 'latency',
                allow_fallbacks: false,
                data_collection: 'deny',
                zdr: true,
                require_parameters: true,
            },
        });
    });
});
