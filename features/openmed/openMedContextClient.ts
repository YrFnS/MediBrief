import {
    parseOpenMedContextHealthResponse,
    parseOpenMedContextResponse,
} from './contextSchemas';
import type {
    OpenMedContextHealth,
    OpenMedContextRequestSpan,
    OpenMedContextResponse,
} from './contextTypes';
import {
    DEFAULT_OPENMED_HEALTH_TIMEOUT_MS,
    normalizeOpenMedBaseUrl,
    OpenMedClientError,
} from './openMedClient';
import { parseOpenMedErrorEnvelope } from './schemas';
import type {
    OpenMedCandidateEntity,
    OpenMedClientConfig,
} from './types';

const contextSpanId = (
    entity: OpenMedCandidateEntity,
    index: number,
): string => [
    entity.kind,
    entity.start,
    entity.end,
    index,
].join(':');

export const buildOpenMedContextSpans = (
    text: string,
    entities: OpenMedCandidateEntity[],
): OpenMedContextRequestSpan[] => entities.map((entity, index) => ({
    id: contextSpanId(entity, index),
    kind: entity.kind,
    text: text.slice(entity.start, entity.end),
    label: entity.label,
    start: entity.start,
    end: entity.end,
}));

const fetchContextJson = async ({
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
    const controller = new AbortController();
    let timedOut = false;
    const parentAbort = () => controller.abort(signal?.reason);
    if (signal?.aborted) parentAbort();
    signal?.addEventListener('abort', parentAbort, { once: true });
    const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort(new Error('OpenMed context request timed out.'));
    }, timeoutMs ?? config.timeoutMs);

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (config.apiKey) headers['X-API-Key'] = config.apiKey;
    if (config.bearerToken) headers.Authorization = `Bearer ${config.bearerToken}`;

    try {
        const response = await fetch(`${baseUrl}${path}`, {
            method,
            headers,
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
            signal: controller.signal,
        });
        const raw = await response.text();
        let payload: unknown = null;
        if (raw) {
            try {
                payload = JSON.parse(raw) as unknown;
            } catch {
                payload = raw;
            }
        }
        if (!response.ok) {
            const envelope = parseOpenMedErrorEnvelope(
                payload,
                `OpenMed context request failed with HTTP ${response.status}.`,
            );
            throw new OpenMedClientError(envelope.message, {
                code: envelope.code || (response.status === 404
                    ? 'context-unavailable'
                    : 'context-http-error'),
                status: response.status,
                details: envelope.details,
                requestId: response.headers.get('X-Request-ID') || undefined,
            });
        }
        return payload;
    } catch (error) {
        if (error instanceof OpenMedClientError) throw error;
        if (controller.signal.aborted) {
            if (signal?.aborted) {
                throw new OpenMedClientError(
                    'OpenMed context request was cancelled.',
                    { code: 'aborted', cause: error },
                );
            }
            if (timedOut) {
                throw new OpenMedClientError(
                    'OpenMed context request timed out.',
                    { code: 'timeout', cause: error },
                );
            }
        }
        throw new OpenMedClientError(
            'MediBrief could not reach the OpenMed context bridge. Run openmed_bridge.app or leave assertion axes unknown.',
            { code: 'context-unavailable', cause: error },
        );
    } finally {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', parentAbort);
    }
};

export const checkOpenMedContextHealth = async ({
    config,
    signal,
    timeoutMs = DEFAULT_OPENMED_HEALTH_TIMEOUT_MS,
}: {
    config: OpenMedClientConfig;
    signal?: AbortSignal;
    timeoutMs?: number;
}): Promise<OpenMedContextHealth> => {
    const endpoint = normalizeOpenMedBaseUrl(config.baseUrl);
    try {
        const payload = await fetchContextJson({
            config,
            path: '/medibrief/context/health',
            method: 'GET',
            signal,
            timeoutMs,
        });
        return parseOpenMedContextHealthResponse(payload, endpoint);
    } catch (error) {
        const clientError = error instanceof OpenMedClientError
            ? error
            : new OpenMedClientError('OpenMed context health check failed.', {
                cause: error,
            });
        return {
            available: false,
            endpoint,
            status: clientError.code === 'aborted'
                ? 'aborted'
                : clientError.code === 'invalid-response'
                    ? 'invalid-response'
                    : 'unavailable',
            message: clientError.message,
            features: [],
        };
    }
};

export const analyzeOpenMedEntityContext = async ({
    config,
    text,
    entities,
    language = 'en',
    signal,
}: {
    config: OpenMedClientConfig;
    text: string;
    entities: OpenMedCandidateEntity[];
    language?: string;
    signal?: AbortSignal;
}): Promise<OpenMedContextResponse> => {
    if (!text.trim()) throw new Error('OpenMed context text must not be blank.');
    if (entities.length === 0) {
        return {
            text,
            engine: 'OpenMed clinical ConText',
            bridgeVersion: '1',
            language,
            evaluatedAt: new Date().toISOString(),
            results: [],
        };
    }

    const spans = buildOpenMedContextSpans(text, entities);
    const payload = await fetchContextJson({
        config,
        path: '/medibrief/context',
        method: 'POST',
        body: { text, spans, language },
        signal,
    });
    try {
        return parseOpenMedContextResponse({
            input: payload,
            expectedText: text,
            requestedSpans: spans,
        });
    } catch (error) {
        throw new OpenMedClientError(
            'OpenMed returned an invalid clinical-context response.',
            { code: 'invalid-response', cause: error },
        );
    }
};
