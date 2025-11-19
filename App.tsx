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
    | { type: 'ADD_INTERIM_MESSAGE', payload: ChatMessage };

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

    // --- Persistence Logic with Quota Protection ---
    useEffect(() => {
        if (messages.length > 0) {
            try {
                // CRITICAL: Strip heavy base64 data before saving to localStorage to avoid QuotaExceededError.
                // We keep the metadata so the UI knows a file was there, but the content expires on reload.
                const optimizedMessages = messages.map(msg => {
                    if (msg.filePreview && msg.filePreview.base64) {
                        return {
                            ...msg,
                            filePreview: {
                                ...msg.filePreview,
                                base64: undefined // Remove the heavy blob
                            }
                        };
                    }
                    return msg;
                });
                localStorage.setItem('mediBriefMessages', JSON.stringify(optimizedMessages));
            } catch (e) {
                console.error("Failed to save messages to localStorage (quota exceeded?)", e);
            }
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
        
        // Command to directly export the briefing as a PDF
        if (trimmedPrompt.toLowerCase() === '/export') {
            dispatch({ type: 'ADD_INTERIM_MESSAGE', payload: { role: 'model', content: '📥 Generating your briefing for PDF export. This may take a moment...' } });
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
            }
            return;
        }

        if (trimmedPrompt.toLowerCase() === '/help') {
             dispatch({ type: 'ADD_FULL_RESPONSE', payload: { message: { role: 'user', content: '/help' } }});
             dispatch({ type: 'ADD_FULL_RESPONSE', payload: { message: { role: 'model', content: HELP_COMMAND_RESPONSE } } });
             return;
        }

        let finalPrompt = trimmedPrompt;
        let modeForRequest: ChatMode;
        let responseType: 'json' | 'text' = 'text';

        const isBriefingCommand = BRIEFING_TRIGGERS.some(trigger => trimmedPrompt.toLowerCase().includes(trigger)) || trimmedPrompt.toLowerCase() === '/brief';

        // Determine mode and prompt based on commands or user selection
        if (isBriefingCommand) {
            finalPrompt = SHIFT_BRIEFING_PROMPT();
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

        const userMessage: ChatMessage = { role: 'user', content: finalPrompt };
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
            const history = [...messages];
            // Optimization: If skipFileSending is true, we pass undefined for the file so it isn't sent to the API.
            const fileToSend = skipFileSending ? undefined : currentFile;
            const stream = generateResponseStream(finalPrompt, history, modeForRequest, { file: fileToSend, responseType });
            
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
    }, [chatMode, messages, uploadedFile]);

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

    return (
        <div className="flex flex-col h-screen font-sans overflow-hidden">
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