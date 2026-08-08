import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { indexedDBStorage } from '../../services/storage';
import type {
    OpenMedOcrEngine,
    OpenMedOcrMode,
} from '../openmed/documentTypes';
import {
    DEFAULT_OPENMED_BASE_URL,
    DEFAULT_OPENMED_TIMEOUT_MS,
} from '../openmed/openMedClient';
import type { ClinicalExtractionMode } from '../openmed/types';

interface SettingsState {
    openRouterApiKey: string;
    openRouterModelId: string;

    extractionMode: ClinicalExtractionMode;
    openMedBaseUrl: string;
    openMedDiseaseModel: string;
    openMedMedicationModel: string;
    openMedConfidenceThreshold: number;
    openMedTimeoutMs: number;
    openMedKeepAlive: string;
    allowOpenRouterExtractionFallback: boolean;
    openMedDocumentExtractionEnabled: boolean;
    openMedOcrMode: OpenMedOcrMode;
    openMedOcrEngine: OpenMedOcrEngine;
    openMedOcrLanguages: string[];
    openMedOcrResolution: number;

    setOpenRouterApiKey: (key: string) => void;
    setOpenRouterModelId: (modelId: string) => void;
    setExtractionMode: (mode: ClinicalExtractionMode) => void;
    setOpenMedBaseUrl: (value: string) => void;
    setOpenMedDiseaseModel: (value: string) => void;
    setOpenMedMedicationModel: (value: string) => void;
    setOpenMedConfidenceThreshold: (value: number) => void;
    setOpenMedTimeoutMs: (value: number) => void;
    setOpenMedKeepAlive: (value: string) => void;
    setAllowOpenRouterExtractionFallback: (value: boolean) => void;
    setOpenMedDocumentExtractionEnabled: (value: boolean) => void;
    setOpenMedOcrMode: (value: OpenMedOcrMode) => void;
    setOpenMedOcrEngine: (value: OpenMedOcrEngine) => void;
    setOpenMedOcrLanguages: (value: string[]) => void;
    setOpenMedOcrResolution: (value: number) => void;
}

const clampConfidence = (value: number): number => {
    if (!Number.isFinite(value)) return 0.6;
    return Math.min(1, Math.max(0, value));
};

const normalizeTimeout = (value: number): number => {
    if (!Number.isFinite(value)) return DEFAULT_OPENMED_TIMEOUT_MS;
    return Math.min(900_000, Math.max(1_000, Math.round(value)));
};

const normalizeOcrLanguages = (values: string[]): string[] => {
    const normalized = values
        .map(value => value.trim().toLowerCase())
        .filter(Boolean)
        .filter((value, index, all) => all.indexOf(value) === index)
        .slice(0, 8);
    return normalized.length > 0 ? normalized : ['en'];
};

const normalizeOcrResolution = (value: number): number => {
    if (!Number.isFinite(value)) return 200;
    return Math.min(400, Math.max(72, Math.round(value)));
};

export const useSettingsStore = create<SettingsState>()(
    persist(
        set => ({
            openRouterApiKey: '',
            openRouterModelId: '',

            extractionMode: 'auto',
            openMedBaseUrl: DEFAULT_OPENMED_BASE_URL,
            openMedDiseaseModel: 'disease_detection_superclinical',
            openMedMedicationModel: 'pharma_detection_superclinical',
            openMedConfidenceThreshold: 0.6,
            openMedTimeoutMs: DEFAULT_OPENMED_TIMEOUT_MS,
            openMedKeepAlive: '10m',
            allowOpenRouterExtractionFallback: false,
            openMedDocumentExtractionEnabled: true,
            openMedOcrMode: 'auto',
            openMedOcrEngine: 'auto',
            openMedOcrLanguages: ['en'],
            openMedOcrResolution: 200,

            setOpenRouterApiKey: openRouterApiKey => set({ openRouterApiKey }),
            setOpenRouterModelId: openRouterModelId => set({ openRouterModelId }),
            setExtractionMode: extractionMode => set({ extractionMode }),
            setOpenMedBaseUrl: openMedBaseUrl => set({ openMedBaseUrl }),
            setOpenMedDiseaseModel: openMedDiseaseModel => set({
                openMedDiseaseModel,
            }),
            setOpenMedMedicationModel: openMedMedicationModel => set({
                openMedMedicationModel,
            }),
            setOpenMedConfidenceThreshold: value => set({
                openMedConfidenceThreshold: clampConfidence(value),
            }),
            setOpenMedTimeoutMs: value => set({
                openMedTimeoutMs: normalizeTimeout(value),
            }),
            setOpenMedKeepAlive: openMedKeepAlive => set({
                openMedKeepAlive,
            }),
            setAllowOpenRouterExtractionFallback: value => set({
                allowOpenRouterExtractionFallback: value,
            }),
            setOpenMedDocumentExtractionEnabled: value => set({
                openMedDocumentExtractionEnabled: value,
            }),
            setOpenMedOcrMode: openMedOcrMode => set({ openMedOcrMode }),
            setOpenMedOcrEngine: openMedOcrEngine => set({ openMedOcrEngine }),
            setOpenMedOcrLanguages: values => set({
                openMedOcrLanguages: normalizeOcrLanguages(values),
            }),
            setOpenMedOcrResolution: value => set({
                openMedOcrResolution: normalizeOcrResolution(value),
            }),
        }),
        {
            name: 'medibrief-settings-storage',
            version: 2,
            storage: createJSONStorage(() => indexedDBStorage),
            skipHydration: true,
            migrate: persisted => {
                const legacy = persisted as Partial<SettingsState> &
                    Record<string, unknown>;
                const legacyMode = legacy.extractionMode as string | undefined;
                return {
                    ...legacy,
                    openRouterModelId: '',
                    extractionMode: legacyMode === 'openmed'
                        || legacyMode === 'openrouter'
                        ? legacyMode
                        : 'auto',
                    allowOpenRouterExtractionFallback: false,
                } as SettingsState;
            },
        },
    ),
);
