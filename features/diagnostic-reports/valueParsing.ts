import {
    createUnknownClinicalDate,
    type ClinicalCodeableConcept,
    type ClinicalDate,
    type ClinicalQuantityValue,
    type ObservationRecord,
} from '../clinical-record';
import type {
    DiagnosticParsingWarning,
    ParsedClinicalDate,
    ParsedObservationValue,
    ParsedReferenceRange,
} from './types';

const UCUM_SYSTEM = 'http://unitsofmeasure.org';
const INTERPRETATION_SYSTEM =
    'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation';
const QUALITATIVE_SYSTEM = 'urn:medibrief:qualitative-result';

const trim = (value?: string | null): string => (value || '').trim();
const lower = (value?: string | null): string => trim(value).toLowerCase();

const normalizeComparatorText = (value: string): string => value
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/﹤/g, '<')
    .replace(/﹥/g, '>')
    .trim();

const SAFE_UCUM_ALIASES: Record<string, string> = {
    '%': '%',
    'g/dl': 'g/dL',
    'mg/dl': 'mg/dL',
    'ng/ml': 'ng/mL',
    'pg/ml': 'pg/mL',
    'mmol/l': 'mmol/L',
    'mol/l': 'mol/L',
    'umol/l': 'umol/L',
    'µmol/l': 'umol/L',
    'μmol/l': 'umol/L',
    'mm/h': 'mm/h',
    'mm/hr': 'mm/h',
    'ml/min': 'mL/min',
    'ml/min/1.73m2': 'mL/min/{1.73_m2}',
    '10^9/l': '10*9/L',
    '10⁹/l': '10*9/L',
    '10^12/l': '10*12/L',
    '10¹²/l': '10*12/L',
};

const normalizedUnitKey = (unit: string): string => unit
    .trim()
    .replace(/\s+/g, '')
    .replace(/μ/g, 'µ')
    .toLowerCase();

const unitEvidence = (
    rawUnit?: string | null,
): {
    unit?: string;
    system?: string;
    code?: string;
    warning?: DiagnosticParsingWarning;
} => {
    const original = trim(rawUnit);
    if (!original) return {};
    const code = SAFE_UCUM_ALIASES[normalizedUnitKey(original)];
    if (code) {
        return {
            unit: original,
            system: UCUM_SYSTEM,
            code,
        };
    }
    return {
        unit: original,
        warning: {
            code: 'unit-not-normalized',
            field: 'unitText',
            message:
                `The unit "${original}" was preserved exactly but was not assigned a UCUM code.`,
        },
    };
};

const numericToken = (
    raw: string,
): {
    value?: number;
    warning?: DiagnosticParsingWarning;
} => {
    const token = raw.trim();
    if (/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(token)) {
        return { value: Number(token.replace(/,/g, '')) };
    }
    if (/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(token)) {
        return { value: Number(token) };
    }
    if (/^[+-]?\d+,\d+$/.test(token)) {
        return {
            warning: {
                code: 'decimal-comma-unparsed',
                field: 'valueText',
                message:
                    `The value "${token}" may use a decimal comma and was preserved as text rather than guessed.`,
            },
        };
    }
    return {};
};

const QUALITATIVE_CODES: Record<string, string> = {
    positive: 'positive',
    negative: 'negative',
    reactive: 'reactive',
    'non-reactive': 'non-reactive',
    nonreactive: 'non-reactive',
    detected: 'detected',
    'not detected': 'not-detected',
    nondetected: 'not-detected',
    trace: 'trace',
    equivocal: 'equivocal',
    indeterminate: 'indeterminate',
    present: 'present',
    absent: 'absent',
};

const qualitativeConcept = (
    raw: string,
): ClinicalCodeableConcept | undefined => {
    const normalized = lower(raw).replace(/\s+/g, ' ');
    const code = QUALITATIVE_CODES[normalized];
    return code
        ? {
            text: raw,
            coding: [{
                system: QUALITATIVE_SYSTEM,
                code,
                display: raw,
            }],
        }
        : undefined;
};

export const parseDiagnosticObservationValue = ({
    valueText,
    unitText,
    absentReasonText,
}: {
    valueText?: string | null;
    unitText?: string | null;
    absentReasonText?: string | null;
}): ParsedObservationValue => {
    const rawValue = trim(valueText);
    const absentReason = trim(absentReasonText);
    const warnings: DiagnosticParsingWarning[] = [];

    if (!rawValue) {
        if (absentReason) {
            return {
                kind: 'absent',
                absentReason,
                warnings,
            };
        }
        warnings.push({
            code: 'missing-value',
            field: 'valueText',
            message: 'No result value or absent-result reason was supplied.',
        });
        return { kind: 'absent', warnings };
    }

    const normalized = normalizeComparatorText(rawValue);
    const quantityMatch = normalized.match(
        /^(<=|>=|<|>)?\s*([+-]?(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?|\.\d+))$/,
    );
    if (quantityMatch) {
        const parsed = numericToken(quantityMatch[2]);
        if (parsed.warning) warnings.push(parsed.warning);
        if (parsed.value !== undefined && Number.isFinite(parsed.value)) {
            const unit = unitEvidence(unitText);
            if (unit.warning) warnings.push(unit.warning);
            const original: ClinicalQuantityValue = {
                value: parsed.value,
                ...(unit.unit ? { unit: unit.unit } : {}),
                ...(unit.system ? { system: unit.system } : {}),
                ...(unit.code ? { code: unit.code } : {}),
                ...(quantityMatch[1]
                    ? {
                        comparator: quantityMatch[1] as
                            | '<'
                            | '<='
                            | '>='
                            | '>',
                    }
                    : {}),
            };
            return {
                kind: 'quantity',
                originalText: rawValue,
                value: {
                    type: 'quantity',
                    quantity: { original },
                },
                warnings,
            };
        }
    }

    const qualitative = qualitativeConcept(rawValue);
    if (qualitative) {
        return {
            kind: 'qualitative',
            originalText: rawValue,
            value: {
                type: 'codeable-concept',
                concept: qualitative,
            },
            warnings,
        };
    }

    return {
        kind: 'text',
        originalText: rawValue,
        value: { type: 'string', text: rawValue },
        warnings,
    };
};

const quantityForRange = (
    value: number,
    rawUnit?: string | null,
    comparator?: ClinicalQuantityValue['comparator'],
): {
    quantity: ClinicalQuantityValue;
    warning?: DiagnosticParsingWarning;
} => {
    const unit = unitEvidence(rawUnit);
    return {
        quantity: {
            value,
            ...(unit.unit ? { unit: unit.unit } : {}),
            ...(unit.system ? { system: unit.system } : {}),
            ...(unit.code ? { code: unit.code } : {}),
            ...(comparator ? { comparator } : {}),
        },
        ...(unit.warning ? { warning: unit.warning } : {}),
    };
};

export const parseDiagnosticReferenceRange = (
    referenceRangeText?: string | null,
    unitText?: string | null,
): ParsedReferenceRange => {
    const raw = trim(referenceRangeText);
    if (!raw) return { ranges: [], warnings: [] };

    const warnings: DiagnosticParsingWarning[] = [];
    const normalized = normalizeComparatorText(raw);
    const numberPattern = '[+-]?(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?|\\.\\d+)';
    const bounded = normalized.match(
        new RegExp(`^(${numberPattern})\\s*(?:-|–|—|to)\\s*(${numberPattern})$`, 'i'),
    );
    if (bounded) {
        const lowValue = numericToken(bounded[1]);
        const highValue = numericToken(bounded[2]);
        if (lowValue.value !== undefined && highValue.value !== undefined) {
            const low = quantityForRange(lowValue.value, unitText);
            const high = quantityForRange(highValue.value, unitText);
            if (low.warning) warnings.push(low.warning);
            return {
                ranges: [{
                    low: low.quantity,
                    high: high.quantity,
                    text: raw,
                }],
                warnings,
            };
        }
    }

    const oneSided = normalized.match(
        new RegExp(`^(<=|>=|<|>)\\s*(${numberPattern})$`),
    );
    if (oneSided) {
        const parsed = numericToken(oneSided[2]);
        if (parsed.value !== undefined) {
            const comparator = oneSided[1] as
                | '<'
                | '<='
                | '>='
                | '>';
            const boundary = quantityForRange(
                parsed.value,
                unitText,
                comparator,
            );
            if (boundary.warning) warnings.push(boundary.warning);
            return {
                ranges: [{
                    ...(comparator.startsWith('<')
                        ? { high: boundary.quantity }
                        : { low: boundary.quantity }),
                    text: raw,
                }],
                warnings,
            };
        }
    }

    if (/\d/.test(raw)) {
        warnings.push({
            code: 'reference-range-unparsed',
            field: 'referenceRangeText',
            message:
                `The reference range "${raw}" was preserved as source text because its numeric structure was not interpreted safely.`,
        });
    }
    return {
        ranges: [{ text: raw }],
        warnings,
    };
};

const INTERPRETATION_CODES: Record<string, string> = {
    n: 'N',
    normal: 'N',
    h: 'H',
    high: 'H',
    l: 'L',
    low: 'L',
    hh: 'HH',
    'critical high': 'HH',
    ll: 'LL',
    'critical low': 'LL',
    a: 'A',
    abnormal: 'A',
    critical: 'AA',
    positive: 'POS',
    negative: 'NEG',
    resistant: 'R',
    susceptible: 'S',
    intermediate: 'I',
};

export const diagnosticInterpretationConcept = (
    interpretationText?: string | null,
): ClinicalCodeableConcept | undefined => {
    const raw = trim(interpretationText);
    if (!raw) return undefined;
    const code = INTERPRETATION_CODES[lower(raw).replace(/\s+/g, ' ')];
    return {
        text: raw,
        ...(code
            ? {
                coding: [{
                    system: INTERPRETATION_SYSTEM,
                    code,
                    display: raw,
                }],
            }
            : {}),
    };
};

const UNKNOWN_DATE_TERMS = new Set([
    'unknown',
    'not visible',
    'not recorded',
    'n/a',
    'na',
]);

export const parseDiagnosticClinicalDate = (
    rawDate?: string | null,
    field = 'clinicalDate',
): ParsedClinicalDate => {
    const raw = trim(rawDate);
    if (!raw || UNKNOWN_DATE_TERMS.has(lower(raw))) {
        return {
            date: createUnknownClinicalDate(raw || undefined),
            warnings: [],
        };
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return {
            date: { value: raw, precision: 'day', sourceText: raw },
            warnings: [],
        };
    }
    if (/^\d{4}-\d{2}$/.test(raw)) {
        return {
            date: { value: raw, precision: 'month', sourceText: raw },
            warnings: [],
        };
    }
    if (/^\d{4}$/.test(raw)) {
        return {
            date: { value: raw, precision: 'year', sourceText: raw },
            warnings: [],
        };
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(raw) && !Number.isNaN(Date.parse(raw))) {
        return {
            date: {
                value: raw.slice(0, 10),
                precision: 'day',
                sourceText: raw,
            },
            warnings: [],
        };
    }
    return {
        date: createUnknownClinicalDate(raw),
        warnings: [{
            code: 'date-unparsed',
            field,
            message:
                `The date "${raw}" was preserved as source text and left clinically unknown because its format was not interpreted safely.`,
        }],
    };
};

export const parseDiagnosticIssuedAt = (
    rawDateTime?: string | null,
    field = 'issuedAt',
): {
    value?: string;
    warnings: DiagnosticParsingWarning[];
} => {
    const raw = trim(rawDateTime);
    if (!raw || UNKNOWN_DATE_TERMS.has(lower(raw))) {
        return { warnings: [] };
    }
    if (raw.includes('T') && !Number.isNaN(Date.parse(raw))) {
        return { value: raw, warnings: [] };
    }
    return {
        warnings: [{
            code: 'datetime-unparsed',
            field,
            message:
                `The date-time "${raw}" was preserved in source notes but not promoted to issuedAt because it was not an unambiguous ISO date-time.`,
        }],
    };
};

export const observationStatusForReport = (
    reportStatus: ObservationRecord['status'] | 'partial',
): {
    status: ObservationRecord['status'];
    warning?: DiagnosticParsingWarning;
} => {
    if (reportStatus !== 'partial') return { status: reportStatus };
    return {
        status: 'preliminary',
        warning: {
            code: 'report-status-mapped',
            field: 'status',
            message:
                'A partial report was represented by preliminary atomic observations while the report retained partial status.',
        },
    };
};
