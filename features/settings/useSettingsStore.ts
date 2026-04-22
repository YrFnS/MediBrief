
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { indexedDBStorage } from '../../services/storage';

export enum AIProvider {
    Gemini = 'Gemini',
    OpenRouter = 'OpenRouter'
}

interface SettingsState {
    provider: AIProvider;
    geminiApiKey: string;
    openRouterApiKey: string;
    selectedModel: string;
    
    // Actions
    setProvider: (provider: AIProvider) => void;
    setGeminiApiKey: (key: string) => void;
    setOpenRouterApiKey: (key: string) => void;
    setSelectedModel: (model: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            provider: AIProvider.Gemini,
            geminiApiKey: '',
            openRouterApiKey: '',
            selectedModel: 'gemini-flash-lite-latest',
            
            setProvider: (provider) => set({ provider }),
            setGeminiApiKey: (geminiApiKey) => set({ geminiApiKey }),
            setOpenRouterApiKey: (openRouterApiKey) => set({ openRouterApiKey }),
            setSelectedModel: (selectedModel) => set({ selectedModel }),
        }),
        {
            name: 'medibrief-settings-storage',
            storage: createJSONStorage(() => indexedDBStorage),
            // We want to persist the keys and settings
        }
    )
);
