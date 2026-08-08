export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
export const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

type JsonRecord = Record<string, unknown>;

export interface OpenRouterModel {
    id: string;
    canonicalSlug?: string;
    name: string;
    description: string;
    contextLength?: number;
    maxCompletionTokens?: number;
    modality?: string;
    inputModalities: string[];
    outputModalities: string[];
    pricing: Record<string, string>;
    supportedParameters: string[];
}

export type OpenRouterMessageContent = string | Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
    | { type: 'file'; file: { filename: string; file_data: string } }
>;

export interface OpenRouterMessage {
    role: 'system' | 'user' | 'assistant';
    content: OpenRouterMessageContent;
}

const record = (value: unknown): JsonRecord | null =>
    typeof value === 'object' && value !== null && !Array.isArray(value)
        ? value as JsonRecord
        : null;

const strings = (value: unknown): string[] =>
    Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : [];

export const parseOpenRouterModels = (payload: unknown): OpenRouterModel[] => {
    const root = record(payload);
    if (!root || !Array.isArray(root.data)) {
        throw new Error('OpenRouter returned an invalid model catalog.');
    }

    return root.data.flatMap(item => {
        const model = record(item);
        if (!model || typeof model.id !== 'string' || !model.id.trim()) return [];

        const architecture = record(model.architecture);
        const pricingRecord = record(model.pricing);
        const topProvider = record(model.top_provider);
        const pricing = Object.fromEntries(
            Object.entries(pricingRecord || {}).flatMap(([key, value]) =>
                typeof value === 'string' || typeof value === 'number'
                    ? [[key, String(value)]]
                    : []),
        );

        return [{
            id: model.id,
            ...(typeof model.canonical_slug === 'string'
                ? { canonicalSlug: model.canonical_slug }
                : {}),
            name: typeof model.name === 'string' && model.name.trim()
                ? model.name
                : model.id,
            description: typeof model.description === 'string'
                ? model.description
                : '',
            ...(typeof model.context_length === 'number'
                ? { contextLength: model.context_length }
                : {}),
            ...(typeof topProvider?.max_completion_tokens === 'number'
                ? { maxCompletionTokens: topProvider.max_completion_tokens }
                : {}),
            ...(typeof architecture?.modality === 'string'
                ? { modality: architecture.modality }
                : {}),
            inputModalities: strings(architecture?.input_modalities),
            outputModalities: strings(architecture?.output_modalities),
            pricing,
            supportedParameters: strings(model.supported_parameters),
        }];
    });
};

export const searchOpenRouterModels = (
    models: OpenRouterModel[],
    query: string,
): OpenRouterModel[] => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return models;

    return models.filter(model => {
        const haystack = [
            model.id,
            model.canonicalSlug,
            model.name,
            model.description,
            model.modality,
            ...model.inputModalities,
            ...model.outputModalities,
            ...model.supportedParameters,
        ].filter(Boolean).join(' ').toLowerCase();
        return terms.every(term => haystack.includes(term));
    });
};

export const isFreeOpenRouterModel = (model: OpenRouterModel): boolean => {
    const prices = Object.values(model.pricing).map(Number);
    return prices.length > 0
        && prices.every(price => Number.isFinite(price) && price === 0);
};

export const formatOpenRouterTokenPrice = (price?: string): string => {
    const amount = Number(price);
    if (!Number.isFinite(amount)) return 'Not listed';
    if (amount === 0) return 'Free';
    return `$${(amount * 1_000_000).toLocaleString(undefined, {
        maximumFractionDigits: 4,
    })}/1M tokens`;
};

export const fetchOpenRouterModels = async (
    signal?: AbortSignal,
): Promise<OpenRouterModel[]> => {
    const response = await fetch(OPENROUTER_MODELS_URL, {
        method: 'GET',
        signal,
        headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
        throw new Error(`OpenRouter model catalog failed with HTTP ${response.status}.`);
    }
    return parseOpenRouterModels(await response.json());
};

export const redactOpenRouterSecrets = (
    value: unknown,
    secrets: string[] = [],
): string => {
    let message = value instanceof Error ? value.message : String(value);
    for (const secret of secrets.filter(Boolean)) {
        message = message.split(secret).join('[redacted]');
    }
    return message
        .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]')
        .replace(/sk-or-v1-[A-Za-z0-9_-]+/g, '[redacted]');
};

interface BuildOpenRouterRequestOptions {
    apiKey: string;
    model: string;
    messages: OpenRouterMessage[];
    stream: boolean;
    signal?: AbortSignal;
    temperature?: number;
    responseFormat?: 'json';
    appOrigin?: string;
    title?: string;
}

export const buildOpenRouterChatRequest = ({
    apiKey,
    model,
    messages,
    stream,
    signal,
    temperature,
    responseFormat,
    appOrigin = typeof window === 'undefined' ? undefined : window.location.origin,
    title = 'MediBrief',
}: BuildOpenRouterRequestOptions): { url: string; init: RequestInit } => {
    if (!apiKey.trim()) throw new Error('Enter an OpenRouter API key in Settings.');
    if (!model.trim()) throw new Error('Select or enter an OpenRouter model in Settings.');

    return {
        url: OPENROUTER_CHAT_URL,
        init: {
            method: 'POST',
            signal,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                ...(appOrigin ? { 'HTTP-Referer': appOrigin } : {}),
                'X-OpenRouter-Title': title,
            },
            body: JSON.stringify({
                model,
                messages,
                stream,
                ...(temperature === undefined ? {} : { temperature }),
                ...(responseFormat === 'json'
                    ? { response_format: { type: 'json_object' } }
                    : {}),
            }),
        },
    };
};

const requestError = (status: number): Error => {
    if (status === 401 || status === 403) {
        return new Error('OpenRouter rejected the API key. Update it in Settings.');
    }
    if (status === 402) {
        return new Error('OpenRouter reports insufficient credits for the selected model.');
    }
    if (status === 429) {
        return new Error('OpenRouter is rate limited. Wait a moment and try again.');
    }
    if (status === 400 || status === 404) {
        return new Error('OpenRouter rejected the selected model or request. Check the model ID.');
    }
    return new Error(`OpenRouter request failed with HTTP ${status}.`);
};

export const completeOpenRouterChat = async (
    options: Omit<BuildOpenRouterRequestOptions, 'stream'>,
): Promise<string> => {
    const request = buildOpenRouterChatRequest({ ...options, stream: false });
    const response = await fetch(request.url, request.init);
    if (!response.ok) throw requestError(response.status);

    const payload = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) {
        throw new Error('The selected OpenRouter model returned no text.');
    }
    return text;
};

export async function* streamOpenRouterChat(
    options: Omit<BuildOpenRouterRequestOptions, 'stream'>,
): AsyncGenerator<string> {
    const request = buildOpenRouterChatRequest({ ...options, stream: true });
    const response = await fetch(request.url, request.init);
    if (!response.ok) throw requestError(response.status);
    if (!response.body) throw new Error('OpenRouter returned no response stream.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });

        let newline = buffer.indexOf('\n');
        while (newline >= 0) {
            const line = buffer.slice(0, newline).trim();
            buffer = buffer.slice(newline + 1);
            newline = buffer.indexOf('\n');
            if (!line.startsWith('data:')) continue;

            const data = line.slice(5).trim();
            if (data === '[DONE]') return;
            try {
                const payload = JSON.parse(data) as {
                    choices?: Array<{ delta?: { content?: string } }>;
                };
                const text = payload.choices?.[0]?.delta?.content;
                if (typeof text === 'string' && text) yield text;
            } catch {
                // Ignore incomplete or non-JSON provider events.
            }
        }

        if (done) return;
    }
}
