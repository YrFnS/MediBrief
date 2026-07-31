import { v4 as uuidv4 } from 'uuid';
import { createUnknownClinicalDate } from '../clinical-record/factories';
import type {
    ClinicalAmendment,
    ClinicalAssertionContext,
    ConditionRecord,
    MedicationDosage,
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

const UNKNOWN_ASSERTION: ClinicalAssertionContext = {
    polarity: 'unknown',
    certainty: 'unknown',
    temporality: 'unknown',
    experiencer: 'unknown',
};

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
        section: entity.context?.section?.label || 'Locally decoded source text',
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
        'Candidate extracted locally by OpenMed named-entity recognition. Assertion context, when present, remains advisory and reviewable.',
});

/**
 * OpenMed's context helpers intentionally default an unmodified span to
 * affirmed, certain, recent, and patient. Those defaults are useful review
 * hints, but they are not positive evidence. MediBrief therefore copies only
 * evidence-backed risk/context signals into the candidate and leaves every
 * other axis unknown until a person reviews the source.
 */
const mappedAssertion = (
    entity: OpenMedCandidateEntity,
): ClinicalAssertionContext => {
    const context = entity.context;
    if (!context) return UNKNOWN_ASSERTION;

    const hasCue = (
        category: 'historical' | 'hypothetical' | 'uncertainty' | 'negation',
    ): boolean => context.cues.some(cue => cue.category === category);
    const section = context.section?.canonical || context.section?.label;
    const historicalSection = section === 'past_medical_history'
        || section === 'history';

    return {
        polarity: context.assertion.polarity === 'negated' && hasCue('negation')
            ? 'negated'
            : 'unknown',
        certainty: context.assertion.certainty === 'uncertain'
            && (hasCue('uncertainty') || hasCue('hypothetical'))
            ? 'uncertain'
            : 'unknown',
        temporality: context.assertion.temporality === 'historical'
            && (hasCue('historical') || historicalSection)
            ? 'historical'
            : context.assertion.temporality === 'hypothetical'
                && hasCue('hypothetical')
                ? 'hypothetical'
                : 'unknown',
        experiencer: context.experiencerEvidence.source !== 'default'
            ? context.assertion.experiencer
            : 'unknown',
    };
};

const contextAmendment = (
    entity: OpenMedCandidateEntity,
): ClinicalAmendment | null => {
    const context = entity.context;
    if (!context) return null;
    return {
        id: uuidv4(),
        amendedAt: context.evaluatedAt,
        amendedBy: context.engine,
        reason:
            'Advisory OpenMed assertion context and medication-sig evidence applied to the extraction candidate. Human review is still required.',
        changedFields: [
            'assertion',
            ...(context.medicationSig ? ['dosageInstructions'] : []),
        ],
        previousValues: {
            assertion: UNKNOWN_ASSERTION,
            ...(context.medicationSig ? { dosageInstructions: [] } : {}),
            openMedContextEvidence: context,
        },
    };
};

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
}) => {
    const amendment = contextAmendment(entity);
    return {
        id: uuidv4(),
        patientId,
        verificationStatus: 'candidate' as const,
        recordedAt: now,
        effective: createUnknownClinicalDate(
            'No clinical event date was extracted by OpenMed.',
        ),
        assertion: mappedAssertion(entity),
        provenance: {
            source,
            createdAt: now,
            updatedAt: entity.context?.evaluatedAt || now,
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
        amendments: amendment ? [amendment] : [],
        tags: [
            'local-extraction',
            'needs-review',
            'openmed-extracted',
            ...(entity.context ? ['openmed-context'] : []),
            ...(entity.context?.medicationSig ? ['openmed-medication-sig'] : []),
        ],
    };
};

const medicationDosage = (
    entity: OpenMedCandidateEntity,
): MedicationDosage[] => {
    const sig = entity.context?.medicationSig;
    if (!sig) return [];
    const dose = sig.dose !== undefined
        ? {
            original: {
                value: sig.dose,
                ...(sig.unit ? { unit: sig.unit } : {}),
            },
        }
        : undefined;
    const frequency = sig.frequencyPerDay !== undefined
        ? `${sig.frequencyPerDay} per day`
        : undefined;
    const timingText = [
        sig.frequencyPeriod !== undefined
            ? `Every ${sig.frequencyPeriod}${sig.frequencyPeriodUnit ? ` ${sig.frequencyPeriodUnit}` : ''}`
            : '',
        sig.durationDays !== undefined
            ? `For ${sig.durationDays} day${String(sig.durationDays) === '1' ? '' : 's'}`
            : '',
    ].filter(Boolean).join(' · ');

    return [{
        text: sig.raw,
        ...(dose ? { dose } : {}),
        ...(sig.route ? { route: { text: sig.route } } : {}),
        ...(frequency ? { frequency } : {}),
        ...(timingText ? { timingText } : {}),
        asNeeded: sig.asNeeded,
    }];
};

const contextSummary = (entity: OpenMedCandidateEntity): string => {
    const context = entity.context;
    if (!context) {
        return 'Assertion context was not available. Confirm polarity, certainty, temporality, experiencer, status, and date against the source.';
    }
    const raw = context.assertion;
    const cueText = context.cues.length > 0
        ? context.cues.map(cue => `“${cue.text}”`).join(', ')
        : 'no scoped cue';
    return [
        `${context.engine} suggested ${raw.polarity}, ${raw.certainty}, ${raw.temporality}, ${raw.experiencer}.`,
        `Evidence: ${cueText}${context.section ? `; section ${context.section.label}` : ''}.`,
        'Default positive axes are retained as review evidence but remain unknown in the candidate unless supported by a scoped cue or section prior.',
        'This deterministic context annotation is advisory and must be reviewed against the original source.',
    ].join(' ');
};

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
            note: [
                'OpenMed identified a disease or condition span.',
                contextSummary(entity),
            ].join(' '),
        };
    }

    const dosageInstructions = medicationDosage(entity);
    return {
        ...base,
        resourceType: 'Medication',
        kind: 'statement',
        medication: { text: entity.text },
        status: 'unknown',
        dosageInstructions,
        ...(entity.context?.medicationSig?.condition
            ? { reason: [{ text: entity.context.medicationSig.condition }] }
            : {}),
        note: [
            'OpenMed identified a medication-related span.',
            contextSummary(entity),
            entity.context?.medicationSig
                ? `Medication instructions were parsed from the local source window; unresolved fields: ${entity.context.medicationSig.missing.join(', ') || 'none listed'}.`
                : 'Dose, route, frequency, duration, indication, status, and patient attribution require review.',
        ].join(' '),
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
