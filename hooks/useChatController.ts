
import { useRef, useCallback } from 'react';
import type { ChatMessage, ChatMode, UploadedFile, GroundingSource } from '../types';
import { ChatMode as ChatModeEnum } from '../types';
import { generateResponseStream } from '../services/geminiService';
import { exportBriefingToPdf } from '../services/exportService';
import { cleanJsonOutput, isJsonBriefing } from '../utils';
import { FILE_ANALYSIS_PROMPT, BRIEFING_TRIGGERS, SHIFT_BRIEFING_PROMPT, HELP_COMMAND_RESPONSE } from '../constants';
import { AppAction } from './useAppState';

// Helper for error messages
const getFriendlyErrorMessage = (error: unknown): string => {
    let errorMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
        try {
            const errorObj = JSON.parse(error.message);
            if (errorObj.error && errorObj.error.message) {
                const message = errorObj.error.message.toLowerCase();
                if (message.includes('overloaded') || message.includes('too many requests') || errorObj.error.code === 503 || errorObj.error.code === 500) {
                    return 'The service is currently experiencing high demand. Please wait a moment and try again.';
                }
                 if (message.includes('api key not valid')) {
                    return 'The API key is not valid. Please check your configuration.';
                }
                return errorObj.error.message; 
            } else {
                return error.message; 
            }
        } catch (parseError) {
            if (error.message.toLowerCase().includes('permission denied')) {
                return 'Microphone access was denied. Please allow microphone permission in your browser settings.';
            }
            return error.message;
        }
    } else if (typeof error === 'string') {
        return error;
    }
    return errorMessage;
};

interface UseChatControllerProps {
    messages: ChatMessage[];
    chatMode: ChatMode;
    dispatch: React.Dispatch<AppAction>;
    uploadedFile: UploadedFile | null;
    setUploadedFile: (file: UploadedFile | null) => void;
    customApiKey: string;
    userLocation?: { latitude: number; longitude: number };
    isLive: boolean;
    stopSession: () => void;
    startSession: (history: ChatMessage[], apiKey?: string) => void;
}

export const useChatController = ({
    messages,
    chatMode,
    dispatch,
    uploadedFile,
    setUploadedFile,
    customApiKey,
    userLocation,
    isLive,
    stopSession,
    startSession
}: UseChatControllerProps) => {
    const abortControllerRef = useRef<AbortController | null>(null);

    const handleStop = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        dispatch({ type: 'REQUEST_FINISH' });
    }, [dispatch]);

    const handleSend = useCallback(async (userPrompt: string) => {
        const trimmedPrompt = userPrompt.trim();
        if (!trimmedPrompt && !uploadedFile) return;

        if (isLive) {
            stopSession();
            dispatch({ type: 'SET_CHAT_MODE', payload: ChatModeEnum.Auto });
        }
        
        // Export Command
        if (trimmedPrompt.toLowerCase() === '/export') {
            const history = messages.filter(m => !isJsonBriefing(m.content));
            if (history.length === 0) {
                 dispatch({ type: 'ADD_INTERIM_MESSAGE', payload: { role: 'model', content: '⚠️ **Cannot Export:** There is no patient data or conversation history to summarize yet. Please upload a chart or discuss a case first.' } });
                 return;
            }

            dispatch({ type: 'ADD_INTERIM_MESSAGE', payload: { role: 'model', content: '📥 Generating your briefing for PDF export. This may take a moment...' } });
            dispatch({ type: 'SET_LOADING', payload: true });
            
            abortControllerRef.current = new AbortController();

            try {
                const modeForRequest = ChatModeEnum.Standard;
                const briefingPrompt = SHIFT_BRIEFING_PROMPT();
                const stream = generateResponseStream(briefingPrompt, history, modeForRequest, { 
                    responseType: 'json',
                    apiKey: customApiKey 
                });
                let fullResponseText = '';
                for await (const chunk of stream) {
                    if (abortControllerRef.current?.signal.aborted) throw new Error("Aborted");
                    fullResponseText += chunk.text;
                }
                
                if (fullResponseText.includes("NO DATA")) throw new Error("Insufficient clinical data found to generate a briefing.");
                const cleanedJson = cleanJsonOutput(fullResponseText);
                if (!cleanedJson.startsWith('{')) throw new Error("The model did not return a valid briefing. Ensure there is enough context in the chat to generate a report.");
                
                const parsedBriefing = JSON.parse(cleanedJson);
                if (parsedBriefing.briefingTitle && parsedBriefing.briefingTitle.includes("NO DATA")) throw new Error("Insufficient clinical data found to generate a briefing.");

                await exportBriefingToPdf(parsedBriefing);
                dispatch({ type: 'UPDATE_LAST_MESSAGE_CONTENT', payload: '✅ Your shift briefing PDF has been downloaded successfully.' });
            } catch (e) {
                if (e.message === "Aborted") {
                     dispatch({ type: 'UPDATE_LAST_MESSAGE_CONTENT', payload: '🛑 Export cancelled.' });
                } else {
                    const friendlyError = getFriendlyErrorMessage(e);
                    const finalMessage = `Sorry, I couldn't generate the PDF. Please try again.\n\n**Reason:** ${friendlyError}`;
                    dispatch({ type: 'UPDATE_LAST_MESSAGE_CONTENT', payload: finalMessage });
                }
            } finally {
                dispatch({ type: 'SET_LOADING', payload: false });
                abortControllerRef.current = null;
            }
            return;
        }

        if (trimmedPrompt.toLowerCase() === '/help') {
             dispatch({ type: 'ADD_FULL_RESPONSE', payload: { message: { role: 'user', content: '/help' } }});
             dispatch({ type: 'ADD_FULL_RESPONSE', payload: { message: { role: 'model', content: HELP_COMMAND_RESPONSE } } });
             return;
        }

        // --- FILE PROCESSING ---
        let finalApiPrompt = trimmedPrompt;
        let historyContent = trimmedPrompt;
        let fileForApi: UploadedFile | undefined = uploadedFile || undefined;
        let displayOverride = undefined;

        let modeForRequest: ChatMode;
        let responseType: 'json' | 'text' = 'text';

        const isBriefingCommand = BRIEFING_TRIGGERS.some(trigger => trimmedPrompt.toLowerCase().includes(trigger)) || trimmedPrompt.toLowerCase() === '/brief';

        if (uploadedFile) {
             try {
                let analysisPrompt: string;
                
                if (uploadedFile.type === 'application/pdf') {
                    const promptBase = trimmedPrompt ? `User Query: ${trimmedPrompt}` : `Analyze this medical document.`;
                    analysisPrompt = FILE_ANALYSIS_PROMPT(uploadedFile.file.name) + `\n\n${promptBase}`;
                } else if (uploadedFile.type === 'text/plain' || uploadedFile.file.name.endsWith('.txt') || uploadedFile.file.name.endsWith('.md')) {
                     const textContent = await uploadedFile.file.text();
                     const promptBase = trimmedPrompt ? `User Query: ${trimmedPrompt}` : `Analyze this document.`;
                     const fullEmbeddedContent = `*** BEGIN FILE CONTENT: ${uploadedFile.file.name} ***\n${textContent}\n*** END FILE CONTENT ***\n\n${promptBase}`;
                     
                     analysisPrompt = fullEmbeddedContent;
                     historyContent = fullEmbeddedContent;
                     displayOverride = `📄 **Uploaded ${uploadedFile.file.name}**\n\n${trimmedPrompt || "Requested analysis."}`;
                     fileForApi = undefined; 
                } else {
                     // IMAGE OR GENERIC FILE
                    const baseAnalysisPrompt = FILE_ANALYSIS_PROMPT(uploadedFile.file.name);
                    if (!trimmedPrompt) {
                        analysisPrompt = baseAnalysisPrompt;
                        displayOverride = `Analyzing file: ${uploadedFile.file.name}`; 
                    } else {
                        analysisPrompt = `${baseAnalysisPrompt}

---
**ADDITIONAL INSTRUCTION:**
The user has asked a specific question about this image: "${trimmedPrompt}".
1. You MUST still output the VALID JSON object as defined above.
2. Answer the user's question within the "visualObservations", "potentialAbnormalities", or "note" fields of the JSON.
3. DO NOT output plain text. DO NOT refuse to answer. This is for a medical professional.
`;
                    }
                }
                finalApiPrompt = analysisPrompt;
                if (isBriefingCommand) {
                    finalApiPrompt = `${finalApiPrompt}\n\nIMPORTANT: After analyzing the above document, ${SHIFT_BRIEFING_PROMPT()}`;
                    modeForRequest = ChatModeEnum.Standard;
                    responseType = 'json';
                    if (!displayOverride) historyContent = trimmedPrompt || "/brief (with file)";
                }
             } catch (error) {
                 const friendlyError = getFriendlyErrorMessage(error);
                 dispatch({ type: 'REQUEST_FAILED', payload: friendlyError });
                 return;
             }
        } else if (isBriefingCommand) {
            finalApiPrompt = SHIFT_BRIEFING_PROMPT();
            historyContent = "/brief"; 
            modeForRequest = ChatModeEnum.Standard;
            responseType = 'json';
        }

        if (!modeForRequest!) {
             if (trimmedPrompt.toLowerCase().startsWith('/patient')) {
                modeForRequest = ChatModeEnum.Standard;
            } else if (chatMode === ChatModeEnum.Live) {
                modeForRequest = ChatModeEnum.Auto;
            } else {
                modeForRequest = chatMode;
            }
        }

        // --- UPDATE UI STATE ---
        const userMessage: ChatMessage = { role: 'user', content: historyContent };
        if (displayOverride) userMessage.displayContent = displayOverride;
        if (uploadedFile) {
            const persistenceUrl = uploadedFile.type.startsWith('image/') && uploadedFile.base64 
                ? `data:${uploadedFile.type};base64,${uploadedFile.base64}` 
                : undefined;
            userMessage.filePreview = { 
                name: uploadedFile.file.name, 
                type: uploadedFile.type, 
                url: persistenceUrl,
                base64: fileForApi ? uploadedFile.base64 : undefined 
            };
        }
        
        dispatch({ type: 'START_REQUEST', payload: { userMessage } });
        dispatch({ type: 'ADD_RESPONSE_PLACEHOLDER' });
        setUploadedFile(null);

        // --- SEND API REQUEST ---
        abortControllerRef.current = new AbortController();

        try {
            const history = [...messages];
            const stream = generateResponseStream(finalApiPrompt, history, modeForRequest, { 
                file: fileForApi, 
                responseType,
                location: userLocation,
                apiKey: customApiKey 
            });
            
            for await (const chunk of stream) {
                if (abortControllerRef.current?.signal.aborted) throw new Error("Aborted");
                const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
                let sources: GroundingSource[] | undefined = undefined;

                if (groundingMetadata && groundingMetadata.groundingChunks) {
                    sources = groundingMetadata.groundingChunks.map(chunk => {
                        if (chunk.web) return { web: chunk.web };
                        if ((chunk as any).maps) return { maps: (chunk as any).maps };
                        return undefined;
                    }).filter(Boolean) as GroundingSource[];
                }
                dispatch({ type: 'APPEND_TO_LAST_MESSAGE', payload: { chunk: chunk.text || '', sources } });
            }
        } catch (e) {
             if (e.message === "Aborted") {
                 dispatch({ type: 'APPEND_TO_LAST_MESSAGE', payload: { chunk: " [Stopped]" } });
            } else {
                const friendlyError = getFriendlyErrorMessage(e);
                dispatch({ type: 'REQUEST_FAILED', payload: friendlyError });
            }
        } finally {
            dispatch({ type: 'REQUEST_FINISH' });
            abortControllerRef.current = null;
        }
    }, [chatMode, messages, uploadedFile, isLive, stopSession, userLocation, customApiKey, dispatch, setUploadedFile]);

    const handleExportChat = useCallback(() => {
        handleSend('/export');
    }, [handleSend]);

    const toggleLiveSession = useCallback(() => {
        if (isLive) {
            stopSession();
        } else {
            startSession(messages, customApiKey);
        }
    }, [isLive, stopSession, startSession, messages, customApiKey]);

    return {
        handleSend,
        handleStop,
        handleExportChat,
        toggleLiveSession
    };
};
