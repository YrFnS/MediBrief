
import React, { useState } from 'react';
import { KeyIcon, CheckIcon, XCircleIcon, CogIcon } from './icons';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    // OAuth props
    isOAuthAuthenticated: boolean;
    oauthUserEmail?: string;
    onOAuthLogin: () => Promise<void>;
    onOAuthLogout: () => Promise<void>;
    // API Key props
    customApiKey: string;
    onSaveCustomKey: (key: string) => void;
}

type AuthTab = 'oauth' | 'apikey';

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    isOAuthAuthenticated,
    oauthUserEmail,
    onOAuthLogin,
    onOAuthLogout,
    customApiKey,
    onSaveCustomKey
}) => {
    const [activeTab, setActiveTab] = useState<AuthTab>('oauth');
    const [tempKey, setTempKey] = useState(customApiKey);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleOAuthLogin = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await onOAuthLogin();
        } catch (err: any) {
            setError(err.message || 'Login failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleOAuthLogout = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await onOAuthLogout();
        } catch (err: any) {
            setError(err.message || 'Logout failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveApiKey = () => {
        onSaveCustomKey(tempKey);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <CogIcon className="w-6 h-6 text-slate-500" />
                            Authentication
                        </h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                            <XCircleIcon className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex gap-2 mb-6 bg-slate-100 dark:bg-slate-700/50 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('oauth')}
                            className={`flex-1 px-4 py-2 rounded-md font-medium text-sm transition-all ${activeTab === 'oauth'
                                    ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                        >
                            Google Subscription
                        </button>
                        <button
                            onClick={() => setActiveTab('apikey')}
                            className={`flex-1 px-4 py-2 rounded-md font-medium text-sm transition-all ${activeTab === 'apikey'
                                    ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                }`}
                        >
                            API Key
                        </button>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg">
                            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                        </div>
                    )}

                    <div className="space-y-4">
                        {/* OAuth Tab */}
                        {activeTab === 'oauth' && (
                            <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-xl border border-blue-100 dark:border-blue-900/30">
                                <div className="flex items-start gap-3 mb-4">
                                    <div className="text-4xl">🔐</div>
                                    <div className="flex-1">
                                        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                                            Sign in with Google
                                        </h3>
                                        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                                            Use your Google account for secure, seamless authentication.
                                        </p>
                                    </div>
                                </div>

                                {!isOAuthAuthenticated ? (
                                    <>
                                        <div className="mb-4 space-y-2">
                                            <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                                                <CheckIcon className="w-4 h-4" />
                                                <span>60 requests/min, 1000 requests/day</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                                                <CheckIcon className="w-4 h-4" />
                                                <span>No API key management needed</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                                                <CheckIcon className="w-4 h-4" />
                                                <span>Automatic model updates</span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleOAuthLogin}
                                            disabled={isLoading}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isLoading ? (
                                                <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                                    </svg>
                                                    Login with Google
                                                </>
                                            )}
                                        </button>
                                    </>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/50 rounded-lg">
                                            <div className="flex items-center gap-2 mb-1">
                                                <CheckIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
                                                <span className="text-sm font-semibold text-green-900 dark:text-green-100">
                                                    Authenticated
                                                </span>
                                            </div>
                                            <p className="text-xs text-green-700 dark:text-green-300 ml-6">
                                                {oauthUserEmail || 'Connected via Google'}
                                            </p>
                                        </div>

                                        <button
                                            onClick={handleOAuthLogout}
                                            disabled={isLoading}
                                            className="w-full px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                        >
                                            {isLoading ? 'Logging out...' : 'Logout'}
                                        </button>
                                    </div>
                                )}

                                <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800/50">
                                    <p className="text-[10px] text-blue-600/80 dark:text-blue-400/80 text-center">
                                        Requires backend server running. See{' '}
                                        <a href="https://github.com/google-gemini/gemini-cli" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-800 dark:hover:text-blue-200">
                                            setup guide
                                        </a>
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* API Key Tab */}
                        {activeTab === 'apikey' && (
                            <div className="bg-slate-50 dark:bg-slate-700/30 p-5 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="flex items-start gap-3 mb-4">
                                    <div className="text-4xl">🔑</div>
                                    <div className="flex-1">
                                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                                            Manual API Key
                                        </h3>
                                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                            Enter your Gemini API key for direct access.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <input
                                        type="password"
                                        value={tempKey}
                                        onChange={(e) => setTempKey(e.target.value)}
                                        placeholder="AIzaSy..."
                                        className="w-full px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    />

                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-1">
                                        <div>• Get your key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-200">Google AI Studio</a></div>
                                        <div>• Stored in browser session only</div>
                                        <div>• Works without backend server</div>
                                    </div>

                                    <button
                                        onClick={handleSaveApiKey}
                                        className="w-full py-2.5 bg-slate-800 dark:bg-slate-600 hover:bg-slate-900 dark:hover:bg-slate-500 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                                    >
                                        {tempKey ? 'Save & Use This Key' : 'Clear Key'}
                                    </button>

                                    {customApiKey && (
                                        <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/50 rounded-lg">
                                            <CheckIcon className="w-4 h-4 text-green-600 dark:text-green-400" />
                                            <span className="text-xs text-green-700 dark:text-green-300">
                                                API Key configured
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
