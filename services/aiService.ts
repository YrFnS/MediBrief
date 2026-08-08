import { MODEL_CONFIGS, SYSTEM_INSTRUCTION } from '../constants';
import type { ChatMessage, ChatMode, UploadedFile } from '../types';
import { scrubPII } from '../utils/piiScrubber';
import {
    streamOpenRouterChat,
    type OpenRouterMessage,
    type OpenRouterMessageContent,
} from './openRouter';

interface GenerateResponseOptions {
    file?: UploadedFile;
    responseType?: 'json' | 'text';
    apiKey: string;
    model: string;
    signal?: AbortSignal;
}

const historyMessage = (message: ChatMessage): OpenRouterMessage => ({
    role: message.role === 'model' ? 'assistant' : 'user',
    content: message.role === 'user'
        ? scrubPII(message.content)
        : message.content,
});

export const generateResponseStream = async function* (
    prompt: string,
    history: ChatMessage[],
    mode: ChatMode,
    options: GenerateResponseOptions,
): AsyncGenerator<{
    text: string;
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
}> {
    const contextLimit = MODEL_CONFIGS[mode].contextLimit;
    const recentHistory = contextLimit > 0
        ? history.slice(-contextLimit)
        : [];
    const messages: OpenRouterMessage[] = [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        ...recentHistory.map(historyMessage),
    ];

    let userContent: OpenRouterMessageContent = scrubPII(prompt);
    if (options.file?.base64) {
        if (options.file.type.startsWith('image/')) {
            userContent = [
                { type: 'text', text: scrubPII(prompt) },
                {
                    type: 'image_url',
                    image_url: {
                        url: `data:${options.file.type};base64,${options.file.base64}`,
                    },
                },
            ];
        } else {
            userContent = [
                { type: 'text', text: scrubPII(prompt) },
                {
                    type: 'file',
                    file: {
                        filename: options.file.file.name,
                        file_data: `data:${options.file.type};base64,${options.file.base64}`,
                    },
                },
            ];
        }
    }
    messages.push({ role: 'user', content: userContent });

    for await (const text of streamOpenRouterChat({
        apiKey: options.apiKey,
        model: options.model,
        messages,
        signal: options.signal,
        responseFormat: options.responseType === 'json' ? 'json' : undefined,
        title: 'MediBrief Clinical Assistant',
    })) {
        yield {
            text,
            candidates: [{ content: { parts: [{ text }] } }],
        };
    }
};
