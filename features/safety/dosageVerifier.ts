
import { fetchDrugSafetyInfo, sanitizeDrugName } from './openFdaService';
import { ParsedMedication, SafetyCheckResult } from './types';
import { PatientMetadata } from '../patient-management/types';
import criticalLimitsData from './criticalLimits.json';

export interface DrugLimit {
    maxDailyAdultMg: number;
    maxDailyPediatricMgPerKg?: number;
}

const CRITICAL_LIMITS: Record<string, DrugLimit> = criticalLimitsData;

/**
 * ASYNCHRONOUS EXTERNAL GUARDRAIL
 * Queries openFDA to check for "Boxed Warnings" (Black Box) and verifies dosage against local critical limits.
 */
export const verifyMedicationSafetyAsync = async (medications: ParsedMedication[], patient?: PatientMetadata, signal?: AbortSignal): Promise<SafetyCheckResult> => {
    const warnings: string[] = [];
    const verifiedItems: string[] = [];
    let serviceError = false;

    // Check for missing weight if needed for calculation (general warning)
    if (patient && !patient.demographics?.weight) {
         warnings.push("⚠️ **MISSING DATA**: Patient weight not recorded. Cannot validate weight-based dosage safety.");
    }
    
    // Check pediatric context
    const isPediatric = (patient?.demographics?.age && patient.demographics.age < 18) || (patient?.demographics?.weight && patient.demographics.weight < 40);

    // Process all meds in parallel
    const promises = medications.map(async (med) => {
        if (signal?.aborted) return;

        const lowerName = sanitizeDrugName(med.drugName).toLowerCase();
        
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
        const limit = CRITICAL_LIMITS[lowerName];
        if (limit) {
             let amountMg = med.amount;
             const unitLower = med.unit.toLowerCase();
             if (unitLower === 'g' || unitLower === 'gram' || unitLower === 'grams') {
                 amountMg = med.amount * 1000;
             } else if (unitLower === 'mcg' || unitLower === 'microgram' || unitLower === 'micrograms') {
                 amountMg = med.amount / 1000;
             }

             // Pediatric/Low Weight Context Check
             if (isPediatric) {
                 if (patient?.demographics?.weight && limit.maxDailyPediatricMgPerKg) {
                     const calculatedMax = patient.demographics.weight * limit.maxDailyPediatricMgPerKg;
                     if (amountMg > calculatedMax) {
                         warnings.push(`⚠️ **PEDIATRIC DOSAGE EXCEEDED**: ${med.drugName} ${med.amount}${med.unit} exceeds calculated weight-based limit of ${calculatedMax.toFixed(1)}mg/day (for ${patient.demographics.weight}kg).`);
                     } else {
                         verifiedItems.push(`✅ Verified (${med.drugName}): Dose ${amountMg}mg is within pediatric limit of ${calculatedMax.toFixed(1)}mg/day.`);
                     }
                 } else if (patient?.demographics?.weight) {
                     warnings.push(`⚠️ **PEDIATRIC/WEIGHT CONTEXT**: ${med.drugName} requires weight-based calculation (${patient.demographics.weight}kg). Verified against Adult max (${limit.maxDailyAdultMg}mg) only.`);
                     if (amountMg > limit.maxDailyAdultMg) {
                         warnings.push(`⚠️ **DOSAGE LIMIT EXCEEDED**: ${med.drugName} ${med.amount}${med.unit} exceeds adult critical limit of ${limit.maxDailyAdultMg}mg/day.`);
                     }
                 } else {
                     warnings.push(`⚠️ **PEDIATRIC CONTEXT**: ${med.drugName} dosing checked against Adult max (${limit.maxDailyAdultMg}mg). This may be toxic for pediatric patients.`);
                     if (amountMg > limit.maxDailyAdultMg) {
                         warnings.push(`⚠️ **DOSAGE LIMIT EXCEEDED**: ${med.drugName} ${med.amount}${med.unit} exceeds adult critical limit of ${limit.maxDailyAdultMg}mg/day.`);
                     }
                 }
             } else {
                 // Adult logic
                 if (amountMg > limit.maxDailyAdultMg) {
                    warnings.push(
                        `⚠️ **DOSAGE LIMIT EXCEEDED**: ${med.drugName} ${med.amount}${med.unit} exceeds critical limit of ${limit.maxDailyAdultMg}mg/day.`
                    );
                 } else {
                    verifiedItems.push(`✅ Verified (${med.drugName}): Dose ${amountMg}mg is within adult limit of ${limit.maxDailyAdultMg}mg/day.`);
                 }
             }
        }
    });

    try {
        await Promise.all(promises);
    } catch (error: any) {
        if (error.name === 'AbortError') {
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
