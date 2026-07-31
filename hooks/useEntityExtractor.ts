import { useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useShallow } from 'zustand/react/shallow';
import { useAuditStore } from '../features/audit/useAuditStore';
import {
    ENTITY_EXTRACTION_MODEL,
    ENTITY_EXTRACTION_PROMPT_VERSION,
    extractEntitiesFromUpload,
} from '../features/clinical-analysis/entityExtractionService';
import { createUnknownClinicalDate } from '../features/clinical-record/factories';
import type {
    AllergyIntoleranceRecord,
    ConditionRecord,
    DocumentReferenceRecord,
    ObservationRecord,
    RecordSource,
} from '../features/clinical-record/types';
import { useClinicalRecordStore } from '../features/clinical-record/useClinicalRecordStore';
import {
    extractOpenMedCandidatesFromUpload,
    mapOpenMedEntitiesToCandidates,
    useDocumentExtractionStore,
} from '../features/openmed';
import { usePatientStore } from '../features/patient-management/usePatientStore';
import { useSettingsStore } from '../features/settings/useSettingsStore';
import type { UploadedFile } from '../types';

export interface EntityExtractionSource {
    documentId?: string;
}

interface CandidateWriteCounts {
    created: number;
    duplicates: number;
}

const normalizedKey = (value: string): string =>
    value.trim().toLowerCase().replace(/\s+/g, ' ');

const geminiCandidateSource = ({
    documentId,
    file,
    kind,
    value,
}: {
    documentId: string;
    file: UploadedFile;
    kind: string;
    value: string;
}): RecordSource => ({
    kind: 'document-extraction',
    document: {
        documentId,
        fileName: file.file.name,
        excerpt: value,
    },
    externalSystem: 'medibrief:gemini-entity-extraction',
    externalId: `${documentId}:${kind}:${normalizedKey(value)}`,
    description:
        'Compatibility candidate extracted from an uploaded medical document by Gemini.',
});

const geminiCandidateBase = ({
    patientId,
    source,
    now,
}: {
    patientId: string;
    source: RecordSource;
    now: string;
}) => ({
    id: uuidv4(),
    patientId,
    verificationStatus: 'candidate' as const,
    recordedAt: now,
    effective: createUnknownClinicalDate(
        'No clinical event date was extracted by the Gemini compatibility path.',
    ),
    assertion: {
        polarity: 'unknown' as const,
        certainty: 'unknown' as const,
        temporality: 'unknown' as const,
        experiencer: 'unknown' as const,
    },
    provenance: {
        source,
        createdAt: now,
        updatedAt: now,
        extraction: {
            engine: 'Google Gemini compatibility extraction',
            model: ENTITY_EXTRACTION_MODEL,
            promptVersion: ENTITY_EXTRACTION_PROMPT_VERSION,
            extractedAt: now,
        },
    },
    amendments: [],
    tags: ['gemini-extracted', 'needs-review'],
});

const ensureDocumentReference = ({
    patientId,
    documentId,
    file,
    now,
}: {
    patientId: string;
    documentId: string;
    file: UploadedFile;
    now: string;
}): void => {
    const actions = useClinicalRecordStore.getState().actions;
    const record = actions.getPatientRecord(patientId);
    const existing = record?.resources.documents.find(document =>
        document.id === documentId
        || (!!file.storageId && document.storageId === file.storageId),
    );
    if (existing || !file.storageId) return;

    const document: DocumentReferenceRecord = {
        id: documentId,
        patientId,
        resourceType: 'DocumentReference',
        verificationStatus: 'confirmed',
        recordedAt: now,
        provenance: {
            source: {
                kind: 'manual',
                description:
                    'File uploaded by the user for local medical-document review.',
            },
            createdAt: now,
            updatedAt: now,
            confirmation: {
                reviewedAt: now,
                reason:
                    'The local file upload was explicitly initiated by the user.',
            },
        },
        amendments: [],
        tags: ['uploaded-document'],
        status: 'current',
        storageId: file.storageId,
        fileName: file.file.name,
        mimeType:
            file.type
            || file.file.type
            || 'application/octet-stream',
        uploadedAt: now,
        relatedResources: [],
        description:
            'Locally stored source document. Clinical facts extracted from it remain candidates until reviewed.',
    };
    actions.addResource(document);
};

export const useEntityExtractor = () => {
    const clinicalRecordActions = useClinicalRecordStore(state => state.actions);
    const documentActions = useDocumentExtractionStore(state => state.actions);
    const auditActions = useAuditStore(state => state.actions);
    const settings = useSettingsStore(useShallow(state => ({
        geminiApiKey: state.geminiApiKey,
        extractionMode: state.extractionMode,
        openMedBaseUrl: state.openMedBaseUrl,
        openMedDiseaseModel: state.openMedDiseaseModel,
        openMedMedicationModel: state.openMedMedicationModel,
        openMedConfidenceThreshold: state.openMedConfidenceThreshold,
        openMedTimeoutMs: state.openMedTimeoutMs,
        openMedKeepAlive: state.openMedKeepAlive,
        allowGeminiExtractionFallback: state.allowGeminiExtractionFallback,
        openMedDocumentExtractionEnabled:
            state.openMedDocumentExtractionEnabled,
        openMedOcrMode: state.openMedOcrMode,
        openMedOcrEngine: state.openMedOcrEngine,
        openMedOcrLanguages: state.openMedOcrLanguages,
        openMedOcrResolution: state.openMedOcrResolution,
    })));
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => () => {
        abortControllerRef.current?.abort();
    }, []);

    const triggerExtraction = useCallback(async (
        file: UploadedFile,
        patientId: string,
        extractionSource: EntityExtractionSource = {},
    ) => {
        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        const documentId = extractionSource.documentId
            || (file.storageId ? `document-${file.storageId}` : undefined)
            || `untracked-document:${file.file.name}:${file.file.size}`;
        const now = new Date().toISOString();
        const mimeType = file.type
            || file.file.type
            || 'application/octet-stream';
        const localRoute = settings.extractionMode !== 'gemini';

        const writeCandidate = (candidate: ConditionRecord
            | AllergyIntoleranceRecord
            | ObservationRecord): 'created' | 'duplicate' | 'other' => {
            const result = clinicalRecordActions.addResource(candidate);
            if (result.status === 'created') return 'created';
            if (result.status === 'duplicate') return 'duplicate';
            return 'other';
        };

        const addGeminiCompatibilityCandidates = async (): Promise<CandidateWriteCounts> => {
            const counts: CandidateWriteCounts = { created: 0, duplicates: 0 };
            const apiKey = settings.geminiApiKey || process.env.API_KEY || '';
            if (!apiKey) {
                console.warn(
                    'Gemini compatibility extraction was requested, but no Gemini API key is configured.',
                );
                return counts;
            }

            const entities = await extractEntitiesFromUpload(file, {
                signal: controller.signal,
                apiKey,
            });
            if (controller.signal.aborted) return counts;

            entities.diagnosis.forEach(diagnosis => {
                const clean = diagnosis.trim();
                if (!clean) return;
                const source = geminiCandidateSource({
                    documentId,
                    file,
                    kind: 'condition',
                    value: clean,
                });
                const candidate: ConditionRecord = {
                    ...geminiCandidateBase({ patientId, source, now }),
                    resourceType: 'Condition',
                    code: { text: clean },
                    clinicalStatus: 'unknown',
                    note:
                        'Review the source and assertion context before confirming this condition.',
                };
                const result = writeCandidate(candidate);
                if (result === 'created') counts.created += 1;
                if (result === 'duplicate') counts.duplicates += 1;
            });

            entities.allergies.forEach(allergy => {
                const clean = allergy.trim();
                if (!clean) return;
                const source = geminiCandidateSource({
                    documentId,
                    file,
                    kind: 'allergy',
                    value: clean,
                });
                const candidate: AllergyIntoleranceRecord = {
                    ...geminiCandidateBase({ patientId, source, now }),
                    resourceType: 'AllergyIntolerance',
                    substance: { text: clean },
                    clinicalStatus: 'unknown',
                    criticality: 'unable-to-assess',
                    categories: ['other'],
                    reactions: [],
                    note:
                        'Confirm the substance, reaction, severity, and whether the statement applies to this patient.',
                };
                const result = writeCandidate(candidate);
                if (result === 'created') counts.created += 1;
                if (result === 'duplicate') counts.duplicates += 1;
            });

            const codeStatus = entities.codeStatus?.trim();
            if (codeStatus) {
                const source = geminiCandidateSource({
                    documentId,
                    file,
                    kind: 'code-status',
                    value: codeStatus,
                });
                const candidate: ObservationRecord = {
                    ...geminiCandidateBase({ patientId, source, now }),
                    resourceType: 'Observation',
                    status: 'final',
                    category: [{ text: 'Advance directive' }],
                    code: { text: 'Code status' },
                    value: { type: 'string', text: codeStatus },
                    referenceRanges: [],
                    note:
                        'Confirm against an authoritative advance-directive or resuscitation-status source.',
                };
                const result = writeCandidate(candidate);
                if (result === 'created') counts.created += 1;
                if (result === 'duplicate') counts.duplicates += 1;
            }
            return counts;
        };

        try {
            const patient = usePatientStore.getState().patients[patientId];
            clinicalRecordActions.initializePatientRecord({
                patientId,
                displayName:
                    patient?.name
                    || `Patient ${patientId.slice(0, 4)}`,
                administrativeSex:
                    patient?.demographics?.sex === 'Male'
                        ? 'male'
                        : patient?.demographics?.sex === 'Female'
                            ? 'female'
                            : patient?.demographics?.sex === 'Other'
                                ? 'other'
                                : undefined,
            });
            ensureDocumentReference({
                patientId,
                documentId,
                file,
                now,
            });

            if (localRoute) {
                documentActions.begin({
                    patientId,
                    documentId,
                    ...(file.storageId ? { storageId: file.storageId } : {}),
                    fileName: file.file.name,
                    mimeType,
                    startedAt: now,
                });
                documentActions.markRunning(patientId, documentId);
                auditActions.logEvent(
                    'DOCUMENT_EXTRACTION_STARTED',
                    patientId,
                    `Started local document extraction for ${file.file.name}.`,
                    'SYSTEM',
                    { documentId, mimeType },
                );

                const openMedResult = await extractOpenMedCandidatesFromUpload({
                    file,
                    documentId,
                    settings: {
                        baseUrl: settings.openMedBaseUrl,
                        timeoutMs: settings.openMedTimeoutMs,
                        confidenceThreshold:
                            settings.openMedConfidenceThreshold,
                        diseaseModel: settings.openMedDiseaseModel,
                        medicationModel: settings.openMedMedicationModel,
                        keepAlive: settings.openMedKeepAlive || undefined,
                        documentExtractionEnabled:
                            settings.openMedDocumentExtractionEnabled,
                        ocrMode: settings.openMedOcrMode,
                        ocrEngine: settings.openMedOcrEngine,
                        ocrLanguages: settings.openMedOcrLanguages,
                        ocrResolution: settings.openMedOcrResolution,
                    },
                    signal: controller.signal,
                });
                if (controller.signal.aborted) {
                    documentActions.cancel(patientId, documentId);
                    return;
                }

                if (openMedResult.warnings.length > 0) {
                    console.warn(
                        'OpenMed extraction diagnostics:',
                        openMedResult.warnings,
                    );
                }

                if (
                    openMedResult.status === 'success'
                    || openMedResult.status === 'partial'
                ) {
                    let created = 0;
                    let duplicates = 0;
                    const candidates = mapOpenMedEntitiesToCandidates({
                        patientId,
                        documentId,
                        fileName: file.file.name,
                        entities: openMedResult.entities,
                        now,
                    });
                    candidates.forEach(candidate => {
                        const result = clinicalRecordActions.addResource(candidate);
                        if (result.status === 'created') created += 1;
                        if (result.status === 'duplicate') duplicates += 1;
                    });
                    documentActions.complete({
                        patientId,
                        documentId,
                        ...(openMedResult.documentExtraction
                            ? { result: openMedResult.documentExtraction }
                            : {}),
                        status: openMedResult.status === 'partial'
                            ? 'partial'
                            : openMedResult.documentExtraction?.status
                                || 'completed',
                        warnings: openMedResult.warnings,
                        createdCandidates: created,
                        duplicateCandidates: duplicates,
                        message: `Local extraction created ${created} candidate${created === 1 ? '' : 's'} and skipped ${duplicates} same-source duplicate${duplicates === 1 ? '' : 's'}.`,
                    });
                    auditActions.logEvent(
                        'DOCUMENT_EXTRACTION_COMPLETED',
                        patientId,
                        `Completed local extraction for ${file.file.name}.`,
                        'SYSTEM',
                        {
                            documentId,
                            status: openMedResult.status,
                            method: openMedResult.documentExtraction?.method
                                || 'local-text',
                            pageCount: openMedResult.documentExtraction?.pageCount,
                            createdCandidates: created,
                            duplicateCandidates: duplicates,
                        },
                    );
                    return;
                }

                if (openMedResult.status === 'empty') {
                    documentActions.complete({
                        patientId,
                        documentId,
                        ...(openMedResult.documentExtraction
                            ? { result: openMedResult.documentExtraction }
                            : {}),
                        status: 'empty',
                        warnings: openMedResult.warnings,
                        message:
                            'Local extraction completed, but no mapped clinical entities were found.',
                    });
                    return;
                }
                if (openMedResult.status === 'aborted') {
                    documentActions.cancel(patientId, documentId);
                    return;
                }

                const fallbackEligible = openMedResult.status === 'unsupported'
                    || openMedResult.status === 'unavailable';
                const shouldFallback = settings.extractionMode === 'auto'
                    && settings.allowGeminiExtractionFallback
                    && fallbackEligible;

                if (!shouldFallback) {
                    if (openMedResult.status === 'unsupported') {
                        documentActions.complete({
                            patientId,
                            documentId,
                            ...(openMedResult.documentExtraction
                                ? { result: openMedResult.documentExtraction }
                                : {}),
                            status: 'unsupported',
                            warnings: openMedResult.warnings,
                            message:
                                'The current local extraction configuration does not support this document.',
                        });
                    } else {
                        documentActions.fail({
                            patientId,
                            documentId,
                            ...(openMedResult.documentExtraction
                                ? { result: openMedResult.documentExtraction }
                                : {}),
                            warnings: openMedResult.warnings,
                            message: openMedResult.warnings[0]
                                || 'Local document extraction failed.',
                        });
                        auditActions.logEvent(
                            'DOCUMENT_EXTRACTION_FAILED',
                            patientId,
                            `Local extraction failed for ${file.file.name}.`,
                            'SYSTEM',
                            { documentId, status: openMedResult.status },
                        );
                    }
                    return;
                }

                // Auto mode reaches this branch only for unsupported or
                // unavailable local extraction when fallback was explicitly enabled.
                const fallbackCounts = await addGeminiCompatibilityCandidates();
                documentActions.fail({
                    patientId,
                    documentId,
                    ...(openMedResult.documentExtraction
                        ? { result: openMedResult.documentExtraction }
                        : {}),
                    status: openMedResult.status === 'unsupported'
                        ? 'unsupported'
                        : 'failed',
                    warnings: openMedResult.warnings,
                    fallbackUsed: true,
                    message: `Local extraction did not complete. Gemini compatibility fallback created ${fallbackCounts.created} candidate${fallbackCounts.created === 1 ? '' : 's'} with separate cloud provenance.`,
                });
                return;
            }

            await addGeminiCompatibilityCandidates();
        } catch (error) {
            if (!controller.signal.aborted) {
                console.warn('Candidate extraction failed:', error);
                if (localRoute) {
                    documentActions.fail({
                        patientId,
                        documentId,
                        message: error instanceof Error
                            ? error.message
                            : 'Candidate extraction failed.',
                    });
                    auditActions.logEvent(
                        'DOCUMENT_EXTRACTION_FAILED',
                        patientId,
                        `Document extraction failed for ${file.file.name}.`,
                        'SYSTEM',
                        { documentId },
                    );
                }
            } else if (localRoute) {
                documentActions.cancel(patientId, documentId);
            }
        } finally {
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
            }
        }
    }, [
        auditActions,
        clinicalRecordActions,
        documentActions,
        settings,
    ]);

    return { triggerExtraction };
};
