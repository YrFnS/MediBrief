
/**
 * Deterministic Unit Normalization Service.
 * Ensures that all clinical data fed into the Rules Engine (CDSS) uses standard units.
 * This prevents critical errors where "4.5 mmol/L" Lactate is misread as "4.5 mg/dL".
 */

export const NORMALIZED_UNITS = {
    GLUCOSE: 'mg/dL',
    CREATININE: 'mg/dL',
    LACTATE: 'mmol/L',
    POTASSIUM: 'mmol/L',
    TEMPERATURE: 'degC'
};

// Physiological Plausibility Limits (Hard Stops)
// Values outside these ranges are likely OCR errors, unit mismatches, or incompatibile with life.
// Based on typical adult ranges + pathology buffer.
export const PLAUSIBILITY_RANGES: Record<string, { min: number, max: number }> = {
    [NORMALIZED_UNITS.GLUCOSE]: { min: 10, max: 2000 }, // <10 is fatal, >2000 is syrup
    [NORMALIZED_UNITS.CREATININE]: { min: 0.1, max: 30.0 }, // >30 is extremely rare even in failure
    [NORMALIZED_UNITS.LACTATE]: { min: 0.1, max: 40.0 }, // Record is ~30-40
    [NORMALIZED_UNITS.POTASSIUM]: { min: 1.0, max: 12.0 }, // >12 is usually hemolyzed or error
    [NORMALIZED_UNITS.TEMPERATURE]: { min: 20.0, max: 46.5 } // <20 severe hypo, >46.5 protein denaturation
};

export interface NormalizedResult {
    value: number;
    unit: string;
    warning?: string; // If present, value is suspect
}

export const normalizeValue = (val: number, unit: string, testName: string): NormalizedResult => {
    const u = unit.toLowerCase().trim();
    const t = testName.toLowerCase();
    
    let resultValue = val;
    let resultUnit = unit;

    // --- CONVERSION LOGIC ---

    // GLUCOSE: Convert mmol/L to mg/dL (Standard: 1 mmol/L = 18.0182 mg/dL)
    if (t.includes('glucose')) {
        if (u === 'mmol/l' || u === 'mmol') {
            resultValue = parseFloat((val * 18.0182).toFixed(1));
            resultUnit = NORMALIZED_UNITS.GLUCOSE;
        } else if (u === 'mg/dl' || u === 'mg') {
            resultUnit = NORMALIZED_UNITS.GLUCOSE;
        }
    }
    
    // CREATININE: Convert umol/L to mg/dL (Standard: 88.4 umol/L = 1 mg/dL)
    else if (t.includes('creatinine') || t.includes('scr')) {
        if (u === 'umol/l' || u === 'µmol/l' || u === 'micromol/l') {
            resultValue = parseFloat((val / 88.4).toFixed(2));
            resultUnit = NORMALIZED_UNITS.CREATININE;
        } else if (u === 'mg/dl') {
            resultUnit = NORMALIZED_UNITS.CREATININE;
        }
    }

    // TEMPERATURE: Fahrenheit to Celsius
    else if (t.includes('temp')) {
        if (u === 'f' || u.includes('fahr')) {
            resultValue = parseFloat(((val - 32) * 5 / 9).toFixed(1));
            resultUnit = NORMALIZED_UNITS.TEMPERATURE;
        } else if (u === 'c' || u.includes('cels')) {
            resultUnit = NORMALIZED_UNITS.TEMPERATURE;
        }
    }
    
    // LACTATE: mg/dL to mmol/L (Standard: 1 mmol/L = 9.008 mg/dL)
    else if (t.includes('lactate')) {
        if (u === 'mg/dl') {
            resultValue = parseFloat((val / 9.008).toFixed(1));
            resultUnit = NORMALIZED_UNITS.LACTATE;
        } else {
            resultUnit = NORMALIZED_UNITS.LACTATE;
        }
    }

    // POTASSIUM: Usually mmol/L or mEq/L (1:1)
    else if (t.includes('potassium') || t.includes('k+')) {
        resultUnit = NORMALIZED_UNITS.POTASSIUM;
    }

    // --- PLAUSIBILITY CHECK LAYER ---
    // Validate the *normalized* value against hard limits
    
    const range = PLAUSIBILITY_RANGES[resultUnit];
    let warning: string | undefined;

    if (range) {
        if (resultValue < range.min) {
            warning = `IMPLAUSIBLE_LOW (Val: ${resultValue} < Min: ${range.min})`;
        } else if (resultValue > range.max) {
            warning = `IMPLAUSIBLE_HIGH (Val: ${resultValue} > Max: ${range.max})`;
        }
    }

    return { value: resultValue, unit: resultUnit, warning };
};
