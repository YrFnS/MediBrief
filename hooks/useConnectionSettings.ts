
import { useState, useCallback } from 'react';

export const useConnectionSettings = () => {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [customApiKey, setCustomApiKey] = useState(() => sessionStorage.getItem('mediBriefCustomKey') || '');
    const [hasEnvKey] = useState(!!process.env.API_KEY);
    const [hasAiStudioKey, setHasAiStudioKey] = useState(false); // Track if user has connected via AI Studio

    const handleSelectAiStudioKey = useCallback(async () => {
        const win = window as any;
        if (win.aistudio) {
            try {
                await win.aistudio.openSelectKey();
                setHasAiStudioKey(true);
            } catch (e) {
                console.error("Key selection failed:", e);
            }
        }
    }, []);

    const handleSaveCustomKey = useCallback((key: string) => {
        setCustomApiKey(key);
        if (key) {
            sessionStorage.setItem('mediBriefCustomKey', key);
        } else {
            sessionStorage.removeItem('mediBriefCustomKey');
        }
    }, []);

    // Computed property: Do we have ANY valid way to connect?
    const hasValidConnection = hasEnvKey || hasAiStudioKey || !!customApiKey;

    return {
        isSettingsOpen,
        setIsSettingsOpen,
        customApiKey,
        hasEnvKey,
        hasAiStudioKey,
        hasValidConnection,
        handleSelectAiStudioKey,
        handleSaveCustomKey
    };
};
