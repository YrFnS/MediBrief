
import React, { useState, useCallback, useEffect, useReducer } from 'react';
import type { ChatMessage, ChatMode, UploadedFile, LiveTranscript } from './types';
import { ChatMode as ChatModeEnum } from './types';
import Header from './components/Header';
import MessageList from './components/MessageList';
import InputBar from './components/InputBar';
import { generateResponseStream } from './services/geminiService';
import { processPdf, PdfProcessingStrategy } from './services/pdfService';
import { exportBriefingToPdf } from './services/exportService';
import { cleanJsonOutput, isJsonBriefing } from './utils';
import { FILE_ANALYSIS_PROMPT, FILE_TEXT_ANALYSIS_PROMPT, BRIEFING_TRIGGERS, SHIFT_BRIEFING_PROMPT, HELP_COMMAND_RESPONSE } from './constants';
import { useLiveSession } from './hooks/useLiveSession';

// --- Error Handling Helper ---
const getFriendlyErrorMessage = (error: unknown): string => {
    let errorMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
        try {
            // Attempt to parse the error message as JSON, which is common for API errors
            const errorObj = JSON.parse(error.message);
            if (errorObj.error && errorObj.error.message) {
                const message = errorObj.error.message.toLowerCase();
                if (message.includes('overloaded') || message.includes('too many requests') || errorObj.error.code === 503 || errorObj.error.code === 500) {
                    return 'The service is currently experiencing high demand. Please wait a moment and try again.';
                }
                 if (message.includes('api key not valid')) {
                    return 'The API key is not valid. Please check your configuration.';
                }
                return errorObj.error.message; // Return the specific message from the API
            } else {
                return error.message; // Not the expected JSON format, return raw message
            }
        } catch (parseError) {
            // If it's not a JSON string, return the raw message.
            // Also check for common non-JSON error messages.
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


// --- State Management (useReducer) ---

interface AppState {
    messages: ChatMessage[];
    isLoading: boolean;
    chatMode: ChatMode;
    error: string | null;
}

type AppAction =
    | { type: 'START_REQUEST'; payload: { userMessage: ChatMessage } }
    | { type: 'ADD_RESPONSE_PLACEHOLDER' }
    | { type: 'APPEND_TO_LAST_MESSAGE'; payload: { chunk: string, sources?: any[] } }
    | { type: 'REQUEST_FINISH' }
    | { type: 'ADD_FULL_RESPONSE'; payload: { message: ChatMessage; consumesFile?: boolean } }
    | { type: 'UPDATE_LAST_MESSAGE_CONTENT'; payload: string }
    | { type: 'REQUEST_FAILED'; payload: string }
    | { type: 'SET_CHAT_MODE'; payload: ChatMode }
    | { type: 'RESET_CHAT' }
    | { type: 'ADD_INTERIM_MESSAGE', payload: ChatMessage }
    | { type: 'SET_LOADING', payload: boolean }; // Added explicit loading setter

const getInitialMessages = (): ChatMessage[] => {
    try {
        const savedMessages = localStorage.getItem('mediBriefMessages');
        if (savedMessages) {
            const parsed = JSON.parse(savedMessages);
            // Basic validation to ensure it's an array of messages
            if (Array.isArray(parsed) && parsed.every(m => 'role' in m && 'content' in m)) {
                return parsed;
            }
        }
    } catch (error) {
        console.error("Failed to parse messages from localStorage. Clearing corrupted data.", error);
        localStorage.removeItem('mediBriefMessages');
    }
    return [];
};

const initialState: AppState = {
    messages: getInitialMessages(),
    isLoading: false,
    chatMode: ChatModeEnum.Auto,
    error: null,
};

const appReducer = (state: AppState, action: AppAction): AppState => {
    switch (action.type) {
        case 'START_REQUEST':
            return {
                ...state,
                isLoading: true,
                error: null,
                messages: [...state.messages, action.payload.userMessage],
            };
        case 'ADD_RESPONSE_PLACEHOLDER':
            return {
                ...state,
                messages: [...state.messages, { role: 'model', content: '' }]
            };
        case 'APPEND_TO_LAST_MESSAGE': {
            const newMessages = [...state.messages];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === 'model') {
                lastMessage.content += action.payload.chunk || '';
                if(action.payload.sources && action.payload.sources.length > 0) {
                    lastMessage.sources = action.payload.sources;
                }
            }
            return { ...state, messages: newMessages };
        }
        case 'REQUEST_FINISH':
             return { ...state, isLoading: false };
        case 'ADD_FULL_RESPONSE':
            return {
                ...state,
                isLoading: false,
                messages: [...state.messages, action.payload.message],
            };
        case 'ADD_INTERIM_MESSAGE':
            return {
                ...state,
                messages: [...state.messages, action.payload],
            };
         case 'UPDATE_LAST_MESSAGE_CONTENT': {
            const newMessages = [...state.messages];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage) {
                lastMessage.content = action.payload;
            }
            return { ...state, messages: newMessages };
        }
        case 'REQUEST_FAILED': {
             const newMessages = [...state.messages];
             const lastMessage = newMessages[newMessages.length - 1];
             if(lastMessage && lastMessage.role === 'model' && lastMessage.content === '') {
                 lastMessage.content = `Sorry, I encountered an error. Please try again. \n\n**Details:** ${action.payload}`;
             } else {
                 newMessages.push({ role: 'model', content: `Sorry, I encountered an error. Please try again. \n\n**Details:** ${action.payload}` });
             }
            return {
                ...state,
                isLoading: false,
                error: action.payload,
                messages: newMessages
            };
        }
        case 'SET_CHAT_MODE':
            return { ...state, chatMode: action.payload };
        case 'RESET_CHAT':
            return { ...initialState, messages: [], chatMode: state.chatMode };
        case 'SET_LOADING':
            return { ...state, isLoading: action.payload };
        default:
            return state;
    }
};

// --- Main App Component ---
const App: React.FC = () => {
    const [state, dispatch] = useReducer(appReducer, initialState);
    const { messages, isLoading, chatMode } = state;
    const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);

    // --- Live Session Hook Integration ---
    const handleLiveTurnComplete = useCallback((userInput: string, modelOutput: string) => {
        if (userInput) dispatch({ type: 'ADD_FULL_RESPONSE', payload: { message: { role: 'user', content: userInput } } });
        if (modelOutput) dispatch({ type: 'ADD_FULL_RESPONSE', payload: { message: { role: 'model', content: modelOutput } } });
    }, []);

    const { isLive, transcript, startSession, stopSession, error: liveError } = useLiveSession(handleLiveTurnComplete);

    // Effect to handle live session errors in the main UI
    useEffect(() => {
        if (liveError) {
            dispatch({ type: 'REQUEST_FAILED', payload: liveError });
        }
    }, [liveError]);

    // --- SYNC: Chat Mode <-> Live Session State ---
    
    // 1. If user manually switches mode AWAY from Live using the UI selector, STOP the session.
    // This prevents the "Creepy Ex" bug where the AI listens while the user thinks they are in Standard mode.
    useEffect(() => {
        if (chatMode !== ChatModeEnum.Live && isLive) {
            stopSession();
        }
    }, [chatMode, isLive, stopSession]);

    // 2. If the session starts (e.g. via Mic button), visually update the UI mode to Live.
    useEffect(() => {
        if (isLive && chatMode !== ChatModeEnum.Live) {
            dispatch({ type: 'SET_CHAT_MODE', payload: ChatModeEnum.Live });
        }
    }, [isLive, chatMode]);

    // --- Persistence Logic with Quota Protection ---
    useEffect(() => {
        const saveMessages = (msgsToSave: ChatMessage[]) => {
            try {
                // CRITICAL: Strip heavy base64 data AND temporary blob URLs before saving.
                const optimizedMessages = msgsToSave.map(msg => {
                    if (msg.filePreview) {
                        const isDataUrl = msg.filePreview.url?.startsWith('data:');
                        const isBlobUrl = msg.filePreview.url?.startsWith('blob:');
                        
                        return {
                            ...msg,
                            filePreview: {
                                ...msg.filePreview,
                                base64: undefined, // Remove the heavy blob source
                                // Remove URL if it's a blob (temporary) or data (heavy). 
                                // Only keep standard URLs if we ever support remote images.
                                url: (isDataUrl || isBlobUrl) ? undefined : msg.filePreview.url 
                            }
                        };
                    }
                    return msg;
                });
                localStorage.setItem('mediBriefMessages', JSON.stringify(optimizedMessages));
            } catch (e) {
                console.error("Failed to save messages to localStorage (quota exceeded?)", e);
                // Fallback: If we fail to save, try saving only the last 10 messages
                // This prevents the app from completely breaking due to full storage
                if (msgsToSave.length > 10) {
                     console.warn("Attempting to save truncated history...");
                     saveMessages(msgsToSave.slice(-10));
                }
            }
        };

        if (messages.length > 0) {
            saveMessages(messages);
        } else {
            localStorage.removeItem('mediBriefMessages');
        }
    }, [messages]);
    
    const handleClearChat = useCallback(() => {
        dispatch({ type: 'RESET_CHAT' });
    }, []);

    /**
     * @param prompt The text prompt to send.
     * @param fileOverride Optional file to use instead of the state's uploadedFile.
     * @param displayOverride Optional text to display in the user's chat bubble instead of the prompt.
     * @param skipFileSending If true, the file is shown in the UI preview but NOT sent to the API (used when we extract text client-side to save tokens).
     */
    const handleSend = useCallback(async (prompt: string, fileOverride?: UploadedFile, displayOverride?: string, skipFileSending: boolean = false) => {
        const trimmedPrompt = prompt.trim();
        const currentFile = fileOverride || uploadedFile;

        if (!trimmedPrompt && !currentFile) return;

        // CRITICAL UX FIX: If the user decides to TYPE a message while a Live Voice session is active,
        // we must Stop the voice session immediately. Otherwise, we have "Schizophrenic AI" 
        // (Voice AI listening while Text AI replies separately).
        if (isLive) {
            stopSession();
        }
        
        // Command to directly export the briefing as a PDF
        if (trimmedPrompt.toLowerCase() === '/export') {
            dispatch({ type: 'ADD_INTERIM_MESSAGE', payload: { role: 'model', content: '📥 Generating your briefing for PDF export. This may take a moment...' } });
            dispatch({ type: 'SET_LOADING', payload: true }); // FIX: Show loading state during export
            
            try {
                const history = messages.filter(m => !isJsonBriefing(m.content));
                const modeForRequest = ChatModeEnum.Deep;
                const briefingPrompt = SHIFT_BRIEFING_PROMPT();

                const stream = generateResponseStream(briefingPrompt, history, modeForRequest, { responseType: 'json' });
                let fullResponseText = '';
                for await (const chunk of stream) {
                    fullResponseText += chunk.text;
                }
                
                const cleanedJson = cleanJsonOutput(fullResponseText);

                if (!cleanedJson.startsWith('{')) {
                    throw new Error("The model did not return a valid briefing. Ensure there is enough context in the chat to generate a report.");
                }
                
                const parsedBriefing = JSON.parse(cleanedJson);
                await exportBriefingToPdf(parsedBriefing);

                dispatch({ type: 'UPDATE_LAST_MESSAGE_CONTENT', payload: '✅ Your shift briefing PDF has been downloaded successfully.' });
            } catch (e) {
                const friendlyError = getFriendlyErrorMessage(e);
                const finalMessage = `Sorry, I couldn't generate the PDF. Please try again.\n\n**Error:** ${friendlyError}`;
                dispatch({ type: 'UPDATE_LAST_MESSAGE_CONTENT', payload: finalMessage });
            } finally {
                dispatch({ type: 'SET_LOADING', payload: false });
            }
            return;
        }

        if (trimmedPrompt.toLowerCase() === '/help') {
             dispatch({ type: 'ADD_FULL_RESPONSE', payload: { message: { role: 'user', content: '/help' } }});
             dispatch({ type: 'ADD_FULL_RESPONSE', payload: { message: { role: 'model', content: HELP_COMMAND_RESPONSE } } });
             return;
        }

        // Decouple the Prompt sent to API from the Content stored in History
        // This prevents "The Magician's Reveal" where internal prompts are shown to the user
        let apiPrompt = trimmedPrompt;
        let historyContent = trimmedPrompt;

        let modeForRequest: ChatMode;
        let responseType: 'json' | 'text' = 'text';

        const isBriefingCommand = BRIEFING_TRIGGERS.some(trigger => trimmedPrompt.toLowerCase().includes(trigger)) || trimmedPrompt.toLowerCase() === '/brief';

        // Determine mode and prompt based on commands or user selection
        if (isBriefingCommand) {
            apiPrompt = SHIFT_BRIEFING_PROMPT();
            historyContent = "/brief"; // Keep history clean
            modeForRequest = ChatModeEnum.Deep;
            responseType = 'json';
        } else if (trimmedPrompt.toLowerCase().startsWith('/patient')) {
            modeForRequest = ChatModeEnum.Deep;
        } else if (chatMode === ChatModeEnum.Live) {
            // If user sends text while in Live mode (which is audio-centric), 
            // fall back to the smart Auto mode so they get a text response with tools if needed.
            modeForRequest = ChatModeEnum.Auto;
        } else {
            // Respect user's manual mode selection if no command is found
            modeForRequest = chatMode;
        }

        const userMessage: ChatMessage = { role: 'user', content: historyContent };
        if(displayOverride) {
            userMessage.displayContent = displayOverride;
        }
        
        if (currentFile) {
            // Store the base64 data in the message history so the model can see it later.
            // OPTIMIZATION: If skipFileSending is true (we extracted text), we do NOT store the base64.
            // This prevents sending both the PDF bytes AND the extracted text in future history turns.
            
            // FIX: We use the base64 to create a data URI for the `url` property. 
            // We cannot rely on `currentFile.url` (Blob URL) because InputBar revokes it immediately after sending.
            const persistenceUrl = currentFile.type.startsWith('image/') && currentFile.base64 
                ? `data:${currentFile.type};base64,${currentFile.base64}` 
                : undefined;

            userMessage.filePreview = { 
                name: currentFile.file.name, 
                type: currentFile.type, 
                url: persistenceUrl,
                base64: skipFileSending ? undefined : currentFile.base64 
            };
        }
        
        dispatch({ type: 'START_REQUEST', payload: { userMessage } });
        dispatch({ type: 'ADD_RESPONSE_PLACEHOLDER' });
        if(!fileOverride) setUploadedFile(null);

        try {
            // We use the current state messages (which includes the just-added userMessage with CLEAN historyContent)
            // But we need to send the API_PROMPT for the last turn, not historyContent.
            
            const history = [...messages]; // Messages *before* the current user message
            const fileToSend = skipFileSending ? undefined : currentFile;
            
            // Note: generateResponseStream appends apiPrompt to the history we pass it.
            // We pass 'history' (previous messages) and 'apiPrompt' (current instruction).
            // This ensures Gemini sees the full instruction, but our UI/State only sees the clean command.
            const stream = generateResponseStream(apiPrompt, history, modeForRequest, { file: fileToSend, responseType });
            
            for await (const chunk of stream) {
                const sources = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
                dispatch({ type: 'APPEND_TO_LAST_MESSAGE', payload: { chunk: chunk.text || '', sources } });
            }
        } catch (e) {
            const friendlyError = getFriendlyErrorMessage(e);
            dispatch({ type: 'REQUEST_FAILED', payload: friendlyError });
        } finally {
            dispatch({ type: 'REQUEST_FINISH' });
        }
    }, [chatMode, messages, uploadedFile, isLive, stopSession]);

    const handleFileUpload = useCallback(async (file: UploadedFile) => {
        try {
            let analysisPrompt: string;
            let displayMessage = `Analyzing file: ${file.file.name}`;
            let skipFileSending = false;

            if (file.type === 'application/pdf') {
                const pdfResult = await processPdf(file.file);
                if (pdfResult.strategy === PdfProcessingStrategy.TEXT_EXTRACTION && pdfResult.extractedText) {
                    // Token Optimization: If we extracted text, sending the text is enough.
                    // We do NOT need to send the PDF bytes, saving massive amounts of tokens.
                    analysisPrompt = FILE_TEXT_ANALYSIS_PROMPT(file.file.name, pdfResult.extractedText);
                    skipFileSending = true;
                } else {
                    analysisPrompt = FILE_ANALYSIS_PROMPT(file.file.name); // Fallback to OCR
                }
            } else if (file.type === 'text/plain' || file.file.name.endsWith('.txt') || file.file.name.endsWith('.md') || file.file.name.endsWith('.csv') || file.file.name.endsWith('.json')) {
                 // Text File Optimization: Read directly and send as text part.
                 const textContent = await file.file.text();
                 analysisPrompt = FILE_TEXT_ANALYSIS_PROMPT(file.file.name, textContent);
                 skipFileSending = true;
            } else {
                analysisPrompt = FILE_ANALYSIS_PROMPT(file.file.name);
            }
            
            // We pass the file to handleSend so it shows the UI preview, 
            // but we use skipFileSending=true to prevent sending bytes to the API if we already extracted text.
            // NOTE: The 'analysisPrompt' will be used as the API Prompt.
            // We should keep the displayMessage as provided to prevent "The Wall of Text".
            await handleSend(analysisPrompt, file, displayMessage, skipFileSending);

        } catch (error) {
            const friendlyError = getFriendlyErrorMessage(error);
            dispatch({ type: 'REQUEST_FAILED', payload: friendlyError });
        }
    }, [handleSend]);
    
    const handleExportChat = useCallback(() => {
        handleSend('/export');
    }, [handleSend]);

    const toggleLiveSession = useCallback(() => {
        if (isLive) {
            stopSession();
        } else {
            startSession();
        }
    }, [isLive, stopSession, startSession]);

    if (!process.env.API_KEY) {
         return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-4">
                <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg max-w-md text-center">
                    <div className="text-red-500 text-5xl mb-4">⚠️</div>
                    <h1 className="text-xl font-bold mb-2">API Key Missing</h1>
                    <p className="text-slate-600 dark:text-slate-400 mb-4">
                        The application cannot start because the <code>API_KEY</code> environment variable is not set.
                    </p>
                </div>
            </div>
         );
    }

    return (
        <div className="flex flex-col h-[100dvh] font-sans overflow-hidden">
            <Header
                currentMode={chatMode}
                onModeChange={(mode) => dispatch({ type: 'SET_CHAT_MODE', payload: mode })}
                onClearChat={handleClearChat}
                onExportChat={handleExportChat}
            />
            <MessageList messages={messages} isLoading={isLoading} isLive={isLive} liveTranscript={transcript} />
            <InputBar
                onSend={handleSend}
                onFileUpload={handleFileUpload}
                onClearFile={() => setUploadedFile(null)}
                setUploadedFile={setUploadedFile}
                uploadedFile={uploadedFile}
                isLoading={isLoading}
                currentMode={chatMode}
                toggleLiveSession={toggleLiveSession}
                isLiveSessionActive={isLive}
            />
        </div>
    );
};

export default App;
