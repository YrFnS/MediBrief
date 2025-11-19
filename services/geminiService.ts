
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
        parts.push({ text: message.content });
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

  // WEAKNESS FIX: Token Cost Management
  // Limit history to last 30 messages (approx 15 turns) to prevent massive context buildup.
  const MAX_HISTORY_TURNS = 30;
  const historyToProcess = rawHistory.slice(-MAX_HISTORY_TURNS);

  // Map history to API Content objects.
  // Pass 'true' to isHistory to strip expensive image binaries from past turns.
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

  if (prompt) {
    currentMessageParts.push({ text: prompt });
  }

  if (currentMessageParts.length === 0) {
      throw new Error("Cannot send an empty message.");
  }

  // Ensure strictly User ends the conversation
  if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      const lastUserMsg = contents.pop();
      if (lastUserMsg) {
          const mergedParts = [...lastUserMsg.parts, ...currentMessageParts];
          contents.push({ role: 'user', parts: mergedParts });
      }
  } else {
      contents.push({ role: 'user', parts: currentMessageParts });
  }

  const request: GenerateContentParameters = {
    model: modelConfig.model,
    contents: contents,
    config: {
      ...modelConfig.config,
      systemInstruction: SYSTEM_INSTRUCTION,
    },
  };

  // Inject Location for Maps Grounding if applicable and available
  if (options?.location && request.config && (request.config.tools?.some(t => t.googleMaps))) {
      request.config.toolConfig = {
          retrievalConfig: {
              latLng: {
                  latitude: options.location.latitude,
                  longitude: options.location.longitude
              }
          }
      };
  }

  if (options?.responseType === 'json') {
    if (request.config) {
        request.config.responseMimeType = "application/json";
    }
  }
  
  const streamResult = await ai.models.generateContentStream(request);

  for await (const chunk of streamResult) {
    // Safety Handling: Check if the model refused to answer
    if (chunk.candidates?.[0]?.finishReason && 
        chunk.candidates[0].finishReason !== 'STOP' && 
        chunk.candidates[0].finishReason !== 'MAX_TOKENS') {
        
        // If we have some text, yield it, then the warning.
        yield chunk;
        
        const reason = chunk.candidates[0].finishReason;
        yield {
            text: `\n\n> ⚠️ **Response Halted**: The model stopped generating content due to safety filters (${reason}). Please rephrase your medical query.`,
        } as GenerateContentResponse;
        break;
    }
    yield chunk;
  }
};
