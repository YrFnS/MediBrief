
import { useReducer, useEffect } from 'react';
import type { ChatMessage, ChatMode, GroundingSource } from '../types';
import { ChatMode as ChatModeEnum } from '../types';

export interface AppState {
    messages: ChatMessage[];
    isLoading: boolean;
    chatMode: ChatMode;
    error: string | null;
}

export type AppAction =
    | { type: 'START_REQUEST'; payload: { userMessage: ChatMessage } }
    | { type: 'ADD_RESPONSE_PLACEHOLDER' }
    | { type: 'APPEND_TO_LAST_MESSAGE'; payload: { chunk: string, sources?: GroundingSource[] } }
    | { type: 'REQUEST_FINISH' }
    | { type: 'ADD_FULL_RESPONSE'; payload: { message: ChatMessage; consumesFile?: boolean } }
    | { type: 'UPDATE_LAST_MESSAGE_CONTENT'; payload: string }
    | { type: 'REQUEST_FAILED'; payload: string }
    | { type: 'SET_CHAT_MODE'; payload: ChatMode }
    | { type: 'RESET_CHAT' }
    | { type: 'ADD_INTERIM_MESSAGE', payload: ChatMessage }
    | { type: 'SET_LOADING', payload: boolean };

const getInitialMessages = (): ChatMessage[] => {
    try {
        const savedMessages = sessionStorage.getItem('mediBriefMessages');
        if (savedMessages) {
            const parsed = JSON.parse(savedMessages);
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
    return ChatModeEnum.Standard;
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
                    const existingSources = lastMessage.sources || [];
                    const newSources = action.payload.sources.filter(ns => 
                        !existingSources.some(es => 
                            (es.web?.uri === ns.web?.uri && es.web?.uri) || 
                            (es.maps?.uri === ns.maps?.uri && es.maps?.uri)
                        )
                    );
                    lastMessage.sources = [...existingSources, ...newSources];
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

export const useAppStore = () => {
    const [state, dispatch] = useReducer(appReducer, initialState);

    // Persistence: Messages
    useEffect(() => {
        const saveMessages = (msgsToSave: ChatMessage[]) => {
            try {
                const optimizedMessages = msgsToSave.map(msg => {
                    if (msg.filePreview) {
                        const isDataUrl = msg.filePreview.url?.startsWith('data:');
                        const isBlobUrl = msg.filePreview.url?.startsWith('blob:');
                        return {
                            ...msg,
                            filePreview: {
                                ...msg.filePreview,
                                base64: undefined, 
                                url: (isDataUrl || isBlobUrl) ? undefined : msg.filePreview.url 
                            }
                        };
                    }
                    return msg;
                });
                sessionStorage.setItem('mediBriefMessages', JSON.stringify(optimizedMessages));
            } catch (e) {
                console.warn("Storage quota exceeded. Saving text-only history.");
                try {
                     const textOnly = msgsToSave.map(m => ({
                         role: m.role,
                         content: m.content,
                         filePreview: undefined
                     }));
                     sessionStorage.setItem('mediBriefMessages', JSON.stringify(textOnly));
                } catch(e2) {
                     console.error("Storage completely full.", e2);
                }
            }
        };

        if (state.messages.length > 0) {
            saveMessages(state.messages);
        } else {
            sessionStorage.removeItem('mediBriefMessages');
        }
    }, [state.messages]);

    // Persistence: Chat Mode
    useEffect(() => {
        try {
            sessionStorage.setItem('mediBriefChatMode', state.chatMode);
        } catch (e) {
            console.error("Failed to save chat mode preference.");
        }
    }, [state.chatMode]);

    return { state, dispatch };
};
