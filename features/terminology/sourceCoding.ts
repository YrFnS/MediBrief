import type { ClinicalCoding } from '../clinical-record/types';
import { TERMINOLOGY_URIS } from './registry';
import type { SourceRxNormInput } from './types';

export interface SourceRxNormValidation {
    valid: boolean;
    errors: string[];
    coding?: ClinicalCoding;
}

/**
 * Validates the local review contract for a source-provided RxNorm identifier.
 * MediBrief does not search RxNorm, verify concept status, or choose a code.
 */
export const validateSourceRxNormInput = (
    input: SourceRxNormInput,
): SourceRxNormValidation => {
    const errors: string[] = [];
    const medicationId = input.medicationId.trim();
    const rxcui = input.rxcui.trim();
    const display = input.display.trim();
    const sourceDescription = input.sourceDescription.trim();

    if (!medicationId) {
        errors.push('A local medication record is required.');
    }
    if (!/^[1-9]\d{0,11}$/.test(rxcui)) {
        errors.push('RxCUI must be a positive numeric identifier of up to 12 digits.');
    }
    if (!display) {
        errors.push('A display term from the reviewed source is required.');
    }
    if (sourceDescription.length < 5) {
        errors.push('Describe the clinical source or terminology workflow that supplied the identifier.');
    }
    if (!input.sourceReviewed) {
        errors.push('Confirm that the identifier and display were reviewed against the stated source.');
    }

    if (errors.length > 0) return { valid: false, errors };

    return {
        valid: true,
        errors: [],
        coding: {
            system: TERMINOLOGY_URIS.rxnorm,
            code: rxcui,
            display,
            userSelected: true,
        },
    };
};
