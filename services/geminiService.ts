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
  // We accept messages if they have text content OR if they have a filePreview object (even without base64)
  const validHistory = history.filter(msg => {
     return (msg.content && msg.content.trim() !== '') || (msg.filePreview);
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

  // --- SANITIZATION: Ensure strict User -> Model -> User alternation ---
  // FIX: "The Hallucinated History"
  // If the history ends with a USER message (due to previous error), do NOT inject a fake Model message.
  // Instead, merge the previous User message into the current one, effectively creating a multi-part User turn.
  if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
      // We pop the last message (the orphan)
      const lastUserContent = contents.pop();
      if (lastUserContent && lastUserContent.parts) {
          // We prepend its parts to the current request
          // We insert a separator to ensure text doesn't blend weirdly
          if (lastUserContent.parts.length > 0 && currentMessageParts.length > 0) {
              // If both have text, add a newline separator to the previous text part
              const lastPart = lastUserContent.parts[lastUserContent.parts.length - 1];
              if (lastPart.text) {
                  lastPart.text += "\n\n[User Continued]:\n";
              }
          }
          // Prepend all parts of the previous message to the start of current message parts
          currentMessageParts.unshift(...lastUserContent.parts);
      }
  }

  // Add the merged (or normal) user message to the contents array.
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