
import React, { useRef, useCallback } from 'react';
import { ChatMode as ChatModeEnum, UploadedFile, ChatMessage, GroundingSource } from '../types';
import { generateResponseStream } from '../services/geminiService';
import { exportBriefingToPdf } from '../services/exportService';
import { cleanJsonOutput, isJsonBriefing, getFriendlyErrorMessage } from '../utils';
import { FILE_ANALYSIS_PROMPT, BRIEFING_TRIGGERS, SHIFT_BRIEFING_PROMPT, HELP_COMMAND_RESPONSE, DRUG_ANALYSIS_PROMPT } from '../constants';
import { AppState, AppAction } from './useAppStore';

interface UseChatOrchestratorProps {
    state: AppState;
    dispatch: React.Dispatch<AppAction>;
    uploadedFile: UploadedFile | null;
    setUploadedFile: (file: UploadedFile | null) => void;
    isLive: boolean;
    stopSession: () => void;
    userLocation?: { latitude: number, longitude: number };
    clearFile: () => void;
}

export const useChatOrchestrator = ({
    state,
    dispatch,
    uploadedFile,
    setUploadedFile,
    isLive,
    stopSession,
    userLocation,
    clearFile
}: UseChatOrchestratorProps) => {
    const abortControllerRef = useRef<AbortController | null>(null);
    const { messages, chatMode } = state;

    const handleStop = useCallback(() => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        dispatch({ type: 'REQUEST_FINISH' });
    }, [dispatch]);

    const handleClearChat = useCallback(() => {
        dispatch({ type: 'RESET_CHAT' });
        clearFile();
    }, [dispatch, clearFile]);

    const handleSend = useCallback(async (userPrompt: string) => {
        const trimmedPrompt = userPrompt.trim();
        if (!trimmedPrompt && !uploadedFile) return;

        if (isLive) {
            stopSession();
            dispatch({ type: 'SET_CHAT_MODE', payload: ChatModeEnum.Standard });
        }
        
        // --- Export Command ---
        if (trimmedPrompt.toLowerCase() === '/export') {
            const history = messages.filter(m => !isJsonBriefing(m.content));
            if (history.length === 0) {
                 dispatch({ type: 'ADD_INTERIM_MESSAGE', payload: { role: 'model', content: '⚠️ **Cannot Export:** No history available.' } });
                 return;
            }

            dispatch({ type: 'ADD_INTERIM_MESSAGE', payload: { role: 'model', content: '📥 Generating briefing for PDF export...' } });
            dispatch({ type: 'SET_LOADING', payload: true });
            
            abortControllerRef.current = new AbortController();
            try {
                const modeForRequest = ChatModeEnum.Standard;
                const stream = generateResponseStream(SHIFT_BRIEFING_PROMPT(), history, modeForRequest, { responseType: 'json' });
                let fullResponseText = '';
                for await (const chunk of stream) {
                    if (abortControllerRef.current?.signal.aborted) throw new Error("Aborted");
                    fullResponseText += chunk.text;
                }
                
                if (fullResponseText.includes("NO DATA")) throw new Error("Insufficient clinical data found.");

                const cleanedJson = cleanJsonOutput(fullResponseText);
                if (!cleanedJson.startsWith('{')) throw new Error("Invalid briefing format.");
                
                const parsedBriefing = JSON.parse(cleanedJson);
                if (parsedBriefing.briefingTitle && parsedBriefing.briefingTitle.includes("NO DATA")) throw new Error("Insufficient clinical data.");

                await exportBriefingToPdf(parsedBriefing);
                dispatch({ type: 'UPDATE_LAST_MESSAGE_CONTENT', payload: '✅ Shift briefing PDF downloaded.' });
            } catch (e) {
                if (e.message === "Aborted") {
                     dispatch({ type: 'UPDATE_LAST_MESSAGE_CONTENT', payload: '🛑 Export cancelled.' });
                } else {
                    const friendlyError = getFriendlyErrorMessage(e);
                    dispatch({ type: 'UPDATE_LAST_MESSAGE_CONTENT', payload: `Sorry, PDF generation failed.\n\n**Reason:** ${friendlyError}` });
                }
            } finally {
                dispatch({ type: 'SET_LOADING', payload: false });
                abortControllerRef.current = null;
            }
            return;
        }

        // --- Help Command ---
        if (trimmedPrompt.toLowerCase() === '/help') {
             dispatch({ type: 'ADD_FULL_RESPONSE', payload: { message: { role: 'user', content: '/help' } }});
             dispatch({ type: 'ADD_FULL_RESPONSE', payload: { message: { role: 'model', content: HELP_COMMAND_RESPONSE } } });
             return;
        }

        // --- Standard Message & File Handling ---
        let finalApiPrompt = trimmedPrompt;
        let historyContent = trimmedPrompt;
        let fileForApi: UploadedFile | undefined = uploadedFile || undefined;
        let displayOverride = undefined;
        let modeForRequest: ChatModeEnum = chatMode === ChatModeEnum.Live ? ChatModeEnum.Standard : chatMode;
        let responseType: 'json' | 'text' = 'text';

        const isBriefingCommand = BRIEFING_TRIGGERS.some(trigger => trimmedPrompt.toLowerCase().includes(trigger)) || trimmedPrompt.toLowerCase() === '/brief';
        const isDrugCommand = trimmedPrompt.toLowerCase().startsWith('/drugs');

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
                    const baseAnalysisPrompt = FILE_ANALYSIS_PROMPT(uploadedFile.file.name);
                    if (!trimmedPrompt) {
                        analysisPrompt = baseAnalysisPrompt;
                        displayOverride = `Analyzing file: ${uploadedFile.file.name}`; 
                    } else {
                        analysisPrompt = `${baseAnalysisPrompt}\n\n---\n**ADDITIONAL INSTRUCTION:**\nThe user has asked: "${trimmedPrompt}".\n1. You MUST still output VALID JSON.\n2. Answer the user's question within the "visualObservations" or "note" fields.`;
                    }
                }
                
                finalApiPrompt = analysisPrompt;
                if (isBriefingCommand) {
                    finalApiPrompt = `${finalApiPrompt}\n\nIMPORTANT: After analyzing, ${SHIFT_BRIEFING_PROMPT()}`;
                    modeForRequest = ChatModeEnum.Standard;
                    responseType = 'json';
                    if (!displayOverride) historyContent = trimmedPrompt || "/brief (with file)";
                }
             } catch (error) {
                 dispatch({ type: 'REQUEST_FAILED', payload: getFriendlyErrorMessage(error) });
                 return;
             }
        } else if (isBriefingCommand) {
            finalApiPrompt = SHIFT_BRIEFING_PROMPT();
            historyContent = "/brief"; 
            modeForRequest = ChatModeEnum.Standard;
            responseType = 'json';
        } else if (isDrugCommand) {
            finalApiPrompt = DRUG_ANALYSIS_PROMPT(trimmedPrompt);
            modeForRequest = ChatModeEnum.Standard; 
            responseType = 'json';
        }

        if (trimmedPrompt.toLowerCase().startsWith('/patient')) modeForRequest = ChatModeEnum.Standard;

        // UI Updates
        const userMessage: ChatMessage = { role: 'user', content: historyContent };
        if (displayOverride) userMessage.displayContent = displayOverride;
        if (uploadedFile) {
            const persistenceUrl = uploadedFile.type.startsWith('image/') && uploadedFile.base64 ? `data:${uploadedFile.type};base64,${uploadedFile.base64}` : undefined;
            userMessage.filePreview = { name: uploadedFile.file.name, type: uploadedFile.type, url: persistenceUrl, base64: fileForApi ? uploadedFile.base64 : undefined };
        }
        
        dispatch({ type: 'START_REQUEST', payload: { userMessage } });
        dispatch({ type: 'ADD_RESPONSE_PLACEHOLDER' });
        setUploadedFile(null);

        // API Call
        abortControllerRef.current = new AbortController();
        try {
            const history = [...messages];
            const stream = generateResponseStream(finalApiPrompt, history, modeForRequest, { file: fileForApi, responseType, location: userLocation });
            
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
                dispatch({ type: 'REQUEST_FAILED', payload: getFriendlyErrorMessage(e) });
            }
        } finally {
            dispatch({ type: 'REQUEST_FINISH' });
            abortControllerRef.current = null;
        }
    }, [messages, chatMode, uploadedFile, isLive, stopSession, userLocation, dispatch, setUploadedFile]);

    return {
        handleSend,
        handleStop,
        handleClearChat,
        handleExportChat: useCallback(() => handleSend('/export'), [handleSend])
    };
};
