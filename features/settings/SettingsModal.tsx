
import React, { useState } from 'react';
import { useSettingsStore, AIProvider } from './useSettingsStore';
import { ChatMode } from '../../types';
import { XCircleIcon, ShieldCheckIcon, BoltIcon } from '../../components/icons';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const { 
        provider, setProvider, 
        geminiApiKey, setGeminiApiKey, 
        openRouterApiKey, setOpenRouterApiKey,
        customModels, setCustomModel 
    } = useSettingsStore();

    const [tempGeminiKey, setTempGeminiKey] = useState(geminiApiKey);
    const [tempOpenRouterKey, setTempOpenRouterKey] = useState(openRouterApiKey);
    const [tempModels, setTempModels] = useState<Record<ChatMode, string>>(customModels);

    if (!isOpen) return null;

    const handleSave = () => {
        setGeminiApiKey(tempGeminiKey);
        setOpenRouterApiKey(tempOpenRouterKey);
        Object.entries(tempModels).forEach(([mode, modelName]) => {
            setCustomModel(mode as ChatMode, modelName as string);
        });
        onClose();
    };

    const geminiModels = [
        'gemini-flash-lite-latest',
        'gemini-3-flash-preview',
        'gemini-3.1-pro-preview',
        'gemini-2.5-flash-native-audio-preview-12-2025'
    ];

    const openRouterModels = [
        'anthropic/claude-3.7-sonnet',
        'anthropic/claude-3.5-sonnet',
        'openai/gpt-4o',
        'deepseek/deepseek-r1',
        'google/gemini-2.0-flash-001'
    ];

    const currentModels = provider === AIProvider.Gemini ? geminiModels : openRouterModels;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-slate-800 font-display font-bold">
                        <BoltIcon className="w-5 h-5 text-blue-600" />
                        <h2>AI CONFIGURATION</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                        <XCircleIcon className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Provider Toggle */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Active Provider</label>
                        <div className="flex p-1 bg-slate-100 rounded-xl">
                            {Object.values(AIProvider).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => {
                                        setProvider(p);
                                        // Optional: When they switch, we could reset. But maybe let them keep their custom setup.
                                    }}
                                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                                        provider === p 
                                        ? 'bg-white text-blue-600 shadow-sm' 
                                        : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* API Key Input */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                            {provider} API Key
                        </label>
                        <div className="relative">
                            <input
                                type="password"
                                value={provider === AIProvider.Gemini ? tempGeminiKey : tempOpenRouterKey}
                                onChange={(e) => provider === AIProvider.Gemini ? setTempGeminiKey(e.target.value) : setTempOpenRouterKey(e.target.value)}
                                placeholder={`Enter ${provider} Key`}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-mono"
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <ShieldCheckIcon className={`w-4 h-4 ${((provider === AIProvider.Gemini && tempGeminiKey) || (provider === AIProvider.OpenRouter && tempOpenRouterKey)) ? 'text-emerald-500' : 'text-slate-300'}`} />
                            </div>
                        </div>
                    </div>

                    {/* Model Selection */}
                     <div className="space-y-3">
                         <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">Model Configurations</label>
                         <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                            {Object.entries(tempModels).map(([mode, modelValue]) => (
                                <div key={mode} className="flex flex-col gap-1">
                                    <span className="text-xs font-semibold text-slate-700">{mode} Mode</span>
                                    <input
                                        type="text"
                                        list="model-suggestions"
                                        value={modelValue}
                                        onChange={(e) => setTempModels(prev => ({ ...prev, [mode]: e.target.value }))}
                                        placeholder={`e.g., ${provider === AIProvider.Gemini ? 'gemini-1.5-pro' : 'anthropic/claude-3-opus'}`}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium font-mono"
                                    />
                                </div>
                            ))}
                         </div>
                         <datalist id="model-suggestions">
                             {currentModels.map(m => (
                                 <option key={m} value={m} />
                             ))}
                         </datalist>
                     </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 px-4 border border-slate-200 text-slate-600 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition-colors"
                        >
                            Apply Protocol
                        </button>
                    </div>
                </div>

                <div className="bg-slate-50 px-6 py-3 border-t border-slate-100 italic text-[10px] text-slate-400 font-mono text-center">
                    Settings persist in local encrypted vault.
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
