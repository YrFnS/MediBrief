
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

export const normalizeValue = (val: number, unit: string, testName: string): { value: number, unit: string } => {
    const u = unit.toLowerCase().trim();
    const t = testName.toLowerCase();
    
    // GLUCOSE: Convert mmol/L to mg/dL (Standard: 1 mmol/L = 18.0182 mg/dL)
    if (t.includes('glucose')) {
        if (u === 'mmol/l' || u === 'mmol') {
            return { value: parseFloat((val * 18.0182).toFixed(1)), unit: NORMALIZED_UNITS.GLUCOSE };
        }
        if (u === 'mg/dl' || u === 'mg') {
            return { value: val, unit: NORMALIZED_UNITS.GLUCOSE };
        }
    }
    
    // CREATININE: Convert umol/L to mg/dL (Standard: 88.4 umol/L = 1 mg/dL)
    if (t.includes('creatinine') || t.includes('scr')) {
        if (u === 'umol/l' || u === 'µmol/l' || u === 'micromol/l') {
            return { value: parseFloat((val / 88.4).toFixed(2)), unit: NORMALIZED_UNITS.CREATININE };
        }
        if (u === 'mg/dl') {
            return { value: val, unit: NORMALIZED_UNITS.CREATININE };
        }
    }

    // TEMPERATURE: Fahrenheit to Celsius
    if (t.includes('temp')) {
        if (u === 'f' || u.includes('fahr')) {
            return { value: parseFloat(((val - 32) * 5 / 9).toFixed(1)), unit: NORMALIZED_UNITS.TEMPERATURE };
        }
        if (u === 'c' || u.includes('cels')) {
            return { value: val, unit: NORMALIZED_UNITS.TEMPERATURE };
        }
    }
    
    // LACTATE: mg/dL to mmol/L (Standard: 1 mmol/L = 9.008 mg/dL)
    if (t.includes('lactate')) {
        if (u === 'mg/dl') {
            return { value: parseFloat((val / 9.008).toFixed(1)), unit: NORMALIZED_UNITS.LACTATE };
        }
    }

    // Default: Return as is
    return { value: val, unit: unit };
};
