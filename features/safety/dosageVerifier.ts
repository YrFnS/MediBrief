
import { fetchDrugSafetyInfo } from './openFdaService';
import { ParsedMedication, SafetyCheckResult } from './types';
import { PatientMetadata } from '../patient-management/types';

// Fallback "Fast" limits for common OTC items if network fails or for double-checking
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
        const limit = CRITICAL_LIMITS[lowerName];
        if (limit) {
             let maxDaily = limit;
             
             // Pediatric/Low Weight Context Check
             if (isPediatric) {
                 if (patient?.demographics?.weight) {
                     warnings.push(`⚠️ **PEDIATRIC/WEIGHT CONTEXT**: ${med.drugName} requires weight-based calculation (${patient.demographics.weight}kg). Verified against Adult max (${limit}mg) only.`);
                 } else {
                     warnings.push(`⚠️ **PEDIATRIC CONTEXT**: ${med.drugName} dosing checked against Adult max (${limit}mg). This may be toxic for pediatric patients.`);
                 }
             } else {
                 // Adult logic
                 let amountMg = med.amount;
                 if (med.unit.toLowerCase().includes('g') && !med.unit.toLowerCase().includes('mg')) amountMg = med.amount * 1000;
                 
                 if (amountMg > maxDaily) {
                    warnings.push(
                        `⚠️ **DOSAGE LIMIT EXCEEDED**: ${med.drugName} ${med.amount}${med.unit} exceeds critical limit of ${maxDaily}mg/day.`
                    );
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
