import type { ClinicalCoding } from '../clinical-record/types';
import { TERMINOLOGY_URIS } from './registry';
import type { LicensedSnomedInput } from './types';

const SNOMED_VERSION_URI = /^http:\/\/snomed\.info\/sct\/\d+(?:\/version\/\d{8})?$/;
const SUPPORTED_RESOURCE_TYPES = new Set([
    'Condition',
    'AllergyIntolerance',
    'Procedure',
]);

// SNOMED CT identifiers use the Verhoeff check-digit algorithm. This local
// syntax check catches common transcription errors but does not establish that
// a concept exists, is active, belongs to the supplied edition, or is suitable.
const VERHOEFF_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
] as const;

const VERHOEFF_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
] as const;

export const hasValidSnomedCheckDigit = (identifier: string): boolean => {
    if (!/^\d{6,18}$/.test(identifier)) return false;
    let checksum = 0;
    const reversedDigits = [...identifier].reverse();
    reversedDigits.forEach((digit, index) => {
        checksum = VERHOEFF_D[checksum][
            VERHOEFF_P[index % 8][Number(digit)]
        ];
    });
    return checksum === 0;
};

export interface LicensedSnomedValidation {
    valid: boolean;
    errors: string[];
    coding?: ClinicalCoding;
}

/**
 * Validates only the local review contract. It does not call a terminology
 * server and cannot establish that the code exists, is active, is clinically
 * appropriate, or is licensed for the deployment.
 */
export const validateLicensedSnomedInput = (
    input: LicensedSnomedInput,
): LicensedSnomedValidation => {
    const errors: string[] = [];
    const code = input.code.trim();
    const display = input.display.trim();
    const versionUri = input.versionUri.trim();

    if (!SUPPORTED_RESOURCE_TYPES.has(input.resourceType)) {
        errors.push('SNOMED CT coding can be attached only to a condition, allergy, or procedure in this workflow.');
    }
    if (!input.resourceId.trim()) {
        errors.push('A local resource is required.');
    }
    if (!/^\d{6,18}$/.test(code)) {
        errors.push('SNOMED CT concept identifiers must contain 6 to 18 digits.');
    } else if (!hasValidSnomedCheckDigit(code)) {
        errors.push('The SNOMED CT identifier failed its Verhoeff check digit. Recheck the licensed source.');
    }
    if (!display) {
        errors.push('A display term from the licensed source is required.');
    }
    if (!SNOMED_VERSION_URI.test(versionUri)) {
        errors.push(
            'Provide a SNOMED CT edition or edition/version URI such as http://snomed.info/sct/{moduleId}/version/{YYYYMMDD}.',
        );
    }
    if (!input.licenseAcknowledged) {
        errors.push(
            'Confirm that the code came from a SNOMED CT source licensed for this deployment.',
        );
    }

    if (errors.length > 0) return { valid: false, errors };

    return {
        valid: true,
        errors: [],
        coding: {
            system: TERMINOLOGY_URIS.snomedCt,
            version: versionUri,
            code,
            display,
            userSelected: true,
        },
    };
};
