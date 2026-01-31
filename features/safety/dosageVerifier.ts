
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
export const verifyMedicationSafetyAsync = async (medications: ParsedMedication[], signal?: AbortSignal): Promise<SafetyCheckResult> => {
    const warnings: string[] = [];
    const verifiedItems: string[] = [];
    let serviceError = false;

    // Process all meds in parallel
    const promises = medications.map(async (med) => {
        if (signal?.aborted) return;

        const lowerName = med.drugName.toLowerCase();
        
        // 1. External Verification (openFDA)
        let fdaData;
        try {
            fdaData = await fetchDrugSafetyInfo(lowerName, signal);
        } catch (e: any) {
            if (e.name === 'AbortError') throw e;
            fdaData = { status: 'service_error' };
        }

        if (signal?.aborted) return;

        if (fdaData.status === 'service_error') {
            serviceError = true;
            warnings.push(
                `⚠️ **NETWORK ERROR**: Unable to verify ${med.drugName} against FDA database.`
            );
        } else if (fdaData.status === 'verified') {
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
            // Not found in FDA
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

    try {
        await Promise.all(promises);
    } catch (error: any) {
        if (error.name === 'AbortError') {
            // If aborted, we can return a safe default or re-throw
            // Typically re-throwing lets the caller know it was cancelled
            throw error; 
        }
    }

    return {
        isSafe: warnings.length === 0,
        warnings,
        verifiedItems,
        serviceError
    };
};
