import {
    parseClinicalRecordResource,
    type ClinicalQuantity,
    type ClinicalQuantityValue,
    type ObservationRecord,
} from '../clinical-record';
import type {
    DiagnosticParsingWarning,
    DiagnosticReportBundle,
} from './types';

const UCUM_SYSTEM = 'http://unitsofmeasure.org';

export type DiagnosticNormalizationStatus =
    | 'already-normalized'
    | 'normalized'
    | 'identity'
    | 'comparator-preserved'
    | 'missing-unit'
    | 'unsupported-unit';

export interface DiagnosticQuantityNormalization {
    quantity: ClinicalQuantity;
    status: DiagnosticNormalizationStatus;
    compatibilityKey?: string;
    warning?: string;
}

interface SafeUnitRule {
    dimension: string;
    canonicalUnit: string;
    canonicalCode: string;
    factor: number;
}

const unitKey = (value?: string): string => (value || '')
    .normalize('NFKC')
    .trim()
    .replace(/[μµ]/g, 'u')
    .replace(/\s+/g, '')
    .toLowerCase();

const rule = (
    dimension: string,
    canonicalUnit: string,
    canonicalCode: string,
    factor: number,
): SafeUnitRule => ({
    dimension,
    canonicalUnit,
    canonicalCode,
    factor,
});

/**
 * Only linear, analyte-independent conversions are accepted here. Molecular
 * weight conversions (for example mg/dL to mmol/L) are intentionally excluded.
 */
const SAFE_UNIT_RULES: Record<string, SafeUnitRule> = {
    // Mass concentration -> g/L.
    'g/l': rule('mass-concentration', 'g/L', 'g/L', 1),
    'g/dl': rule('mass-concentration', 'g/L', 'g/L', 10),
    'mg/l': rule('mass-concentration', 'g/L', 'g/L', 0.001),
    'mg/dl': rule('mass-concentration', 'g/L', 'g/L', 0.01),
    'ug/l': rule('mass-concentration', 'g/L', 'g/L', 0.000001),
    'ng/ml': rule('mass-concentration', 'g/L', 'g/L', 0.000001),
    'pg/ml': rule('mass-concentration', 'g/L', 'g/L', 0.000000001),

    // Amount concentration -> mmol/L.
    'mol/l': rule('amount-concentration', 'mmol/L', 'mmol/L', 1000),
    'mmol/l': rule('amount-concentration', 'mmol/L', 'mmol/L', 1),
    'umol/l': rule('amount-concentration', 'mmol/L', 'mmol/L', 0.001),
    'nmol/l': rule('amount-concentration', 'mmol/L', 'mmol/L', 0.000001),

    // Cell counts commonly represented in either litre or microlitre notation.
    '10*9/l': rule('count-concentration-9', '10*9/L', '10*9/L', 1),
    '10^9/l': rule('count-concentration-9', '10*9/L', '10*9/L', 1),
    '109/l': rule('count-concentration-9', '10*9/L', '10*9/L', 1),
    '10*3/ul': rule('count-concentration-9', '10*9/L', '10*9/L', 1),
    '10^3/ul': rule('count-concentration-9', '10*9/L', '10*9/L', 1),
    '103/ul': rule('count-concentration-9', '10*9/L', '10*9/L', 1),
    'k/ul': rule('count-concentration-9', '10*9/L', '10*9/L', 1),

    '10*12/l': rule('count-concentration-12', '10*12/L', '10*12/L', 1),
    '10^12/l': rule('count-concentration-12', '10*12/L', '10*12/L', 1),
    '1012/l': rule('count-concentration-12', '10*12/L', '10*12/L', 1),
    '10*6/ul': rule('count-concentration-12', '10*12/L', '10*12/L', 1),
    '10^6/ul': rule('count-concentration-12', '10*12/L', '10*12/L', 1),
    '106/ul': rule('count-concentration-12', '10*12/L', '10*12/L', 1),
    'm/ul': rule('count-concentration-12', '10*12/L', '10*12/L', 1),

    '%': rule('fraction-percent', '%', '%', 1),
};

const rounded = (value: number): number => {
    if (!Number.isFinite(value)) return value;
    return Number(value.toPrecision(12));
};

const recognizedRule = (
    value: ClinicalQuantityValue,
): SafeUnitRule | undefined => {
    if (value.system && value.system !== UCUM_SYSTEM) return undefined;
    return SAFE_UNIT_RULES[unitKey(value.code)]
        || SAFE_UNIT_RULES[unitKey(value.unit)];
};

const canonicalCompatibilityKey = (
    value: ClinicalQuantityValue,
): string | undefined => {
    const unit = value.code || value.unit;
    if (!unit) return undefined;
    return `${value.system || 'unspecified'}|${unitKey(unit)}`;
};

export const normalizeDiagnosticQuantity = (
    quantity: ClinicalQuantity,
): DiagnosticQuantityNormalization => {
    if (quantity.normalized) {
        return {
            quantity,
            status: 'already-normalized',
            compatibilityKey:
                canonicalCompatibilityKey(quantity.normalized),
            ...(quantity.normalizationWarning
                ? { warning: quantity.normalizationWarning }
                : {}),
        };
    }

    const original = quantity.original;
    if (original.comparator) {
        const warning =
            'Comparator result preserved as reported. It is not converted or used as an exact numeric trend point.';
        return {
            quantity: {
                ...quantity,
                normalizationWarning:
                    quantity.normalizationWarning || warning,
            },
            status: 'comparator-preserved',
            warning,
        };
    }

    const rawUnit = original.code || original.unit;
    if (!rawUnit) {
        const warning =
            'The numeric result has no recorded unit, so no normalized value or cross-report compatibility claim was created.';
        return {
            quantity: {
                ...quantity,
                normalizationWarning:
                    quantity.normalizationWarning || warning,
            },
            status: 'missing-unit',
            warning,
        };
    }

    const unitRule = recognizedRule(original);
    if (!unitRule) {
        const warning =
            `The source unit "${original.unit || original.code}" is not in the conservative normalization table. The original value remains authoritative.`;
        return {
            quantity: {
                ...quantity,
                normalizationWarning:
                    quantity.normalizationWarning || warning,
            },
            status: 'unsupported-unit',
            compatibilityKey:
                `source|${original.system || 'unspecified'}|${unitKey(rawUnit)}`,
            warning,
        };
    }

    const normalized: ClinicalQuantityValue = {
        value: rounded(original.value * unitRule.factor),
        unit: unitRule.canonicalUnit,
        system: UCUM_SYSTEM,
        code: unitRule.canonicalCode,
    };
    const compatibilityKey =
        `${unitRule.dimension}|${unitRule.canonicalCode}`;
    return {
        quantity: {
            ...quantity,
            normalized,
        },
        status: unitRule.factor === 1 ? 'identity' : 'normalized',
        compatibilityKey,
    };
};

const normalizeObservation = (
    observation: ObservationRecord,
): {
    observation: ObservationRecord;
    warning?: DiagnosticParsingWarning;
} => {
    if (observation.value?.type !== 'quantity') {
        return { observation };
    }

    const result = normalizeDiagnosticQuantity(observation.value.quantity);
    const updated = parseClinicalRecordResource({
        ...observation,
        value: {
            type: 'quantity',
            quantity: result.quantity,
        },
    }) as ObservationRecord;

    return {
        observation: updated,
        ...(result.warning
            ? {
                warning: {
                    code: 'unit-not-normalized' as const,
                    message: result.warning,
                    field: 'value.quantity',
                    resultLocalId: observation.id,
                },
            }
            : {}),
    };
};

/**
 * Add safe normalized quantities to a diagnostic bundle without replacing any
 * original result value, unit, comparator, source text, or provenance.
 */
export const normalizeDiagnosticReportBundle = (
    bundle: DiagnosticReportBundle,
): DiagnosticReportBundle => {
    const normalized = bundle.observations.map(normalizeObservation);
    const observations = normalized.map(item => item.observation);
    const byId = new Map(observations.map(observation => [
        observation.id,
        observation,
    ]));

    return {
        ...bundle,
        observations,
        resources: bundle.resources.map(resource =>
            resource.resourceType === 'Observation'
                ? byId.get(resource.id) || resource
                : resource),
        warnings: [
            ...bundle.warnings,
            ...normalized.flatMap(item => item.warning ? [item.warning] : []),
        ],
    };
};

export const diagnosticSourceUnitCompatibilityKey = (
    value: ClinicalQuantityValue,
): string | undefined => {
    const rawUnit = value.code || value.unit;
    return rawUnit
        ? `source|${value.system || 'unspecified'}|${unitKey(rawUnit)}`
        : undefined;
};
