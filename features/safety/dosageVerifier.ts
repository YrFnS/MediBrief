
import { DRUG_LIMITS, DRUG_ALIASES } from './drugLimits';
import { ParsedMedication, SafetyCheckResult } from './types';

/**
 * Normalizes values to milligrams.
 * e.g., "4g" -> 4000, "500mg" -> 500
 */
const normalizeToMg = (value: number, unit: string): number => {
    const u = unit.toLowerCase().trim();
    if (u === 'g' || u === 'gm' || u === 'grams') return value * 1000;
    if (u === 'mcg' || u === 'µg') return value / 1000;
    if (u === 'kg') return value * 1000000; // Unlikely for drug dose, but completeness
    return value; // assume mg if unknown or mg
};

/**
 * DETERMINISTIC GUARDRAIL (LOGIC ENGINE)
 * Receives structured AI-parsed data and mathematically verifies against hard-coded limits.
 */
export const verifyMedicationSafety = (medications: ParsedMedication[]): SafetyCheckResult => {
    const warnings: string[] = [];
    const verifiedItems: string[] = [];

    medications.forEach(med => {
        const lowerName = med.drugName.toLowerCase();
        
        // Resolve alias (e.g., Tylenol -> Acetaminophen)
        const canonicalName = DRUG_ALIASES[lowerName] || lowerName;
        const limit = DRUG_LIMITS[canonicalName];

        if (limit) {
            const mgValue = normalizeToMg(med.amount, med.unit);

            // 0 amount means mention without dosage, skip math check but maybe log
            if (mgValue > 0) {
                 if (mgValue > limit.maxDailyMg) {
                    warnings.push(
                        `🛑 **SAFETY VIOLATION**: ${med.drugName} dosage (${med.amount}${med.unit}) exceeds daily safety limit of ${limit.maxDailyMg}mg.`
                    );
                    if (limit.blackBox) {
                        warnings.push(`⚠️ **BLACK BOX WARNING**: ${canonicalName} carries strict FDA warnings.`);
                    }
                } else {
                    verifiedItems.push(
                        `✅ Verified: ${med.drugName} ${med.amount}${med.unit} is within standard safety limits.`
                    );
                }
            }
        }
    });

    return {
        isSafe: warnings.length === 0,
        warnings,
        verifiedItems
    };
};
