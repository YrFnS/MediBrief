import { fetchDrugSafetyInfo, sanitizeDrugName } from './openFdaService';
import type {
    MedicationLabelReviewResult,
    ParsedMedication,
} from './types';

const LABEL_REVIEW_LIMITATIONS = [
    'This lookup does not validate the prescribed dose, frequency, route, duration, formulation, or total daily amount.',
    'It does not evaluate drug-drug interactions, allergies, pregnancy, indication, kidney/liver function, or other patient-specific contraindications.',
    'Finding a label without a boxed-warning field does not mean that a medication or regimen is safe for this patient.',
];

const conciseLabelText = (value: string): string => {
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length > 400
        ? `${normalized.slice(0, 397)}...`
        : normalized;
};

/**
 * Retrieves limited public FDA label fields. The function intentionally avoids
 * dose arithmetic or a binary safe/unsafe result because the extracted amount
 * does not include enough regimen and patient context for that conclusion.
 */
export const reviewMedicationLabelsAsync = async (
    medications: ParsedMedication[],
    signal?: AbortSignal,
): Promise<MedicationLabelReviewResult> => {
    const labelWarnings: string[] = [];
    const labelInformation: string[] = [];
    const limitations = [...LABEL_REVIEW_LIMITATIONS];
    let serviceError = false;

    await Promise.all(medications.map(async medication => {
        if (signal?.aborted) return;

        const sanitized = sanitizeDrugName(medication.drugName);
        if (!sanitized) {
            limitations.push(
                `No usable medication name was available for “${medication.drugName || 'unnamed item'}”.`,
            );
            return;
        }

        let label;
        try {
            label = await fetchDrugSafetyInfo(sanitized, signal);
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                throw error;
            }
            serviceError = true;
            limitations.push(
                `The FDA label service could not be reached for ${medication.drugName}.`,
            );
            return;
        }

        if (signal?.aborted) return;

        if (label.status === 'service_error') {
            serviceError = true;
            limitations.push(
                `The FDA label service could not be reached for ${medication.drugName}.`,
            );
            return;
        }

        if (label.status === 'not_found') {
            limitations.push(
                `No matching FDA label was found for ${medication.drugName}; spelling, market, or product naming may differ.`,
            );
            return;
        }

        const displayName = label.genericName
            || label.brandName
            || medication.drugName;
        const boxedWarnings = (label.boxedWarning || [])
            .map(conciseLabelText)
            .filter(Boolean);

        if (boxedWarnings.length > 0) {
            boxedWarnings.forEach(warning => {
                labelWarnings.push(
                    `FDA boxed-warning text for ${displayName}: ${warning}`,
                );
            });
        } else {
            labelInformation.push(
                `FDA label located for ${displayName}; the returned label did not contain a boxed-warning field.`,
            );
        }

        const generalWarning = label.generalWarnings?.[0];
        if (generalWarning) {
            labelInformation.push(
                `FDA label warning information is available for ${displayName}: ${conciseLabelText(generalWarning)}`,
            );
        }
    }));

    return {
        hasBoxedWarnings: labelWarnings.length > 0,
        labelWarnings,
        labelInformation,
        limitations: [...new Set(limitations)],
        ...(serviceError ? { serviceError: true } : {}),
    };
};

/**
 * Backward-compatible alias for older call sites. Despite the historical name,
 * this performs label lookup only and never returns a regimen-safety verdict.
 */
export const verifyMedicationSafetyAsync = async (
    medications: ParsedMedication[],
    _patientContext?: unknown,
    signal?: AbortSignal,
): Promise<MedicationLabelReviewResult> =>
    reviewMedicationLabelsAsync(medications, signal);
