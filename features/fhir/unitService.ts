import { normalizeQuantityValue } from '../terminology/normalization';

/**
 * Backward-compatible preferred display units for existing consumers.
 * New code should use the governed terminology review workflow and preserve
 * UCUM system/code metadata on ClinicalQuantity.normalized.
 */
export const NORMALIZED_UNITS = {
    GLUCOSE: 'mg/dL',
    CREATININE: 'mg/dL',
    LACTATE: 'mmol/L',
    POTASSIUM: 'mmol/L',
    TEMPERATURE: '°C',
    HEART_RATE: 'beats/min',
    SPO2: '%',
    BLOOD_PRESSURE: 'mmHg',
} as const;

/**
 * Deprecated compatibility export.
 *
 * MediBrief no longer labels isolated measurements “implausible” from a small
 * hard-coded adult range table. Such conclusions require age, physiology,
 * specimen, method, device, clinical context, and a separately validated rule.
 */
export const PLAUSIBILITY_RANGES: Record<
    string,
    { min: number; max: number }
> = {};

export interface NormalizedResult {
    value: number;
    unit: string;
    system?: string;
    code?: string;
    warning?: string;
    conversionApplied?: boolean;
}

/**
 * Compatibility wrapper for earlier callers.
 *
 * - Unit aliases are mapped to canonical, case-sensitive UCUM codes.
 * - A value conversion is performed only when the caller supplies a reviewed
 *   LOINC code and the code/unit pair matches a governed conversion profile.
 * - The historical free-text test name is retained only for API compatibility;
 *   it is never used to guess an analyte or specimen.
 * - Unknown units are preserved and returned with a warning.
 * - No physiological safety, diagnosis, or plausibility conclusion is made.
 */
export const normalizeValue = (
    value: number,
    unit: string,
    _testName: string,
    loinc?: string,
): NormalizedResult => {
    const result = normalizeQuantityValue({
        value,
        unit,
        loincCode: loinc || null,
    });

    if (!result.normalized) {
        return {
            value,
            unit,
            warning: result.warning,
            conversionApplied: false,
        };
    }

    return {
        value: result.normalized.value,
        unit: result.normalized.unit || unit,
        system: result.normalized.system,
        code: result.normalized.code,
        conversionApplied: result.conversionApplied,
        ...(result.warning ? { warning: result.warning } : {}),
    };
};
