import {
    parseOpenMedAnalysisResponse,
    parseOpenMedErrorEnvelope,
    parseOpenMedHealthResponse,
} from './schemas';
import type {
    OpenMedAnalysisResponse,
    OpenMedAnalyzeOptions,
    OpenMedClientConfig,
    OpenMedServiceHealth,
} from './types';

export const DEFAULT_OPENMED_BASE_URL = 'http://127.0.0.1:8080';
export const DEFAULT_OPENMED_TIMEOUT_MS = 300_000;
export const DEFAULT_OPENMED_HEALTH_TIMEOUT_MS = 5_000;

export class OpenMedClientError extends Error {
    readonly code?: string;
    readonly status?: number;
    readonly details?: unknown;
    readonly requestId?: string;

    constructor(message: string, options: {
        code?: string;
        status?: number;
        details?: unknown;
        requestId?: string;
        cause?: unknown;
    } = {}) {
        super(message, options.cause !== undefined
            ? { cause: options.cause }
            : undefined);
        this.name = 'OpenMedClientError';
        this.code = options.code;
        this.status = options.status;
        this.details = options.details;
        this.requestId = options.requestId;
    }
}

export const normalizeOpenMedBaseUrl = (value: string): string => {
    const raw = value.trim() || DEFAULT_OPENMED_BASE_URL;
    let parsed: URL;
    try {
        parsed = new URL(raw);
    } catch {
        throw new Error('OpenMed endpoint must be a valid HTTP or HTTPS URL.');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('OpenMed endpoint must use HTTP or HTTPS.');
    }
    if (parsed.username || parsed.password) {
        throw new Error('OpenMed credentials must not be embedded in the URL.');
    }
    parsed.hash = '';
    parsed.search = '';
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    return parsed.toString().replace(/\/$/, '');
};

const combineAbortSignals = ({
    signal,
    timeoutMs,
}: {
    signal?: AbortSignal;
    timeoutMs: number;
}) => {
    const controller = new AbortController();
    let timedOut = false;

    const abortFromParent = () => controller.abort(signal?.reason);
    if (signal?.aborted) abortFromParent();
    signal?.addEventListener('abort', abortFromParent, { once: true });

    const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort(new Error('OpenMed request timed out.'));
    }, timeoutMs);

    return {
        signal: controller.signal,
        didTimeOut: () => timedOut,
        cleanup: () => {
            clearTimeout(timeout);
            signal?.removeEventListener('abort', abortFromParent);
        },
    };
};

const readResponseBody = async (response: Response): Promise<unknown> => {
    const text = await response.text();
    if (!text) return null;
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return text;
    }
};

const requestJson = async ({
    config,
    path,
    method,
    body,
    signal,
    timeoutMs,
}: {
    config: OpenMedClientConfig;
    path: string;
    method: 'GET' | 'POST';
    body?: unknown;
    signal?: AbortSignal;
    timeoutMs?: number;
}): Promise<unknown> => {
    const baseUrl = normalizeOpenMedBaseUrl(config.baseUrl);
    const abort = combineAbortSignals({
        signal,
        timeoutMs: timeoutMs ?? config.timeoutMs,
    });

    const headers: Record<string, string> = {
        Accept: 'application/json',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (config.apiKey) headers['X-API-Key'] = config.apiKey;
    if (config.bearerToken) {
        headers.Authorization = `Bearer ${config.bearerToken}`;
    }

    try {
        const response = await fetch(`${baseUrl}${path}`, {
            method,
            headers,
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
            signal: abort.signal,
        });
        const payload = await readResponseBody(response);
        if (!response.ok) {
            const fallback = `OpenMed request failed with HTTP ${response.status}.`;
            const envelope = parseOpenMedErrorEnvelope(payload, fallback);
            throw new OpenMedClientError(envelope.message, {
                code: envelope.code,
                status: response.status,
                details: envelope.details,
                requestId: response.headers.get('X-Request-ID') || undefined,
            });
        }
        return payload;
    } catch (error) {
        if (error instanceof OpenMedClientError) throw error;
        if (abort.signal.aborted) {
            if (signal?.aborted) {
                throw new OpenMedClientError('OpenMed request was cancelled.', {
                    code: 'aborted',
                    cause: error,
                });
            }
            if (abort.didTimeOut()) {
                throw new OpenMedClientError('OpenMed request timed out.', {
                    code: 'timeout',
                    cause: error,
                });
            }
        }
        throw new OpenMedClientError(
            'OpenMed service could not be reached. Check the local service, endpoint, CORS origin, and trusted-host configuration.',
            { code: 'unavailable', cause: error },
        );
    } finally {
        abort.cleanup();
    }
};

export const checkOpenMedHealth = async ({
    config,
    signal,
    timeoutMs = DEFAULT_OPENMED_HEALTH_TIMEOUT_MS,
}: {
    config: OpenMedClientConfig;
    signal?: AbortSignal;
    timeoutMs?: number;
}): Promise<OpenMedServiceHealth> => {
    const endpoint = normalizeOpenMedBaseUrl(config.baseUrl);
    try {
        const payload = await requestJson({
            config,
            path: '/health',
            method: 'GET',
            signal,
            timeoutMs,
        });
        let health;
        try {
            health = parseOpenMedHealthResponse(payload);
        } catch (error) {
            return {
                available: false,
                endpoint,
                status: 'invalid-response',
                message: 'OpenMed responded, but its health payload was not valid.',
            };
        }

        const available = ['ok', 'ready'].includes(
            health.status.trim().toLowerCase(),
        );
        return {
            available,
            endpoint,
            status: available ? 'available' : 'invalid-response',
            message: available
                ? 'OpenMed local service is reachable.'
                : `OpenMed reported status “${health.status}”.`,
            ...(health.service ? { service: health.service } : {}),
            ...(health.version ? { version: health.version } : {}),
            ...(health.profile ? { profile: health.profile } : {}),
        };
    } catch (error) {
        const clientError = error instanceof OpenMedClientError
            ? error
            : new OpenMedClientError('OpenMed health check failed.', {
                cause: error,
            });
        return {
            available: false,
            endpoint,
            status: clientError.code === 'aborted'
                ? 'aborted'
                : 'unavailable',
            message: clientError.message,
        };
    }
};

export const analyzeOpenMedText = async ({
    config,
    options,
}: {
    config: OpenMedClientConfig;
    options: OpenMedAnalyzeOptions;
}): Promise<OpenMedAnalysisResponse> => {
    const text = options.text;
    const modelName = options.modelName.trim();
    if (!text.trim()) throw new Error('OpenMed analysis text must not be blank.');
    if (!modelName) throw new Error('OpenMed model name must not be blank.');
    if (
        !Number.isFinite(options.confidenceThreshold)
        || options.confidenceThreshold < 0
        || options.confidenceThreshold > 1
    ) {
        throw new Error('OpenMed confidence threshold must be between 0 and 1.');
    }

    const payload = await requestJson({
        config,
        path: '/analyze',
        method: 'POST',
        signal: options.signal,
        body: {
            text,
            model_name: modelName,
            confidence_threshold: options.confidenceThreshold,
            group_entities: options.groupEntities ?? false,
            aggregation_strategy: options.aggregationStrategy || 'simple',
            ...(options.keepAlive ? { keep_alive: options.keepAlive } : {}),
        },
    });

    try {
        return parseOpenMedAnalysisResponse({
            input: payload,
            expectedText: text,
            requestedModel: modelName,
        });
    } catch (error) {
        throw new OpenMedClientError(
            'OpenMed returned an invalid analysis response.',
            { code: 'invalid-response', cause: error },
        );
    }
};
