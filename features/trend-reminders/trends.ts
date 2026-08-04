import {
    buildDiagnosticResultsIntelligence,
    type DiagnosticTrendSeries,
} from '../diagnostic-reports';
import type { PatientClinicalRecord } from '../clinical-record/types';
import type {
    DeterministicTrendExplanation,
    DeterministicTrendPoint,
    DeterministicTrendViewModel,
    RecordedTrendDirection,
    TrendNormalizationBasis,
} from './types';

const normalizeText = (value?: string): string => (value || '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, ' ');

const formatNumber = (value: number): string => new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 6,
}).format(value);

const evidenceIdForObservation = (observationId: string): string =>
    `MB:Observation:${observationId.replace(/[^A-Za-z0-9._:-]/g, '_')}`;

const toPoint = (
    point: DiagnosticTrendSeries['points'][number],
): DeterministicTrendPoint => ({
    evidenceId: evidenceIdForObservation(point.observationId),
    observationId: point.observationId,
    date: point.date,
    dateLabel: point.dateLabel,
    value: point.value,
    unit: point.unit,
    originalValueLabel: point.originalValueLabel,
    ...(point.normalizedValueLabel
        ? { normalizedValueLabel: point.normalizedValueLabel }
        : {}),
    reportNames: [...point.reportNames],
    ...(point.source ? { source: point.source } : {}),
});

const normalizationBasisFor = (
    points: DeterministicTrendPoint[],
): TrendNormalizationBasis => {
    const normalizedCount = points.filter(point =>
        Boolean(point.normalizedValueLabel)).length;
    if (normalizedCount === 0) return 'original-values';
    if (normalizedCount === points.length) return 'normalized-values';
    return 'mixed-original-and-normalized';
};

const directionFor = (first: number, last: number): RecordedTrendDirection => {
    if (last > first) return 'higher';
    if (last < first) return 'lower';
    return 'unchanged';
};

const elapsedDaysBetween = (firstDate: string, lastDate: string): number => {
    const first = Date.parse(`${firstDate}T00:00:00.000Z`);
    const last = Date.parse(`${lastDate}T00:00:00.000Z`);
    if (Number.isNaN(first) || Number.isNaN(last)) return 0;
    return Math.max(0, Math.round((last - first) / 86_400_000));
};

const citations = (...points: DeterministicTrendPoint[]): string => [
    ...new Set(points.map(point => `[${point.evidenceId}]`)),
].join(' ');

const normalizationNotice = (
    basis: TrendNormalizationBasis,
): string => {
    if (basis === 'original-values') {
        return 'All plotted values use their original recorded quantities.';
    }
    if (basis === 'normalized-values') {
        return 'All plotted chart quantities use persisted normalized views; every original source value remains preserved beside its point.';
    }
    return 'The series contains both original plotted quantities and persisted normalized views. Original source values remain preserved for every point.';
};

export const buildDeterministicTrendExplanation = ({
    series,
    matchingExclusions,
    unitConflictMessages,
}: {
    series: DiagnosticTrendSeries;
    matchingExclusions: DeterministicTrendExplanation['matchingExclusions'];
    unitConflictMessages: string[];
}): DeterministicTrendExplanation => {
    if (series.points.length < 2) {
        throw new Error('A deterministic trend explanation requires at least two eligible points.');
    }

    const points = series.points.map(toPoint);
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const minimumPoint = points.reduce((minimum, current) =>
        current.value < minimum.value ? current : minimum, points[0]);
    const maximumPoint = points.reduce((maximum, current) =>
        current.value > maximum.value ? current : maximum, points[0]);
    const direction = directionFor(firstPoint.value, lastPoint.value);
    const absoluteChange = Math.abs(lastPoint.value - firstPoint.value);
    const elapsedDays = elapsedDaysBetween(firstPoint.date, lastPoint.date);
    const normalizationBasis = normalizationBasisFor(points);
    const changeStatement = direction === 'unchanged'
        ? `The first and last recorded values are equal at ${formatNumber(lastPoint.value)} ${series.unit}.`
        : `The last recorded value is ${direction} than the first by ${formatNumber(absoluteChange)} ${series.unit}.`;
    const groupingNotice = series.groupingBasis === 'loinc'
        ? `Series membership uses confirmed LOINC identity${series.loincCode ? ` ${series.loincCode}` : ''} and a compatible unit group.`
        : 'Series membership uses the exact recorded test name, specimen context, and compatible unit because no confirmed LOINC identity is available.';

    return {
        schemaVersion: 1,
        seriesKey: series.key,
        name: series.name,
        ...(series.loincCode ? { loincCode: series.loincCode } : {}),
        ...(series.specimenLabel
            ? { specimenLabel: series.specimenLabel }
            : {}),
        unit: series.unit,
        groupingBasis: series.groupingBasis,
        normalizationBasis,
        pointCount: points.length,
        firstPoint,
        lastPoint,
        minimumPoint,
        maximumPoint,
        absoluteChange,
        direction,
        elapsedDays,
        points,
        matchingExclusions,
        unitConflictMessages,
        qualityNotices: [
            groupingNotice,
            normalizationNotice(normalizationBasis),
            'Every plotted date has exact-day precision. Unknown, month-only, and year-only dates remain outside the series.',
            ...(series.qualityNotice ? [series.qualityNotice] : []),
            ...unitConflictMessages,
        ],
        deterministicStatements: [
            `${series.name} has ${points.length} comparable recorded points from ${firstPoint.dateLabel} through ${lastPoint.dateLabel}, spanning ${elapsedDays} day${elapsedDays === 1 ? '' : 's'}. ${citations(firstPoint, lastPoint)}`,
            `The first plotted value is ${formatNumber(firstPoint.value)} ${series.unit} on ${firstPoint.dateLabel}; the last plotted value is ${formatNumber(lastPoint.value)} ${series.unit} on ${lastPoint.dateLabel}. ${citations(firstPoint, lastPoint)}`,
            `${changeStatement} ${citations(firstPoint, lastPoint)}`,
            `The lowest plotted value is ${formatNumber(minimumPoint.value)} ${series.unit} on ${minimumPoint.dateLabel}; the highest is ${formatNumber(maximumPoint.value)} ${series.unit} on ${maximumPoint.dateLabel}. ${citations(minimumPoint, maximumPoint)}`,
        ],
        limitations: [
            'This is a deterministic description of recorded values, dates, and units—not a diagnosis or interpretation of clinical significance.',
            'It does not establish improvement, worsening, causality, prognosis, treatment effect, or a recommended action.',
            'Reference ranges, methods, specimens, and source flags can differ between reports and must be reviewed in their original context.',
            'Comparator, qualitative, narrative, absent, superseded, undated, partial-date, single-point, and incompatible-unit observations remain outside this plotted series.',
            'A local evidence citation identifies the record used; it does not prove semantic or clinical correctness.',
        ],
    };
};

export const buildDeterministicTrendViewModel = (
    record: PatientClinicalRecord,
): DeterministicTrendViewModel => {
    const intelligence = buildDiagnosticResultsIntelligence(record);
    const explanations = intelligence.trendSeries.map(series => {
        const normalizedName = normalizeText(series.name);
        const matchingExclusions = intelligence.trendExclusions
            .filter(exclusion => normalizeText(exclusion.name) === normalizedName)
            .map(exclusion => ({
                observationId: exclusion.observationId,
                reason: exclusion.reason,
                message: exclusion.message,
            }));
        const unitConflictMessages = intelligence.unitConflicts
            .filter(conflict => normalizeText(conflict.identityLabel)
                .includes(normalizedName))
            .map(conflict =>
                `${conflict.identityLabel}: recorded units ${conflict.units.join(', ')} remain in separate groups. ${conflict.message}`);
        return buildDeterministicTrendExplanation({
            series,
            matchingExclusions,
            unitConflictMessages,
        });
    }).sort((left, right) => left.name.localeCompare(right.name));

    return {
        explanations,
        seriesCount: explanations.length,
        pointCount: explanations.reduce(
            (total, explanation) => total + explanation.pointCount,
            0,
        ),
        exclusionCount: intelligence.trendExclusions.length,
        unitConflictCount: intelligence.unitConflicts.length,
        candidateCount: intelligence.candidateCount,
    };
};

export const renderDeterministicTrendExplanationMarkdown = (
    explanation: DeterministicTrendExplanation,
): string => {
    const lines = [
        `# Recorded trend: ${explanation.name}`,
        '',
        `- Unit: ${explanation.unit}`,
        `- Specimen: ${explanation.specimenLabel || 'Not recorded'}`,
        `- Grouping basis: ${explanation.groupingBasis === 'loinc'
            ? `Confirmed LOINC${explanation.loincCode ? ` ${explanation.loincCode}` : ''}`
            : 'Exact name, specimen, and compatible unit'}`,
        `- Normalization basis: ${explanation.normalizationBasis.replace(/-/g, ' ')}`,
        '',
        '## Deterministic description',
        '',
        ...explanation.deterministicStatements.map(statement => `- ${statement}`),
        '',
        '## Included points',
        '',
        ...explanation.points.flatMap(point => [
            `- ${point.dateLabel}: ${formatNumber(point.value)} ${point.unit} [${point.evidenceId}]`,
            `  - Original source value: ${point.originalValueLabel}`,
            ...(point.normalizedValueLabel
                ? [`  - Normalized view: ${point.normalizedValueLabel}`]
                : []),
            `  - Report context: ${point.reportNames.join(', ') || 'No linked report name'}`,
        ]),
        '',
        '## Excluded matching records',
        '',
        ...(explanation.matchingExclusions.length > 0
            ? explanation.matchingExclusions.map(item =>
                `- ${item.observationId}: ${item.reason} — ${item.message}`)
            : ['- No same-name exclusion was recorded for this series.']),
        '',
        '## Limitations',
        '',
        ...explanation.limitations.map(item => `- ${item}`),
    ];
    return lines.join('\n');
};

export const trendExplanationMatchesSearch = (
    explanation: DeterministicTrendExplanation,
    query: string,
): boolean => {
    const normalized = normalizeText(query);
    if (!normalized) return true;
    return [
        explanation.name,
        explanation.loincCode,
        explanation.specimenLabel,
        explanation.unit,
        explanation.groupingBasis,
        explanation.normalizationBasis,
        explanation.points.map(point => [
            point.dateLabel,
            point.originalValueLabel,
            point.normalizedValueLabel,
            point.reportNames.join(' '),
            point.source?.fileName,
        ].filter(Boolean).join(' ')).join(' '),
        explanation.matchingExclusions.map(item =>
            `${item.reason} ${item.message}`).join(' '),
    ].some(value => normalizeText(value).includes(normalized));
};
