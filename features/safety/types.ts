
export interface ParsedMedication {
    drugName: string;
    amount: number;
    unit: string;
    context?: string; // e.g., "prescribed", "stopped", "current"
}

export interface SafetyCheckResult {
    isSafe: boolean;
    warnings: string[];
    verifiedItems: string[];
    serviceError?: boolean;
}
