import React, { useState, useCallback, useEffect, useReducer } from 'react';
import type { ChatMessage, ChatMode, UploadedFile } from './types';
import { ChatMode as ChatModeEnum } from './types';
import Header from './components/Header';
import MessageList from './components/MessageList';
import InputBar from './components/InputBar';
import { generateResponse } from './services/geminiService';
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
    uploadedFile: UploadedFile | null;
}

type AppAction =
    | { type: 'START_REQUEST'; payload: { userMessage: ChatMessage } }
    | { type: 'UPDATE_LAST_MESSAGE'; payload: Partial<ChatMessage> }
    | { type: 'ADD_RESPONSE'; payload: { message: ChatMessage; consumesFile?: boolean } }
    | { type: 'REQUEST_FAILED'; payload: string }
    | { type: 'SET_CHAT_MODE'; payload: ChatMode }
    | { type: 'SET_UPLOADED_FILE'; payload: UploadedFile | null };

const initialState: AppState = {
    messages: [],
    isLoading: false,
    chatMode: ChatModeEnum.Auto,
    error: null,
    uploadedFile: null,
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
        case 'UPDATE_LAST_MESSAGE': {
            const newMessages = [...state.messages];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage) {
                Object.assign(lastMessage, action.payload);
            }
            return { ...state, messages: newMessages };
        }
        case 'ADD_RESPONSE':
            return {
                ...state,
                isLoading: false,
                messages: [...state.messages, action.payload.message],
                // Clear the file if it was consumed by this response
                uploadedFile: action.payload.consumesFile ? null : state.uploadedFile,
            };
        case 'REQUEST_FAILED':
            return {
                ...state,
                isLoading: false,
                error: action.payload,
                messages: [...state.messages, { role: 'model', content: `Sorry, I encountered an error. Please try again. \n\n**Details:** ${action.payload}` }],
            };
        case 'SET_CHAT_MODE':
            return { ...state, chatMode: action.payload };
        case 'SET_UPLOADED_FILE':
            return { ...state, uploadedFile: action.payload };
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

const determineRequestDetails = (prompt: string, chatMode: ChatMode, hasFile: boolean): { finalPrompt: string, modeForRequest: ChatMode, responseType: 'json' | 'text' } => {
    const lowerCasePrompt = prompt.trim().toLowerCase();
    let finalPrompt = prompt;
    let modeForRequest: ChatMode | undefined;
    let responseType: 'json' | 'text' = 'text';

    const isBriefingRequest = BRIEFING_TRIGGERS.some(trigger => lowerCasePrompt.includes(trigger)) || lowerCasePrompt.startsWith('/brief');

    if (isBriefingRequest) {
        finalPrompt = SHIFT_BRIEFING_PROMPT();
        modeForRequest = ChatModeEnum.Deep;
        responseType = 'json'; // Explicitly set JSON for briefings
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

    if (hasFile) {
        modeForRequest = ChatModeEnum.Standard;
    }

    return { finalPrompt, modeForRequest, responseType };
};


// --- Main App Component ---

const App: React.FC = () => {
    const [state, dispatch] = useReducer(appReducer, initialState);
    const { messages, isLoading, chatMode, uploadedFile } = state;

    useEffect(() => {
        if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.worker.min.mjs`;
        }
    }, []);

    const handleFileUpload = useCallback(async (file: UploadedFile) => {
        const userMessage: ChatMessage = {
            role: 'user',
            content: `Processing ${file.file.name}...`,
            displayContent: `Processing ${file.file.name}...`,
            filePreview: { url: file.url, name: file.file.name, type: file.type },
        };
        dispatch({ type: 'START_REQUEST', payload: { userMessage } });

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

        dispatch({ type: 'UPDATE_LAST_MESSAGE', payload: { content: analysisPrompt, displayContent } });

        try {
            // Use a functional state update with the reducer to get the latest history
            const currentHistory = (currentState: AppState) => currentState.messages;
            const response = await generateResponse(analysisPrompt, currentHistory(state), ChatModeEnum.Standard, { file: fileForApi });
            dispatch({ type: 'ADD_RESPONSE', payload: { message: { role: 'model', content: response.text }, consumesFile: true } });
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            dispatch({ type: 'REQUEST_FAILED', payload: `Failed to analyze file. Error: ${errorMessage}` });
        }
    }, [state]);

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
                dispatch({ type: 'ADD_RESPONSE', payload: { message: commandResult.response } });
            }
            return;
        }

        dispatch({ type: 'START_REQUEST', payload: { userMessage } });

        const { finalPrompt, modeForRequest, responseType } = determineRequestDetails(prompt, chatMode, !!uploadedFile);

        try {
            // The reducer ensures `messages` is up-to-date for the history
            const response = await generateResponse(finalPrompt, messages, modeForRequest, { file: uploadedFile || undefined, responseType });
            const modelMessage: ChatMessage = {
                role: 'model',
                content: response.text,
                sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks,
            };
            dispatch({ type: 'ADD_RESPONSE', payload: { message: modelMessage, consumesFile: !!uploadedFile } });
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
            dispatch({ type: 'REQUEST_FAILED', payload: `Failed to get response from AI. Error: ${errorMessage}` });
        }
    }, [chatMode, messages, uploadedFile]);
    
    return (
        <div className="flex flex-col h-screen font-sans">
            <Header currentMode={chatMode} onModeChange={(mode) => dispatch({ type: 'SET_CHAT_MODE', payload: mode })} />
            <MessageList messages={messages} />
            <InputBar
                onSend={handleSend}
                onFileUpload={handleFileUpload}
                onClearFile={() => dispatch({ type: 'SET_UPLOADED_FILE', payload: null })}
                setUploadedFile={(file) => dispatch({ type: 'SET_UPLOADED_FILE', payload: file })}
                uploadedFile={uploadedFile}
                isLoading={isLoading}
                currentMode={chatMode}
            />
        </div>
    );
};

// A small change to InputBar props to allow it to call dispatch for setting the file.
const InputBarWithDispatch: React.FC<Omit<React.ComponentProps<typeof InputBar>, 'onFileUpload'> & { onFileUpload: (file: UploadedFile) => void; setUploadedFile: (file: UploadedFile) => void }> = (props) => {
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > 4 * 1024 * 1024) {
                alert("File is too large. Please select a file smaller than 4MB.");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = (reader.result as string).split(',')[1];
                const uploadPayload: UploadedFile = { file, base64, type: file.type };
                if (file.type.startsWith('image/')) {
                    uploadPayload.url = URL.createObjectURL(file);
                }
                // Differentiate between auto-analyzing and just attaching
                if (props.currentMode === ChatModeEnum.Auto && !document.querySelector('textarea')?.value.trim()) {
                     props.onFileUpload(uploadPayload);
                } else {
                     props.setUploadedFile(uploadPayload);
                }
            };
            reader.readAsDataURL(file);
        }
        if (event.target) event.target.value = '';
    };
    return <InputBar {...props} onFileUpload={(file: UploadedFile) => handleFileChange({ target: { files: [file.file] } } as any)} />;
};


export default App;