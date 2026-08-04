import { reviewMedicationLabelsAsync } from './medicationLabelReviewService';
import type {
    MedicationLabelReviewResult,
    ParsedMedication,
} from './types';

export { reviewMedicationLabelsAsync } from './medicationLabelReviewService';

/**
 * @deprecated The old name implied patient-specific dose validation. This
 * compatibility wrapper performs limited FDA label lookup only.
 */
export const verifyMedicationSafetyAsync = async (
    medications: ParsedMedication[],
    _patientContext?: unknown,
    signal?: AbortSignal,
): Promise<MedicationLabelReviewResult> =>
    reviewMedicationLabelsAsync(medications, signal);
