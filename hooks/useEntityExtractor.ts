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
            || file.storageId
            || `untracked-document:${file.file.name}:${file.file.size}`;

        try {
            const entities = await extractEntitiesFromUpload(file, {
                signal: controller.signal,
                apiKey: geminiApiKey || process.env.API_KEY || '',
            });
            if (controller.signal.aborted) return;

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

            const now = new Date().toISOString();

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
