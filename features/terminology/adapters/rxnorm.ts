import { TERMINOLOGY_URIS } from '../registry';
import {
    NLM_RXNORM_ATTRIBUTION,
    createTerminologyResult,
    normalizeCodeValidationRequest,
    normalizeTerminologyEndpoint,
    objectValue,
    readBoundedJsonResponse,
    resolveFetch,
    resolveTerminologyResponseLimitBytes,
    resolveTerminologyTimeoutMs,
} from './shared';
import type {
    RxNormValidationAdapterOptions,
    TerminologyValidationAdapter,
} from './types';

export const buildRxNormPropertiesUrl = (
    endpoint: string,
    rxcui: string,
): string => {
    const normalizedEndpoint = normalizeTerminologyEndpoint(endpoint);
    if (!/^[1-9]\d{0,11}$/.test(rxcui)) {
        throw new Error(
            'RxCUI must be a positive numeric identifier of up to 12 digits.',
        );
    }
    return `${normalizedEndpoint}/rxcui/${encodeURIComponent(rxcui)}/properties.json`;
};

const responseFailureMessage = (
    reason:
        | 'unsupported-content-type'
        | 'response-too-large'
        | 'invalid-json',
): string => ({
    'unsupported-content-type':
        'The RxNorm API returned a non-JSON content type.',
    'response-too-large':
        'The RxNorm API response exceeded the configured safety limit.',
    'invalid-json':
        'The RxNorm API response was not valid JSON.',
}[reason]);

export const createRxNormValidationAdapter = (
    options: RxNormValidationAdapterOptions = {},
): TerminologyValidationAdapter => {
    const endpoint = normalizeTerminologyEndpoint(
        options.endpoint || 'https://rxnav.nlm.nih.gov/REST',
    );
    const fetchImpl = resolveFetch(options.fetchImpl);
    const timeoutMs = resolveTerminologyTimeoutMs(options.timeoutMs);
    const maxResponseBytes = resolveTerminologyResponseLimitBytes(
        options.maxResponseBytes,
    );
    const id = options.id || 'nlm-rxnorm-properties';

    return {
        id,
        name: options.name || 'NLM RxNorm active-concept lookup',
        mode: 'rxnorm-properties',
        externalRequest: true,
        supportedSystems: [TERMINOLOGY_URIS.rxnorm],
        privacyBoundary:
            'Sends only the numeric RxCUI in the URL path. It does not send a medication name, patient identifier, record, note, document, or source excerpt, and it never performs fuzzy concept search.',
        attribution: NLM_RXNORM_ATTRIBUTION,
        validateCode: async input => {
            const request = normalizeCodeValidationRequest(input);
            if (request.system !== TERMINOLOGY_URIS.rxnorm) {
                return createTerminologyResult({
                    adapterId: id,
                    status: 'indeterminate',
                    request,
                    message:
                        'This adapter validates RxNorm identifiers only. No network request was made.',
                    externalRequest: false,
                });
            }
            if (!/^[1-9]\d{0,11}$/.test(request.code)) {
                return createTerminologyResult({
                    adapterId: id,
                    status: 'invalid',
                    request,
                    message:
                        'RxCUI must be a positive numeric identifier of up to 12 digits.',
                    externalRequest: false,
                });
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const response = await fetchImpl(
                    buildRxNormPropertiesUrl(endpoint, request.code),
                    {
                        method: 'GET',
                        headers: { Accept: 'application/json' },
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
                            'The RxNorm API response was redirected; concept status is unknown.',
                        externalRequest: true,
                    });
                }
                if (!response.ok) {
                    return createTerminologyResult({
                        adapterId: id,
                        status: 'indeterminate',
                        request,
                        message:
                            `The RxNorm API returned HTTP ${response.status}; concept status is unknown.`,
                        externalRequest: true,
                    });
                }

                const bounded = await readBoundedJsonResponse(
                    response,
                    maxResponseBytes,
                );
                if ('reason' in bounded) {
                    return createTerminologyResult({
                        adapterId: id,
                        status: 'indeterminate',
                        request,
                        message: responseFailureMessage(bounded.reason),
                        externalRequest: true,
                    });
                }
                const root = objectValue(bounded.payload);
                const properties = root
                    ? objectValue(root.properties)
                    : null;
                if (!properties) {
                    return createTerminologyResult({
                        adapterId: id,
                        status: 'invalid',
                        request,
                        message:
                            'The RxCUI was not found in the active RxNorm data set.',
                        externalRequest: true,
                    });
                }
                const returnedRxcui = typeof properties.rxcui === 'string'
                    ? properties.rxcui
                    : undefined;
                const preferredDisplay = typeof properties.name === 'string'
                    ? properties.name
                    : undefined;
                if (!returnedRxcui) {
                    return createTerminologyResult({
                        adapterId: id,
                        status: 'indeterminate',
                        request,
                        preferredDisplay,
                        message:
                            'The RxNorm API did not identify the returned concept; concept status is unknown.',
                        externalRequest: true,
                    });
                }
                if (returnedRxcui !== request.code) {
                    return createTerminologyResult({
                        adapterId: id,
                        status: 'indeterminate',
                        request,
                        preferredDisplay,
                        message:
                            'The RxNorm API returned a different RxCUI; concept status is unknown.',
                        externalRequest: true,
                    });
                }
                if (typeof properties.suppress === 'string'
                    && properties.suppress !== 'N') {
                    return createTerminologyResult({
                        adapterId: id,
                        status: 'indeterminate',
                        request,
                        preferredDisplay,
                        message:
                            'The RxNorm API returned an unexpected suppression status; active concept status is unknown.',
                        externalRequest: true,
                    });
                }
                if (request.version) {
                    return createTerminologyResult({
                        adapterId: id,
                        status: 'indeterminate',
                        request,
                        preferredDisplay,
                        message:
                            'The RxCUI is active in the current RxNorm data set, but this endpoint cannot verify the supplied historical version.',
                        warnings: [
                            'Current active status must not be treated as validation of a version-specific historical coding.',
                        ],
                        externalRequest: true,
                    });
                }
                return createTerminologyResult({
                    adapterId: id,
                    status: 'valid',
                    request,
                    preferredDisplay,
                    message:
                        'The RxCUI is present in the active RxNorm data set.',
                    warnings: request.display
                        && preferredDisplay
                        && request.display !== preferredDisplay
                        ? ['The supplied display differs from the current RxNorm concept name.']
                        : [],
                    externalRequest: true,
                });
            } catch (error) {
                return createTerminologyResult({
                    adapterId: id,
                    status: 'indeterminate',
                    request,
                    message:
                        error instanceof Error && error.name === 'AbortError'
                            ? 'RxNorm validation timed out; concept status is unknown.'
                            : 'RxNorm validation could not be completed; concept status is unknown.',
                    externalRequest: true,
                });
            } finally {
                clearTimeout(timeout);
            }
        },
    };
};
