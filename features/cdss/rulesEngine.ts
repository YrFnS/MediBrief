import type { FHIRObservation } from '../fhir/types';
import type { CDSSAlert } from './types';

/**
 * The previous rules labelled isolated values as diagnoses or protocol states
 * without enough patient context, baseline data, or validated protocol inputs.
 * They are intentionally disabled until each rule has an explicit intended
 * population, required inputs, evidence/version metadata, and regression tests.
 */
export const CLINICAL_RULES_ENABLED = false as const;

export const CLINICAL_RULES_DISABLED_REASON =
    'Automated clinical conclusions are disabled pending protocol validation.';

/**
 * Compatibility entry point retained while callers migrate away from the old
 * rule engine. Returning an empty list prevents legacy thresholds from creating
 * treatment-style alerts or actions.
 */
export const evaluateClinicalSafety = async (
    observations: FHIRObservation[],
): Promise<CDSSAlert[]> => {
    void observations;
    return [];
};
