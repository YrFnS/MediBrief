import { v4 as uuidv4 } from 'uuid';
import { createUnknownClinicalDate } from '../clinical-record/factories';
import type {
    ConditionRecord,
    MedicationRecord,
    RecordSource,
} from '../clinical-record/types';
import type {
    OpenMedCandidateEntity,
    OpenMedCandidateKind,
    OpenMedEntity,
} from './types';

const CONDITION_LABELS = new Set([
    'CONDITION',
    'DIAGNOSIS',
    'DISEASE',
    'DISORDER',
    'PROBLEM',
    'SYMPTOM',
]);

const MEDICATION_LABELS = new Set([
    'CHEMICAL',
    'DRUG',
    'MEDICATION',
    'PHARMACEUTICAL',
    'SUBSTANCE',
]);

const normalizedText = (value: string): string =>
    value.trim().toLowerCase().replace(/\s+/g, ' ');

export const classifyOpenMedEntityLabel = (
    label: string,
): OpenMedCandidateKind | null => {
    const normalized = label.trim().toUpperCase().replace(/^B-|^I-/, '');
    if (CONDITION_LABELS.has(normalized)) return 'condition';
    if (MEDICATION_LABELS.has(normalized)) return 'medication';
    return null;
};

export const toOpenMedCandidateEntity = ({
    entity,
    modelName,
    engineVersion,
}: {
    entity: OpenMedEntity;
    modelName: string;
    engineVersion?: string;
}): OpenMedCandidateEntity | null => {
    const kind = classifyOpenMedEntityLabel(entity.label);
    if (!kind) return null;
    return {
        ...entity,
        kind,
        modelName,
        ...(engineVersion ? { engineVersion } : {}),
    };
};

/**
 * Multiple specialized models may return the same clinical span. Keep the
 * highest-confidence assertion for one kind and source location while leaving
 * condition and medication interpretations separate for human review.
 */
export const deduplicateOpenMedEntities = (
    entities: OpenMedCandidateEntity[],
): OpenMedCandidateEntity[] => {
    const selected = new Map<string, OpenMedCandidateEntity>();
    entities.forEach(entity => {
        const key = [
            entity.kind,
            entity.start,
            entity.end,
            normalizedText(entity.text),
        ].join(':');
        const current = selected.get(key);
        if (!current || entity.confidence > current.confidence) {
            selected.set(key, entity);
        }
    });
    return [...selected.values()].sort((left, right) => {
        if (left.start !== right.start) return left.start - right.start;
        if (left.end !== right.end) return left.end - right.end;
        return left.kind.localeCompare(right.kind);
    });
};

const candidateSource = ({
    documentId,
    fileName,
    entity,
}: {
    documentId: string;
    fileName: string;
    entity: OpenMedCandidateEntity;
}): RecordSource => ({
    kind: 'document-extraction',
    document: {
        documentId,
        fileName,
        startOffset: entity.start,
        endOffset: entity.end,
        excerpt: entity.text,
        section: 'Locally decoded source text',
    },
    externalSystem: 'openmed:rest',
    externalId: [
        documentId,
        entity.kind,
        entity.modelName,
        entity.start,
        entity.end,
        normalizedText(entity.text),
    ].join(':'),
    description:
        'Candidate extracted locally by OpenMed named-entity recognition.',
});

const candidateBase = ({
    patientId,
    source,
    entity,
    now,
}: {
    patientId: string;
    source: RecordSource;
    entity: OpenMedCandidateEntity;
    now: string;
}) => ({
    id: uuidv4(),
    patientId,
    verificationStatus: 'candidate' as const,
    recordedAt: now,
    effective: createUnknownClinicalDate(
        'No clinical event date was extracted by OpenMed.',
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
            engine: 'OpenMed local REST NER',
            model: entity.modelName,
            ...(entity.engineVersion
                ? { engineVersion: entity.engineVersion }
                : {}),
            confidence: entity.confidence,
            extractedAt: now,
        },
    },
    amendments: [],
    tags: [
        'local-extraction',
        'needs-review',
        'openmed-extracted',
    ],
});

export const mapOpenMedEntityToCandidate = ({
    patientId,
    documentId,
    fileName,
    entity,
    now = new Date().toISOString(),
}: {
    patientId: string;
    documentId: string;
    fileName: string;
    entity: OpenMedCandidateEntity;
    now?: string;
}): ConditionRecord | MedicationRecord => {
    const source = candidateSource({ documentId, fileName, entity });
    const base = candidateBase({ patientId, source, entity, now });

    if (entity.kind === 'condition') {
        return {
            ...base,
            resourceType: 'Condition',
            code: { text: entity.text },
            clinicalStatus: 'unknown',
            note:
                'OpenMed identified a disease or condition span. Confirm the assertion, patient attribution, status, and date against the source before accepting it.',
        };
    }

    return {
        ...base,
        resourceType: 'Medication',
        kind: 'statement',
        medication: { text: entity.text },
        status: 'unknown',
        dosageInstructions: [],
        note:
            'OpenMed identified a medication-related span. Confirm the drug, dose, route, frequency, indication, status, and patient attribution against the source before accepting it.',
    };
};

export const mapOpenMedEntitiesToCandidates = ({
    patientId,
    documentId,
    fileName,
    entities,
    now = new Date().toISOString(),
}: {
    patientId: string;
    documentId: string;
    fileName: string;
    entities: OpenMedCandidateEntity[];
    now?: string;
}): Array<ConditionRecord | MedicationRecord> =>
    deduplicateOpenMedEntities(entities).map(entity =>
        mapOpenMedEntityToCandidate({
            patientId,
            documentId,
            fileName,
            entity,
            now,
        }));
