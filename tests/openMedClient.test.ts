import { describe, expect, it, vi } from 'vitest';
import {
    analyzeOpenMedText,
    checkOpenMedHealth,
    normalizeOpenMedBaseUrl,
} from '../features/openmed';

const config = {
    baseUrl: 'http://127.0.0.1:8080/',
    timeoutMs: 100,
};

describe('OpenMed REST client', () => {
    it('normalizes a loopback endpoint and reports a valid health response', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(
            JSON.stringify({
                status: 'ok',
                service: 'openmed-rest',
                version: '2.0.0',
                profile: 'full',
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            },
        ));
        vi.stubGlobal('fetch', fetchMock);

        expect(normalizeOpenMedBaseUrl(' http://127.0.0.1:8080/// '))
            .toBe('http://127.0.0.1:8080');

        const health = await checkOpenMedHealth({ config });
        expect(health).toMatchObject({
            available: true,
            endpoint: 'http://127.0.0.1:8080',
            status: 'available',
            service: 'openmed-rest',
            version: '2.0.0',
            profile: 'full',
        });
        expect(fetchMock).toHaveBeenCalledWith(
            'http://127.0.0.1:8080/health',
            expect.objectContaining({ method: 'GET' }),
        );
    });

    it('sends the documented analyze request and rejects malformed spans', async () => {
        const text = 'Asthma treated with albuterol.';
        const fetchMock = vi.fn().mockResolvedValue(new Response(
            JSON.stringify({
                text,
                model_name: 'disease_detection_superclinical',
                version: '2.0.0',
                entities: [
                    {
                        text: 'Asthma',
                        label: 'B-DISEASE',
                        confidence: 0.96,
                        start: 0,
                        end: 6,
                    },
                    {
                        text: 'outside',
                        label: 'DISEASE',
                        confidence: 0.91,
                        start: 500,
                        end: 507,
                    },
                ],
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            },
        ));
        vi.stubGlobal('fetch', fetchMock);

        const result = await analyzeOpenMedText({
            config,
            options: {
                text,
                modelName: 'disease_detection_superclinical',
                confidenceThreshold: 0.6,
                groupEntities: false,
                aggregationStrategy: 'simple',
                keepAlive: '10m',
            },
        });

        expect(result.entities).toEqual([
            {
                text: 'Asthma',
                label: 'DISEASE',
                confidence: 0.96,
                start: 0,
                end: 6,
            },
        ]);
        expect(result.rejectedEntityCount).toBe(1);
        expect(result.engineVersion).toBe('2.0.0');

        const request = fetchMock.mock.calls[0];
        expect(request[0]).toBe('http://127.0.0.1:8080/analyze');
        expect(JSON.parse(String(request[1]?.body))).toEqual({
            text,
            model_name: 'disease_detection_superclinical',
            confidence_threshold: 0.6,
            group_entities: false,
            aggregation_strategy: 'simple',
            keep_alive: '10m',
        });
    });

    it('fails closed when the service returns different source text', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
            JSON.stringify({
                text: 'Different text',
                entities: [],
                model_name: 'disease_detection_superclinical',
            }),
            { status: 200 },
        )));

        await expect(analyzeOpenMedText({
            config,
            options: {
                text: 'Expected source text',
                modelName: 'disease_detection_superclinical',
                confidenceThreshold: 0.6,
            },
        })).rejects.toMatchObject({
            name: 'OpenMedClientError',
            code: 'invalid-response',
        });
    });

    it('distinguishes a timeout from a caller cancellation', async () => {
        const neverCompletes = vi.fn((_: unknown, init?: RequestInit) =>
            new Promise((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => {
                    reject(new DOMException('Aborted', 'AbortError'));
                }, { once: true });
            }));
        vi.stubGlobal('fetch', neverCompletes);

        await expect(analyzeOpenMedText({
            config: { ...config, timeoutMs: 5 },
            options: {
                text: 'Patient has asthma.',
                modelName: 'disease_detection_superclinical',
                confidenceThreshold: 0.6,
            },
        })).rejects.toMatchObject({
            name: 'OpenMedClientError',
            code: 'timeout',
        });

        const controller = new AbortController();
        const pending = analyzeOpenMedText({
            config: { ...config, timeoutMs: 1_000 },
            options: {
                text: 'Patient takes metformin.',
                modelName: 'pharma_detection_superclinical',
                confidenceThreshold: 0.6,
                signal: controller.signal,
            },
        });
        controller.abort();
        await expect(pending).rejects.toMatchObject({
            name: 'OpenMedClientError',
            code: 'aborted',
        });
    });
});
