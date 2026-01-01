
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const USE_BACKEND = import.meta.env.VITE_USE_BACKEND === 'true';

/**
 * Generate response via backend proxy (for OAuth authentication)
 */
async function* generateViaBackend(
    prompt: string,
    history: any[],
    mode: string,
    options?: { file?: any; apiKey?: string }
): AsyncGenerator<any> {
    const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include', // Include session cookie
        body: JSON.stringify({
            messages: [
                ...history.map(msg => ({
                    role: msg.role,
                    content: msg.content,
                    parts: msg.parts
                })),
                {
                    role: 'user',
                    content: prompt
                }
            ],
            mode,
            file: options?.file,
            apiKey: options?.apiKey // Fallback to API key if provided
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `Backend request failed: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') return;

                try {
                    const parsed = JSON.parse(data);
                    if (parsed.error) {
                        throw new Error(parsed.error);
                    }
                    if (parsed.text) {
                        // Convert backend format to Gemini SDK format
                        // Include both the nested structure AND a 'text' getter
                        // to match how the Gemini SDK's GenerateContentResponse works
                        const responseChunk = {
                            candidates: [{
                                content: {
                                    parts: [{ text: parsed.text }],
                                    role: 'model'
                                }
                            }],
                            // Add text getter to match Gemini SDK interface
                            get text() {
                                return parsed.text;
                            }
                        };
                        yield responseChunk;
                    }
                } catch (e) {
                    console.error('Error parsing SSE:', e);
                }
            }
        }
    }
}

export { USE_BACKEND, generateViaBackend };
