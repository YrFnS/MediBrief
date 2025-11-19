import { GoogleGenAI, GenerateContentResponse, Content, Part, GenerateContentParameters } from "@google/genai";
import type { ChatMessage, ChatMode, UploadedFile } from '../types';
import { MODEL_CONFIGS, SYSTEM_INSTRUCTION } from '../constants';

// Helper to convert our app's message format to Gemini's format.
const messageToContent = (message: ChatMessage): Content => {
    const parts: Part[] = [];

    // If the message has a persistent file attached (from history), add it.
    // This ensures the model can "see" images from previous turns.
    if (message.filePreview) {
        if (message.filePreview.base64 && message.filePreview.type) {
            parts.push({
                inlineData: {
                    mimeType: message.filePreview.type,
                    data: message.filePreview.base64,
                }
            });
        } else {
            // "Zombie" Fix & Optimization:
            // If base64 is missing, it's either because it expired from localStorage OR we intentionally
            // optimized it away because we extracted the text (for PDFs/Text files).
            
            const isImage = message.filePreview.type.startsWith('image/');
            const hasTextContent = message.content && message.content.trim().length > 0;

            // If it's an image and data is missing, we MUST warn the model.
            // If it's a document but we have no text content, we MUST warn the model.
            // If it's a document AND we have text content, we assume the text is sufficient and don't spam the model.
            if (isImage || !hasTextContent) {
                parts.push({ 
                    text: `[Attachment: ${message.filePreview.name} - (File data not available)]` 
                });
            }
        }
    }

    // Add the text content if it exists
    if (message.content) {
        parts.push({ text: message.content });
    }
    
    return { role: message.role, parts };
};

/**
 * Consolidates the history to ensure strict User -> Model -> User alternation.
 * Merges consecutive messages of the same role.
 */
const consolidateContents = (contents: Content[]): Content[] => {
    if (contents.length === 0) return [];

    const consolidated: Content[] = [];
    let currentRole = contents[0].role;
    let currentParts: Part[] = [...contents[0].parts];

    for (let i = 1; i < contents.length; i++) {
        const msg = contents[i];
        if (msg.role === currentRole) {
            // Merge consecutive messages of the same role
            // Add a separator if both parts have text to prevent run-on sentences
            if (currentParts.length > 0 && msg.parts.length > 0) {
                 // Optional: Add a visual break if needed, but standard newlines are usually enough
                 // for the model to understand it's a continuation.
            }
            currentParts = [...currentParts, ...msg.parts];
        } else {
            // Push the completed group
            consolidated.push({ role: currentRole, parts: currentParts });
            // Start new group
            currentRole = msg.role;
            currentParts = [...msg.parts];
        }
    }
    // Push the final group
    consolidated.push({ role: currentRole, parts: currentParts });

    return consolidated;
};

interface GenerateResponseOptions {
  file?: UploadedFile;
  responseType?: 'json' | 'text';
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
  
  // Filter out extremely empty messages, but keep those with file previews (even zombie ones)
  const rawHistory = history.filter(msg => {
     return (msg.content && msg.content.trim() !== '') || (msg.filePreview !== undefined);
  });

  // Convert to Gemini Format
  let contents: Content[] = rawHistory.map(messageToContent);

  // Consolidate to fix any broken alternation (e.g. User -> [Error Removed] -> User)
  contents = consolidateContents(contents);

  // Construct the parts for the CURRENT user message.
  const currentMessageParts: Part[] = [];

  // Add the file first if it exists (for the new request)
  if (file) {
    currentMessageParts.push({
      inlineData: {
        mimeType: file.type,
        data: file.base64,
      },
    });
  }

  // Then add the text prompt.
  if (prompt) {
    currentMessageParts.push({ text: prompt });
  }

  if (currentMessageParts.length === 0) {
      throw new Error("Cannot send an empty message. Please provide a prompt or a file.");
  }

  // Final Alternation Check:
  // If the history ends with USER, we must merge our new message into that last USER message
  // because Gemini expects the last message in `contents` to be the one triggering the response,
  // but standard `generateContent` API usually handles the "history + new prompt" logic by 
  // treating `contents` as the FULL conversation.
  
  if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      const lastUserMsg = contents.pop(); // Remove it
      if (lastUserMsg) {
          // Merge its parts with the new parts
          // We put the OLD parts first, then the NEW parts
          const mergedParts = [...lastUserMsg.parts, ...currentMessageParts];
          contents.push({ role: 'user', parts: mergedParts });
      }
  } else {
      // Normal case: History ends with Model (or is empty), so we append a new User message
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

  // Explicitly set the response MIME type if requested.
  if (options?.responseType === 'json') {
    if (request.config) {
        request.config.responseMimeType = "application/json";
    }
  }
  
  const streamResult = await ai.models.generateContentStream(request);

  for await (const chunk of streamResult) {
    yield chunk;
  }
};