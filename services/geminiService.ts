import { GoogleGenAI, GenerateContentResponse, Content, Part, GenerateContentRequest, GenerateContentStreamResult } from "@google/genai";
import type { ChatMessage, ChatMode, UploadedFile } from '../types';
import { MODEL_CONFIGS, SYSTEM_INSTRUCTION } from '../constants';

// Helper to convert our app's message format to Gemini's format.
const messageToContent = (message: ChatMessage): Content => {
    // The content field always has the real prompt for the model.
    // The file is only attached to the most recent user message, not historical ones.
    const parts: Part[] = [{ text: message.content }];
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
  
  // Convert previous messages into Gemini's format.
  const contents: Content[] = history.map(messageToContent);

  // Construct the parts for the CURRENT user message.
  const currentMessageParts: Part[] = [];

  // Add the file first if it exists.
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

  const request: GenerateContentRequest = {
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
  
  const streamResult: GenerateContentStreamResult = await ai.models.generateContentStream(request);

  for await (const chunk of streamResult) {
    yield chunk;
  }
};
