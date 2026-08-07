import { generateGeminiContent } from '../../services/geminiProxy';
import { SYSTEM_INSTRUCTION } from '../../constants';
import { AIProvider } from '../settings/useSettingsStore';
import { scrubPII } from '../../utils/piiScrubber';

export interface GenerateTrendModelExplanationInput {
    prompt: string;
    provider: AIProvider;
    apiKey?: string;
    model: string;
    signal?: AbortSignal;
}

const TREND_SYSTEM_BOUNDARY = `${SYSTEM_INSTRUCTION}\n\nTREND EXPLANATION MODE:\n- Use only the local evidence supplied in the current request.\n- External tools and web search are unavailable.\n- Describe recorded arithmetic only. Do not infer clinical significance, cause, prognosis, treatment effect, diagnosis, or a recommended action.\n- Preserve exact local citations.`;

const generateGeminiExplanation = async ({
    prompt,
    apiKey,
    model,
    signal,
}: GenerateTrendModelExplanationInput): Promise<string> => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const response = await generateGeminiContent({
        model,
        contents: scrubPII(prompt),
        config: {
            systemInstruction: TREND_SYSTEM_BOUNDARY,
            temperature: 0.1,
        },
    });
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const text = response.text?.trim();
    if (!text) throw new Error('The configured Gemini model returned no trend explanation text.');
    return text;
};

const generateOpenRouterExplanation = async ({
    prompt,
    apiKey,
    model,
    signal,
}: GenerateTrendModelExplanationInput): Promise<string> => {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.origin,
            'X-Title': 'MediBrief Recorded Trend Explanation',
        },
        body: JSON.stringify({
            model,
            stream: false,
            temperature: 0.1,
            messages: [
                { role: 'system', content: TREND_SYSTEM_BOUNDARY },
                { role: 'user', content: scrubPII(prompt) },
            ],
        }),
    });
    if (!response.ok) {
        throw new Error(`OpenRouter trend explanation failed with HTTP ${response.status}.`);
    }
    const payload = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('The configured OpenRouter model returned no trend explanation text.');
    return text;
};

export const generateTrendModelExplanationText = async (
    input: GenerateTrendModelExplanationInput,
): Promise<string> => {
    if (input.provider === AIProvider.OpenRouter && !input.apiKey?.trim()) {
        throw new Error('An OpenRouter key is required for optional model wording.');
    }
    if (!input.model.trim()) {
        throw new Error('A model name is required for optional model wording.');
    }
    return input.provider === AIProvider.Gemini
        ? generateGeminiExplanation(input)
        : generateOpenRouterExplanation(input);
};
