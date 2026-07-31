import { useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useShallow } from 'zustand/react/shallow';
import type { UploadedFile } from '../types';
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
} from '../features/openmed';
import { usePatientStore } from '../features/patient-management/usePatientStore';
import { useSettingsStore } from '../features/settings/useSettingsStore';

export interface EntityExtractionSource {
    documentId?: string;
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

        const addGeminiCompatibilityCandidates = async () => {
            const apiKey = settings.geminiApiKey || process.env.API_KEY || '';
            if (!apiKey) {
                console.warn(
                    'Gemini compatibility extraction was requested, but no Gemini API key is configured.',
                );
                return;
            }

            const entities = await extractEntitiesFromUpload(file, {
                signal: controller.signal,
                apiKey,
            });
            if (controller.signal.aborted) return;

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
                clinicalRecordActions.addResource(candidate);
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
                clinicalRecordActions.addResource(candidate);
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
                clinicalRecordActions.addResource(candidate);
            }
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

            if (settings.extractionMode !== 'gemini') {
                const openMedResult = await extractOpenMedCandidatesFromUpload({
                    file,
                    settings: {
                        baseUrl: settings.openMedBaseUrl,
                        timeoutMs: settings.openMedTimeoutMs,
                        confidenceThreshold:
                            settings.openMedConfidenceThreshold,
                        diseaseModel: settings.openMedDiseaseModel,
                        medicationModel: settings.openMedMedicationModel,
                        keepAlive: settings.openMedKeepAlive || undefined,
                    },
                    signal: controller.signal,
                });
                if (controller.signal.aborted) return;

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
                    const candidates = mapOpenMedEntitiesToCandidates({
                        patientId,
                        documentId,
                        fileName: file.file.name,
                        entities: openMedResult.entities,
                        now,
                    });
                    candidates.forEach(candidate => {
                        clinicalRecordActions.addResource(candidate);
                    });
                    return;
                }

                if (
                    openMedResult.status === 'empty'
                    || openMedResult.status === 'aborted'
                    || settings.extractionMode === 'openmed'
                    || !settings.allowGeminiExtractionFallback
                ) {
                    return;
                }

                // Auto mode reaches this branch only when local extraction is
                // unsupported or unavailable and fallback was explicitly allowed.
                await addGeminiCompatibilityCandidates();
                return;
            }

            await addGeminiCompatibilityCandidates();
        } catch (error) {
            if (!controller.signal.aborted) {
                console.warn('Candidate extraction failed:', error);
            }
        } finally {
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
            }
        }
    }, [clinicalRecordActions, settings]);

    return { triggerExtraction };
};
