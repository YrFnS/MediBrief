export interface ParsedMedication {
    drugName: string;
    amount: number;
    unit: string;
    context?: string;
}

/**
 * Results from looking up public FDA label fields. This is deliberately not a
 * patient-specific regimen-safety result.
 */
export interface MedicationLabelReviewResult {
    hasBoxedWarnings: boolean;
    labelWarnings: string[];
    labelInformation: string[];
    limitations: string[];
    serviceError?: boolean;
}

/** @deprecated Use MedicationLabelReviewResult. */
export type SafetyCheckResult = MedicationLabelReviewResult;
