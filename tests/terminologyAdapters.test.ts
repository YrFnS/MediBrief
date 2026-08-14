import { describe, expect, it, vi } from 'vitest';
import {
    buildFhirValidateCodeParameters,
    buildRxNormPropertiesUrl,
    createFhirValidateCodeAdapter,
    createRxNormValidationAdapter,
    normalizeTerminologyEndpoint,
    validateCodeWithLocalReviewedSubset,
    type TerminologyCodeValidationRequest,
} from '../features/terminology/adapters';
import { TERMINOLOGY_URIS } from '../features/terminology/registry';

describe('local reviewed terminology adapter', () => {
    it('validates only the reviewed exact subsets and remains indeterminate outside them', () => {
        expect(validateCodeWithLocalReviewedSubset({
            system: TERMINOLOGY_URIS.loinc,
            code: '8867-4',
            display: 'Heart rate',
        }).status).toBe('valid');

        expect(validateCodeWithLocalReviewedSubset({
            system: TERMINOLOGY_URIS.loinc,
            code: '60591-5',
        }).status).toBe('indeterminate');

        expect(validateCodeWithLocalReviewedSubset({
            system: TERMINOLOGY_URIS.ucum,
            code: 'mg/dL',
        }).status).toBe('valid');

        expect(validateCodeWithLocalReviewedSubset({
            system: TERMINOLOGY_URIS.ucum,
            code: 'MG/DL',
        }).status).toBe('indeterminate');
    });

    it('does not treat identifier syntax as proof of active terminology content', () => {
        expect(validateCodeWithLocalReviewedSubset({
            system: TERMINOLOGY_URIS.rxnorm,
            code: '308135',
        }).status).toBe('indeterminate');
        expect(validateCodeWithLocalReviewedSubset({
            system: TERMINOLOGY_URIS.rxnorm,
            code: 'amlodipine',
        }).status).toBe('invalid');
        expect(validateCodeWithLocalReviewedSubset({
            system: TERMINOLOGY_URIS.snomedCt,
            code: '59621000',
        }).status).toBe('indeterminate');
    });
});

describe('FHIR validate-code adapter', () => {
    it('hardens configured endpoints and numeric safety limits', () => {
        expect(normalizeTerminologyEndpoint(
            'https://terminology.example/fhir/',
        )).toBe('https://terminology.example/fhir');
        expect(normalizeTerminologyEndpoint(
            'http://localhost:8080/fhir/',
        )).toBe('http://localhost:8080/fhir');
        expect(() => normalizeTerminologyEndpoint(
            'http://terminology.example/fhir',
        )).toThrow(/HTTPS/);
        expect(() => normalizeTerminologyEndpoint(
            'https://user:secret@terminology.example/fhir',
        )).toThrow(/credentials/);
        expect(() => normalizeTerminologyEndpoint(
            'https://terminology.example/fhir?token=secret',
        )).toThrow(/query or fragment/);
        expect(() => createFhirValidateCodeAdapter({
            endpoint: 'https://terminology.example/fhir',
            supportedSystems: [TERMINOLOGY_URIS.loinc],
            timeoutMs: 0,
        })).toThrow(/timeout/i);
        expect(() => createFhirValidateCodeAdapter({
            endpoint: 'https://terminology.example/fhir',
            supportedSystems: [TERMINOLOGY_URIS.loinc],
            maxResponseBytes: 10,
        })).toThrow(/response limit/i);
    });

    it('builds R4 CodeSystem and ValueSet Parameters with the correct version field', () => {
        const codeSystemParameters = buildFhirValidateCodeParameters({
            system: TERMINOLOGY_URIS.loinc,
            code: '8867-4',
            version: '2.82',
            display: 'Heart rate',
        });
        expect(codeSystemParameters.parameter).toContainEqual({
            name: 'version',
            valueString: '2.82',
        });

        const valueSetParameters = buildFhirValidateCodeParameters({
            system: TERMINOLOGY_URIS.loinc,
            code: '8867-4',
            version: '2.82',
            valueSetUrl: 'https://receiver.example/ValueSet/heart-rate',
        });
        expect(valueSetParameters.parameter).toContainEqual({
            name: 'systemVersion',
            valueString: '2.82',
        });
        expect(valueSetParameters.parameter).not.toContainEqual({
            name: 'version',
            valueString: '2.82',
        });

        const serialized = JSON.stringify(codeSystemParameters);
        expect(serialized).toContain('8867-4');
        expect(serialized).toContain(TERMINOLOGY_URIS.loinc);
        expect(serialized).not.toContain('patientId');
        expect(serialized).not.toContain('document');
        expect(serialized).not.toContain('sourceText');
    });

    it('omits unexpected clinical fields and validates a matching coded response', async () => {
        const captured: Array<{ url: string; init?: RequestInit }> = [];
        const fetchImpl = vi.fn(async (
            input: RequestInfo | URL,
            init?: RequestInit,
        ) => {
            captured.push({ url: String(input), init });
            return new Response(JSON.stringify({
                resourceType: 'Parameters',
                parameter: [
                    { name: 'result', valueBoolean: true },
                    { name: 'display', valueString: 'Heart rate' },
                    { name: 'system', valueUri: TERMINOLOGY_URIS.loinc },
                    { name: 'code', valueCode: '8867-4' },
                ],
            }), {
                status: 200,
                headers: { 'content-type': 'application/fhir+json' },
            });
        }) as unknown as typeof fetch;
        const adapter = createFhirValidateCodeAdapter({
            endpoint: 'https://terminology.example/fhir',
            supportedSystems: [TERMINOLOGY_URIS.loinc],
            fetchImpl,
        });
        const request = {
            system: TERMINOLOGY_URIS.loinc,
            code: '8867-4',
            display: 'Heart rate',
            patientId: 'must-not-leave-browser',
            sourceText: 'must-not-leave-browser',
        } as TerminologyCodeValidationRequest & {
            patientId: string;
            sourceText: string;
        };
        const result = await adapter.validateCode(request);
        expect(result.status).toBe('valid');
        expect(captured).toHaveLength(1);
        expect(captured[0].url).toBe(
            'https://terminology.example/fhir/CodeSystem/$validate-code',
        );
        expect(captured[0].init?.credentials).toBe('omit');
        expect(captured[0].init?.redirect).toBe('error');
        const body = String(captured[0].init?.body);
        expect(body).not.toContain('must-not-leave-browser');
        expect(body).not.toContain('patientId');
        expect(body).not.toContain('sourceText');
    });

    it('fails closed on identity drift, malformed JSON, and oversized responses', async () => {
        const mismatchAdapter = createFhirValidateCodeAdapter({
            endpoint: 'https://terminology.example/fhir',
            supportedSystems: [TERMINOLOGY_URIS.loinc],
            fetchImpl: (async () => new Response(JSON.stringify({
                resourceType: 'Parameters',
                parameter: [
                    { name: 'result', valueBoolean: true },
                    { name: 'system', valueUri: TERMINOLOGY_URIS.loinc },
                    { name: 'code', valueCode: 'different-code' },
                ],
            }), {
                status: 200,
                headers: { 'content-type': 'application/fhir+json' },
            })) as typeof fetch,
        });
        expect((await mismatchAdapter.validateCode({
            system: TERMINOLOGY_URIS.loinc,
            code: '8867-4',
        })).status).toBe('indeterminate');

        const malformedAdapter = createFhirValidateCodeAdapter({
            endpoint: 'https://terminology.example/fhir',
            supportedSystems: [TERMINOLOGY_URIS.loinc],
            fetchImpl: (async () => new Response('not-json', {
                status: 200,
            })) as typeof fetch,
        });
        expect((await malformedAdapter.validateCode({
            system: TERMINOLOGY_URIS.loinc,
            code: '8867-4',
        })).status).toBe('indeterminate');

        const oversizedAdapter = createFhirValidateCodeAdapter({
            endpoint: 'https://terminology.example/fhir',
            supportedSystems: [TERMINOLOGY_URIS.loinc],
            maxResponseBytes: 1_024,
            fetchImpl: (async () => new Response(JSON.stringify({
                resourceType: 'Parameters',
                parameter: [
                    { name: 'result', valueBoolean: true },
                    { name: 'message', valueString: 'x'.repeat(2_000) },
                ],
            }), {
                status: 200,
                headers: { 'content-type': 'application/fhir+json' },
            })) as typeof fetch,
        });
        const oversized = await oversizedAdapter.validateCode({
            system: TERMINOLOGY_URIS.loinc,
            code: '8867-4',
        });
        expect(oversized.status).toBe('indeterminate');
        expect(oversized.message).toMatch(/safety limit/i);
    });

    it('does not make a request for a system outside the adapter allowlist', async () => {
        const fetchImpl = vi.fn() as unknown as typeof fetch;
        const adapter = createFhirValidateCodeAdapter({
            endpoint: 'https://terminology.example/fhir',
            supportedSystems: [TERMINOLOGY_URIS.loinc],
            fetchImpl,
        });
        const result = await adapter.validateCode({
            system: TERMINOLOGY_URIS.snomedCt,
            code: '59621000',
        });
        expect(result.status).toBe('indeterminate');
        expect(result.externalRequest).toBe(false);
        expect(fetchImpl).not.toHaveBeenCalled();
    });
});

describe('RxNorm adapter', () => {
    it('constructs an identifier-only properties URL', () => {
        expect(buildRxNormPropertiesUrl(
            'https://rxnav.nlm.nih.gov/REST',
            '308135',
        )).toBe(
            'https://rxnav.nlm.nih.gov/REST/rxcui/308135/properties.json',
        );
        expect(() => buildRxNormPropertiesUrl(
            'https://rxnav.nlm.nih.gov/REST',
            'amlodipine',
        )).toThrow(/RxCUI/);
    });

    it('does not expose display text in the URL and distinguishes active, missing, and version-specific concepts', async () => {
        const urls: string[] = [];
        const activeAdapter = createRxNormValidationAdapter({
            fetchImpl: (async (input: RequestInfo | URL) => {
                urls.push(String(input));
                return new Response(JSON.stringify({
                    properties: {
                        rxcui: '308135',
                        name: 'Amlodipine 5 MG Oral Tablet',
                        suppress: 'N',
                    },
                }), {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                });
            }) as typeof fetch,
        });
        const active = await activeAdapter.validateCode({
            system: TERMINOLOGY_URIS.rxnorm,
            code: '308135',
            display: 'Patient-specific medication wording',
        });
        expect(active.status).toBe('valid');
        expect(urls[0]).toContain('/rxcui/308135/properties.json');
        expect(urls[0]).not.toContain('Patient-specific');
        expect(activeAdapter.attribution).toContain(
            'U.S. National Library of Medicine',
        );

        const versionSpecific = await activeAdapter.validateCode({
            system: TERMINOLOGY_URIS.rxnorm,
            code: '308135',
            version: '2025-07-01',
        });
        expect(versionSpecific.status).toBe('indeterminate');
        expect(versionSpecific.message).toMatch(/historical version/i);

        const missingAdapter = createRxNormValidationAdapter({
            fetchImpl: (async () => new Response('{}', {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })) as typeof fetch,
        });
        expect((await missingAdapter.validateCode({
            system: TERMINOLOGY_URIS.rxnorm,
            code: '308135',
        })).status).toBe('invalid');
    });

    it('fails closed on an oversized response and avoids network for invalid identifiers', async () => {
        const oversizedAdapter = createRxNormValidationAdapter({
            maxResponseBytes: 1_024,
            fetchImpl: (async () => new Response(JSON.stringify({
                properties: {
                    rxcui: '308135',
                    name: 'x'.repeat(2_000),
                },
            }), {
                status: 200,
                headers: { 'content-type': 'application/json' },
            })) as typeof fetch,
        });
        expect((await oversizedAdapter.validateCode({
            system: TERMINOLOGY_URIS.rxnorm,
            code: '308135',
        })).status).toBe('indeterminate');

        const fetchImpl = vi.fn() as unknown as typeof fetch;
        const invalidAdapter = createRxNormValidationAdapter({ fetchImpl });
        const invalid = await invalidAdapter.validateCode({
            system: TERMINOLOGY_URIS.rxnorm,
            code: 'amlodipine',
        });
        expect(invalid.status).toBe('invalid');
        expect(invalid.externalRequest).toBe(false);
        expect(fetchImpl).not.toHaveBeenCalled();
    });
});
