
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { ChatMode } from '../../types';
import { LabReport } from '../chat/schemas';

// --- State Definition ---

export interface UIState {
    isLoading: boolean;
    error: string | null;
    chatMode: ChatMode;
    pendingLabReport: LabReport | null; // Quarantine state for OCR verification
}

// --- Actions ---

export type UIAction =
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'SET_CHAT_MODE'; payload: ChatMode }
    | { type: 'SET_PENDING_LAB_REPORT'; payload: LabReport | null }
    | { type: 'CLEAR_ERROR' };

// --- Initial State ---

const STORAGE_KEY_MODE = 'mediBrief_chatMode_v1';

const getInitialMode = (): ChatMode => {
    try {
        const saved = sessionStorage.getItem(STORAGE_KEY_MODE);
        if (saved && Object.values(ChatMode).includes(saved as ChatMode)) {
            return saved as ChatMode;
        }
    } catch (e) { }
    return ChatMode.Standard;
};

const initialState: UIState = {
    isLoading: false,
    error: null,
    chatMode: getInitialMode(),
    pendingLabReport: null,
};

// --- Reducer ---

const uiReducer = (state: UIState, action: UIAction): UIState => {
    switch (action.type) {
        case 'SET_LOADING':
            return { ...state, isLoading: action.payload };
        case 'SET_ERROR':
            return { ...state, error: action.payload, isLoading: false };
        case 'CLEAR_ERROR':
            return { ...state, error: null };
        case 'SET_CHAT_MODE':
            return { ...state, chatMode: action.payload };
        case 'SET_PENDING_LAB_REPORT':
            return { ...state, pendingLabReport: action.payload };
        default:
            return state;
    }
};

// --- Context ---

interface UIContextType {
    uiState: UIState;
    uiDispatch: React.Dispatch<UIAction>;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [uiState, uiDispatch] = useReducer(uiReducer, initialState);

    // Persistence
    useEffect(() => {
        sessionStorage.setItem(STORAGE_KEY_MODE, uiState.chatMode);
    }, [uiState.chatMode]);

    return React.createElement(UIContext.Provider, {
        value: { uiState, uiDispatch }
    }, children);
};

export const useUIStore = () => {
    const context = useContext(UIContext);
    if (!context) {
        throw new Error("useUIStore must be used within a UIProvider");
    }
    return context;
};
