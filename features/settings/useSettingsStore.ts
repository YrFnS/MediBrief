
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { indexedDBStorage } from '../../services/storage';
import { ChatMode } from '../../types';

export enum AIProvider {
    Gemini = 'Gemini',
    OpenRouter = 'OpenRouter'
}

interface SettingsState {
    provider: AIProvider;
    geminiApiKey: string;
    openRouterApiKey: string;
    customModels: Record<ChatMode, string>;
    
    // Actions
    setProvider: (provider: AIProvider) => void;
    setGeminiApiKey: (key: string) => void;
    setOpenRouterApiKey: (key: string) => void;
    setCustomModel: (mode: ChatMode, model: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            provider: AIProvider.Gemini,
            geminiApiKey: '',
            openRouterApiKey: '',
            customModels: {
                [ChatMode.Standard]: '',
                [ChatMode.Deep]: '',
                [ChatMode.Live]: '',
                [ChatMode.Scribe]: ''
            },
            
            setProvider: (provider) => set({ provider }),
            setGeminiApiKey: (geminiApiKey) => set({ geminiApiKey }),
            setOpenRouterApiKey: (openRouterApiKey) => set({ openRouterApiKey }),
            setCustomModel: (mode, model) => set((state) => ({ 
                customModels: { ...state.customModels, [mode]: model } 
            })),
        }),
        {
            name: 'medibrief-settings-storage',
            storage: createJSONStorage(() => indexedDBStorage),
            // We want to persist the keys and settings
        }
    )
);
