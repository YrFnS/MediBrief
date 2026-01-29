
import { GoogleGenAI, GenerateContentResponse, Content, Part, GenerateContentParameters } from "@google/genai";
import type { ChatMessage, ChatMode, UploadedFile } from '../types';
import { MODEL_CONFIGS, SYSTEM_INSTRUCTION } from '../constants';

// Helper to convert our app's message format to Gemini's format.
const messageToContent = (message: ChatMessage, isHistory: boolean = false): Content => {
    const parts: Part[] = [];

    // If the message has a persistent file attached
    if (message.filePreview) {
        // COST OPTIMIZATION & ZOMBIE FILE LOGIC:
        // We strictly control when to send base64 image data.
        // Sending high-res images in the chat history (every turn) is extremely expensive and redundant
        // because the model (Assistant) has already processed and described the image in the previous turn.
        
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
            // Text files are already embedded in `message.content` by App.tsx logic, so they don't need this
            // UNLESS the text content was also huge and stripped (future optimization).
            if (isImage) {
                 parts.push({ 
                    text: `[System Note: The user attached an image named "${message.filePreview.name}" in a previous turn. To conserve tokens, the image data is not re-sent. Please rely on your previous analysis of this image.]` 
                });
            } 
        }
    }

    if (message.content) {
        let textToSend = message.content;
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
  
  // 1. Filter out completely empty messages (safety check)
  const rawHistory = history.filter(msg => {
     return (msg.content && msg.content.trim() !== '') || (msg.filePreview !== undefined);
  });

  // 2. INTELLIGENT CONTEXT PRUNING ("Adaptive Budget")
  // Different models have different cost/latency profiles.
  // We dynamically adjust the window size based on the active mode.
  
  // Default to 15 if not specified (legacy safety), but prefer config value.
  const MAX_TEXT_TURNS = (modelConfig as any).contextLimit || 15;
  
  // Identify "Medical Records" (Messages with file attachments)
  // We generally assume these are CRITICAL and "Sticky" (should not be pruned easily).
  const medicalRecords = rawHistory.filter(msg => msg.filePreview !== undefined);
  
  // Identify "Conversation" (Text-only messages)
  const conversation = rawHistory.filter(msg => msg.filePreview === undefined);
  
  // Prune the conversation based on the model's budget
  const recentConversation = conversation.slice(-MAX_TEXT_TURNS);
  
  // Re-assemble and sort by original order to maintain logical flow.
  // Using a Set for O(1) lookups to reconstruct order efficiently.
  const keptMessagesSet = new Set([...medicalRecords, ...recentConversation]);
  
  const historyToProcess = rawHistory.filter(msg => keptMessagesSet.has(msg));

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
