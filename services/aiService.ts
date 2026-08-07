
import type { ChatMessage, ChatMode, UploadedFile } from '../types';
import { generateGeminiContent } from './geminiProxy';
import { MODEL_CONFIGS, SYSTEM_INSTRUCTION } from '../constants';
import { cleanJsonOutput } from '../utils';
import { scrubPII } from '../utils/piiScrubber';
import { AIProvider } from '../features/settings/useSettingsStore';

// Helper to extract a concise summary from a previous model response to substitute for an image
const extractImageInsights = async (modelResponseText: string, model: string): Promise<string | null> => {
    if (!modelResponseText) return null;
    
    try {
        const jsonStr = cleanJsonOutput(modelResponseText);
        if (jsonStr.startsWith('{')) {
            const data = JSON.parse(jsonStr);
            if (data.visualObservations) return data.visualObservations;
            if (data.interpretation) return data.interpretation;
            if (data.summary) return data.summary;
            if (data.findings) return data.findings;
        }
    } catch {
        // Fall through to the lightweight text matcher.
    }

    const match = modelResponseText.match(/\*\*Visual Observations\*\*:\s*(.*?)(\n|$)/i);
    if (match && match[1]) return match[1].trim();

    try {
        const response = await generateGeminiContent({
            model,
            contents: `Summarize the key clinical findings and visual observations from the following text in 1-2 concise sentences. Focus ONLY on actionable medical data:\n\n${modelResponseText}`,
            config: { temperature: 0.1 },
        });
        return response.text?.trim() || null;
    } catch {
        return null;
    }
};

type Part = {
    text?: string;
    inlineData?: { mimeType: string; data: string };
};
type Content = { role: string; parts: Part[] };
type GenerateContentResponse = { text?: string };

const messageToContent = (message: ChatMessage, isHistory: boolean = false, injectedContext?: string | null): Content => {
    const parts: Part[] = [];
    if (message.filePreview) {
        const isImage = message.filePreview.type.startsWith('image/');
        if (isImage && isHistory) {
             const contextNote = injectedContext 
                ? `[System: User uploaded image "${message.filePreview.name}". Context from previous analysis: ${injectedContext}]`
                : `[System: User attached image "${message.filePreview.name}". Image data not re-sent. Rely on previous analysis.]`;
             parts.push({ text: contextNote });
        } 
    }

    if (message.content) {
        const textToSend = message.role === 'user' ? scrubPII(message.content) : message.content;
        parts.push({ text: textToSend });
    }
    return { role: message.role, parts };
};

const consolidateContents = (contents: Content[]): Content[] => {
    if (contents.length === 0) return [];
    const consolidated: Content[] = [];
    let currentRole = contents[0].role;
    let currentParts: Part[] = [...contents[0].parts];
    for (let i = 1; i < contents.length; i++) {
        const msg = contents[i];
        if (msg.role === currentRole) {
            currentParts = [...currentParts, ...msg.parts];
        } else {
            consolidated.push({ role: currentRole, parts: currentParts });
            currentRole = msg.role;
            currentParts = [...msg.parts];
        }
    }
    consolidated.push({ role: currentRole, parts: currentParts });
    return consolidated;
};

interface GenerateResponseOptions {
  file?: UploadedFile;
  responseType?: 'json' | 'text';
  apiKey?: string;
  provider: AIProvider;
  model: string;
}

export const generateResponseStream = async function* (
  prompt: string,
  history: ChatMessage[],
  mode: ChatMode,
  options: GenerateResponseOptions
): AsyncGenerator<any> {
  if (options.provider === AIProvider.Gemini) {
    yield* generateGeminiStream(prompt, history, mode, options);
  } else {
    yield* generateOpenRouterStream(prompt, history, mode, options);
  }
};

async function* generateGeminiStream(
    prompt: string,
    history: ChatMessage[],
    mode: ChatMode,
    options: GenerateResponseOptions
): AsyncGenerator<GenerateContentResponse> {
  const modelConfig = MODEL_CONFIGS[mode];
  const file = options?.file;
  
  const rawHistory = history.filter(msg => (msg.content && msg.content.trim() !== '') || (msg.filePreview !== undefined));
  const MAX_TEXT_TURNS = (modelConfig as any).contextLimit || 15;
  const medicalRecords = rawHistory.filter(msg => msg.filePreview !== undefined);
  const conversation = rawHistory.filter(msg => msg.filePreview === undefined);
  const recentConversation = conversation.slice(-MAX_TEXT_TURNS);
  const keptMessagesSet = new Set([...medicalRecords, ...recentConversation]);
  const historyToProcess = rawHistory.filter(msg => keptMessagesSet.has(msg));

  let contents: Content[] = [];
  for (let i = 0; i < historyToProcess.length; i++) {
      const msg = historyToProcess[i];
      const nextMsg = historyToProcess[i + 1];
      let imageContext = null;
      if (msg.role === 'user' && msg.filePreview?.type.startsWith('image/') && nextMsg && nextMsg.role === 'model') {
          imageContext = await extractImageInsights(nextMsg.content, options.model);
      }
      contents.push(messageToContent(msg, true, imageContext));
  }
  contents = consolidateContents(contents);

  const currentMessageParts: Part[] = [];
  if (file && file.base64) {
    currentMessageParts.push({ inlineData: { mimeType: file.type, data: file.base64 } });
  }
  currentMessageParts.push({ text: scrubPII(prompt) });
  contents.push({ role: 'user', parts: currentMessageParts });

  const response = await generateGeminiContent({
    model: options.model,
    contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      ...modelConfig.config,
      ...(options?.responseType === 'json' ? { responseMimeType: 'application/json' } : {})
    },
  });
  yield response;
}

async function* generateOpenRouterStream(
    prompt: string,
    history: ChatMessage[],
    _mode: ChatMode,
    options: GenerateResponseOptions
): AsyncGenerator<any> {
    const messages = [];
    messages.push({ role: 'system', content: SYSTEM_INSTRUCTION });
    
    for (const msg of history) {
        messages.push({
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.content
        });
    }
    
    // Add file content if present (as text for simplicity in OpenRouter for now, or handle base64 if model supports it)
    let userContent: any = scrubPII(prompt);
    if (options.file && options.file.base64) {
        // OpenRouter format for images (OpenAI compatible)
        if (options.file.type.startsWith('image/')) {
            userContent = [
                { type: 'text', text: scrubPII(prompt) },
                {
                    type: 'image_url',
                    image_url: {
                        url: `data:${options.file.type};base64,${options.file.base64}`
                    }
                }
            ];
        } else {
             userContent = `${scrubPII(prompt)}\n\n[Attached File Content not fully supported in OpenRouter stream yet]`;
        }
    }

    messages.push({ role: 'user', content: userContent });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${options.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": window.location.origin,
            "X-Title": "MediBrief CIL",
        },
        body: JSON.stringify({
            "model": options.model,
            "messages": messages,
            "stream": true,
            "response_format": options.responseType === 'json' ? { type: "json_object" } : undefined
        })
    });

    if (!response.ok) {
        throw new Error(`OpenRouter error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) return;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
            if (line.startsWith("data: ")) {
                const dataStr = line.slice(6);
                if (dataStr === "[DONE]") return;
                try {
                    const data = JSON.parse(dataStr);
                    const delta = data.choices[0]?.delta?.content;
                    if (delta) {
                        // Reshape to match Gemini response structure partially
                        yield {
                            text: delta,
                            candidates: [{ content: { parts: [{ text: delta }] } }]
                        };
                    }
                } catch {
                    // Ignore malformed provider chunks.
                }
            }
        }
    }
}
