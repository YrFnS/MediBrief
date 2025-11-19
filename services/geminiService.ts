
import { GoogleGenAI, GenerateContentResponse, Content, Part, GenerateContentParameters } from "@google/genai";
import type { ChatMessage, ChatMode, UploadedFile } from '../types';
import { MODEL_CONFIGS, SYSTEM_INSTRUCTION } from '../constants';

// Helper to convert our app's message format to Gemini's format.
const messageToContent = (message: ChatMessage): Content => {
    const parts: Part[] = [];

    // If the message has a persistent file attached
    if (message.filePreview) {
        if (message.filePreview.base64 && message.filePreview.type) {
            parts.push({
                inlineData: {
                    mimeType: message.filePreview.type,
                    data: message.filePreview.base64,
                }
            });
        } else {
            // "Zombie" Fix:
            // If base64 is missing (expired from storage or optimized away for text files),
            // we must NOT send an empty inlineData part.
            const isImage = message.filePreview.type.startsWith('image/');
            const hasTextContent = message.content && message.content.trim().length > 0;

            // Only add a placeholder text if there is absolutely no other content to represent this message,
            // or if it was specifically an image that is now missing.
            if (isImage) {
                 parts.push({ 
                    text: `[System Note: The user attached an image named "${message.filePreview.name}" here, but the file data is no longer available in this session history. Rely on previous analysis if available.]` 
                });
            } else if (!hasTextContent) {
                 parts.push({ 
                    text: `[System Note: Attachment "${message.filePreview.name}" content missing.]` 
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

  let contents: Content[] = rawHistory.map(messageToContent);
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
