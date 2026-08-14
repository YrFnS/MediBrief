import type {
    FhirParametersResource,
    TerminologyCodeValidationRequest,
    TerminologyCodeValidationResult,
    TerminologyValidationStatus,
} from './types';

export const NLM_RXNORM_ATTRIBUTION =
    'This product uses publicly available data from the U.S. National Library of Medicine (NLM), National Institutes of Health, Department of Health and Human Services; NLM is not responsible for the product and does not endorse or recommend this or any other product.';

export const normalizeCodeValidationRequest = (
    request: TerminologyCodeValidationRequest,
): TerminologyCodeValidationRequest => ({
    system: request.system.trim(),
    code: request.code.trim(),
    ...(request.version?.trim()
        ? { version: request.version.trim() }
        : {}),
    ...(request.display?.trim()
        ? { display: request.display.trim() }
        : {}),
    ...(request.valueSetUrl?.trim()
        ? { valueSetUrl: request.valueSetUrl.trim() }
        : {}),
});

export const terminologyRequestFingerprint = (
    request: TerminologyCodeValidationRequest,
): string => {
    const normalized = normalizeCodeValidationRequest(request);
    return JSON.stringify([
        normalized.system,
        normalized.version || null,
        normalized.code,
        normalized.valueSetUrl || null,
    ]);
};

export const createTerminologyResult = ({
    adapterId,
    status,
    request: input,
    message,
    warnings = [],
    preferredDisplay,
    externalRequest,
}: {
    adapterId: string;
    status: TerminologyValidationStatus;
    request: TerminologyCodeValidationRequest;
    message: string;
    warnings?: string[];
    preferredDisplay?: string;
    externalRequest: boolean;
}): TerminologyCodeValidationResult => {
    const request = normalizeCodeValidationRequest(input);
    return {
        adapterId,
        status,
        system: request.system,
        code: request.code,
        ...(request.version ? { version: request.version } : {}),
        ...(request.display
            ? { requestedDisplay: request.display }
            : {}),
        ...(preferredDisplay ? { preferredDisplay } : {}),
        message,
        warnings,
        checkedAt: new Date().toISOString(),
        externalRequest,
        requestFingerprint: terminologyRequestFingerprint(request),
    };
};

const isLocalHostname = (hostname: string): boolean => [
    'localhost',
    '127.0.0.1',
    '[::1]',
    '::1',
].includes(hostname.toLowerCase());

export const normalizeTerminologyEndpoint = (input: string): string => {
    const url = new URL(input.trim());
    if (url.username || url.password) {
        throw new Error(
            'Terminology endpoint URLs must not contain credentials.',
        );
    }
    if (url.search || url.hash) {
        throw new Error(
            'Terminology endpoint URLs must not contain a query or fragment.',
        );
    }
    const localHttp = url.protocol === 'http:'
        && isLocalHostname(url.hostname);
    if (url.protocol !== 'https:' && !localHttp) {
        throw new Error(
            'Terminology endpoints require HTTPS, except for localhost development endpoints.',
        );
    }
    url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString().replace(/\/$/, '');
};

const parameter = (
    name: string,
    key: string,
    value: string,
): Record<string, unknown> => ({ name, [key]: value });

export const buildFhirValidateCodeParameters = (
    input: TerminologyCodeValidationRequest,
): FhirParametersResource => {
    const request = normalizeCodeValidationRequest(input);
    const parameters: Array<Record<string, unknown>> = [];
    if (request.valueSetUrl) {
        parameters.push(
            parameter('url', 'valueUri', request.valueSetUrl),
            parameter('system', 'valueUri', request.system),
        );
    } else {
        parameters.push(parameter('url', 'valueUri', request.system));
    }
    parameters.push(parameter('code', 'valueCode', request.code));
    if (request.version) {
        parameters.push(
            parameter('version', 'valueString', request.version),
        );
    }
    if (request.display) {
        parameters.push(
            parameter('display', 'valueString', request.display),
        );
    }
    return {
        resourceType: 'Parameters',
        parameter: parameters,
    };
};

export const objectValue = (
    value: unknown,
): Record<string, unknown> | null =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;

const parametersArray = (
    value: unknown,
): Array<Record<string, unknown>> => {
    const payload = objectValue(value);
    if (!payload || payload.resourceType !== 'Parameters') return [];
    return Array.isArray(payload.parameter)
        ? payload.parameter.flatMap(item => {
            const parsed = objectValue(item);
            return parsed ? [parsed] : [];
        })
        : [];
};

const namedParameter = (
    payload: unknown,
    name: string,
): Record<string, unknown> | undefined =>
    parametersArray(payload).find(item => item.name === name);

export const parseFhirValidateCodeResponse = (
    payload: unknown,
): {
    result?: boolean;
    message?: string;
    display?: string;
    system?: string;
    code?: string;
    version?: string;
} => {
    const resultParameter = namedParameter(payload, 'result');
    const messageParameter = namedParameter(payload, 'message');
    const displayParameter = namedParameter(payload, 'display');
    const systemParameter = namedParameter(payload, 'system');
    const codeParameter = namedParameter(payload, 'code');
    const versionParameter = namedParameter(payload, 'version');
    return {
        ...(typeof resultParameter?.valueBoolean === 'boolean'
            ? { result: resultParameter.valueBoolean }
            : {}),
        ...(typeof messageParameter?.valueString === 'string'
            ? { message: messageParameter.valueString }
            : {}),
        ...(typeof displayParameter?.valueString === 'string'
            ? { display: displayParameter.valueString }
            : {}),
        ...(typeof systemParameter?.valueUri === 'string'
            ? { system: systemParameter.valueUri }
            : {}),
        ...(typeof codeParameter?.valueCode === 'string'
            ? { code: codeParameter.valueCode }
            : {}),
        ...(typeof versionParameter?.valueString === 'string'
            ? { version: versionParameter.valueString }
            : {}),
    };
};

const unavailableFetch = (): typeof fetch =>
    (async () => {
        throw new Error('Fetch is not available in this runtime.');
    }) as typeof fetch;

export const resolveFetch = (fetchImpl?: typeof fetch): typeof fetch =>
    fetchImpl || globalThis.fetch || unavailableFetch();
