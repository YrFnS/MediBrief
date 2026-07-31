import { describe, expect, it, vi } from 'vitest';
import {
    analyzeOpenMedEntityContext,
    checkOpenMedContextHealth,
} from '../features/openmed';
import type { OpenMedCandidateEntity } from '../features/openmed';

const config = {
    baseUrl: 'http://127.0.0.1:8080',
    timeoutMs: 100,
};

const text = 'No evidence of pneumonia. Metformin 500 mg PO BID.';
const entities: OpenMedCandidateEntity[] = [
    {
        text: 'pneumonia',
        label: 'DISEASE',
        confidence: 0.97,
        start: 15,
        end: 24,
        kind: 'condition',
        modelName: 'disease_detection_superclinical',
    },
    {
        text: 'Metformin',
        label: 'DRUG',
        confidence: 0.95,
        start: 26,
        end: 35,
        kind: 'medication',
        modelName: 'pharma_detection_superclinical',
    },
];

const contextPayload = () => ({
    text,
    engine: 'OpenMed clinical ConText',
    engine_version: '2.0.0',
    bridge_version: '1',
    language: 'en',
    evaluated_at: '2026-07-31T12:00:00.000Z',
    results: [
        {
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
            experiencer_evidence: { source: 'default' },
        },
        {
            id: 'medication:26:35:1',
            kind: 'medication',
            text: 'Metformin',
            start: 26,
            end: 35,
            assertion: {
                polarity: 'affirmed',
                certainty: 'certain',
                temporality: 'recent',
                experiencer: 'patient',
            },
            cues: [],
            section: {
                label: 'unsectioned',
                start: 0,
                end: text.length,
            },
            experiencer_evidence: { source: 'default' },
            medication_sig: {
                raw: 'Metformin 500 mg PO BID',
                window_start: 26,
                window_end: 49,
                dose: 500,
                unit: 'mg',
                form: null,
                route: 'oral',
                frequency_per_day: 2,
                frequency_period: 0.5,
                frequency_period_unit: 'day',
                as_needed: false,
                condition: null,
                duration_days: null,
                missing: [],
            },
        },
    ],
});

describe('OpenMed context bridge client', () => {
    it('validates health and reports features without claiming clinical readiness', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
            JSON.stringify({
                status: 'ready',
                service: 'medibrief-openmed-context-bridge',
                engine: 'OpenMed clinical ConText',
                openmed_version: '2.0.0',
                bridge_version: '1',
                features: ['negation', 'temporality', 'medication-sig'],
                advisory: true,
            }),
            { status: 200 },
        )));

        const health = await checkOpenMedContextHealth({ config });
        expect(health).toMatchObject({
            available: true,
            status: 'available',
            openMedVersion: '2.0.0',
            bridgeVersion: '1',
            features: ['negation', 'temporality', 'medication-sig'],
        });
    });

    it('preserves exact spans, scoped cues, assertion axes, and medication sigs', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(
            JSON.stringify(contextPayload()),
            { status: 200 },
        ));
        vi.stubGlobal('fetch', fetchMock);

        const result = await analyzeOpenMedEntityContext({
            config,
            text,
            entities,
        });

        expect(result.results).toHaveLength(2);
        expect(result.results[0]).toMatchObject({
            text: 'pneumonia',
            start: 15,
            end: 24,
            assertion: { polarity: 'negated' },
            cues: [{ text: 'No evidence of', start: 0, end: 14 }],
        });
        expect(result.results[1].medicationSig).toMatchObject({
            dose: 500,
            unit: 'mg',
            route: 'oral',
            frequencyPerDay: 2,
            asNeeded: false,
        });

        const request = fetchMock.mock.calls[0];
        expect(request[0]).toBe('http://127.0.0.1:8080/medibrief/context');
        const body = JSON.parse(String(request[1]?.body));
        expect(body.spans).toEqual([
            {
                id: 'condition:15:24:0',
                kind: 'condition',
                text: 'pneumonia',
                label: 'DISEASE',
                start: 15,
                end: 24,
            },
            {
                id: 'medication:26:35:1',
                kind: 'medication',
                text: 'Metformin',
                label: 'DRUG',
                start: 26,
                end: 35,
            },
        ]);
    });

    it('fails closed when the bridge changes a source span or cue offset', async () => {
        const payload = contextPayload();
        payload.results[0].text = 'asthma';
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
            JSON.stringify(payload),
            { status: 200 },
        )));

        await expect(analyzeOpenMedEntityContext({
            config,
            text,
            entities,
        })).rejects.toMatchObject({
            name: 'OpenMedClientError',
            code: 'invalid-response',
        });
    });

    it('reports a missing bridge separately from the NER service', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
            JSON.stringify({ detail: 'Not Found' }),
            { status: 404 },
        )));

        await expect(analyzeOpenMedEntityContext({
            config,
            text,
            entities,
        })).rejects.toMatchObject({
            name: 'OpenMedClientError',
            code: 'context-unavailable',
            status: 404,
        });
    });
});
