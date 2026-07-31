import React, { useState } from 'react';
import {
    ActivityIcon,
    ShieldCheckIcon,
    WifiOffIcon,
} from '../../components/icons';
import type {
    OpenMedOcrEngine,
    OpenMedOcrMode,
} from '../openmed/documentTypes';
import {
    checkOpenMedHealth,
    normalizeOpenMedBaseUrl,
} from '../openmed/openMedClient';
import type {
    ClinicalExtractionMode,
    OpenMedServiceHealth,
} from '../openmed/types';
import OpenMedDocumentBridgeStatus from './OpenMedDocumentBridgeStatus';

interface OpenMedSettingsPanelProps {
    extractionMode: ClinicalExtractionMode;
    baseUrl: string;
    diseaseModel: string;
    medicationModel: string;
    confidenceThreshold: number;
    timeoutMs: number;
    keepAlive: string;
    allowGeminiFallback: boolean;
    documentExtractionEnabled: boolean;
    ocrMode: OpenMedOcrMode;
    ocrEngine: OpenMedOcrEngine;
    ocrLanguages: string[];
    ocrResolution: number;
    onExtractionModeChange: (value: ClinicalExtractionMode) => void;
    onBaseUrlChange: (value: string) => void;
    onDiseaseModelChange: (value: string) => void;
    onMedicationModelChange: (value: string) => void;
    onConfidenceThresholdChange: (value: number) => void;
    onTimeoutMsChange: (value: number) => void;
    onKeepAliveChange: (value: string) => void;
    onAllowGeminiFallbackChange: (value: boolean) => void;
    onDocumentExtractionEnabledChange: (value: boolean) => void;
    onOcrModeChange: (value: OpenMedOcrMode) => void;
    onOcrEngineChange: (value: OpenMedOcrEngine) => void;
    onOcrLanguagesChange: (value: string[]) => void;
    onOcrResolutionChange: (value: number) => void;
}

const MODE_OPTIONS: Array<{
    value: ClinicalExtractionMode;
    label: string;
    description: string;
}> = [
    {
        value: 'auto',
        label: 'Auto',
        description:
            'Use local OpenMed for supported text, PDFs, and images. Use Gemini only when local extraction is unavailable and fallback is enabled.',
    },
    {
        value: 'openmed',
        label: 'OpenMed only',
        description:
            'Keep extraction local. Text, embedded PDF text, and configured OCR can be used without cloud fallback.',
    },
    {
        value: 'gemini',
        label: 'Gemini only',
        description:
            'Use the existing compatibility extractor. OpenMed and the local document bridge are not contacted.',
    },
];

const OCR_ENGINE_OPTIONS: Array<{
    value: OpenMedOcrEngine;
    label: string;
}> = [
    { value: 'auto', label: 'Auto-select installed engine' },
    { value: 'doctr', label: 'docTR' },
    { value: 'tesseract', label: 'Tesseract' },
    { value: 'easyocr', label: 'EasyOCR' },
    { value: 'paddleocr', label: 'PaddleOCR' },
];

const OpenMedSettingsPanel: React.FC<OpenMedSettingsPanelProps> = props => {
    const [health, setHealth] = useState<OpenMedServiceHealth | null>(null);
    const [testing, setTesting] = useState(false);

    const testService = async () => {
        setTesting(true);
        setHealth(null);
        try {
            const baseUrl = normalizeOpenMedBaseUrl(props.baseUrl);
            const result = await checkOpenMedHealth({
                config: {
                    baseUrl,
                    timeoutMs: Math.min(props.timeoutMs, 5_000),
                },
            });
            setHealth(result);
        } catch (error) {
            setHealth({
                available: false,
                endpoint: props.baseUrl,
                status: 'unavailable',
                message: error instanceof Error
                    ? error.message
                    : 'OpenMed service health check failed.',
            });
        } finally {
            setTesting(false);
        }
    };

    return (
        <section
            aria-labelledby="openmed-settings-title"
            className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60"
        >
            <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                    <ActivityIcon className="h-4 w-4" />
                </span>
                <div>
                    <h3
                        id="openmed-settings-title"
                        className="text-sm font-bold text-slate-900 dark:text-white"
                    >
                        Clinical document extraction
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        OpenMed runs as a separate local REST service. Named entities, assertion context, and OCR-derived findings become review candidates only; they are never confirmed automatically.
                    </p>
                </div>
            </div>

            <fieldset>
                <legend className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                    Extraction route
                </legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    {MODE_OPTIONS.map(option => (
                        <label
                            key={option.value}
                            className={`cursor-pointer rounded-xl border p-3 transition-colors ${props.extractionMode === option.value
                                ? 'border-emerald-400 bg-white dark:border-emerald-700 dark:bg-slate-950'
                                : 'border-slate-200 bg-white/70 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/50'
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                <input
                                    type="radio"
                                    name="clinical-extraction-mode"
                                    value={option.value}
                                    checked={props.extractionMode === option.value}
                                    onChange={() => props.onExtractionModeChange(option.value)}
                                />
                                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                    {option.label}
                                </span>
                            </span>
                            <span className="mt-1.5 block text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                                {option.description}
                            </span>
                        </label>
                    ))}
                </div>
            </fieldset>

            {props.extractionMode !== 'gemini' && (
                <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                        <label className="block">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                                Local OpenMed endpoint
                            </span>
                            <input
                                type="url"
                                value={props.baseUrl}
                                onChange={event => {
                                    props.onBaseUrlChange(event.target.value);
                                    setHealth(null);
                                }}
                                placeholder="http://127.0.0.1:8080"
                                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-mono text-slate-800 outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                                aria-describedby="openmed-endpoint-help"
                            />
                        </label>
                        <button
                            type="button"
                            onClick={testService}
                            disabled={testing}
                            className="rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-900 dark:bg-slate-950 dark:text-emerald-300"
                        >
                            {testing ? 'Checking…' : 'Test local service'}
                        </button>
                    </div>
                    <p
                        id="openmed-endpoint-help"
                        className="text-[10px] leading-relaxed text-slate-500 dark:text-slate-400"
                    >
                        Browser access requires the bridge to allow this app’s exact origin with <code>OPENMED_SERVICE_CORS_ORIGINS</code>. The recommended local bind is <code>127.0.0.1</code>.
                    </p>

                    {health && (
                        <div
                            role="status"
                            aria-live="polite"
                            className={`flex items-start gap-2 rounded-xl border p-3 ${health.available
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
                                : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
                            }`}
                        >
                            {health.available
                                ? <ShieldCheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                                : <WifiOffIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />}
                            <div className="min-w-0 text-xs">
                                <p className="font-bold">{health.message}</p>
                                <p className="mt-1 break-all text-[10px] opacity-80">
                                    {health.endpoint}
                                    {health.version ? ` · OpenMed ${health.version}` : ''}
                                    {health.profile ? ` · ${health.profile} profile` : ''}
                                </p>
                                {health.available && (
                                    <p className="mt-1 text-[10px] opacity-80">
                                        Reachability does not prove that the configured models are downloaded, loaded, appropriate for the document language, or clinically validated.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                                Disease model
                            </span>
                            <input
                                type="text"
                                value={props.diseaseModel}
                                onChange={event => props.onDiseaseModelChange(event.target.value)}
                                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-mono outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-950"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                                Medication model
                            </span>
                            <input
                                type="text"
                                value={props.medicationModel}
                                onChange={event => props.onMedicationModelChange(event.target.value)}
                                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-mono outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-950"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                                Confidence threshold
                            </span>
                            <input
                                type="number"
                                min="0"
                                max="1"
                                step="0.05"
                                value={props.confidenceThreshold}
                                onChange={event => props.onConfidenceThresholdChange(Number(event.target.value))}
                                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-950"
                            />
                        </label>
                        <label className="block">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                                Request timeout (seconds)
                            </span>
                            <input
                                type="number"
                                min="1"
                                max="900"
                                value={Math.round(props.timeoutMs / 1_000)}
                                onChange={event => props.onTimeoutMsChange(Number(event.target.value) * 1_000)}
                                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-950"
                            />
                        </label>
                        <label className="block sm:col-span-2">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                                Model keep-alive
                            </span>
                            <input
                                type="text"
                                value={props.keepAlive}
                                onChange={event => props.onKeepAliveChange(event.target.value)}
                                placeholder="10m"
                                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-mono outline-none focus:border-emerald-400 dark:border-slate-700 dark:bg-slate-950"
                            />
                        </label>
                    </div>

                    <div className="space-y-3 rounded-2xl border border-violet-200 bg-white p-4 dark:border-violet-900/60 dark:bg-slate-950">
                        <label className="flex items-start gap-3">
                            <input
                                type="checkbox"
                                checked={props.documentExtractionEnabled}
                                onChange={event => props.onDocumentExtractionEnabledChange(event.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-violet-300"
                            />
                            <span>
                                <span className="block text-xs font-bold text-slate-800 dark:text-slate-100">
                                    Enable local PDF and image text extraction
                                </span>
                                <span className="mt-1 block text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                                    Embedded PDF text is extracted page by page. OCR is used according to the policy below. Derived text and coordinates are review evidence; the original file remains authoritative.
                                </span>
                            </span>
                        </label>

                        {props.documentExtractionEnabled && (
                            <>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <label className="block">
                                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                                            OCR policy
                                        </span>
                                        <select
                                            value={props.ocrMode}
                                            onChange={event => props.onOcrModeChange(event.target.value as OpenMedOcrMode)}
                                            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950"
                                        >
                                            <option value="auto">Auto — OCR pages without usable embedded text</option>
                                            <option value="always">Always OCR every PDF page and image</option>
                                            <option value="never">Never OCR — embedded PDF text only</option>
                                        </select>
                                    </label>
                                    <label className="block">
                                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                                            OCR engine
                                        </span>
                                        <select
                                            value={props.ocrEngine}
                                            onChange={event => props.onOcrEngineChange(event.target.value as OpenMedOcrEngine)}
                                            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950"
                                        >
                                            {OCR_ENGINE_OPTIONS.map(option => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="block">
                                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                                            OCR languages
                                        </span>
                                        <input
                                            type="text"
                                            value={props.ocrLanguages.join(', ')}
                                            onChange={event => props.onOcrLanguagesChange(
                                                event.target.value.split(',').map(value => value.trim()),
                                            )}
                                            placeholder="en, ar"
                                            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-mono outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950"
                                        />
                                        <span className="mt-1 block text-[9px] leading-relaxed text-slate-400">
                                            OpenMed language codes. OCR language support does not establish Arabic clinical-NER or assertion-context quality.
                                        </span>
                                    </label>
                                    <label className="block">
                                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400">
                                            PDF OCR resolution (DPI)
                                        </span>
                                        <input
                                            type="number"
                                            min="72"
                                            max="400"
                                            value={props.ocrResolution}
                                            onChange={event => props.onOcrResolutionChange(Number(event.target.value))}
                                            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400 dark:border-slate-700 dark:bg-slate-950"
                                        />
                                    </label>
                                </div>
                                <OpenMedDocumentBridgeStatus
                                    baseUrl={props.baseUrl}
                                    timeoutMs={props.timeoutMs}
                                />
                            </>
                        )}
                    </div>

                    {props.extractionMode === 'auto' && (
                        <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
                            <input
                                type="checkbox"
                                checked={props.allowGeminiFallback}
                                onChange={event => props.onAllowGeminiFallbackChange(event.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-amber-300"
                            />
                            <span className="text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                                Allow the existing Gemini compatibility extractor only when local document or NER extraction is unsupported or unavailable. Gemini output keeps separate cloud-extraction provenance.
                            </span>
                        </label>
                    )}
                </div>
            )}
        </section>
    );
};

export default OpenMedSettingsPanel;
