import React, { useEffect, useState } from 'react';
import {
    BoltIcon,
    ShieldCheckIcon,
    XCircleIcon,
} from '../../components/icons';
import { ChatMode } from '../../types';
import type {
    OpenMedOcrEngine,
    OpenMedOcrMode,
} from '../openmed/documentTypes';
import { normalizeOpenMedBaseUrl } from '../openmed/openMedClient';
import type { ClinicalExtractionMode } from '../openmed/types';
import OpenMedContextBridgeStatus from './OpenMedContextBridgeStatus';
import OpenMedSettingsPanel from './OpenMedSettingsPanel';
import { AIProvider, useSettingsStore } from './useSettingsStore';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const settings = useSettingsStore();
    const [tempGeminiKey, setTempGeminiKey] = useState(settings.geminiApiKey);
    const [tempOpenRouterKey, setTempOpenRouterKey] = useState(
        settings.openRouterApiKey,
    );
    const [tempModels, setTempModels] = useState<Record<ChatMode, string>>(
        settings.customModels,
    );
    const [tempExtractionMode, setTempExtractionMode] =
        useState<ClinicalExtractionMode>(settings.extractionMode);
    const [tempOpenMedBaseUrl, setTempOpenMedBaseUrl] = useState(
        settings.openMedBaseUrl,
    );
    const [tempDiseaseModel, setTempDiseaseModel] = useState(
        settings.openMedDiseaseModel,
    );
    const [tempMedicationModel, setTempMedicationModel] = useState(
        settings.openMedMedicationModel,
    );
    const [tempConfidence, setTempConfidence] = useState(
        settings.openMedConfidenceThreshold,
    );
    const [tempTimeoutMs, setTempTimeoutMs] = useState(
        settings.openMedTimeoutMs,
    );
    const [tempKeepAlive, setTempKeepAlive] = useState(
        settings.openMedKeepAlive,
    );
    const [tempFallback, setTempFallback] = useState(
        settings.allowGeminiExtractionFallback,
    );
    const [tempDocumentExtractionEnabled, setTempDocumentExtractionEnabled] =
        useState(settings.openMedDocumentExtractionEnabled);
    const [tempOcrMode, setTempOcrMode] = useState<OpenMedOcrMode>(
        settings.openMedOcrMode,
    );
    const [tempOcrEngine, setTempOcrEngine] = useState<OpenMedOcrEngine>(
        settings.openMedOcrEngine,
    );
    const [tempOcrLanguages, setTempOcrLanguages] = useState(
        settings.openMedOcrLanguages,
    );
    const [tempOcrResolution, setTempOcrResolution] = useState(
        settings.openMedOcrResolution,
    );
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setTempGeminiKey(settings.geminiApiKey);
        setTempOpenRouterKey(settings.openRouterApiKey);
        setTempModels(settings.customModels);
        setTempExtractionMode(settings.extractionMode);
        setTempOpenMedBaseUrl(settings.openMedBaseUrl);
        setTempDiseaseModel(settings.openMedDiseaseModel);
        setTempMedicationModel(settings.openMedMedicationModel);
        setTempConfidence(settings.openMedConfidenceThreshold);
        setTempTimeoutMs(settings.openMedTimeoutMs);
        setTempKeepAlive(settings.openMedKeepAlive);
        setTempFallback(settings.allowGeminiExtractionFallback);
        setTempDocumentExtractionEnabled(
            settings.openMedDocumentExtractionEnabled,
        );
        setTempOcrMode(settings.openMedOcrMode);
        setTempOcrEngine(settings.openMedOcrEngine);
        setTempOcrLanguages(settings.openMedOcrLanguages);
        setTempOcrResolution(settings.openMedOcrResolution);
        setSaveError(null);
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        let normalizedBaseUrl = tempOpenMedBaseUrl;
        if (tempExtractionMode !== 'gemini') {
            try {
                normalizedBaseUrl = normalizeOpenMedBaseUrl(tempOpenMedBaseUrl);
            } catch (error) {
                setSaveError(error instanceof Error
                    ? error.message
                    : 'OpenMed endpoint is invalid.');
                return;
            }
            if (!tempDiseaseModel.trim() || !tempMedicationModel.trim()) {
                setSaveError(
                    'OpenMed disease and medication model names are required.',
                );
                return;
            }
            if (tempDocumentExtractionEnabled && tempOcrLanguages.length === 0) {
                setSaveError('At least one OCR language code is required.');
                return;
            }
        }

        settings.setGeminiApiKey(tempGeminiKey.trim());
        settings.setOpenRouterApiKey(tempOpenRouterKey.trim());
        Object.entries(tempModels).forEach(([mode, modelName]) => {
            settings.setCustomModel(mode as ChatMode, String(modelName).trim());
        });
        settings.setExtractionMode(tempExtractionMode);
        settings.setOpenMedBaseUrl(normalizedBaseUrl);
        settings.setOpenMedDiseaseModel(tempDiseaseModel.trim());
        settings.setOpenMedMedicationModel(tempMedicationModel.trim());
        settings.setOpenMedConfidenceThreshold(tempConfidence);
        settings.setOpenMedTimeoutMs(tempTimeoutMs);
        settings.setOpenMedKeepAlive(tempKeepAlive.trim());
        settings.setAllowGeminiExtractionFallback(tempFallback);
        settings.setOpenMedDocumentExtractionEnabled(
            tempDocumentExtractionEnabled,
        );
        settings.setOpenMedOcrMode(tempOcrMode);
        settings.setOpenMedOcrEngine(tempOcrEngine);
        settings.setOpenMedOcrLanguages(tempOcrLanguages);
        settings.setOpenMedOcrResolution(tempOcrResolution);
        onClose();
    };

    const geminiModels = [
        'gemini-flash-lite-latest',
        'gemini-3-flash-preview',
        'gemini-3.1-pro-preview',
        'gemini-2.5-flash-native-audio-preview-12-2025',
    ];
    const openRouterModels = [
        'anthropic/claude-3.7-sonnet',
        'anthropic/claude-3.5-sonnet',
        'openai/gpt-4o',
        'deepseek/deepseek-r1',
        'google/gemini-2.0-flash-001',
    ];
    const currentModels = settings.provider === AIProvider.Gemini
        ? geminiModels
        : openRouterModels;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-sm md:p-6">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="settings-modal-title"
                className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
            >
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center gap-2 font-display font-bold text-slate-800 dark:text-slate-100">
                        <BoltIcon className="h-5 w-5 text-blue-600" />
                        <h2 id="settings-modal-title">MEDIBRIEF SETTINGS</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-1 transition-colors hover:bg-slate-200 dark:hover:bg-slate-800"
                        aria-label="Close settings"
                    >
                        <XCircleIcon className="h-6 w-6 text-slate-400" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5 md:p-6">
                    <section
                        aria-labelledby="assistant-settings-title"
                        className="space-y-5 rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
                    >
                        <div>
                            <h3
                                id="assistant-settings-title"
                                className="text-sm font-bold text-slate-900 dark:text-white"
                            >
                                Assistant AI
                            </h3>
                            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                These provider settings power chat, voice, scribe, and the Gemini compatibility extractor. They are separate from local OpenMed settings.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                                Active chat provider
                            </span>
                            <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
                                {Object.values(AIProvider).map(provider => (
                                    <button
                                        key={provider}
                                        type="button"
                                        onClick={() => settings.setProvider(provider)}
                                        className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${settings.provider === provider
                                            ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-800 dark:text-blue-300'
                                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                        }`}
                                    >
                                        {provider}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <label className="block">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                                {settings.provider} API key
                            </span>
                            <span className="relative mt-1.5 block">
                                <input
                                    type="password"
                                    value={settings.provider === AIProvider.Gemini
                                        ? tempGeminiKey
                                        : tempOpenRouterKey}
                                    onChange={event => settings.provider === AIProvider.Gemini
                                        ? setTempGeminiKey(event.target.value)
                                        : setTempOpenRouterKey(event.target.value)}
                                    placeholder={`Enter ${settings.provider} key`}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-10 text-sm font-mono outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900"
                                />
                                <ShieldCheckIcon className={`absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${((settings.provider === AIProvider.Gemini && tempGeminiKey)
                                    || (settings.provider === AIProvider.OpenRouter && tempOpenRouterKey))
                                    ? 'text-emerald-500'
                                    : 'text-slate-300'
                                }`} />
                            </span>
                        </label>

                        <div className="space-y-3">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                                Chat model configuration
                            </span>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {Object.entries(tempModels).map(([mode, modelValue]) => (
                                    <label key={mode} className="block">
                                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                            {mode} mode
                                        </span>
                                        <input
                                            type="text"
                                            list="model-suggestions"
                                            value={modelValue}
                                            onChange={event => setTempModels(previous => ({
                                                ...previous,
                                                [mode]: event.target.value,
                                            }))}
                                            className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
                                        />
                                    </label>
                                ))}
                            </div>
                            <datalist id="model-suggestions">
                                {currentModels.map(model => (
                                    <option key={model} value={model} />
                                ))}
                            </datalist>
                        </div>
                    </section>

                    <OpenMedSettingsPanel
                        extractionMode={tempExtractionMode}
                        baseUrl={tempOpenMedBaseUrl}
                        diseaseModel={tempDiseaseModel}
                        medicationModel={tempMedicationModel}
                        confidenceThreshold={tempConfidence}
                        timeoutMs={tempTimeoutMs}
                        keepAlive={tempKeepAlive}
                        allowGeminiFallback={tempFallback}
                        documentExtractionEnabled={tempDocumentExtractionEnabled}
                        ocrMode={tempOcrMode}
                        ocrEngine={tempOcrEngine}
                        ocrLanguages={tempOcrLanguages}
                        ocrResolution={tempOcrResolution}
                        onExtractionModeChange={setTempExtractionMode}
                        onBaseUrlChange={setTempOpenMedBaseUrl}
                        onDiseaseModelChange={setTempDiseaseModel}
                        onMedicationModelChange={setTempMedicationModel}
                        onConfidenceThresholdChange={setTempConfidence}
                        onTimeoutMsChange={setTempTimeoutMs}
                        onKeepAliveChange={setTempKeepAlive}
                        onAllowGeminiFallbackChange={setTempFallback}
                        onDocumentExtractionEnabledChange={setTempDocumentExtractionEnabled}
                        onOcrModeChange={setTempOcrMode}
                        onOcrEngineChange={setTempOcrEngine}
                        onOcrLanguagesChange={setTempOcrLanguages}
                        onOcrResolutionChange={setTempOcrResolution}
                    />

                    {tempExtractionMode !== 'gemini' && (
                        <OpenMedContextBridgeStatus
                            baseUrl={tempOpenMedBaseUrl}
                            timeoutMs={tempTimeoutMs}
                        />
                    )}

                    {saveError && (
                        <div
                            role="alert"
                            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
                        >
                            {saveError}
                        </div>
                    )}
                </div>

                <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl border border-slate-200 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-600 transition-colors hover:bg-white dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            className="rounded-xl bg-blue-600 px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-500"
                        >
                            Apply settings
                        </button>
                    </div>
                    <p className="mt-2 text-center text-[10px] font-mono italic text-slate-400">
                        Settings persist in the local encrypted vault.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
