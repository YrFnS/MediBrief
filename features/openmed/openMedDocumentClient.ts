import {
    parseOpenMedDocumentHealth,
    parseOpenMedDocumentResponse,
} from './documentSchemas';
import type {
    OpenMedDocumentExtractOptions,
    OpenMedDocumentExtractionResponse,
    OpenMedDocumentHealth,
} from './documentTypes';
import {
    DEFAULT_OPENMED_HEALTH_TIMEOUT_MS,
    normalizeOpenMedBaseUrl,
    OpenMedClientError,
} from './openMedClient';
import { parseOpenMedErrorEnvelope } from './schemas';
import type { OpenMedClientConfig } from './types';

const fetchDocumentJson = async ({
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
        controller.abort(new Error('OpenMed document request timed out.'));
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
                `OpenMed document request failed with HTTP ${response.status}.`,
            );
            throw new OpenMedClientError(envelope.message, {
                code: envelope.code || (response.status === 404
                    ? 'document-unavailable'
                    : 'document-http-error'),
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
                    'OpenMed document extraction was cancelled.',
                    { code: 'aborted', cause: error },
                );
            }
            if (timedOut) {
                throw new OpenMedClientError(
                    'OpenMed document extraction timed out.',
                    { code: 'timeout', cause: error },
                );
            }
        }
        throw new OpenMedClientError(
            'MediBrief could not reach the local OpenMed document bridge. Run openmed_bridge.app with multimodal dependencies installed.',
            { code: 'document-unavailable', cause: error },
        );
    } finally {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', parentAbort);
    }
};

export const checkOpenMedDocumentHealth = async ({
    config,
    signal,
    timeoutMs = DEFAULT_OPENMED_HEALTH_TIMEOUT_MS,
}: {
    config: OpenMedClientConfig;
    signal?: AbortSignal;
    timeoutMs?: number;
}): Promise<OpenMedDocumentHealth> => {
    const endpoint = normalizeOpenMedBaseUrl(config.baseUrl);
    try {
        const payload = await fetchDocumentJson({
            config,
            path: '/medibrief/documents/health',
            method: 'GET',
            signal,
            timeoutMs,
        });
        return parseOpenMedDocumentHealth(payload, endpoint);
    } catch (error) {
        const clientError = error instanceof OpenMedClientError
            ? error
            : new OpenMedClientError('Document bridge health check failed.', {
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
            availableOcrEngines: [],
            ocrAvailable: false,
        };
    }
};

export const extractOpenMedDocument = async ({
    config,
    options,
}: {
    config: OpenMedClientConfig;
    options: OpenMedDocumentExtractOptions;
}): Promise<OpenMedDocumentExtractionResponse> => {
    if (!options.documentId.trim()) {
        throw new Error('Document extraction requires a document ID.');
    }
    if (!options.fileName.trim()) {
        throw new Error('Document extraction requires a filename.');
    }
    if (!options.mimeType.trim()) {
        throw new Error('Document extraction requires a MIME type.');
    }
    if (!options.base64.trim()) {
        throw new Error('Document extraction requires local file data.');
    }

    const payload = await fetchDocumentJson({
        config,
        path: '/medibrief/documents/extract',
        method: 'POST',
        body: {
            document_id: options.documentId,
            file_name: options.fileName,
            mime_type: options.mimeType,
            document_base64: options.base64,
            ocr_mode: options.ocrMode,
            ocr_engine: options.ocrEngine,
            languages: options.languages,
            resolution: options.resolution,
        },
        signal: options.signal,
    });

    try {
        return parseOpenMedDocumentResponse({
            input: payload,
            expectedDocumentId: options.documentId,
            expectedFileName: options.fileName,
        });
    } catch (error) {
        throw new OpenMedClientError(
            'OpenMed returned an invalid page-aware document extraction response.',
            { code: 'invalid-response', cause: error },
        );
    }
};
