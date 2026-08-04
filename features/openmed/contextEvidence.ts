import type { ClinicalRecordResource } from '../clinical-record/types';
import type { OpenMedContextResult } from './contextTypes';

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isContextResult = (value: unknown): value is OpenMedContextResult => {
    if (!isObject(value)) return false;
    const assertion = value.assertion;
    return typeof value.id === 'string'
        && typeof value.engine === 'string'
        && typeof value.bridgeVersion === 'string'
        && typeof value.language === 'string'
        && typeof value.evaluatedAt === 'string'
        && Array.isArray(value.cues)
        && isObject(assertion)
        && typeof assertion.polarity === 'string'
        && typeof assertion.certainty === 'string'
        && typeof assertion.temporality === 'string'
        && typeof assertion.experiencer === 'string';
};

/**
 * Context is stored in the initial assertion amendment so NER provenance and
 * context-engine provenance remain distinct while using the existing versioned
 * clinical-record schema and backup format.
 */
export const getOpenMedContextEvidence = (
    resource: ClinicalRecordResource,
): OpenMedContextResult | null => {
    for (const amendment of [...resource.amendments].reverse()) {
        const evidence = amendment.previousValues?.openMedContextEvidence;
        if (isContextResult(evidence)) return evidence;
    }
    return null;
};
