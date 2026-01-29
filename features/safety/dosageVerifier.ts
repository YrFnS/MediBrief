
import { fetchDrugSafetyInfo } from './openFdaService';
import { ParsedMedication, SafetyCheckResult } from './types';

// Fallback "Fast" limits for common OTC items if network fails or for double-checking
// We keep a small subset of the old list as a "Local Guardrail" for extreme outliers
const CRITICAL_LIMITS: Record<string, number> = {
    "acetaminophen": 4000,
    "paracetamol": 4000,
    "ibuprofen": 3200,
    "aspirin": 4000
};

/**
 * ASYNCHRONOUS EXTERNAL GUARDRAIL
 * Queries openFDA to check for "Boxed Warnings" (Black Box) and verifies dosage against local critical limits.
 */
export const verifyMedicationSafetyAsync = async (medications: ParsedMedication[]): Promise<SafetyCheckResult> => {
    const warnings: string[] = [];
    const verifiedItems: string[] = [];
    const interactions: string[] = [];

    // Process all meds in parallel
    const promises = medications.map(async (med) => {
        const lowerName = med.drugName.toLowerCase();
        
        // 1. External Verification (openFDA)
        const fdaData = await fetchDrugSafetyInfo(lowerName);

        if (fdaData.found) {
            const displayName = fdaData.genericName || fdaData.brandName || med.drugName;

            // CHECK: Boxed Warning (The most critical safety check)
            if (fdaData.boxedWarning && fdaData.boxedWarning.length > 0) {
                // Truncate warning for UI clarity
                const shortWarn = fdaData.boxedWarning[0].substring(0, 150) + "...";
                warnings.push(
                    `🛑 **FDA BOXED WARNING** (${displayName}): ${shortWarn}`
                );
            } else {
                 verifiedItems.push(
                    `✅ Verified (${displayName}): No Boxed Warning found in FDA Label.`
                );
            }
        } else {
            // If not found in FDA, we can't verify it.
            // In a real app, this might be a warning itself.
            // For now, we just don't add a verification tag.
        }

        // 2. Local Critical Limit Check (Dosage Math)
        // We attempt to match simple names to our small critical list
        const limit = CRITICAL_LIMITS[lowerName];
        if (limit) {
            // Simple normalization
            let amountMg = med.amount;
            if (med.unit.toLowerCase().includes('g')) amountMg = med.amount * 1000;
            
            if (amountMg > limit) {
                warnings.push(
                    `⚠️ **DOSAGE LIMIT EXCEEDED**: ${med.drugName} ${med.amount}${med.unit} exceeds critical limit of ${limit}mg/day.`
                );
            }
        }
    });

    await Promise.all(promises);

    return {
        isSafe: warnings.length === 0,
        warnings,
        verifiedItems
    };
};
