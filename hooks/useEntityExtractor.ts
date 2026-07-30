import { useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
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
import { usePatientStore } from '../features/patient-management/usePatientStore';
import { useSettingsStore } from '../features/settings/useSettingsStore';

export interface EntityExtractionSource {
    documentId?: string;
}

const normalizedKey = (value: string): string =>
    value.trim().toLowerCase().replace(/\s+/g, ' ');

const candidateSource = ({
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
    externalSystem: 'medibrief:entity-extraction',
    externalId: `${documentId}:${kind}:${normalizedKey(value)}`,
    description: 'Candidate extracted from an uploaded medical document.',
});

const baseCandidate = ({
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
    effective: createUnknownClinicalDate(),
    assertion: {
        polarity: 'unknown' as const,
        certainty: 'unknown' as const,
        temporality: 'unknown' as const,
        experiencer: 'patient' as const,
    },
    provenance: {
        source,
        createdAt: now,
        updatedAt: now,
        extraction: {
            engine: 'Google Gemini entity extraction',
            model: ENTITY_EXTRACTION_MODEL,
            promptVersion: ENTITY_EXTRACTION_PROMPT_VERSION,
            extractedAt: now,
        },
    },
    amendments: [],
    tags: ['ai-extracted', 'needs-review'],
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
                description: 'File uploaded by the user for local medical-document review.',
            },
            createdAt: now,
            updatedAt: now,
            confirmation: {
                reviewedAt: now,
                reason: 'The local file upload was explicitly initiated by the user.',
            },
        },
        amendments: [],
        tags: ['uploaded-document'],
        status: 'current',
        storageId: file.storageId,
        fileName: file.file.name,
        mimeType: file.type || file.file.type || 'application/octet-stream',
        uploadedAt: now,
        relatedResources: [],
        description: 'Locally stored source document. Clinical facts extracted from it remain candidates until reviewed.',
    };
    actions.addResource(document);
};

export const useEntityExtractor = () => {
    const clinicalRecordActions = useClinicalRecordStore(state => state.actions);
    const geminiApiKey = useSettingsStore(state => state.geminiApiKey);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
        };
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

        try {
            const patient = usePatientStore.getState().patients[patientId];
            clinicalRecordActions.initializePatientRecord({
                patientId,
                displayName: patient?.name || `Patient ${patientId.slice(0, 4)}`,
                administrativeSex: patient?.demographics?.sex === 'Male'
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

            const entities = await extractEntitiesFromUpload(file, {
                signal: controller.signal,
                apiKey: geminiApiKey || process.env.API_KEY || '',
            });
            if (controller.signal.aborted) return;

            entities.diagnosis.forEach(diagnosis => {
                const clean = diagnosis.trim();
                if (!clean) return;
                const source = candidateSource({
                    documentId,
                    file,
                    kind: 'condition',
                    value: clean,
                });
                const candidate: ConditionRecord = {
                    ...baseCandidate({ patientId, source, now }),
                    resourceType: 'Condition',
                    code: { text: clean },
                    clinicalStatus: 'unknown',
                    note: 'Review the source and assertion context before confirming this condition.',
                };
                clinicalRecordActions.addResource(candidate);
            });

            entities.allergies.forEach(allergy => {
                const clean = allergy.trim();
                if (!clean) return;
                const source = candidateSource({
                    documentId,
                    file,
                    kind: 'allergy',
                    value: clean,
                });
                const candidate: AllergyIntoleranceRecord = {
                    ...baseCandidate({ patientId, source, now }),
                    resourceType: 'AllergyIntolerance',
                    substance: { text: clean },
                    clinicalStatus: 'unknown',
                    criticality: 'unable-to-assess',
                    categories: ['other'],
                    reactions: [],
                    note: 'Confirm the substance, reaction, severity, and whether the statement applies to this patient.',
                };
                clinicalRecordActions.addResource(candidate);
            });

            const codeStatus = entities.codeStatus?.trim();
            if (codeStatus) {
                const source = candidateSource({
                    documentId,
                    file,
                    kind: 'code-status',
                    value: codeStatus,
                });
                const candidate: ObservationRecord = {
                    ...baseCandidate({ patientId, source, now }),
                    resourceType: 'Observation',
                    status: 'final',
                    category: [{ text: 'Advance directive' }],
                    code: { text: 'Code status' },
                    value: { type: 'string', text: codeStatus },
                    referenceRanges: [],
                    note: 'Confirm against an authoritative advance-directive or resuscitation-status source.',
                };
                clinicalRecordActions.addResource(candidate);
            }
        } catch (error) {
            if (!controller.signal.aborted) {
                console.warn('Candidate extraction failed:', error);
            }
        } finally {
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
            }
        }
    }, [clinicalRecordActions, geminiApiKey]);

    return { triggerExtraction };
};
