import type {
    ClinicalDate,
    ClinicalPeriod,
    ClinicalQuantityValue,
    ObservationRecord,
    PatientClinicalRecord,
    SourceDocumentReference,
} from '../clinical-record';
import {
    diagnosticSourceUnitCompatibilityKey,
    normalizeDiagnosticQuantity,
} from './normalization';

export type DiagnosticTrendExclusionReason =
    | 'not-confirmed'
    | 'status-not-trendable'
    | 'missing-value'
    | 'non-numeric'
    | 'comparator-value'
    | 'unknown-clinical-date'
    | 'partial-clinical-date'
    | 'missing-unit'
    | 'single-point-series';

export interface DiagnosticTrendExclusion {
    observationId: string;
    observationName: string;
    reason: DiagnosticTrendExclusionReason;
    message: string;
}

export interface DiagnosticTrendPoint {
    observationId: string;
    diagnosticReportId?: string;
    date: string;
    timestamp: number;
    value: number;
    unit: string;
    originalValue: ClinicalQuantityValue;
    normalizedValue?: ClinicalQuantityValue;
    originalLabel: string;
    normalizedLabel?: string;
    interpretationLabels: string[];
    source?: SourceDocumentReference;
}

export interface DiagnosticTrendSeries {
    key: string;
    analyteKey: string;
    analyteName: string;
    loincCode?: string;
    compatibilityKey: string;
    unit: string;
    sourceUnitOnly: boolean;
    points: DiagnosticTrendPoint[];
    firstValue: number;
    latestValue: number;
    absoluteChange: number;
    warning?: string;
}

export interface DiagnosticTrendModel {
    series: DiagnosticTrendSeries[];
    exclusions: DiagnosticTrendExclusion[];
    eligibleObservationCount: number;
    chartedObservationCount: number;
    exclusionCounts: Record<DiagnosticTrendExclusionReason, number>;
}

const TRENDABLE_STATUSES = new Set([
    'final',
    'amended',
    'corrected',
]);

const normalizeTextKey = (value: string): string => value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const loincCoding = (observation: ObservationRecord) =>
    observation.code.coding?.find(coding =>
        coding.system?.replace(/\/$/, '') === 'http://loinc.org');

const analyteIdentity = (observation: ObservationRecord): {
    key: string;
    name: string;
    loincCode?: string;
} => {
    const loinc = loincCoding(observation);
    if (loinc) {
        return {
            key: `loinc:${loinc.code}`,
            name: observation.code.text,
            loincCode: loinc.code,
        };
    }
    return {
        key: `text:${normalizeTextKey(observation.code.text)}`,
        name: observation.code.text,
    };
};

const isClinicalDate = (
    value: ClinicalDate | ClinicalPeriod,
): value is ClinicalDate => 'precision' in value;

const exactDay = (observation: ObservationRecord): {
    date?: string;
    exclusion?: DiagnosticTrendExclusion;
} => {
    const effective = observation.effective;
    if (!effective || !isClinicalDate(effective)) {
        return {
            exclusion: {
                observationId: observation.id,
                observationName: observation.code.text,
                reason: 'unknown-clinical-date',
                message:
                    'Numeric trending requires an explicit clinical result date; recorded or upload time is not substituted.',
            },
        };
    }
    if (effective.precision === 'unknown' || !effective.value) {
        return {
            exclusion: {
                observationId: observation.id,
                observationName: observation.code.text,
                reason: 'unknown-clinical-date',
                message:
                    'The result date is explicitly unknown and is not placed on a trend timeline.',
            },
        };
    }
    if (effective.precision !== 'day') {
        return {
            exclusion: {
                observationId: observation.id,
                observationName: observation.code.text,
                reason: 'partial-clinical-date',
                message:
                    'Month- or year-precision results remain visible in the record but are excluded from exact-date charts.',
            },
        };
    }
    return { date: effective.value };
};

const quantityLabel = (quantity: ClinicalQuantityValue): string =>
    `${quantity.comparator || ''}${quantity.value}${quantity.unit ? ` ${quantity.unit}` : ''}`;

const rounded = (value: number): number => Number(value.toPrecision(12));

const interpretationLabels = (observation: ObservationRecord): string[] =>
    [...new Set((observation.interpretation || [])
        .map(value => value.text.trim())
        .filter(Boolean))];

interface EligiblePoint {
    seriesKey: string;
    analyteKey: string;
    analyteName: string;
    loincCode?: string;
    compatibilityKey: string;
    sourceUnitOnly: boolean;
    point: DiagnosticTrendPoint;
    warning?: string;
}

const exclusion = (
    observation: ObservationRecord,
    reason: DiagnosticTrendExclusionReason,
    message: string,
): DiagnosticTrendExclusion => ({
    observationId: observation.id,
    observationName: observation.code.text,
    reason,
    message,
});

const eligiblePoint = (
    observation: ObservationRecord,
): {
    value?: EligiblePoint;
    exclusion?: DiagnosticTrendExclusion;
} => {
    if (observation.verificationStatus !== 'confirmed') {
        return {
            exclusion: exclusion(
                observation,
                'not-confirmed',
                'Only confirmed observations are eligible for trend analysis.',
            ),
        };
    }
    if (!TRENDABLE_STATUSES.has(observation.status)) {
        return {
            exclusion: exclusion(
                observation,
                'status-not-trendable',
                `Status "${observation.status}" is not treated as a stable trend point.`,
            ),
        };
    }
    if (!observation.value) {
        return {
            exclusion: exclusion(
                observation,
                'missing-value',
                'The observation has no recorded result value.',
            ),
        };
    }
    if (observation.value.type !== 'quantity') {
        return {
            exclusion: exclusion(
                observation,
                'non-numeric',
                'Qualitative, absent, boolean, coded, and narrative results are kept outside numeric trend charts.',
            ),
        };
    }

    const original = observation.value.quantity.original;
    if (original.comparator) {
        return {
            exclusion: exclusion(
                observation,
                'comparator-value',
                'Comparator results remain visible but are not treated as exact numeric points.',
            ),
        };
    }

    const date = exactDay(observation);
    if (!date.date) return { exclusion: date.exclusion };

    const normalized = normalizeDiagnosticQuantity(observation.value.quantity);
    const safeNormalized = normalized.quantity.normalized;
    const compatibilityKey = normalized.compatibilityKey
        || diagnosticSourceUnitCompatibilityKey(original);
    if (!compatibilityKey || !(original.unit || original.code)) {
        return {
            exclusion: exclusion(
                observation,
                'missing-unit',
                'A numeric result without a recorded unit is not compared across reports.',
            ),
        };
    }

    const sourceUnitOnly = !safeNormalized;
    const selected = safeNormalized || original;
    const identity = analyteIdentity(observation);
    const timestamp = Date.parse(`${date.date}T00:00:00.000Z`);
    const unit = selected.unit || selected.code || 'unit not recorded';
    const point: DiagnosticTrendPoint = {
        observationId: observation.id,
        ...(observation.diagnosticReportId
            ? { diagnosticReportId: observation.diagnosticReportId }
            : {}),
        date: date.date,
        timestamp,
        value: selected.value,
        unit,
        originalValue: original,
        ...(safeNormalized ? { normalizedValue: safeNormalized } : {}),
        originalLabel: quantityLabel(original),
        ...(safeNormalized
            ? { normalizedLabel: quantityLabel(safeNormalized) }
            : {}),
        interpretationLabels: interpretationLabels(observation),
        ...(observation.provenance.source.document
            ? { source: observation.provenance.source.document }
            : {}),
    };

    return {
        value: {
            seriesKey: `${identity.key}|${compatibilityKey}`,
            analyteKey: identity.key,
            analyteName: identity.name,
            ...(identity.loincCode ? { loincCode: identity.loincCode } : {}),
            compatibilityKey,
            sourceUnitOnly,
            point,
            ...(sourceUnitOnly
                ? {
                    warning:
                        'This series uses identical source-unit text only. No unit conversion or dimensional equivalence was asserted.',
                }
                : {}),
        },
    };
};

const emptyCounts = (): Record<DiagnosticTrendExclusionReason, number> => ({
    'not-confirmed': 0,
    'status-not-trendable': 0,
    'missing-value': 0,
    'non-numeric': 0,
    'comparator-value': 0,
    'unknown-clinical-date': 0,
    'partial-clinical-date': 0,
    'missing-unit': 0,
    'single-point-series': 0,
});

export const buildDiagnosticTrendModel = (
    record: PatientClinicalRecord,
): DiagnosticTrendModel => {
    const groups = new Map<string, EligiblePoint[]>();
    const exclusions: DiagnosticTrendExclusion[] = [];

    record.resources.observations.forEach(observation => {
        const result = eligiblePoint(observation);
        if (result.exclusion) exclusions.push(result.exclusion);
        if (!result.value) return;
        const values = groups.get(result.value.seriesKey) || [];
        values.push(result.value);
        groups.set(result.value.seriesKey, values);
    });

    let eligibleObservationCount = 0;
    const series: DiagnosticTrendSeries[] = [];
    groups.forEach(values => {
        eligibleObservationCount += values.length;
        const ordered = [...values].sort((left, right) =>
            left.point.timestamp - right.point.timestamp);
        if (ordered.length < 2) {
            const point = ordered[0];
            exclusions.push({
                observationId: point.point.observationId,
                observationName: point.analyteName,
                reason: 'single-point-series',
                message:
                    'A trend series requires at least two comparable confirmed results.',
            });
            return;
        }
        const first = ordered[0];
        const last = ordered[ordered.length - 1];
        series.push({
            key: first.seriesKey,
            analyteKey: first.analyteKey,
            analyteName: first.analyteName,
            ...(first.loincCode ? { loincCode: first.loincCode } : {}),
            compatibilityKey: first.compatibilityKey,
            unit: first.point.unit,
            sourceUnitOnly: first.sourceUnitOnly,
            points: ordered.map(value => value.point),
            firstValue: first.point.value,
            latestValue: last.point.value,
            absoluteChange: rounded(last.point.value - first.point.value),
            ...(first.warning ? { warning: first.warning } : {}),
        });
    });

    series.sort((left, right) => {
        const latestLeft = left.points[left.points.length - 1]?.timestamp || 0;
        const latestRight = right.points[right.points.length - 1]?.timestamp || 0;
        if (latestLeft !== latestRight) return latestRight - latestLeft;
        return left.analyteName.localeCompare(right.analyteName);
    });

    const exclusionCounts = emptyCounts();
    exclusions.forEach(item => {
        exclusionCounts[item.reason] += 1;
    });

    return {
        series,
        exclusions,
        eligibleObservationCount,
        chartedObservationCount: series.reduce(
            (total, item) => total + item.points.length,
            0,
        ),
        exclusionCounts,
    };
};
