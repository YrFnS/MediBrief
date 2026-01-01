
import { useState, useCallback, useEffect } from 'react';
import { loginWithGoogle, logout, getAuthStatus, type AuthStatus } from '../services/authService';

export const useConnectionSettings = () => {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [customApiKey, setCustomApiKey] = useState(() => sessionStorage.getItem('mediBriefCustomKey') || '');
    const [hasEnvKey] = useState(!!import.meta.env.VITE_GEMINI_API_KEY);

    // OAuth state
    const [isOAuthAuthenticated, setIsOAuthAuthenticated] = useState(false);
    const [oauthUserEmail, setOauthUserEmail] = useState<string | undefined>(undefined);

    // Check OAuth status on mount
    useEffect(() => {
        const checkAuthStatus = async () => {
            const status = await getAuthStatus();
            setIsOAuthAuthenticated(status.authenticated);
            setOauthUserEmail(status.user?.email);
        };
        checkAuthStatus();
    }, []);

    // OAuth handlers
    const handleOAuthLogin = useCallback(async () => {
        const success = await loginWithGoogle();
        if (success) {
            const status = await getAuthStatus();
            setIsOAuthAuthenticated(status.authenticated);
            setOauthUserEmail(status.user?.email);
        }
    }, []);

    const handleOAuthLogout = useCallback(async () => {
        await logout();
        setIsOAuthAuthenticated(false);
        setOauthUserEmail(undefined);
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
    const hasValidConnection = hasEnvKey || isOAuthAuthenticated || !!customApiKey;

    return {
        isSettingsOpen,
        setIsSettingsOpen,
        customApiKey,
        hasEnvKey,
        hasValidConnection,
        // OAuth
        isOAuthAuthenticated,
        oauthUserEmail,
        handleOAuthLogin,
        handleOAuthLogout,
        // API Key
        handleSaveCustomKey
    };
};
