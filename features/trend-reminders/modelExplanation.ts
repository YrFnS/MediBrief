import { SYSTEM_INSTRUCTION } from '../../constants';
import { completeOpenRouterChat } from '../../services/openRouter';
import { scrubPII } from '../../utils/piiScrubber';

export interface GenerateTrendModelExplanationInput {
    prompt: string;
    apiKey: string;
    model: string;
    signal?: AbortSignal;
}

const TREND_SYSTEM_BOUNDARY = `${SYSTEM_INSTRUCTION}\n\nTREND EXPLANATION MODE:\n- Use only the local evidence supplied in the current request.\n- External tools and web search are unavailable.\n- Describe recorded arithmetic only. Do not infer clinical significance, cause, prognosis, treatment effect, diagnosis, or a recommended action.\n- Preserve exact local citations.`;

export const generateTrendModelExplanationText = async ({
    prompt,
    apiKey,
    model,
    signal,
}: GenerateTrendModelExplanationInput): Promise<string> => completeOpenRouterChat({
    apiKey,
    model,
    signal,
    temperature: 0.1,
    title: 'MediBrief Recorded Trend Explanation',
    messages: [
        { role: 'system', content: TREND_SYSTEM_BOUNDARY },
        { role: 'user', content: scrubPII(prompt) },
    ],
});
