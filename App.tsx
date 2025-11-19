
import React, { useState, useCallback, useEffect, useReducer, useRef } from 'react';
import type { ChatMessage, ChatMode, UploadedFile, LiveTranscript } from './types';
import { ChatMode as ChatModeEnum } from './types';
import Header from './components/Header';
import MessageList from './components/MessageList';
import InputBar from './components/InputBar';
import { generateResponseStream } from './services/geminiService';
import { exportBriefingToPdf } from './services/exportService';
import { cleanJsonOutput, isJsonBriefing } from './utils';
import { FILE_ANALYSIS_PROMPT, BRIEFING_TRIGGERS, SHIFT_BRIEFING_PROMPT, HELP_COMMAND_RESPONSE } from './constants';
import { useLiveSession } from './hooks/useLiveSession';
import { DocumentTextIcon } from './components/icons';

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
        // SECURITY FIX: Use sessionStorage instead of localStorage.
        // This ensures patient data is wiped when the tab closes, preventing
        // unauthorized access on shared hospital workstations.
        const savedMessages = sessionStorage.getItem('mediBriefMessages');
        if (savedMessages) {
            const parsed = JSON.parse(savedMessages);
            // Basic validation to ensure it's an array of messages
            if (Array.isArray(parsed) && parsed.every(m => 'role' in m && 'content' in m)) {
                return parsed;
            }
        }
    } catch (error) {
        console.error("Failed to parse messages from sessionStorage. Clearing corrupted data.", error);
        sessionStorage.removeItem('mediBriefMessages');
    }
    return [];
};

const getInitialMode = (): ChatMode => {
    try {
        const savedMode = sessionStorage.getItem('mediBriefChatMode');
        if (savedMode && Object.values(ChatModeEnum).includes(savedMode as ChatModeEnum)) {
            return savedMode as ChatModeEnum;
        }
    } catch (error) {
        console.error("Failed to parse chat mode.", error);
    }
    return ChatModeEnum.Auto;
};

const initialState: AppState = {
    messages: getInitialMessages(),
    isLoading: false,
    chatMode: getInitialMode(),
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
    const [isDragging, setIsDragging] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

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
                // CRITICAL: We must remove blob URLs as they are temporary.
                // Weakness Fix: We aggressively optimize storage to prevent crashes.
                const optimizedMessages = msgsToSave.map(msg => {
                    if (msg.filePreview) {
                        const isDataUrl = msg.filePreview.url?.startsWith('data:');
                        const isBlobUrl = msg.filePreview.url?.startsWith('blob:');
                        
                        // Strategy: Don't save base64 in sessionStorage if it's huge.
                        // This means on refresh, the image PREVIEW might disappear, but the CHAT TEXT remains.
                        // This is a better trade-off than the app crashing.
                        return {
                            ...msg,
                            filePreview: {
                                ...msg.filePreview,
                                base64: undefined, // Don't persist heavy base64
                                url: (isDataUrl || isBlobUrl) ? undefined : msg.filePreview.url 
                            }
                        };
                    }
                    return msg;
                });
                sessionStorage.setItem('mediBriefMessages', JSON.stringify(optimizedMessages));
            } catch (e) {
                console.warn("Storage quota exceeded. Saving text-only history.");
                // Fallback: Strip EVERYTHING related to files to save at least the text
                try {
                     const textOnly = msgsToSave.map(m => ({
                         role: m.role,
                         content: m.content,
                         // Strip file info entirely
                         filePreview: undefined
                     }));
                     sessionStorage.setItem('mediBriefMessages', JSON.stringify(textOnly));
                } catch(e2) {
                     console.error("Storage completely full.", e2);
                }
            }
        };

        if (messages.length > 0) {
            saveMessages(messages);
        } else {
            sessionStorage.removeItem('mediBriefMessages');
        }
    }, [messages]);

    // --- Chat Mode Persistence ---
    useEffect(() => {
        try {
            sessionStorage.setItem('mediBriefChatMode', chatMode);
        } catch (e) {
            console.error("Failed to save chat mode preference.");
        }
    }, [chatMode]);
    
    const handleClearChat = useCallback(() => {
        dispatch({ type: 'RESET_CHAT' });
    }, []);

    // --- DRAG AND DROP HANDLERS ---
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        
        // WEAKNESS FIX: Mobile/Touch Protection & File Type Check
        // 1. If touch is active, disable drag overlay to prevent it blocking scroll
        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;
        
        // 2. Only activate if the user is actually dragging a FILE
        if (!e.dataTransfer.types.includes('Files')) return;

        if (!isDragging) setIsDragging(true);
    }, [isDragging]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        // Only set false if we are leaving the main window (relatedTarget is null)
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        
        const file = e.dataTransfer.files?.[0];
        if (file) {
             if (file.size > 4 * 1024 * 1024) { 
                alert("File is too large. Please select a file smaller than 4MB.");
                return;
            }
            // Check for supported types (Image, PDF, Text)
            const isSupported = file.type.startsWith('image/') || file.type === 'application/pdf' || file.type === 'text/plain' || file.name.endsWith('.md') || file.name.endsWith('.txt');
            if (!isSupported) {
                 alert("Unsupported file type. Please upload Images, PDFs, or Text files.");
                 return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                const uploadPayload: UploadedFile = { file, base64, type: file.type };
                if (file.type.startsWith('image/')) {
                    uploadPayload.url = URL.createObjectURL(file);
                }
                setUploadedFile(uploadPayload);
            };
            reader.readAsDataURL(file);
        }
    }, []);

    // --- STOP GENERATION HANDLER ---
    const handleStop = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            // Do NOT set to null here. Doing so causes the loop in handleSend to 
            // lose reference to the aborted signal and continue processing.
            // The controller will be cleaned up in the finally block of the generator.
        }
        dispatch({ type: 'REQUEST_FINISH' });
    }, []);

    /**
     * @param userPrompt The text prompt to send.
     */
    const handleSend = useCallback(async (userPrompt: string) => {
        const trimmedPrompt = userPrompt.trim();
        
        // If we have neither text nor a file, do nothing.
        if (!trimmedPrompt && !uploadedFile) return;

        // CRITICAL UX FIX: If the user decides to TYPE a message while a Live Voice session is active,
        // we must Stop the voice session immediately.
        if (isLive) {
            stopSession();
            // VISUAL FIX: explicitly revert to Auto mode so the user knows they are no longer in Live mode.
            dispatch({ type: 'SET_CHAT_MODE', payload: ChatModeEnum.Auto });
        }
        
        // Command to directly export the briefing as a PDF
        if (trimmedPrompt.toLowerCase() === '/export') {
             // FIX: Prevent hallucinations on empty chat
             // We check if there are ANY messages with actual content (excluding welcome/system messages)
            const history = messages.filter(m => !isJsonBriefing(m.content));
            
            if (history.length === 0) {
                 dispatch({ type: 'ADD_INTERIM_MESSAGE', payload: { role: 'model', content: '⚠️ **Cannot Export:** There is no patient data or conversation history to summarize yet. Please upload a chart or discuss a case first.' } });
                 return;
            }

            dispatch({ type: 'ADD_INTERIM_MESSAGE', payload: { role: 'model', content: '📥 Generating your briefing for PDF export. This may take a moment...' } });
            dispatch({ type: 'SET_LOADING', payload: true });
            
            abortControllerRef.current = new AbortController();

            try {
                const modeForRequest = ChatModeEnum.Deep;
                const briefingPrompt = SHIFT_BRIEFING_PROMPT();

                const stream = generateResponseStream(briefingPrompt, history, modeForRequest, { responseType: 'json' });
                let fullResponseText = '';
                for await (const chunk of stream) {
                    if (abortControllerRef.current?.signal.aborted) {
                         throw new Error("Aborted");
                    }
                    fullResponseText += chunk.text;
                }
                
                // Handle NO DATA case if the model followed instruction
                if (fullResponseText.includes("NO DATA")) {
                    throw new Error("Insufficient clinical data found to generate a briefing.");
                }

                const cleanedJson = cleanJsonOutput(fullResponseText);

                if (!cleanedJson.startsWith('{')) {
                    throw new Error("The model did not return a valid briefing. Ensure there is enough context in the chat to generate a report.");
                }
                
                const parsedBriefing = JSON.parse(cleanedJson);
                
                // Double check for empty title or NO DATA flag in JSON
                if (parsedBriefing.briefingTitle && parsedBriefing.briefingTitle.includes("NO DATA")) {
                    throw new Error("Insufficient clinical data found to generate a briefing.");
                }

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

        // --- FILE PROCESSING LOGIC ---
        // If a file is uploaded, we need to process it *before* determining the final prompt.
        
        let finalApiPrompt = trimmedPrompt;
        let historyContent = trimmedPrompt;
        // By default, we send the file. 
        // We NO LONGER do client-side extraction for PDFs ("The OCR Lobotomy").
        // Gemini Native Multimodal is superior for medical charts/tables.
        let fileForApi: UploadedFile | undefined = uploadedFile || undefined;
        let displayOverride = undefined;

        // --- MODE SELECTION & COMMAND DETECTION ---
        let modeForRequest: ChatMode;
        let responseType: 'json' | 'text' = 'text';

        const isBriefingCommand = BRIEFING_TRIGGERS.some(trigger => trimmedPrompt.toLowerCase().includes(trigger)) || trimmedPrompt.toLowerCase() === '/brief';

        if (uploadedFile) {
             try {
                let analysisPrompt: string;
                
                if (uploadedFile.type === 'application/pdf') {
                    // PDF Logic: Pass file directly to Gemini.
                    // We still use a structured prompt to guide the analysis.
                    const promptBase = trimmedPrompt ? `User Query: ${trimmedPrompt}` : `Analyze this medical document.`;
                    analysisPrompt = FILE_ANALYSIS_PROMPT(uploadedFile.file.name) + `\n\n${promptBase}`;
                } else if (uploadedFile.type === 'text/plain' || uploadedFile.file.name.endsWith('.txt') || uploadedFile.file.name.endsWith('.md')) {
                     // Text files: AMNESIA FIX
                     // We read the content and EMBED it into the history.
                     // This ensures that in future turns, the model still has access to the text.
                     const textContent = await uploadedFile.file.text();
                     
                     const promptBase = trimmedPrompt ? `User Query: ${trimmedPrompt}` : `Analyze this document.`;
                     
                     // This huge string goes to the API and History
                     const fullEmbeddedContent = `*** BEGIN FILE CONTENT: ${uploadedFile.file.name} ***\n${textContent}\n*** END FILE CONTENT ***\n\n${promptBase}`;
                     
                     analysisPrompt = fullEmbeddedContent;
                     historyContent = fullEmbeddedContent;
                     
                     // This clean string is what the user sees
                     displayOverride = `📄 **Uploaded ${uploadedFile.file.name}**\n\n${trimmedPrompt || "Requested analysis."}`;
                     
                     // We do not need to send the file blob, as we embedded the text
                     fileForApi = undefined; 
                } else {
                    // Images
                    if (!trimmedPrompt) {
                        analysisPrompt = FILE_ANALYSIS_PROMPT(uploadedFile.file.name);
                        displayOverride = `Analyzing file: ${uploadedFile.file.name}`; 
                    } else {
                        analysisPrompt = trimmedPrompt;
                    }
                }
                
                finalApiPrompt = analysisPrompt;
                
                // FIX: "The Briefing Bulldozer"
                if (isBriefingCommand) {
                    finalApiPrompt = `${finalApiPrompt}\n\nIMPORTANT: After analyzing the above document, ${SHIFT_BRIEFING_PROMPT()}`;
                    modeForRequest = ChatModeEnum.Deep;
                    responseType = 'json';
                    // For text files, historyContent is already set above. For PDFs/Images, we update it here.
                    if (!displayOverride) historyContent = trimmedPrompt || "/brief (with file)";
                }
                
             } catch (error) {
                 const friendlyError = getFriendlyErrorMessage(error);
                 dispatch({ type: 'REQUEST_FAILED', payload: friendlyError });
                 return;
             }
        } else if (isBriefingCommand) {
            // Normal briefing without new file
            finalApiPrompt = SHIFT_BRIEFING_PROMPT();
            historyContent = "/brief"; 
            modeForRequest = ChatModeEnum.Deep;
            responseType = 'json';
        }

        // Standard Mode Logic (if not overridden by briefing logic above)
        if (!modeForRequest!) { // If mode wasn't set by briefing logic
             if (trimmedPrompt.toLowerCase().startsWith('/patient')) {
                modeForRequest = ChatModeEnum.Deep;
            } else if (chatMode === ChatModeEnum.Live) {
                // If we were in Live mode but are sending text, fallback to Auto
                modeForRequest = ChatModeEnum.Auto;
            } else {
                modeForRequest = chatMode;
            }
        }

        // --- UPDATE UI STATE ---
        const userMessage: ChatMessage = { role: 'user', content: historyContent };
        if (displayOverride) {
            userMessage.displayContent = displayOverride;
        }
        
        if (uploadedFile) {
            const persistenceUrl = uploadedFile.type.startsWith('image/') && uploadedFile.base64 
                ? `data:${uploadedFile.type};base64,${uploadedFile.base64}` 
                : undefined;

            userMessage.filePreview = { 
                name: uploadedFile.file.name, 
                type: uploadedFile.type, 
                url: persistenceUrl,
                // Only persist base64 if we actually sent it to API (i.e. not a text file we extracted)
                base64: fileForApi ? uploadedFile.base64 : undefined 
            };
        }
        
        dispatch({ type: 'START_REQUEST', payload: { userMessage } });
        dispatch({ type: 'ADD_RESPONSE_PLACEHOLDER' });
        setUploadedFile(null); // Clear file from input

        // --- SEND API REQUEST ---
        abortControllerRef.current = new AbortController();

        try {
            const history = [...messages];
            const stream = generateResponseStream(finalApiPrompt, history, modeForRequest, { file: fileForApi, responseType });
            
            for await (const chunk of stream) {
                if (abortControllerRef.current?.signal.aborted) {
                    throw new Error("Aborted");
                }
                const sources = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
                dispatch({ type: 'APPEND_TO_LAST_MESSAGE', payload: { chunk: chunk.text || '', sources } });
            }
        } catch (e) {
             if (e.message === "Aborted") {
                 // Append " [Stopped]" to the message
                 dispatch({ type: 'APPEND_TO_LAST_MESSAGE', payload: { chunk: " [Stopped]" } });
            } else {
                const friendlyError = getFriendlyErrorMessage(e);
                dispatch({ type: 'REQUEST_FAILED', payload: friendlyError });
            }
        } finally {
            dispatch({ type: 'REQUEST_FINISH' });
            abortControllerRef.current = null;
        }
    }, [chatMode, messages, uploadedFile, isLive, stopSession]);

    const handleExportChat = useCallback(() => {
        handleSend('/export');
    }, [handleSend]);

    const toggleLiveSession = useCallback(() => {
        if (isLive) {
            stopSession();
        } else {
            // PASS CONTEXT: Inject the current chat history into the live session
            startSession(messages);
        }
    }, [isLive, stopSession, startSession, messages]);

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
        <div 
            className="flex flex-col h-[100dvh] font-sans overflow-hidden relative"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Drag and Drop Overlay */}
            {isDragging && (
                <div className="absolute inset-0 z-50 bg-blue-500/10 backdrop-blur-sm flex items-center justify-center border-4 border-blue-500 border-dashed m-4 rounded-xl animate-pulse pointer-events-none">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-xl flex flex-col items-center text-blue-500">
                        <DocumentTextIcon className="w-16 h-16 mb-4" />
                        <h2 className="text-2xl font-bold">Drop Medical Records Here</h2>
                        <p className="text-slate-500 mt-2">PDF, Images (X-Ray, EKG), or Text</p>
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
                onClearFile={() => setUploadedFile(null)}
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
