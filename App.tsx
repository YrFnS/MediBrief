import React, { useState, useCallback, useEffect, useReducer } from 'react';
import type { ChatMessage, ChatMode, UploadedFile } from './types';
import { ChatMode as ChatModeEnum } from './types';
import Header from './components/Header';
import MessageList from './components/MessageList';
import InputBar from './components/InputBar';
import { generateResponseStream } from './services/geminiService';
import { processPdf, PdfProcessingStrategy } from './services/pdfService';
import { FILE_ANALYSIS_PROMPT, FILE_TEXT_ANALYSIS_PROMPT, BRIEFING_TRIGGERS, SHIFT_BRIEFING_PROMPT, HELP_COMMAND_RESPONSE } from './constants';

declare global {
    interface Window {
        pdfjsLib: any;
    }
}

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
    | { type: 'RESET_CHAT' };

const savedMessages = localStorage.getItem('mediBriefMessages');

const initialState: AppState = {
    messages: savedMessages ? JSON.parse(savedMessages) : [],
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
                lastMessage.content += action.payload.chunk;
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
             // If the last message was an empty model placeholder, replace it with the error.
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
            return { ...initialState, messages: [] };
        default:
            return state;
    }
};


// --- Helper Functions for handleSend Logic ---

const handleLocalCommand = (prompt: string): { isHandled: boolean; response?: ChatMessage } => {
    const lowerCasePrompt = prompt.trim().toLowerCase();
    if (!lowerCasePrompt.startsWith('/')) {
        return { isHandled: false };
    }

    const [command, ...args] = prompt.trim().split(' ');
    const argument = args.join(' ');

    if (command === '/help') {
        return { isHandled: true, response: { role: 'model', content: HELP_COMMAND_RESPONSE } };
    }

    if ((command === '/patient' || command === '/drugs') && !argument) {
        const usage = command === '/patient' ? '`/patient [ID]`' : '`/drugs [name]`';
        return { isHandled: true, response: { role: 'model', content: `Please provide an argument. Usage: ${usage}` } };
    }

    return { isHandled: false };
};

const determineRequestDetails = (prompt: string, chatMode: ChatMode): { finalPrompt: string, modeForRequest: ChatMode, responseType: 'json' | 'text' } => {
    const lowerCasePrompt = prompt.trim().toLowerCase();
    let finalPrompt = prompt;
    let modeForRequest: ChatMode | undefined;
    let responseType: 'json' | 'text' = 'text';

    const isBriefingRequest = BRIEFING_TRIGGERS.some(trigger => lowerCasePrompt.includes(trigger)) || lowerCasePrompt.startsWith('/brief');

    if (isBriefingRequest) {
        finalPrompt = SHIFT_BRIEFING_PROMPT();
        modeForRequest = ChatModeEnum.Deep;
        responseType = 'json';
    } else if (lowerCasePrompt.startsWith('/patient')) {
        finalPrompt = `Show patient summary for ${prompt.trim().split(' ').slice(1).join(' ')}`;
    } else if (lowerCasePrompt.startsWith('/drugs')) {
        finalPrompt = `Tell me about ${prompt.trim().split(' ').slice(1).join(' ')}`;
        modeForRequest = ChatModeEnum.Web;
    } else if (lowerCasePrompt.startsWith('/export')) {
        finalPrompt = 'export briefing';
    }

    if (!modeForRequest) {
        if (chatMode === ChatModeEnum.Auto) {
            if (/\b(latest|current|news|who is|what is|define)\b/i.test(prompt)) modeForRequest = ChatModeEnum.Web;
            else if (prompt.length > 200) modeForRequest = ChatModeEnum.Deep;
            else if (prompt.length < 60) modeForRequest = ChatModeEnum.Quick;
            else modeForRequest = ChatModeEnum.Standard;
        } else {
            modeForRequest = chatMode;
        }
    }

    return { finalPrompt, modeForRequest, responseType };
};


// --- Main App Component ---

const App: React.FC = () => {
    const [state, dispatch] = useReducer(appReducer, initialState);
    const { messages, isLoading, chatMode } = state;
    const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);

    useEffect(() => {
        if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs`;
        }
    }, []);
    
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('mediBriefMessages', JSON.stringify(messages));
        } else {
            localStorage.removeItem('mediBriefMessages');
        }
    }, [messages]);
    
    const handleClearChat = useCallback(() => {
        dispatch({ type: 'RESET_CHAT' });
    }, []);

    const handleFileUpload = useCallback(async (file: UploadedFile) => {
        const userMessage: ChatMessage = {
            role: 'user',
            content: `Processing ${file.file.name}...`,
            displayContent: `Processing ${file.file.name}...`,
            filePreview: { url: file.url, name: file.file.name, type: file.type },
        };
        dispatch({ type: 'START_REQUEST', payload: { userMessage } });
        setUploadedFile(null);

        let analysisPrompt: string;
        let fileForApi: UploadedFile | undefined = file;
        let displayContent: string;

        if (file.type === 'application/pdf') {
            const result = await processPdf(file.file);
            if (result.strategy === PdfProcessingStrategy.TEXT_EXTRACTION && result.extractedText) {
                analysisPrompt = FILE_TEXT_ANALYSIS_PROMPT(file.file.name, result.extractedText);
                fileForApi = undefined;
                displayContent = `Text extracted from ${file.file.name}. Analyzing content...`;
            } else { // OCR_FALLBACK
                analysisPrompt = FILE_ANALYSIS_PROMPT(file.file.name);
                fileForApi = file;
                displayContent = `This appears to be a scanned PDF. Using advanced OCR for analysis...`;
            }
        } else {
            analysisPrompt = FILE_ANALYSIS_PROMPT(file.file.name);
            fileForApi = file;
            displayContent = `Analyzing file: ${file.file.name}`;
        }

        dispatch({ type: 'UPDATE_LAST_MESSAGE_CONTENT', payload: displayContent });
        dispatch({ type: 'ADD_RESPONSE_PLACEHOLDER' });
        
        try {
            const stream = await generateResponseStream(analysisPrompt, messages, ChatModeEnum.Standard, { file: fileForApi });
            
            for await (const chunk of stream) {
                dispatch({ type: 'APPEND_TO_LAST_MESSAGE', payload: { chunk: chunk.text }});
            }

        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            dispatch({ type: 'REQUEST_FAILED', payload: `Failed to analyze file. Error: ${errorMessage}` });
        } finally {
            dispatch({ type: 'REQUEST_FINISH' });
        }
    }, [messages]);

    const handleSend = useCallback(async (prompt: string) => {
        if (!prompt.trim() && !uploadedFile) return;

        const userMessage: ChatMessage = {
            role: 'user',
            content: prompt,
            displayContent: prompt,
            filePreview: uploadedFile ? { url: uploadedFile.url, name: uploadedFile.file.name, type: uploadedFile.type } : undefined,
        };

        const commandResult = handleLocalCommand(prompt);
        if (commandResult.isHandled) {
            dispatch({ type: 'START_REQUEST', payload: { userMessage } });
            if (commandResult.response) {
                dispatch({ type: 'ADD_FULL_RESPONSE', payload: { message: commandResult.response } });
            }
            return;
        }

        dispatch({ type: 'START_REQUEST', payload: { userMessage } });
        const currentFile = uploadedFile;
        setUploadedFile(null); // Clear file after sending

        const { finalPrompt, modeForRequest, responseType } = determineRequestDetails(prompt, chatMode);

        dispatch({ type: 'ADD_RESPONSE_PLACEHOLDER' });

        try {
            const stream = await generateResponseStream(finalPrompt, messages, modeForRequest, { file: currentFile || undefined, responseType });
            
            for await (const chunk of stream) {
                 dispatch({ 
                    type: 'APPEND_TO_LAST_MESSAGE', 
                    payload: { 
                        chunk: chunk.text, 
                        sources: chunk.candidates?.[0]?.groundingMetadata?.groundingChunks 
                    }
                });
            }
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            dispatch({ type: 'REQUEST_FAILED', payload: `Failed to get response from AI. Error: ${errorMessage}` });
        } finally {
            dispatch({ type: 'REQUEST_FINISH' });
        }
    }, [chatMode, messages, uploadedFile]);
    
    return (
        <div className="flex flex-col h-screen font-sans">
            <Header currentMode={chatMode} onModeChange={(mode) => dispatch({ type: 'SET_CHAT_MODE', payload: mode })} onClearChat={handleClearChat} />
            <MessageList messages={messages} isLoading={isLoading} />
            <InputBar
                onSend={handleSend}
                onFileUpload={handleFileUpload}
                onClearFile={() => setUploadedFile(null)}
                setUploadedFile={setUploadedFile}
                uploadedFile={uploadedFile}
                isLoading={isLoading}
                currentMode={chatMode}
            />
        </div>
    );
};

export default App;
