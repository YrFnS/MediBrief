import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { indexedDBStorage } from '../../services/storage';
import type {
    DocumentExtractionRunRecord,
    DocumentExtractionRunStatus,
    OpenMedDocumentExtractionResponse,
} from './documentTypes';

const STORAGE_KEY = 'medibrief-openmed-document-extraction-storage';
const STORAGE_VERSION = 1;

export const documentExtractionKey = (
    patientId: string,
    documentId: string,
): string => `${patientId}:${documentId}`;

interface StartDocumentExtractionInput {
    patientId: string;
    documentId: string;
    storageId?: string;
    fileName: string;
    mimeType: string;
    startedAt?: string;
}

interface CompleteDocumentExtractionInput {
    patientId: string;
    documentId: string;
    result?: OpenMedDocumentExtractionResponse;
    status?: DocumentExtractionRunStatus;
    warnings?: string[];
    message?: string;
    createdCandidates?: number;
    duplicateCandidates?: number;
    fallbackUsed?: boolean;
    completedAt?: string;
}

interface DocumentExtractionState {
    records: Record<string, DocumentExtractionRunRecord>;
    actions: {
        begin: (input: StartDocumentExtractionInput) => void;
        markRunning: (patientId: string, documentId: string) => void;
        complete: (input: CompleteDocumentExtractionInput) => void;
        fail: (input: CompleteDocumentExtractionInput) => void;
        cancel: (patientId: string, documentId: string, message?: string) => void;
        removePatient: (patientId: string) => void;
        get: (
            patientId: string,
            documentId: string,
        ) => DocumentExtractionRunRecord | undefined;
    };
}

const nowIso = (): string => new Date().toISOString();

const statusFromBridge = (
    response?: OpenMedDocumentExtractionResponse,
): DocumentExtractionRunStatus => {
    if (!response) return 'completed';
    return response.status;
};

const pagesWithText = (
    response?: OpenMedDocumentExtractionResponse,
): number | undefined => response
    ? response.pages.filter(page => page.characterCount > 0).length
    : undefined;

export const useDocumentExtractionStore = create<DocumentExtractionState>()(
    persist(
        (set, get) => ({
            records: {},
            actions: {
                begin: input => {
                    const timestamp = input.startedAt || nowIso();
                    const key = documentExtractionKey(
                        input.patientId,
                        input.documentId,
                    );
                    const previous = get().records[key];
                    set(state => ({
                        records: {
                            ...state.records,
                            [key]: {
                                key,
                                patientId: input.patientId,
                                documentId: input.documentId,
                                ...(input.storageId
                                    ? { storageId: input.storageId }
                                    : {}),
                                fileName: input.fileName,
                                mimeType: input.mimeType,
                                status: 'queued',
                                attempts: (previous?.attempts || 0) + 1,
                                startedAt: timestamp,
                                updatedAt: timestamp,
                                warnings: [],
                                failedPages: [],
                                createdCandidates: 0,
                                duplicateCandidates: 0,
                                fallbackUsed: false,
                            },
                        },
                    }));
                },
                markRunning: (patientId, documentId) => {
                    const key = documentExtractionKey(patientId, documentId);
                    const current = get().records[key];
                    if (!current) return;
                    set(state => ({
                        records: {
                            ...state.records,
                            [key]: {
                                ...current,
                                status: 'running',
                                updatedAt: nowIso(),
                            },
                        },
                    }));
                },
                complete: input => {
                    const key = documentExtractionKey(
                        input.patientId,
                        input.documentId,
                    );
                    const current = get().records[key];
                    if (!current) return;
                    const completedAt = input.completedAt || nowIso();
                    const response = input.result;
                    set(state => ({
                        records: {
                            ...state.records,
                            [key]: {
                                ...current,
                                status: input.status || statusFromBridge(response),
                                completedAt,
                                updatedAt: completedAt,
                                ...(response
                                    ? {
                                        method: response.method,
                                        pageCount: response.pageCount,
                                        pagesWithText: pagesWithText(response),
                                        characterCount: response.text.length,
                                        sourceSha256: response.sourceSha256,
                                        textSha256: response.textSha256,
                                        ocrEngine: response.ocrEngine,
                                        languages: response.languages,
                                        warnings: response.warnings,
                                        failedPages: response.failedPages,
                                    }
                                    : {
                                        warnings: input.warnings || current.warnings,
                                    }),
                                createdCandidates:
                                    input.createdCandidates
                                    ?? current.createdCandidates,
                                duplicateCandidates:
                                    input.duplicateCandidates
                                    ?? current.duplicateCandidates,
                                fallbackUsed:
                                    input.fallbackUsed
                                    ?? current.fallbackUsed,
                                ...(input.message ? { message: input.message } : {}),
                            },
                        },
                    }));
                },
                fail: input => {
                    const key = documentExtractionKey(
                        input.patientId,
                        input.documentId,
                    );
                    const current = get().records[key];
                    if (!current) return;
                    const completedAt = input.completedAt || nowIso();
                    set(state => ({
                        records: {
                            ...state.records,
                            [key]: {
                                ...current,
                                status: input.status || 'failed',
                                completedAt,
                                updatedAt: completedAt,
                                warnings: input.warnings || current.warnings,
                                failedPages:
                                    input.result?.failedPages
                                    || current.failedPages,
                                fallbackUsed:
                                    input.fallbackUsed
                                    ?? current.fallbackUsed,
                                message: input.message
                                    || 'Local document extraction failed.',
                            },
                        },
                    }));
                },
                cancel: (patientId, documentId, message) => {
                    const key = documentExtractionKey(patientId, documentId);
                    const current = get().records[key];
                    if (!current) return;
                    const completedAt = nowIso();
                    set(state => ({
                        records: {
                            ...state.records,
                            [key]: {
                                ...current,
                                status: 'cancelled',
                                completedAt,
                                updatedAt: completedAt,
                                message: message || 'Local document extraction was cancelled.',
                            },
                        },
                    }));
                },
                removePatient: patientId => set(state => ({
                    records: Object.fromEntries(
                        Object.entries(state.records).filter(
                            ([, record]) => record.patientId !== patientId,
                        ),
                    ),
                })),
                get: (patientId, documentId) => get().records[
                    documentExtractionKey(patientId, documentId)
                ],
            },
        }),
        {
            name: STORAGE_KEY,
            version: STORAGE_VERSION,
            storage: createJSONStorage(() => indexedDBStorage),
            partialize: state => ({ records: state.records }),
            merge: (persisted, current) => ({
                ...current,
                records: (
                    persisted as Partial<Pick<DocumentExtractionState, 'records'>>
                ).records || {},
                actions: current.actions,
            }),
            skipHydration: true,
        },
    ),
);
