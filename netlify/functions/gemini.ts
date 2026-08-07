import { GoogleGenAI } from '@google/genai';

interface GeminiRequest {
    model?: unknown;
    contents?: unknown;
    config?: unknown;
}

const json = (statusCode: number, body: Record<string, unknown>) => ({
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
});

export const handler = async (event: {
    httpMethod?: string;
    body?: string | null;
}) => {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return json(503, { error: 'Gemini service is not configured.' });

    let request: GeminiRequest;
    try {
        request = JSON.parse(event.body || '{}') as GeminiRequest;
    } catch {
        return json(400, { error: 'Invalid request.' });
    }

    if (typeof request.model !== 'string' || !request.model.trim()
        || request.contents === undefined) {
        return json(400, { error: 'Invalid Gemini request.' });
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: request.model,
            contents: request.contents as never,
            ...(request.config !== undefined
                ? { config: request.config as never }
                : {}),
        });
        return json(200, { text: response.text || '' });
    } catch (error) {
        const status = typeof error === 'object' && error !== null
            && 'status' in error && typeof error.status === 'number'
            ? error.status
            : 502;
        return json(status === 429 ? 429 : 502, {
            error: status === 429
                ? 'Gemini is temporarily rate limited.'
                : 'Gemini request failed.',
        });
    }
};
