import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import {
    BoltIcon,
    ShieldCheckIcon,
    XCircleIcon,
} from '../../components/icons';
import {
    fetchOpenRouterModels,
    formatOpenRouterTokenPrice,
    isFreeOpenRouterModel,
    searchOpenRouterModels,
    type OpenRouterModel,
} from '../../services/openRouter';
import type {
    OpenMedOcrEngine,
    OpenMedOcrMode,
} from '../openmed/documentTypes';
import { normalizeOpenMedBaseUrl } from '../openmed/openMedClient';
import type { ClinicalExtractionMode } from '../openmed/types';
import OpenMedContextBridgeStatus from './OpenMedContextBridgeStatus';
import OpenMedSettingsPanel from './OpenMedSettingsPanel';
import { useSettingsStore } from './useSettingsStore';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const settings = useSettingsStore();
    const [tempOpenRouterKey, setTempOpenRouterKey] = useState(
        settings.openRouterApiKey,
    );
    const [tempModelId, setTempModelId] = useState(settings.openRouterModelId);
    const [catalog, setCatalog] = useState<OpenRouterModel[]>([]);
    const [catalogSearch, setCatalogSearch] = useState('');
    const [freeOnly, setFreeOnly] = useState(false);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [catalogError, setCatalogError] = useState<string | null>(null);
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
        settings.allowOpenRouterExtractionFallback,
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

    const loadCatalog = useCallback(async (signal?: AbortSignal) => {
        setCatalogLoading(true);
        setCatalogError(null);
        try {
            setCatalog(await fetchOpenRouterModels(signal));
        } catch (error) {
            if (!(error instanceof DOMException && error.name === 'AbortError')) {
                setCatalogError(
                    'The live OpenRouter catalog is unavailable. Enter a model ID manually below.',
                );
            }
        } finally {
            if (!signal?.aborted) setCatalogLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        setTempOpenRouterKey(settings.openRouterApiKey);
        setTempModelId(settings.openRouterModelId);
        setTempExtractionMode(settings.extractionMode);
        setTempOpenMedBaseUrl(settings.openMedBaseUrl);
        setTempDiseaseModel(settings.openMedDiseaseModel);
        setTempMedicationModel(settings.openMedMedicationModel);
        setTempConfidence(settings.openMedConfidenceThreshold);
        setTempTimeoutMs(settings.openMedTimeoutMs);
        setTempKeepAlive(settings.openMedKeepAlive);
        setTempFallback(settings.allowOpenRouterExtractionFallback);
        setTempDocumentExtractionEnabled(
            settings.openMedDocumentExtractionEnabled,
        );
        setTempOcrMode(settings.openMedOcrMode);
        setTempOcrEngine(settings.openMedOcrEngine);
        setTempOcrLanguages(settings.openMedOcrLanguages);
        setTempOcrResolution(settings.openMedOcrResolution);
        setSaveError(null);

        const controller = new AbortController();
        void loadCatalog(controller.signal);
        return () => controller.abort();
    }, [isOpen, loadCatalog]);

    if (!isOpen) return null;

    const visibleModels = searchOpenRouterModels(catalog, catalogSearch)
        .filter(model => !freeOnly || isFreeOpenRouterModel(model));
    const listedModels = visibleModels.slice(0, 80);

    const handleSave = () => {
        const apiKey = tempOpenRouterKey.trim();
        const modelId = tempModelId.trim();
        if (
            (tempExtractionMode === 'openrouter' || tempFallback)
            && (!apiKey || !modelId)
        ) {
            setSaveError(
                'OpenRouter cloud extraction requires your key and an explicitly selected model.',
            );
            return;
        }

        let normalizedBaseUrl = tempOpenMedBaseUrl;
        if (tempExtractionMode !== 'openrouter') {
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

        settings.setOpenRouterApiKey(apiKey);
        settings.setOpenRouterModelId(modelId);
        settings.setExtractionMode(tempExtractionMode);
        settings.setOpenMedBaseUrl(normalizedBaseUrl);
        settings.setOpenMedDiseaseModel(tempDiseaseModel.trim());
        settings.setOpenMedMedicationModel(tempMedicationModel.trim());
        settings.setOpenMedConfidenceThreshold(tempConfidence);
        settings.setOpenMedTimeoutMs(tempTimeoutMs);
        settings.setOpenMedKeepAlive(tempKeepAlive.trim());
        settings.setAllowOpenRouterExtractionFallback(tempFallback);
        settings.setOpenMedDocumentExtractionEnabled(
            tempDocumentExtractionEnabled,
        );
        settings.setOpenMedOcrMode(tempOcrMode);
        settings.setOpenMedOcrEngine(tempOcrEngine);
        settings.setOpenMedOcrLanguages(tempOcrLanguages);
        settings.setOpenMedOcrResolution(tempOcrResolution);
        onClose();
    };

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
                                OpenRouter assistant
                            </h3>
                            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                Your key stays in this browser&apos;s encrypted vault and is sent only as a Bearer header directly to OpenRouter. MediBrief and Vercel have no AI key or proxy.
                            </p>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                            <label className="block">
                                <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                                    OpenRouter API key
                                </span>
                                <span className="relative mt-1.5 block">
                                    <input
                                        type="password"
                                        value={tempOpenRouterKey}
                                        onChange={event => setTempOpenRouterKey(event.target.value)}
                                        placeholder="Enter your OpenRouter key"
                                        autoComplete="off"
                                        spellCheck={false}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-10 text-sm font-mono outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900"
                                    />
                                    <ShieldCheckIcon className={`absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${tempOpenRouterKey ? 'text-emerald-500' : 'text-slate-300'}`} />
                                </span>
                            </label>
                            <button
                                type="button"
                                disabled={!tempOpenRouterKey && !settings.openRouterApiKey}
                                onClick={() => {
                                    setTempOpenRouterKey('');
                                    settings.setOpenRouterApiKey('');
                                }}
                                className="rounded-xl border border-red-200 px-4 py-3 text-xs font-bold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
                            >
                                Clear saved key
                            </button>
                        </div>

                        <div className="space-y-2">
                            <div className="flex flex-wrap items-end justify-between gap-2">
                                <label className="min-w-0 flex-1">
                                    <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                                        Search live model catalog
                                    </span>
                                    <input
                                        type="search"
                                        value={catalogSearch}
                                        onChange={event => setCatalogSearch(event.target.value)}
                                        placeholder="Search name, ID, description, modality…"
                                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={() => void loadCatalog()}
                                    disabled={catalogLoading}
                                    className="rounded-xl border border-blue-200 px-4 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-blue-900 dark:text-blue-300"
                                >
                                    {catalogLoading ? 'Loading…' : 'Refresh'}
                                </button>
                            </div>
                            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                <input
                                    type="checkbox"
                                    checked={freeOnly}
                                    onChange={event => setFreeOnly(event.target.checked)}
                                />
                                Free only (all returned prices are zero)
                            </label>
                        </div>

                        {catalogError && (
                            <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                                {catalogError}
                            </p>
                        )}

                        {!catalogLoading && !catalogError && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-mono text-slate-500">
                                    {visibleModels.length} matching model{visibleModels.length === 1 ? '' : 's'} from the public OpenRouter catalog{visibleModels.length > listedModels.length ? ` · showing first ${listedModels.length}` : ''}
                                </p>
                                <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-slate-800">
                                    {listedModels.map(model => (
                                        <button
                                            key={model.id}
                                            type="button"
                                            onClick={() => setTempModelId(model.id)}
                                            className={`w-full rounded-lg border p-3 text-left transition-colors ${tempModelId === model.id
                                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                                                : 'border-slate-200 hover:border-blue-300 dark:border-slate-800'
                                            }`}
                                        >
                                            <span className="flex flex-wrap items-center justify-between gap-2">
                                                <span className="text-xs font-bold text-slate-900 dark:text-white">
                                                    {model.name}
                                                </span>
                                                {isFreeOpenRouterModel(model) && (
                                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                                        Free
                                                    </span>
                                                )}
                                            </span>
                                            <span className="mt-1 block break-all text-[10px] font-mono text-blue-700 dark:text-blue-300">
                                                {model.id}
                                            </span>
                                            {model.description && (
                                                <span className="mt-1 block line-clamp-2 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                                                    {model.description}
                                                </span>
                                            )}
                                            <span className="mt-2 block text-[9px] text-slate-500 dark:text-slate-400">
                                                Context {model.contextLength?.toLocaleString() || 'not listed'} · Input {formatOpenRouterTokenPrice(model.pricing.prompt)} · Output {formatOpenRouterTokenPrice(model.pricing.completion)}{model.modality ? ` · ${model.modality}` : ''}
                                            </span>
                                        </button>
                                    ))}
                                    {listedModels.length === 0 && (
                                        <p className="p-4 text-center text-xs text-slate-500">
                                            No catalog models match these filters. Use a manual ID below.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        <label className="block">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                                Selected model ID / manual fallback
                            </span>
                            <input
                                type="text"
                                value={tempModelId}
                                onChange={event => setTempModelId(event.target.value)}
                                placeholder="provider/model-id"
                                spellCheck={false}
                                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-mono outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
                            />
                        </label>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                                No model is chosen by default. MediBrief sends this exact ID for every OpenRouter request.
                            </span>
                            <button
                                type="button"
                                disabled={!tempModelId}
                                onClick={() => setTempModelId('')}
                                className="text-[10px] font-bold uppercase tracking-wider text-red-700 disabled:opacity-40 dark:text-red-300"
                            >
                                Clear model selection
                            </button>
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
                        allowOpenRouterFallback={tempFallback}
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
                        onAllowOpenRouterFallbackChange={setTempFallback}
                        onDocumentExtractionEnabledChange={setTempDocumentExtractionEnabled}
                        onOcrModeChange={setTempOcrMode}
                        onOcrEngineChange={setTempOcrEngine}
                        onOcrLanguagesChange={setTempOcrLanguages}
                        onOcrResolutionChange={setTempOcrResolution}
                    />

                    {tempExtractionMode !== 'openrouter' && (
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
                        Assistant settings persist only in the local encrypted vault.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
