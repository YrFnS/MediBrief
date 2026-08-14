import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
    createPatientClinicalRecord,
    type PatientClinicalRecord,
} from '../features/clinical-record';
import {
    buildIpsDocument,
    HAPI_PUBLIC_R4_RECEIVER_PROFILE,
    RECEIVER_EXCHANGE_PROFILES,
    validateIpsForReceiver,
} from '../features/fhir';
import {
    HAPI_PUBLIC_R4_BASE_URL,
    HAPI_PUBLIC_R4_CAPABILITY_URL,
    buildSyntheticProbeBundle,
    inspectHapiCapabilityStatement,
    runHapiPublicR4Probe,
    validateSyntheticProbeBundle,
} from '../scripts/hapi-public-r4-probe.mjs';

const NOW = '2026-08-15T12:00:00.000Z';

const evidence = JSON.parse(readFileSync(
    new URL(
        '../evidence/hapi-public-r4-receiver-evidence.json',
        import.meta.url,
    ),
    'utf8',
)) as {
    receiverProfileId: string;
    snapshotId: string;
    reviewedAt: string;
    receiverContract: {
        compatibilityConclusion: string;
        advertisedIpsConsumerProfiles: string[];
    };
    syntheticProbeBoundary: {
        manualOnly: boolean;
        enabledByDefault: boolean;
        requiredEnvironmentVariable: string;
        payloadResourceTypes: string[];
        patientDataTransmitted: boolean;
        ipsDocumentTransmitted: boolean;
        cleanupRequired: boolean;
    };
    claimsNotEstablished: string[];
};

const syntheticRecord = (): PatientClinicalRecord => {
    const record = createPatientClinicalRecord({
        patientId: 'synthetic-hapi-contract-patient',
        displayName: 'Synthetic HAPI Contract Patient',
        dateOfBirth: { value: '1990-01-01', precision: 'day' },
        administrativeSex: 'unknown',
        preferredLanguage: 'en',
        now: NOW,
    });
    record.updatedAt = NOW;
    return record;
};

const capabilityStatement = ({
    fhirVersion = '4.0.1',
    transaction = true,
    basicUpdate = true,
    basicDelete = true,
}: {
    fhirVersion?: string;
    transaction?: boolean;
    basicUpdate?: boolean;
    basicDelete?: boolean;
} = {}) => ({
    resourceType: 'CapabilityStatement',
    id: 'hapi-public-r4-test',
    status: 'active',
    kind: 'instance',
    fhirVersion,
    format: ['application/fhir+json'],
    rest: [{
        mode: 'server',
        interaction: transaction ? [{ code: 'transaction' }] : [],
        resource: [{
            type: 'Basic',
            interaction: [
                ...(basicUpdate ? [{ code: 'update' }] : []),
                ...(basicDelete ? [{ code: 'delete' }] : []),
            ],
        }],
    }],
});

const jsonResponse = (
    payload: unknown,
    status = 200,
): Response => new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/fhir+json' },
});

describe('named HAPI public R4 receiver contract', () => {
    it('pins a synthetic-only receiver profile and governed evidence snapshot', () => {
        expect(RECEIVER_EXCHANGE_PROFILES).toContain(
            HAPI_PUBLIC_R4_RECEIVER_PROFILE,
        );
        expect(HAPI_PUBLIC_R4_RECEIVER_PROFILE.id).toBe(
            'hapi-public-r4-test-server',
        );
        expect(HAPI_PUBLIC_R4_RECEIVER_PROFILE.version).toBe('2026-08-15');
        expect(HAPI_PUBLIC_R4_RECEIVER_PROFILE.sourceReference).toBe(
            HAPI_PUBLIC_R4_CAPABILITY_URL,
        );
        expect(HAPI_PUBLIC_R4_RECEIVER_PROFILE.capabilityWarnings.length)
            .toBeGreaterThan(0);
        expect(HAPI_PUBLIC_R4_RECEIVER_PROFILE.limitations.join(' '))
            .toContain('Never send real patient data');

        expect(evidence.receiverProfileId).toBe(
            HAPI_PUBLIC_R4_RECEIVER_PROFILE.id,
        );
        expect(evidence.snapshotId).toBe('hapi-public-r4-2026-08-15');
        expect(evidence.reviewedAt).toBe('2026-08-15');
        expect(evidence.receiverContract.compatibilityConclusion)
            .toBe('indeterminate');
        expect(evidence.receiverContract.advertisedIpsConsumerProfiles)
            .toEqual([]);
        expect(evidence.syntheticProbeBoundary).toMatchObject({
            manualOnly: true,
            enabledByDefault: false,
            requiredEnvironmentVariable:
                'MEDIBRIEF_ALLOW_PUBLIC_SYNTHETIC_PROBE=true',
            payloadResourceTypes: ['Basic'],
            patientDataTransmitted: false,
            ipsDocumentTransmitted: false,
            cleanupRequired: true,
        });
        expect(evidence.claimsNotEstablished).toContain('IPS ingestion');
        expect(evidence.claimsNotEstablished).toContain('production readiness');
    });

    it('keeps local IPS compatibility indeterminate and non-authorizing', async () => {
        const bundle = buildIpsDocument(syntheticRecord(), NOW).bundle;
        const report = await validateIpsForReceiver({
            bundle,
            receiver: HAPI_PUBLIC_R4_RECEIVER_PROFILE,
            generatedAt: NOW,
        });

        expect(report.state).toBe('indeterminate');
        expect(report.readyForManualTransfer).toBe(false);
        expect(report.transferAuthorized).toBe(false);
        expect(report.receiverAcceptanceEstablished).toBe(false);
        expect(report.clinicalValidationEstablished).toBe(false);
        expect(report.networkActivity).toBe('none');
        expect(report.issues.some(issue =>
            issue.category === 'capability-uncertainty')).toBe(true);
    });
});

describe('HAPI public R4 synthetic transaction probe', () => {
    it('builds only one hard-coded nonclinical Basic resource', () => {
        const bundle = buildSyntheticProbeBundle({
            probeId: 'contract-test',
            resourceUuid: '2ee43652-69f1-48ae-8404-4b6c094f30d7',
            now: NOW,
        });

        expect(validateSyntheticProbeBundle(bundle)).toEqual([]);
        expect(bundle).toMatchObject({
            resourceType: 'Bundle',
            type: 'transaction',
            entry: [{
                resource: {
                    resourceType: 'Basic',
                    id: 'medibrief-probe-contract-test',
                },
                request: {
                    method: 'PUT',
                    url: 'Basic/medibrief-probe-contract-test',
                },
            }],
        });

        const serialized = JSON.stringify(bundle);
        for (const forbidden of [
            'Patient',
            'Composition',
            'Observation',
            'Condition',
            'MedicationStatement',
            'DiagnosticReport',
            'DocumentReference',
        ]) {
            expect(serialized).not.toContain(`"resourceType":"${forbidden}"`);
        }
        expect(serialized).not.toContain('synthetic-hapi-contract-patient');
        expect(serialized).not.toContain('Synthetic HAPI Contract Patient');
    });

    it('rejects a clinical or patient-linked payload before network use', () => {
        const unsafe = buildSyntheticProbeBundle({
            probeId: 'unsafe-test',
            resourceUuid: 'bf0d5062-2711-4c9c-8230-bd3ad2368cea',
            now: NOW,
        });
        (unsafe.entry[0] as any).resource = {
            resourceType: 'Patient',
            id: 'unsafe-patient',
            name: [{ text: 'Must never leave the device' }],
        };
        (unsafe.entry[0] as any).request.url = 'Patient/unsafe-patient';

        const errors = validateSyntheticProbeBundle(unsafe);
        expect(errors.some(error => error.includes('only a Basic'))).toBe(true);
        expect(errors.some(error => error.includes('prohibited clinical')))
            .toBe(true);
        expect(errors.some(error => error.includes('.name is not permitted')))
            .toBe(true);
    });

    it('requires explicit enablement before capability discovery', async () => {
        const fetchImpl = vi.fn();
        await expect(runHapiPublicR4Probe({
            enabled: false,
            fetchImpl,
            now: NOW,
            probeId: 'disabled-test',
            resourceUuid: '49f68314-83c6-488d-bac8-24105aeb280e',
        })).rejects.toThrow('Live probing is disabled');
        expect(fetchImpl).not.toHaveBeenCalled();
    });

    it('fails closed on capability drift before attempting a write', async () => {
        const fetchImpl = vi.fn(async () => jsonResponse(
            capabilityStatement({ fhirVersion: '5.0.0' }),
        ));

        await expect(runHapiPublicR4Probe({
            enabled: true,
            fetchImpl,
            now: NOW,
            probeId: 'drift-test',
            resourceUuid: '4c36f87d-61ba-4f26-91f4-69ffc5b56ad0',
        })).rejects.toThrow('Capability drift blocked the probe');
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(fetchImpl).toHaveBeenCalledWith(
            HAPI_PUBLIC_R4_CAPABILITY_URL,
            expect.objectContaining({ method: 'GET' }),
        );
    });

    it('discovers, writes one Basic resource, and confirms cleanup', async () => {
        let postedBundle: ReturnType<typeof buildSyntheticProbeBundle> | null = null;
        const fetchImpl = vi.fn(async (
            input: string | URL | Request,
            init?: RequestInit,
        ): Promise<Response> => {
            const url = String(input);
            const method = init?.method || 'GET';
            if (url === HAPI_PUBLIC_R4_CAPABILITY_URL && method === 'GET') {
                return jsonResponse(capabilityStatement());
            }
            if (url === HAPI_PUBLIC_R4_BASE_URL && method === 'POST') {
                postedBundle = JSON.parse(String(init?.body)) as ReturnType<
                    typeof buildSyntheticProbeBundle
                >;
                const resourceId = postedBundle.entry[0].resource.id;
                return jsonResponse({
                    resourceType: 'Bundle',
                    type: 'transaction-response',
                    entry: [{
                        response: {
                            status: '201 Created',
                            location: `Basic/${resourceId}/_history/1`,
                        },
                    }],
                });
            }
            if (url.startsWith(`${HAPI_PUBLIC_R4_BASE_URL}/Basic/`)
                && method === 'DELETE') {
                return new Response(null, { status: 204 });
            }
            throw new Error(`Unexpected synthetic probe request: ${method} ${url}`);
        });

        const report = await runHapiPublicR4Probe({
            enabled: true,
            fetchImpl,
            now: NOW,
            probeId: 'success-test',
            resourceUuid: '53ba481c-b476-4a32-b0fb-889f67c68fd4',
        });

        expect(fetchImpl).toHaveBeenCalledTimes(3);
        expect(postedBundle).not.toBeNull();
        expect(validateSyntheticProbeBundle(postedBundle!)).toEqual([]);
        expect(postedBundle!.entry.map(entry => entry.resource.resourceType))
            .toEqual(['Basic']);
        expect(report).toMatchObject({
            receiverId: 'hapi-public-r4-test-server',
            endpoint: HAPI_PUBLIC_R4_BASE_URL,
            syntheticTransaction: {
                entryCount: 1,
                resourceTypes: ['Basic'],
                entryMethod: 'PUT',
                cleanupStatus: 204,
            },
            patientDataTransmitted: false,
            ipsDocumentTransmitted: false,
            transferAuthorized: false,
            receiverAcceptanceEstablished: false,
            clinicalValidationEstablished: false,
        });
    });

    it('records the absence of an advertised IPS consumer profile', () => {
        const result = inspectHapiCapabilityStatement(capabilityStatement());
        expect(result.errors).toEqual([]);
        expect(result.summary).toMatchObject({
            fhirVersion: '4.0.1',
            supportsJson: true,
            transactionSupported: true,
            basicUpdateSupported: true,
            basicDeleteSupported: true,
            documentConsumerProfiles: [],
            ipsConsumerProfileAdvertised: false,
        });
    });
});
