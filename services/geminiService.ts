
import { GoogleGenAI, GenerateContentResponse, Content, Part, GenerateContentParameters } from "@google/genai";
import type { ChatMessage, ChatMode, UploadedFile } from '../types';
import { MODEL_CONFIGS, SYSTEM_INSTRUCTION } from '../constants';

// Helper to convert our app's message format to Gemini's format.
const messageToContent = (message: ChatMessage): Content => {
    const parts: Part[] = [];

    // If the message has a persistent file attached (from history), add it.
    // This ensures the model can "see" images from previous turns.
    if (message.filePreview && message.filePreview.base64 && message.filePreview.type) {
        parts.push({
            inlineData: {
                mimeType: message.filePreview.type,
                data: message.filePreview.base64,
            }
        });
    }

    // Add the text content if it exists
    if (message.content) {
        parts.push({ text: message.content });
    }
    
    return { role: message.role, parts };
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
  
  // Filter out any empty model messages from history to prevent API errors
  // Also ensures we don't send messages with no parts
  const validHistory = history.filter(msg => {
     // Keep if it has text content OR if it has a file attachment
     return (msg.content && msg.content.trim() !== '') || (msg.filePreview?.base64);
  });

  // Convert previous messages into Gemini's format.
  const contents: Content[] = validHistory.map(messageToContent);

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

  // Add the current user message to the contents array.
  contents.push({ role: 'user', parts: currentMessageParts });

  const request: GenerateContentParameters = {
    model: modelConfig.model,
    contents: contents, // Pass the full conversation
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
