
import React, { useState } from 'react';
import { KeyIcon, CheckIcon, XCircleIcon, CogIcon } from './icons';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectKey: () => Promise<void>;
    hasAiStudio: boolean;
    hasActiveKey: boolean;
    customApiKey: string;
    onSaveCustomKey: (key: string) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, 
    onClose, 
    onSelectKey, 
    hasAiStudio, 
    hasActiveKey,
    customApiKey,
    onSaveCustomKey
}) => {
    const [tempKey, setTempKey] = useState(customApiKey);
    const [isSelecting, setIsSelecting] = useState(false);

    if (!isOpen) return null;

    const handleSave = () => {
        onSaveCustomKey(tempKey);
        onClose();
    };

    const handleGoogleSelect = async () => {
        setIsSelecting(true);
        try {
            await onSelectKey();
        } finally {
            setIsSelecting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <CogIcon className="w-6 h-6 text-slate-500" />
                            Connection Settings
                        </h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                            <XCircleIcon className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="space-y-6">
                        {/* Option 1: Google Subscription */}
                        {hasAiStudio && (
                            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                                <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">Option A: Google Cloud Subscription</h3>
                                <p className="text-xs text-blue-700 dark:text-blue-300 mb-3 leading-relaxed">
                                    Use your existing Google Cloud project or AI Studio subscription. This is the recommended way to connect securely.
                                </p>
                                <button
                                    onClick={handleGoogleSelect}
                                    disabled={isSelecting}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50 mb-3"
                                >
                                    {isSelecting ? (
                                        <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <KeyIcon className="w-4 h-4" />
                                    )}
                                    {hasActiveKey ? 'Connected via Google' : 'Connect Google Account'}
                                </button>
                                <div className="text-[10px] text-blue-600/80 dark:text-blue-400/80 text-center">
                                    Must be a paid project. <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-800 dark:hover:text-blue-200">View billing docs</a>.
                                </div>
                                {hasActiveKey && !tempKey && (
                                    <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800/50 flex items-center justify-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-bold">
                                        <CheckIcon className="w-4 h-4" />
                                        Active Connection
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Option 2: Custom API Key */}
                        <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">
                                {hasAiStudio ? 'Option B: ' : ''}Manual API Key
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                                Enter a specific Gemini API key. This overrides the Google Subscription if set.
                            </p>
                            <input
                                type="password"
                                value={tempKey}
                                onChange={(e) => setTempKey(e.target.value)}
                                placeholder="AIzaSy..."
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all mb-3"
                            />
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-3">
                                * Key is stored in your browser's session memory only.
                            </div>
                            <button
                                onClick={handleSave}
                                className="w-full py-2 bg-slate-800 dark:bg-slate-600 hover:bg-slate-900 dark:hover:bg-slate-500 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                {tempKey ? 'Use This Key' : 'Clear Key'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
