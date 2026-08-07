export interface GeminiProxyRequest {
    model: string;
    contents: unknown;
    config?: unknown;
}

export interface GeminiProxyResponse {
    text?: string;
}

/**
 * Calls the same-origin Netlify function. Gemini credentials never enter the
 * browser bundle or request payload; the function reads GEMINI_API_KEY server-side.
 */
export const generateGeminiContent = async (
    request: GeminiProxyRequest,
    signal?: AbortSignal,
): Promise<GeminiProxyResponse> => {
    const response = await fetch('/.netlify/functions/gemini', {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
    });

    const payload = await response.json().catch(() => ({})) as {
        text?: string;
        error?: string;
    };
    if (!response.ok) {
        throw new Error(payload.error || `Gemini proxy failed with HTTP ${response.status}.`);
    }
    return { text: payload.text || '' };
};
