import {
    buildFhirValidateCodeParameters,
    createTerminologyResult,
    normalizeCodeValidationRequest,
    normalizeTerminologyEndpoint,
    parseFhirValidateCodeResponse,
    readBoundedJsonResponse,
    resolveFetch,
    resolveTerminologyResponseLimitBytes,
    resolveTerminologyTimeoutMs,
} from './shared';
import type {
    FhirValidateCodeAdapterOptions,
    TerminologyValidationAdapter,
} from './types';

const responseFailureMessage = (
    reason:
        | 'unsupported-content-type'
        | 'response-too-large'
        | 'invalid-json',
): string => ({
    'unsupported-content-type':
        'The terminology service returned a non-JSON content type.',
    'response-too-large':
        'The terminology service response exceeded the configured safety limit.',
    'invalid-json':
        'The terminology service response was not valid JSON.',
}[reason]);

export const createFhirValidateCodeAdapter = (
    options: FhirValidateCodeAdapterOptions,
): TerminologyValidationAdapter => {
    const endpoint = normalizeTerminologyEndpoint(options.endpoint);
    const supportedSystems = [...new Set(
        options.supportedSystems.map(system => system.trim()).filter(Boolean),
    )];
    if (supportedSystems.length === 0) {
        throw new Error(
            'At least one supported terminology system is required.',
        );
    }
    const fetchImpl = resolveFetch(options.fetchImpl);
    const timeoutMs = resolveTerminologyTimeoutMs(options.timeoutMs);
    const maxResponseBytes = resolveTerminologyResponseLimitBytes(
        options.maxResponseBytes,
    );
    const id = options.id || 'fhir-validate-code';

    return {
        id,
        name: options.name || 'Configured FHIR terminology service',
        mode: 'fhir-validate-code',
        externalRequest: true,
        supportedSystems,
        privacyBoundary:
            'Sends only system, code, optional version/display, and optional value-set URL. The adapter cannot accept patient identifiers, notes, documents, source excerpts, or clinical-resource objects.',
        validateCode: async input => {
            const request = normalizeCodeValidationRequest(input);
            if (!request.system || !request.code) {
                return createTerminologyResult({
                    adapterId: id,
                    status: 'invalid',
                    request,
                    message: 'A terminology system and code are required.',
                    externalRequest: false,
                });
            }
            if (!supportedSystems.includes(request.system)) {
                return createTerminologyResult({
                    adapterId: id,
                    status: 'indeterminate',
                    request,
                    message:
                        'The configured adapter does not permit this terminology system. No network request was made.',
                    externalRequest: false,
                });
            }

            const operationPath = request.valueSetUrl
                ? 'ValueSet/$validate-code'
                : 'CodeSystem/$validate-code';
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = await fetchImpl(
                    `${endpoint}/${operationPath}`,
                    {
                        method: 'POST',
                        headers: {
                            Accept: 'application/fhir+json, application/json',
                            'Content-Type': 'application/fhir+json',
                        },
                        body: JSON.stringify(
                            buildFhirValidateCodeParameters(request),
                        ),
                        credentials: 'omit',
                        redirect: 'error',
                        referrerPolicy: 'no-referrer',
                        signal: controller.signal,
                    },
                );
                if (response.redirected) {
                    return createTerminologyResult({
                        adapterId: id,
                        status: 'indeterminate',
                        request,
                        message:
                            'The terminology service response was redirected; code validity is unknown.',
                        externalRequest: true,
                    });
                }
                if (!response.ok) {
                    return createTerminologyResult({
                        adapterId: id,
                        status: 'indeterminate',
                        request,
                        message:
                            `The terminology service returned HTTP ${response.status}; code validity is unknown.`,
                        externalRequest: true,
                    });
                }

                const bounded = await readBoundedJsonResponse(
                    response,
                    maxResponseBytes,
                );
                if (!bounded.ok) {
                    return createTerminologyResult({
                        adapterId: id,
                        status: 'indeterminate',
                        request,
                        message: responseFailureMessage(bounded.reason),
                        externalRequest: true,
                    });
                }
                const parsed = parseFhirValidateCodeResponse(bounded.payload);
                if (typeof parsed.result !== 'boolean') {
                    return createTerminologyResult({
                        adapterId: id,
                        status: 'indeterminate',
                        request,
                        message:
                            parsed.message
                            || 'The service did not return a boolean validation result.',
                        externalRequest: true,
                    });
                }

                const identityWarnings = [
                    ...(parsed.system && parsed.system !== request.system
                        ? ['The service returned a different terminology system.']
                        : []),
                    ...(parsed.code && parsed.code !== request.code
                        ? ['The service returned a different code.']
                        : []),
                    ...(parsed.version
                        && request.version
                        && parsed.version !== request.version
                        ? ['The service returned a different code-system version.']
                        : []),
                ];
                if (parsed.result && identityWarnings.length > 0) {
                    return createTerminologyResult({
                        adapterId: id,
                        status: 'indeterminate',
                        request,
                        preferredDisplay: parsed.display,
                        message:
                            'The service returned a positive result for a different coded identity; validity is unknown.',
                        warnings: identityWarnings,
                        externalRequest: true,
                    });
                }

                return createTerminologyResult({
                    adapterId: id,
                    status: parsed.result ? 'valid' : 'invalid',
                    request,
                    preferredDisplay: parsed.display,
                    message:
                        parsed.message
                        || (parsed.result
                            ? 'The configured terminology service accepted the code.'
                            : 'The configured terminology service rejected the code.'),
                    warnings: identityWarnings,
                    externalRequest: true,
                });
            } catch (error) {
                return createTerminologyResult({
                    adapterId: id,
                    status: 'indeterminate',
                    request,
                    message:
                        error instanceof Error && error.name === 'AbortError'
                            ? 'Terminology validation timed out; code validity is unknown.'
                            : 'Terminology validation could not be completed; code validity is unknown.',
                    externalRequest: true,
                });
            } finally {
                clearTimeout(timeout);
            }
        },
    };
};
