
import { GoogleGenAI, GenerateContentResponse, Content, Part, GenerateContentParameters } from "@google/genai";
import type { ChatMessage, ChatMode, UploadedFile } from '../types';
import { MODEL_CONFIGS, SYSTEM_INSTRUCTION } from '../constants';

// Helper to convert our app's message format to Gemini's format.
const messageToContent = (message: ChatMessage, isHistory: boolean = false): Content => {
    const parts: Part[] = [];

    // If the message has a persistent file attached
    if (message.filePreview) {
        // COST OPTIMIZATION:
        // We strictly control when to send base64 image data.
        // Sending high-res images in the chat history (every turn) is extremely expensive and redundant
        // because the model (Assistant) has already processed and described the image in the previous turn.
        // We only send the binary data if it's the CURRENT payload, not history.
        
        const hasData = message.filePreview.base64 && message.filePreview.type;
        const shouldSendImage = !isHistory && hasData;

        if (shouldSendImage) {
            parts.push({
                inlineData: {
                    mimeType: message.filePreview.type,
                    data: message.filePreview.base64!,
                }
            });
        } else {
            // "Zombie" / Context Preservation Logic:
            // If data is missing (reload) OR if we intentionally stripped it (history optimization),
            // we inject a System Note. This prevents the model from hallucinating that it "can't see" anything,
            // by explicitly telling it to rely on memory/previous analysis.
            
            const isImage = message.filePreview.type.startsWith('image/');
            
            // We only inject a text placeholder if this was an image.
            // Text files are already embedded in `message.content` by App.tsx logic, so they don't need this.
            if (isImage) {
                 parts.push({ 
                    text: `[System Note: The user attached an image named "${message.filePreview.name}" in a previous turn. To conserve tokens, the image data is not re-sent. Please rely on your previous analysis of this image.]` 
                });
            } 
        }
    }

    if (message.content) {
        let textToSend = message.content;

        // INTELLIGENCE RESTORATION:
        // We DO NOT strip text files. We only strip Images (which are expensive).
        // The AI retains full access to all uploaded text documents in the history.
        // We removed the truncation logic here to allow full 1M token context usage for text.

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
  location?: { latitude: number; longitude: number };
}

export const generateResponseStream = async function* (
  prompt: string,
  history: ChatMessage[],
  mode: ChatMode,
  options?: GenerateResponseOptions
): AsyncGenerator<GenerateContentResponse> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const modelConfig = MODEL_CONFIGS[mode];
  const file = options?.file;
  
  // Filter out empty messages, but keep those with file previews
  const rawHistory = history.filter(msg => {
     return (msg.content && msg.content.trim() !== '') || (msg.filePreview !== undefined);
  });

  // COST & CONTEXT BALANCE:
  // While text is cheap on Flash, deep context windows can still accumulate costs over long shifts.
  // We reduced the window from 50 to 15 turns. This is generally sufficient for immediate clinical context
  // (e.g. "What did I just ask about Patient X?") without dragging the entire day's log into every request.
  const MAX_HISTORY_TURNS = 15;
  const historyToProcess = rawHistory.slice(-MAX_HISTORY_TURNS);

  // Map history to API Content objects.
  // Pass 'true' to isHistory to strip expensive image binaries, but KEEP text.
  let contents: Content[] = historyToProcess.map(msg => messageToContent(msg, true));
  contents = consolidateContents(contents);

  const currentMessageParts: Part[] = [];

  if (file) {
    currentMessageParts.push({
      inlineData: {
        mimeType: file.type,
        data: file.base64,
      },
    });
  }
  
  currentMessageParts.push({ text: prompt });

  contents.push({ role: 'user', parts: currentMessageParts });

  const responseStream = await ai.models.generateContentStream({
    model: modelConfig.model,
    contents: contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      ...modelConfig.config,
      ...(options?.responseType === 'json' ? { responseMimeType: 'application/json' } : {}),
      // GROUNDING: If options provide location, inject it into toolConfig
      ...(options?.location ? {
         toolConfig: {
             // FIX: Removed incorrect 'googleMapsToolConfig' wrapper and using 'retrievalConfig' directly as per Maps Grounding guidelines.
             retrievalConfig: {
                 latLng: {
                     latitude: options.location.latitude,
                     longitude: options.location.longitude
                 }
             }
         } as any
      } : {})
    },
  });

  for await (const chunk of responseStream) {
    yield chunk;
  }
};
