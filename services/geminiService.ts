
import { GoogleGenAI, GenerateContentResponse, Content, Part, GenerateContentParameters } from "@google/genai";
import type { ChatMessage, ChatMode, UploadedFile } from '../types';
import { MODEL_CONFIGS, SYSTEM_INSTRUCTION } from '../constants';
import { cleanJsonOutput } from '../utils';
import { scrubPII } from '../utils/piiScrubber';

// Helper to extract a concise summary from a previous model response to substitute for an image
const extractImageInsights = (modelResponseText: string): string | null => {
    if (!modelResponseText) return null;
    
    try {
        // 1. Try JSON parsing first (Common for MediBrief's file analysis)
        const jsonStr = cleanJsonOutput(modelResponseText);
        if (jsonStr.startsWith('{')) {
            const data = JSON.parse(jsonStr);
            // Prioritize fields that describe the visual content
            if (data.visualObservations) return data.visualObservations;
            if (data.interpretation) return data.interpretation;
            if (data.summary) return data.summary;
            if (data.findings) return data.findings;
        }
    } catch (e) {
        // Fallback to text heuristics if JSON parse fails
    }

    // 2. Text fallback: Look for "Visual Observations:" or similar headers in Markdown
    const match = modelResponseText.match(/\*\*Visual Observations\*\*:\s*(.*?)(\n|$)/i);
    if (match && match[1]) return match[1].trim();

    // 3. Fallback: Take a truncated version of the response as context
    // Limit to 300 chars to be token-efficient
    return modelResponseText.slice(0, 300).replace(/\n/g, ' ') + (modelResponseText.length > 300 ? "..." : "");
};

// Helper to convert our app's message format to Gemini's format.
const messageToContent = (message: ChatMessage, isHistory: boolean = false, injectedContext?: string | null): Content => {
    const parts: Part[] = [];

    // If the message has a persistent file attached
    if (message.filePreview) {
        // COST OPTIMIZATION & STORAGE SAFETY:
        // We strictly control when to send base64 image data.
        // 1. We NEVER send base64 if isHistory is true (saves tokens).
        // 2. We check if the message object even HAS base64 (it shouldn't if loaded from store).
        
        const isImage = message.filePreview.type.startsWith('image/');
        
        if (isImage && isHistory) {
             // INTELLIGENT CONTEXT SUBSTITUTION:
             // Instead of sending raw bytes (expensive/impossible for history) or a blank placeholder (lossy),
             // we inject the *previous analysis* of this image if available.
             const contextNote = injectedContext 
                ? `[System: User uploaded image "${message.filePreview.name}". Context from previous analysis: ${injectedContext}]`
                : `[System: User attached image "${message.filePreview.name}". Image data not re-sent. Rely on previous analysis.]`;
             
             parts.push({ text: contextNote });
        } 
    }

    if (message.content) {
        // PII PROTECTION: Scrub only USER messages before sending to history
        // System instructions instruct the model to be clinical, but we must protect user input.
        let textToSend = message.role === 'user' ? scrubPII(message.content) : message.content;
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
  
  const MAX_TEXT_TURNS = (modelConfig as any).contextLimit || 15;
  
  const medicalRecords = rawHistory.filter(msg => msg.filePreview !== undefined);
  const conversation = rawHistory.filter(msg => msg.filePreview === undefined);
  const recentConversation = conversation.slice(-MAX_TEXT_TURNS);
  
  // Combine sets but maintain chronological order
  const keptMessagesSet = new Set([...medicalRecords, ...recentConversation]);
  const historyToProcess = rawHistory.filter(msg => keptMessagesSet.has(msg));

  // 3. Map history to API Content objects with Context Injection
  let contents: Content[] = [];
  
  for (let i = 0; i < historyToProcess.length; i++) {
      const msg = historyToProcess[i];
      const nextMsg = historyToProcess[i + 1];
      
      let imageContext = null;
      
      // Check if this is an image upload turn followed by a model response
      if (msg.role === 'user' && msg.filePreview?.type.startsWith('image/') && nextMsg && nextMsg.role === 'model') {
          // Extract insights from the *next* message (the model's analysis)
          // to substitute for the missing image data in this *user* message.
          imageContext = extractImageInsights(nextMsg.content);
      }
      
      contents.push(messageToContent(msg, true, imageContext));
  }

  contents = consolidateContents(contents);

  const currentMessageParts: Part[] = [];

  // This is the ONLY place where actual image binary data is sent to the model
  // It comes from the 'file' option (current upload), NOT the chat history state.
  if (file && file.base64) {
    currentMessageParts.push({
      inlineData: {
        mimeType: file.type,
        data: file.base64,
      },
    });
  }
  
  // Scrub the current prompt as well
  currentMessageParts.push({ text: scrubPII(prompt) });

  contents.push({ role: 'user', parts: currentMessageParts });

  const responseStream = await ai.models.generateContentStream({
    model: modelConfig.model,
    contents: contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      ...modelConfig.config,
      ...(options?.responseType === 'json' ? { responseMimeType: 'application/json' } : {}),
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
