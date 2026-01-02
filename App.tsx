import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ChatMode as ChatModeEnum, UploadedFile, ChatMessage, GroundingSource } from './types';
import Header from './components/Header';
import MessageList from './components/MessageList';
import InputBar from './components/InputBar';
import { generateResponseStream } from './services/geminiService';
import { exportBriefingToPdf } from './services/exportService';
import { cleanJsonOutput, isJsonBriefing, getFriendlyErrorMessage } from './utils';
import { FILE_ANALYSIS_PROMPT, BRIEFING_TRIGGERS, SHIFT_BRIEFING_PROMPT, HELP_COMMAND_RESPONSE } from './constants';
import { useLiveSession } from './hooks/useLiveSession';
import { useAppStore } from './hooks/useAppStore';
import { useFileDragAndDrop } from './hooks/useFileDragAndDrop';
import { DocumentTextIcon } from './components/icons';

const App: React.FC = () => {
    // --- State & Custom Hooks ---
    const { state, dispatch } = useAppStore();
    const { uploadedFile, setUploadedFile, isDragging, clearFile, dragHandlers } = useFileDragAndDrop();
    const { messages, isLoading, chatMode } = state;
    
    // --- Local Utils ---
    const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | undefined>(undefined);
    const abortControllerRef = useRef<AbortController | null>(null);

    // --- Geolocation ---
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
                (err) => console.debug("Location access denied or failed:", err.message)
            );
        }
    }, []);

    // --- Live Session Integration ---
    const handleLiveTurnComplete = useCallback((userInput: string, modelOutput: string) => {
        if (userInput) dispatch({ type: 'ADD_FULL_RESPONSE', payload: { message: { role: 'user', content: userInput } } });
        if (modelOutput) dispatch({ type: 'ADD_FULL_RESPONSE', payload: { message: { role: 'model', content: modelOutput } } });
    }, [dispatch]);

    const { isLive, transcript, startSession, stopSession, error: liveError } = useLiveSession(handleLiveTurnComplete);

    useEffect(() => {
        if (liveError) dispatch({ type: 'REQUEST_FAILED', payload: liveError });
    }, [liveError, dispatch]);

    useEffect(() => {
        if (chatMode !== ChatModeEnum.Live && isLive) stopSession();
    }, [chatMode, isLive, stopSession]);

    useEffect(() => {
        if (isLive && chatMode !== ChatModeEnum.Live) dispatch({ type: 'SET_CHAT_MODE', payload: ChatModeEnum.Live });
    }, [isLive, chatMode, dispatch]);

    // --- Handlers ---
    const handleClearChat = useCallback(() => dispatch({ type: 'RESET_CHAT' }), [dispatch]);
    
    const handleStop = useCallback(() => {
        if (abortControllerRef.current) abortControllerRef.current.abort();
        dispatch({ type: 'REQUEST_FINISH' });
    }, [dispatch]);

    // --- Core Logic: Handle Send ---
    const handleSend = useCallback(async (userPrompt: string) => {
        const trimmedPrompt = userPrompt.trim();
        if (!trimmedPrompt && !uploadedFile) return;

        if (isLive) {
            stopSession();
            dispatch({ type: 'SET_CHAT_MODE', payload: ChatModeEnum.Auto });
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
        let modeForRequest: ChatModeEnum = chatMode === ChatModeEnum.Live ? ChatModeEnum.Auto : chatMode;
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
    }, [chatMode, messages, uploadedFile, isLive, stopSession, userLocation, dispatch, setUploadedFile]);

    const handleExportChat = useCallback(() => handleSend('/export'), [handleSend]);
    const toggleLiveSession = useCallback(() => isLive ? stopSession() : startSession(messages), [isLive, stopSession, startSession, messages]);

    if (!process.env.API_KEY) {
         return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-4">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg max-w-md text-center">
                    <div className="text-red-500 text-5xl mb-4">⚠️</div>
                    <h1 className="text-xl font-bold mb-2">API Key Missing</h1>
                    <p className="text-slate-600 dark:text-slate-400">Environment variable <code>API_KEY</code> is required.</p>
                </div>
            </div>
         );
    }

    return (
        <div 
            className="flex flex-col h-[100dvh] font-sans overflow-hidden relative"
            {...dragHandlers}
        >
            {isDragging && (
                <div className="absolute inset-0 z-50 bg-blue-500/10 backdrop-blur-sm flex items-center justify-center border-4 border-blue-500 border-dashed m-4 rounded-xl animate-pulse pointer-events-none">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-xl flex flex-col items-center text-blue-500">
                        <DocumentTextIcon className="w-16 h-16 mb-4" />
                        <h2 className="text-2xl font-bold">Drop Medical Records Here</h2>
                    </div>
                </div>
            )}

            <Header
                currentMode={chatMode}
                onModeChange={(mode) => dispatch({ type: 'SET_CHAT_MODE', payload: mode })}
                onClearChat={handleClearChat}
                onExportChat={handleExportChat}
            />
            <MessageList messages={messages} isLoading={isLoading} isLive={isLive} liveTranscript={transcript} />
            <InputBar
                onSend={handleSend}
                onClearFile={clearFile}
                setUploadedFile={setUploadedFile}
                uploadedFile={uploadedFile}
                isLoading={isLoading}
                currentMode={chatMode}
                toggleLiveSession={toggleLiveSession}
                isLiveSessionActive={isLive}
                onStop={handleStop}
            />
        </div>
    );
};

export default App;