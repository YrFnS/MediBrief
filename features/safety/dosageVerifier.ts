
import { DRUG_LIMITS, DRUG_ALIASES } from './drugLimits';

export interface SafetyCheckResult {
    isSafe: boolean;
    warnings: string[];
    verifiedItems: string[];
}

/**
 * Normalizes values to milligrams.
 * e.g., "4g" -> 4000, "500mg" -> 500
 */
const normalizeToMg = (value: number, unit: string): number => {
    const u = unit.toLowerCase().trim();
    if (u === 'g' || u === 'gm' || u === 'grams') return value * 1000;
    if (u === 'mcg' || u === 'µg') return value / 1000;
    return value; // assume mg
};

/**
 * DETERMINISTIC GUARDRAIL
 * Scans text for Drug + Dosage patterns and mathematically verifies against hard limits.
 */
export const verifyDosages = (text: string): SafetyCheckResult => {
    const warnings: string[] = [];
    const verifiedItems: string[] = [];
    const lowerText = text.toLowerCase();

    // 1. Scan for known drugs
    const allDrugs = [...Object.keys(DRUG_LIMITS), ...Object.keys(DRUG_ALIASES)];
    
    allDrugs.forEach(drugKey => {
        if (lowerText.includes(drugKey)) {
            // Resolve alias
            const canonicalName = DRUG_ALIASES[drugKey] || drugKey;
            const limit = DRUG_LIMITS[canonicalName];

            if (!limit) return;

            // 2. Regex to extract dosage associated with this drug
            // Looks for: drugName ... 500 mg
            // Limitation: Simple proximity check. 
            // Matches "Acetaminophen" followed by up to 20 chars, then a number, then unit
            const regex = new RegExp(`${drugKey}[^0-9]{0,30}(\\d+(\\.\\d+)?)\\s*(mg|g|mcg|gm|grams)`, 'gi');
            
            let match;
            while ((match = regex.exec(text)) !== null) {
                const val = parseFloat(match[1]);
                const unit = match[3];
                const mgValue = normalizeToMg(val, unit);

                // 3. Mathematical Verification (Deterministic)
                if (mgValue > limit.maxDailyMg) {
                    warnings.push(
                        `🛑 **SAFETY VIOLATION**: Detected dosage of ${canonicalName} (${match[1]}${unit}) exceeds standard safety limit (${limit.maxDailyMg}mg/day).`
                    );
                } else {
                    verifiedItems.push(
                        `✅ Verified: ${canonicalName} dosage (${match[1]}${unit}) is within standard limits.`
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
