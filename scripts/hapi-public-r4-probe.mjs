import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const HAPI_PUBLIC_R4_BASE_URL = 'https://hapi.fhir.org/baseR4';
export const HAPI_PUBLIC_R4_CAPABILITY_URL =
    `${HAPI_PUBLIC_R4_BASE_URL}/metadata`;
export const HAPI_PUBLIC_R4_RECEIVER_ID =
    'hapi-public-r4-test-server';

const REQUIRED_ENABLEMENT =
    'MEDIBRIEF_ALLOW_PUBLIC_SYNTHETIC_PROBE=true';
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_CAPABILITY_BYTES = 8 * 1024 * 1024;
const MAX_TRANSACTION_RESPONSE_BYTES = 1024 * 1024;
const PROBE_TAG_SYSTEM =
    'https://medibrief.local/fhir/security';
const PROBE_CODE_SYSTEM =
    'https://medibrief.local/fhir/CodeSystem/test-artifact';

const isObject = value =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const asArray = value => Array.isArray(value) ? value : [];

const resolveTimeoutMs = value => {
    if (!Number.isInteger(value) || value < 100 || value > 120_000) {
        throw new Error(
            'Probe timeout must be an integer between 100 and 120000 milliseconds.',
        );
    }
    return value;
};

const readBoundedBytes = async (response, maxBytes, label) => {
    const contentLength = Number(
        response.headers.get('content-length') || Number.NaN,
    );
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        throw new Error(`${label} exceeded the configured response limit.`);
    }

    if (!response.body) {
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength > maxBytes) {
            throw new Error(`${label} exceeded the configured response limit.`);
        }
        return bytes;
    }

    const reader = response.body.getReader();
    const chunks = [];
    let totalBytes = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            totalBytes += value.byteLength;
            if (totalBytes > maxBytes) {
                await reader.cancel();
                throw new Error(
                    `${label} exceeded the configured response limit.`,
                );
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }

    const bytes = new Uint8Array(totalBytes);
    let offset = 0;
    chunks.forEach(chunk => {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    });
    return bytes;
};

const boundedJson = async (response, maxBytes, label) => {
    const contentType = response.headers.get('content-type')
        ?.toLowerCase();
    if (contentType && !contentType.includes('json')) {
        throw new Error(`${label} returned a non-JSON content type.`);
    }

    const bytes = await readBoundedBytes(response, maxBytes, label);
    try {
        return JSON.parse(new TextDecoder().decode(bytes));
    } catch {
        throw new Error(`${label} did not return valid JSON.`);
    }
};

const fetchWithTimeout = async (
    fetchImpl,
    url,
    init,
    timeoutMs,
    consume = response => response,
) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetchImpl(url, {
            ...init,
            signal: controller.signal,
        });
        return await consume(response);
    } finally {
        clearTimeout(timeout);
    }
};

const probeResourceId = value => {
    const normalized = String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '')
        .replace(/^-+|-+$/g, '')
        .slice(0, 42);
    if (!normalized) {
        throw new Error('A non-empty synthetic probe identifier is required.');
    }
    return `medibrief-probe-${normalized}`;
};

/**
 * @param {{
 *   probeId?: string;
 *   resourceUuid?: string;
 *   now?: string;
 * }} [options]
 */
export const buildSyntheticProbeBundle = ({
    probeId = randomUUID(),
    resourceUuid = randomUUID(),
    now = new Date().toISOString(),
} = {}) => {
    const resourceId = probeResourceId(probeId);
    return {
        resourceType: 'Bundle',
        type: 'transaction',
        identifier: {
            system: 'https://medibrief.local/fhir/identifier/synthetic-probe',
            value: resourceId,
        },
        timestamp: now,
        entry: [{
            fullUrl: `urn:uuid:${resourceUuid}`,
            resource: {
                resourceType: 'Basic',
                id: resourceId,
                meta: {
                    tag: [{
                        system: PROBE_TAG_SYSTEM,
                        code: 'synthetic-nonclinical-test',
                        display: 'Synthetic nonclinical interoperability test',
                    }],
                },
                code: {
                    coding: [{
                        system: PROBE_CODE_SYSTEM,
                        code: 'connectivity-probe',
                        display: 'MediBrief connectivity probe',
                    }],
                    text: 'MediBrief synthetic connectivity probe',
                },
                created: now,
            },
            request: {
                method: 'PUT',
                url: `Basic/${resourceId}`,
            },
        }],
    };
};

const BLOCKED_RESOURCE_TYPES = new Set([
    'Patient',
    'Composition',
    'Observation',
    'Condition',
    'AllergyIntolerance',
    'MedicationStatement',
    'MedicationRequest',
    'Medication',
    'Immunization',
    'Procedure',
    'DiagnosticReport',
    'Specimen',
    'DocumentReference',
    'Encounter',
    'CarePlan',
    'CareTeam',
]);

const BLOCKED_PATIENT_KEYS = new Set([
    'subject',
    'patient',
    'beneficiary',
    'individual',
    'identifier',
    'name',
    'telecom',
    'address',
    'birthDate',
    'deceasedBoolean',
    'deceasedDateTime',
    'note',
    'contained',
    'managingOrganization',
    'contact',
    'communication',
]);

export const validateSyntheticProbeBundle = bundle => {
    const errors = [];
    if (!isObject(bundle)
        || bundle.resourceType !== 'Bundle'
        || bundle.type !== 'transaction') {
        return ['The synthetic probe must be a FHIR transaction Bundle.'];
    }

    const entries = asArray(bundle.entry);
    if (entries.length !== 1) {
        errors.push('The synthetic probe must contain exactly one entry.');
    }

    entries.forEach((entry, index) => {
        if (!isObject(entry) || !isObject(entry.resource)) {
            errors.push(`Bundle.entry[${index}] must contain a resource.`);
            return;
        }
        const resourceType = entry.resource.resourceType;
        if (resourceType !== 'Basic') {
            errors.push(
                `Bundle.entry[${index}] may contain only a Basic resource.`,
            );
        }
        if (BLOCKED_RESOURCE_TYPES.has(resourceType)) {
            errors.push(
                `Bundle.entry[${index}] contains a prohibited clinical resource.`,
            );
        }
        if (!isObject(entry.request)
            || entry.request.method !== 'PUT'
            || entry.request.url !== `Basic/${entry.resource.id}`) {
            errors.push(
                `Bundle.entry[${index}] must use a deterministic Basic PUT.`,
            );
        }
    });

    const visit = (value, path = 'Bundle') => {
        if (Array.isArray(value)) {
            value.forEach((item, index) => visit(item, `${path}[${index}]`));
            return;
        }
        if (!isObject(value)) return;

        Object.entries(value).forEach(([key, child]) => {
            const childPath = `${path}.${key}`;
            if (BLOCKED_PATIENT_KEYS.has(key)
                && childPath !== 'Bundle.identifier') {
                errors.push(
                    `${childPath} is not permitted in the nonclinical probe.`,
                );
            }
            if (key === 'div') {
                errors.push(
                    `${childPath} is not permitted in the nonclinical probe.`,
                );
            }
            visit(child, childPath);
        });
    };
    visit(bundle);

    return [...new Set(errors)];
};

export const inspectHapiCapabilityStatement = payload => {
    const errors = [];
    if (!isObject(payload)
        || payload.resourceType !== 'CapabilityStatement') {
        return {
            errors: ['The endpoint did not return a CapabilityStatement.'],
            summary: null,
        };
    }

    if (payload.fhirVersion !== '4.0.1') {
        errors.push(
            `Expected FHIR 4.0.1 but received ${String(payload.fhirVersion)}.`,
        );
    }

    const formats = asArray(payload.format)
        .filter(value => typeof value === 'string')
        .map(value => value.toLowerCase());
    const supportsJson = formats.some(value => [
        'json',
        'application/json',
        'application/fhir+json',
    ].includes(value));
    if (!supportsJson) {
        errors.push('The endpoint does not advertise FHIR JSON support.');
    }

    const serverRest = asArray(payload.rest).find(entry =>
        isObject(entry) && entry.mode === 'server');
    if (!isObject(serverRest)) {
        errors.push('The CapabilityStatement has no server REST declaration.');
    }

    const systemInteractions = new Set(
        asArray(serverRest?.interaction)
            .filter(isObject)
            .map(entry => entry.code)
            .filter(value => typeof value === 'string'),
    );
    if (!systemInteractions.has('transaction')) {
        errors.push('The endpoint does not advertise system transaction support.');
    }

    const basicResource = asArray(serverRest?.resource).find(entry =>
        isObject(entry) && entry.type === 'Basic');
    if (!isObject(basicResource)) {
        errors.push('The endpoint does not advertise the Basic resource.');
    }
    const basicInteractions = new Set(
        asArray(basicResource?.interaction)
            .filter(isObject)
            .map(entry => entry.code)
            .filter(value => typeof value === 'string'),
    );
    if (!basicInteractions.has('update')) {
        errors.push('The endpoint does not advertise Basic update support.');
    }
    if (!basicInteractions.has('delete')) {
        errors.push('The endpoint does not advertise Basic delete support.');
    }

    const documentConsumerProfiles = asArray(payload.document)
        .filter(entry =>
            isObject(entry)
            && entry.mode === 'consumer'
            && typeof entry.profile === 'string')
        .map(entry => entry.profile);

    return {
        errors,
        summary: {
            fhirVersion: payload.fhirVersion,
            supportsJson,
            transactionSupported: systemInteractions.has('transaction'),
            basicUpdateSupported: basicInteractions.has('update'),
            basicDeleteSupported: basicInteractions.has('delete'),
            documentConsumerProfiles,
            ipsConsumerProfileAdvertised: documentConsumerProfiles.some(
                profile => profile.includes('/uv/ips/'),
            ),
        },
    };
};

const inspectTransactionResponse = (payload, expectedResourceId) => {
    if (!isObject(payload)
        || payload.resourceType !== 'Bundle'
        || payload.type !== 'transaction-response') {
        throw new Error(
            'The endpoint did not return a transaction-response Bundle.',
        );
    }

    const response = asArray(payload.entry)[0]?.response;
    if (!isObject(response) || typeof response.status !== 'string') {
        throw new Error(
            'The transaction response did not include an entry status.',
        );
    }
    if (!/^(200|201)\b/.test(response.status)) {
        throw new Error(
            `The synthetic transaction returned ${response.status}.`,
        );
    }

    const location = typeof response.location === 'string'
        ? response.location
        : `Basic/${expectedResourceId}`;
    if (!location.includes(`Basic/${expectedResourceId}`)) {
        throw new Error(
            'The transaction response identified an unexpected resource.',
        );
    }

    return {
        status: response.status,
        location,
    };
};

/**
 * @param {{
 *   enabled?: boolean;
 *   fetchImpl?: typeof fetch;
 *   now?: string;
 *   probeId?: string;
 *   resourceUuid?: string;
 *   timeoutMs?: number;
 * }} [options]
 */
export const runHapiPublicR4Probe = async ({
    enabled = process.env.MEDIBRIEF_ALLOW_PUBLIC_SYNTHETIC_PROBE === 'true',
    fetchImpl = globalThis.fetch,
    now = new Date().toISOString(),
    probeId = randomUUID(),
    resourceUuid = randomUUID(),
    timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) => {
    if (!enabled) {
        throw new Error(
            `Live probing is disabled. Set ${REQUIRED_ENABLEMENT} explicitly.`,
        );
    }
    if (typeof fetchImpl !== 'function') {
        throw new Error('A Fetch API implementation is required.');
    }
    const resolvedTimeoutMs = resolveTimeoutMs(timeoutMs);

    const bundle = buildSyntheticProbeBundle({
        probeId,
        resourceUuid,
        now,
    });
    const probeErrors = validateSyntheticProbeBundle(bundle);
    if (probeErrors.length > 0) {
        throw new Error(
            `Synthetic probe safety validation failed: ${probeErrors.join(' ')}`,
        );
    }

    const capabilityPayload = await fetchWithTimeout(
        fetchImpl,
        HAPI_PUBLIC_R4_CAPABILITY_URL,
        {
            method: 'GET',
            headers: {
                Accept: 'application/fhir+json, application/json',
            },
            redirect: 'error',
            credentials: 'omit',
            referrerPolicy: 'no-referrer',
        },
        resolvedTimeoutMs,
        async response => {
            if (!response.ok) {
                throw new Error(
                    `Capability discovery returned HTTP ${response.status}.`,
                );
            }
            return boundedJson(
                response,
                MAX_CAPABILITY_BYTES,
                'Capability discovery',
            );
        },
    );
    const capability = inspectHapiCapabilityStatement(capabilityPayload);
    if (capability.errors.length > 0) {
        throw new Error(
            `Capability drift blocked the probe: ${capability.errors.join(' ')}`,
        );
    }

    const resourceId = bundle.entry[0].resource.id;
    const resourcePath = `Basic/${resourceId}`;
    let writeAttempted = false;
    let transactionResult = null;
    let cleanupStatus = null;
    let primaryError = null;

    try {
        writeAttempted = true;
        transactionResult = await fetchWithTimeout(
            fetchImpl,
            HAPI_PUBLIC_R4_BASE_URL,
            {
                method: 'POST',
                headers: {
                    Accept: 'application/fhir+json, application/json',
                    'Content-Type': 'application/fhir+json',
                },
                body: JSON.stringify(bundle),
                redirect: 'error',
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
            },
            resolvedTimeoutMs,
            async response => {
                if (!response.ok) {
                    throw new Error(
                        `Synthetic transaction returned HTTP ${response.status}.`,
                    );
                }
                const payload = await boundedJson(
                    response,
                    MAX_TRANSACTION_RESPONSE_BYTES,
                    'Synthetic transaction',
                );
                return inspectTransactionResponse(payload, resourceId);
            },
        );
    } catch (error) {
        primaryError = error;
    } finally {
        if (writeAttempted) {
            try {
                const cleanupResponse = await fetchWithTimeout(
                    fetchImpl,
                    `${HAPI_PUBLIC_R4_BASE_URL}/${resourcePath}`,
                    {
                        method: 'DELETE',
                        headers: {
                            Accept: 'application/fhir+json, application/json',
                        },
                        redirect: 'error',
                        credentials: 'omit',
                        referrerPolicy: 'no-referrer',
                    },
                    resolvedTimeoutMs,
                );
                cleanupStatus = cleanupResponse.status;
                if (!cleanupResponse.ok && cleanupResponse.status !== 404) {
                    throw new Error(
                        `Synthetic cleanup returned HTTP ${cleanupResponse.status}.`,
                    );
                }
            } catch (cleanupError) {
                if (primaryError) {
                    throw new AggregateError(
                        [primaryError, cleanupError],
                        'The synthetic probe failed and cleanup could not be confirmed.',
                    );
                }
                throw cleanupError;
            }
        }
    }

    if (primaryError) throw primaryError;
    if (!transactionResult) {
        throw new Error('The synthetic transaction did not produce a result.');
    }

    return {
        schemaVersion: '1',
        receiverId: HAPI_PUBLIC_R4_RECEIVER_ID,
        generatedAt: now,
        endpoint: HAPI_PUBLIC_R4_BASE_URL,
        capability: capability.summary,
        syntheticTransaction: {
            requestMethod: 'POST',
            entryCount: 1,
            resourceTypes: ['Basic'],
            entryMethod: 'PUT',
            entryUrl: resourcePath,
            responseStatus: transactionResult.status,
            responseLocation: transactionResult.location,
            cleanupStatus,
        },
        patientDataTransmitted: false,
        ipsDocumentTransmitted: false,
        transferAuthorized: false,
        receiverAcceptanceEstablished: false,
        clinicalValidationEstablished: false,
        limitations: [
            'This probe demonstrates only current public-test endpoint discovery, transaction handling, and cleanup for one nonclinical Basic resource.',
            'It does not test patient identity, consent, authentication, IPS ingestion, clinical rendering, durability, or production readiness.',
        ],
    };
};

const isMain = Boolean(process.argv[1])
    && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
    runHapiPublicR4Probe()
        .then(report => {
            process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        })
        .catch(error => {
            const message = error instanceof Error
                ? error.message
                : String(error);
            process.stderr.write(`HAPI public R4 probe failed: ${message}\n`);
            process.exitCode = 1;
        });
}
