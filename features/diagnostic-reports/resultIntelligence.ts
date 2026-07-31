import type {
    ClinicalDate,
    ClinicalPeriod,
    ClinicalQuantityValue,
    DiagnosticReportRecord,
    ObservationRecord,
    PatientClinicalRecord,
    SourceDocumentReference,
} from '../clinical-record/types';

const TRENDABLE_STATUSES = new Set<ObservationRecord['status']>([
    'final',
    'amended',
    'corrected',
]);

const LOINC_SYSTEM = 'http://loinc.org';
const UCUM_SYSTEM = 'http://unitsofmeasure.org';

export type ResultPresentationKind =
    | 'numeric'
    | 'comparator'
    | 'qualitative'
    | 'narrative'
    | 'absent'
    | 'other';

export type TrendExclusionReason =
    | 'not-confirmed'
    | 'not-patient-applicable'
    | 'unsupported-status'
    | 'not-quantity'
    | 'comparator-value'
    | 'normalization-warning'
    | 'clinical-date-unknown'
    | 'clinical-date-not-exact'
    | 'identity-insufficient'
    | 'unit-missing'
    | 'single-point-only';

export interface ReviewCodingSuggestion {
    system: typeof LOINC_SYSTEM;
    code: string;
    display: string;
    basis: string;
    caveat: string;
}

export interface DiagnosticResultView {
    id: string;
    name: string;
    status: ObservationRecord['status'];
    statusLabel: string;
    kind: ResultPresentationKind;
    originalValueLabel: string;
    normalizedValueLabel?: string;
    interpretationLabels: string[];
    referenceRangeLabels: string[];
    flagged: boolean;
    clinicalDateLabel: string;
    clinicalDateValue?: string;
    clinicalDatePrecision: ClinicalDate['precision'];
    specimenLabel?: string;
    reportNames: string[];
    source?: SourceDocumentReference;
    loincCode?: string;
    codingSuggestion?: ReviewCodingSuggestion;
    normalizationWarning?: string;
    note?: string;
}

export interface DiagnosticPanelView {
    id: string;
    name: string;
    status: DiagnosticReportRecord['status'];
    statusLabel: string;
    clinicalDateLabel: string;
    memberResults: DiagnosticResultView[];
    missingMemberIds: string[];
    specimenLabels: string[];
    source?: SourceDocumentReference;
    loincCode?: string;
    codingSuggestion?: ReviewCodingSuggestion;
    conclusion?: string;
    membershipBasis: 'diagnostic-report-resultIds';
}

export interface TrendPoint {
    observationId: string;
    date: string;
    dateLabel: string;
    value: number;
    unit: string;
    originalValueLabel: string;
    normalizedValueLabel?: string;
    reportNames: string[];
    source?: SourceDocumentReference;
}

export interface DiagnosticTrendSeries {
    key: string;
    name: string;
    loincCode?: string;
    specimenLabel?: string;
    unit: string;
    groupingBasis: 'loinc' | 'exact-name-and-specimen';
    points: TrendPoint[];
    qualityNotice?: string;
}

export interface TrendExclusion {
    observationId: string;
    name: string;
    reason: TrendExclusionReason;
    message: string;
}

export interface UnitConflict {
    identityLabel: string;
    units: string[];
    observationIds: string[];
    message: string;
}

export interface DiagnosticResultsIntelligence {
    panels: DiagnosticPanelView[];
    unlinkedResults: DiagnosticResultView[];
    numericResults: DiagnosticResultView[];
    comparatorResults: DiagnosticResultView[];
    qualitativeResults: DiagnosticResultView[];
    narrativeResults: DiagnosticResultView[];
    absentResults: DiagnosticResultView[];
    otherResults: DiagnosticResultView[];
    trendSeries: DiagnosticTrendSeries[];
    trendExclusions: TrendExclusion[];
    unitConflicts: UnitConflict[];
    candidateCount: number;
    reportCount: number;
    observationCount: number;
    flaggedCount: number;
}

interface TrendCandidate {
    observation: ObservationRecord;
    name: string;
    loincCode?: string;
    specimenLabel?: string;
    reportNames: string[];
    source?: SourceDocumentReference;
    date: ClinicalDate;
    quantity: ClinicalQuantityValue;
    originalValueLabel: string;
    normalizedValueLabel?: string;
    identityKey: string;
    identityLabel: string;
    unitKey: string;
    unitLabel: string;
    groupingBasis: DiagnosticTrendSeries['groupingBasis'];
}

interface ExactLoincCatalogEntry {
    aliases: string[];
    code: string;
    display: string;
    units?: string[];
    specimenTokens?: string[];
}

const RESULT_LOINC_REVIEW_CATALOG: ExactLoincCatalogEntry[] = [
    {
        aliases: ['hemoglobin', 'hgb'],
        code: '718-7',
        display: 'Hemoglobin [Mass/volume] in Blood',
        units: ['g/dl', 'g/l'],
        specimenTokens: ['blood'],
    },
    {
        aliases: ['creatinine'],
        code: '2160-0',
        display: 'Creatinine [Mass/volume] in Serum or Plasma',
        units: ['mg/dl', 'umol/l', 'µmol/l'],
        specimenTokens: ['serum', 'plasma'],
    },
    {
        aliases: ['glucose'],
        code: '2345-7',
        display: 'Glucose [Mass/volume] in Serum or Plasma',
        units: ['mg/dl', 'mmol/l'],
        specimenTokens: ['serum', 'plasma'],
    },
    {
        aliases: [
            'wbc',
            'white blood cell count',
            'white blood cells',
            'leukocytes',
        ],
        code: '6690-2',
        display: 'Leukocytes [#/volume] in Blood by Automated count',
        units: ['10*3/ul', '10^3/ul', '10^9/l'],
        specimenTokens: ['blood'],
    },
];

const PANEL_LOINC_REVIEW_CATALOG: Array<{
    aliases: string[];
    code: string;
    display: string;
}> = [
    {
        aliases: ['cbc', 'cbc panel', 'complete blood count'],
        code: '58410-2',
        display: 'CBC panel - Blood by Automated count',
    },
    {
        aliases: ['bmp', 'basic metabolic panel'],
        code: '24320-4',
        display: 'Basic metabolic 1998 panel - Serum or Plasma',
    },
];

const normalizeText = (value?: string | null): string => (value || '')
    .trim()
    .toLowerCase()
    .replace(/[µμ]/g, 'u')
    .replace(/\s+/g, ' ');

const titleCaseStatus = (value: string): string => value
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const isClinicalDate = (
    value: ClinicalDate | ClinicalPeriod | undefined,
): value is ClinicalDate => Boolean(value && 'precision' in value);

const clinicalDateForObservation = (
    observation: ObservationRecord,
): ClinicalDate | undefined => {
    if (!observation.effective) return undefined;
    if (isClinicalDate(observation.effective)) return observation.effective;
    return observation.effective.start;
};

const clinicalDateForReport = (
    report: DiagnosticReportRecord,
): ClinicalDate | undefined => {
    if (report.effective && isClinicalDate(report.effective)) {
        return report.effective;
    }
    return report.effectivePeriod?.start
        || (!isClinicalDate(report.effective)
            ? report.effective?.start
            : undefined);
};

const formatClinicalDate = (date?: ClinicalDate): string => {
    if (!date || !date.value || date.precision === 'unknown') {
        return 'Clinical date unknown';
    }
    return date.value;
};

const patientApplicable = (observation: ObservationRecord): boolean => {
    const assertion = observation.assertion;
    if (!assertion) return true;
    if (assertion.polarity === 'negated') return false;
    if (assertion.temporality === 'hypothetical') return false;
    if (assertion.experiencer === 'family' || assertion.experiencer === 'other') {
        return false;
    }
    return true;
};

const confirmedObservation = (observation: ObservationRecord): boolean =>
    observation.verificationStatus === 'confirmed'
    && patientApplicable(observation)
    && observation.status !== 'entered-in-error';

const confirmedReport = (report: DiagnosticReportRecord): boolean =>
    report.verificationStatus === 'confirmed'
    && report.status !== 'entered-in-error';

const loincCodeForConcept = (
    concept: ObservationRecord['code'] | DiagnosticReportRecord['code'],
): string | undefined => concept.coding?.find(coding =>
    normalizeText(coding.system) === LOINC_SYSTEM)?.code;

const valueWithUnit = (value: ClinicalQuantityValue): string => [
    value.comparator,
    Number.isFinite(value.value) ? String(value.value) : 'Unknown',
    value.unit || value.code,
].filter(Boolean).join(' ');

const resultValueLabels = (
    observation: ObservationRecord,
): {
    kind: ResultPresentationKind;
    originalValueLabel: string;
    normalizedValueLabel?: string;
    normalizationWarning?: string;
} => {
    const value = observation.value;
    if (!value) {
        return {
            kind: observation.tags?.includes('data-absent')
                ? 'absent'
                : 'other',
            originalValueLabel: observation.tags?.includes('data-absent')
                ? observation.note || 'Result absent — see source evidence'
                : 'No structured value recorded',
        };
    }

    if (value.type === 'quantity') {
        const original = valueWithUnit(value.quantity.original);
        const normalized = value.quantity.normalized
            ? valueWithUnit(value.quantity.normalized)
            : undefined;
        return {
            kind: value.quantity.original.comparator
                ? 'comparator'
                : 'numeric',
            originalValueLabel: original,
            ...(normalized && normalized !== original
                ? { normalizedValueLabel: normalized }
                : {}),
            ...(value.quantity.normalizationWarning
                ? { normalizationWarning: value.quantity.normalizationWarning }
                : {}),
        };
    }

    if (value.type === 'codeable-concept') {
        return {
            kind: 'qualitative',
            originalValueLabel: value.concept.text,
        };
    }
    if (value.type === 'boolean') {
        return {
            kind: 'qualitative',
            originalValueLabel: value.value ? 'Yes' : 'No',
        };
    }
    if (value.type === 'string') {
        return {
            kind: 'narrative',
            originalValueLabel: value.text || 'Empty text result',
        };
    }
    if (value.type === 'integer') {
        return {
            kind: 'other',
            originalValueLabel: String(value.value),
        };
    }

    return { kind: 'other', originalValueLabel: 'Unsupported value' };
};

const interpretationLabels = (observation: ObservationRecord): string[] =>
    observation.interpretation?.map(item => item.text).filter(Boolean) || [];

const flaggedObservation = (observation: ObservationRecord): boolean =>
    interpretationLabels(observation).some(label => ![
        'normal',
        'within range',
        'negative',
        'not detected',
    ].includes(normalizeText(label)));

const rangeLabel = (
    range: ObservationRecord['referenceRanges'][number],
): string => {
    if (range.text) return range.text;
    const low = range.low ? valueWithUnit(range.low) : undefined;
    const high = range.high ? valueWithUnit(range.high) : undefined;
    if (low && high) return `${low} – ${high}`;
    if (low) return `From ${low}`;
    if (high) return `Up to ${high}`;
    return 'Range context recorded without display text';
};

const specimenLabelForObservation = (
    record: PatientClinicalRecord,
    observation: ObservationRecord,
): string | undefined => {
    if (!observation.specimenId) return undefined;
    const specimen = record.resources.specimens.find(item =>
        item.id === observation.specimenId);
    return specimen?.type?.text || specimen?.note || 'Linked specimen';
};

const reportMembership = (
    reports: DiagnosticReportRecord[],
): Map<string, DiagnosticReportRecord[]> => {
    const membership = new Map<string, DiagnosticReportRecord[]>();
    reports.forEach(report => {
        report.resultIds.forEach(resultId => {
            membership.set(resultId, [
                ...(membership.get(resultId) || []),
                report,
            ]);
        });
    });
    return membership;
};

const safeUnit = (value?: ClinicalQuantityValue): string =>
    normalizeText(value?.code || value?.unit);

const loincSuggestionForResult = ({
    observation,
    specimenLabel,
}: {
    observation: ObservationRecord;
    specimenLabel?: string;
}): ReviewCodingSuggestion | undefined => {
    if (loincCodeForConcept(observation.code)) return undefined;
    const value = observation.value;
    if (!value || value.type !== 'quantity') return undefined;
    const name = normalizeText(observation.code.text);
    const unit = safeUnit(value.quantity.original);
    const specimen = normalizeText(specimenLabel);
    const match = RESULT_LOINC_REVIEW_CATALOG.find(entry =>
        entry.aliases.includes(name)
        && (!entry.units || entry.units.includes(unit))
        && (!entry.specimenTokens
            || entry.specimenTokens.some(token => specimen.includes(token))));
    if (!match) return undefined;
    return {
        system: LOINC_SYSTEM,
        code: match.code,
        display: match.display,
        basis:
            `Exact local name, recorded unit, and specimen context matched the bounded review catalog.`,
        caveat:
            'Review-only suggestion. Confirm specimen, method, scale, and source wording before adding any code.',
    };
};

const loincSuggestionForPanel = (
    report: DiagnosticReportRecord,
): ReviewCodingSuggestion | undefined => {
    if (loincCodeForConcept(report.code)) return undefined;
    const name = normalizeText(report.code.text);
    const match = PANEL_LOINC_REVIEW_CATALOG.find(entry =>
        entry.aliases.includes(name));
    if (!match) return undefined;
    return {
        system: LOINC_SYSTEM,
        code: match.code,
        display: match.display,
        basis: 'Exact report title matched the bounded local panel catalog.',
        caveat:
            'Review-only suggestion. Confirm the panel definition, specimen, method, and included members before coding.',
    };
};

const resultView = ({
    record,
    observation,
    reports,
}: {
    record: PatientClinicalRecord;
    observation: ObservationRecord;
    reports: DiagnosticReportRecord[];
}): DiagnosticResultView => {
    const date = clinicalDateForObservation(observation);
    const labels = resultValueLabels(observation);
    const specimenLabel = specimenLabelForObservation(record, observation);
    return {
        id: observation.id,
        name: observation.code.text,
        status: observation.status,
        statusLabel: titleCaseStatus(observation.status),
        ...labels,
        interpretationLabels: interpretationLabels(observation),
        referenceRangeLabels: observation.referenceRanges.map(rangeLabel),
        flagged: flaggedObservation(observation),
        clinicalDateLabel: formatClinicalDate(date),
        ...(date?.value ? { clinicalDateValue: date.value } : {}),
        clinicalDatePrecision: date?.precision || 'unknown',
        ...(specimenLabel ? { specimenLabel } : {}),
        reportNames: reports.map(report => report.code.text),
        ...(observation.provenance.source.document
            ? { source: observation.provenance.source.document }
            : {}),
        ...(loincCodeForConcept(observation.code)
            ? { loincCode: loincCodeForConcept(observation.code) }
            : {}),
        ...(loincSuggestionForResult({ observation, specimenLabel })
            ? {
                codingSuggestion: loincSuggestionForResult({
                    observation,
                    specimenLabel,
                }),
            }
            : {}),
        ...(observation.note ? { note: observation.note } : {}),
    };
};

const trendExclusion = (
    observation: ObservationRecord,
    reason: TrendExclusionReason,
    message: string,
): TrendExclusion => ({
    observationId: observation.id,
    name: observation.code.text,
    reason,
    message,
});

const trendCandidateFor = ({
    record,
    observation,
    reports,
}: {
    record: PatientClinicalRecord;
    observation: ObservationRecord;
    reports: DiagnosticReportRecord[];
}): { candidate?: TrendCandidate; exclusion?: TrendExclusion } => {
    if (observation.verificationStatus !== 'confirmed') {
        return {
            exclusion: trendExclusion(
                observation,
                'not-confirmed',
                'Only confirmed observations can enter a trend.',
            ),
        };
    }
    if (!patientApplicable(observation)) {
        return {
            exclusion: trendExclusion(
                observation,
                'not-patient-applicable',
                'Negated, hypothetical, family, or other-person evidence is excluded.',
            ),
        };
    }
    if (!TRENDABLE_STATUSES.has(observation.status)) {
        return {
            exclusion: trendExclusion(
                observation,
                'unsupported-status',
                `Status ${titleCaseStatus(observation.status)} is not trend eligible.`,
            ),
        };
    }
    if (!observation.value || observation.value.type !== 'quantity') {
        return {
            exclusion: trendExclusion(
                observation,
                'not-quantity',
                'Qualitative, narrative, absent, boolean, and integer results are not plotted as numeric trends.',
            ),
        };
    }
    if (observation.value.quantity.original.comparator) {
        return {
            exclusion: trendExclusion(
                observation,
                'comparator-value',
                'Comparator values such as <5 or >100 are retained but not plotted as exact points.',
            ),
        };
    }
    if (observation.value.quantity.normalizationWarning) {
        return {
            exclusion: trendExclusion(
                observation,
                'normalization-warning',
                observation.value.quantity.normalizationWarning,
            ),
        };
    }
    const date = clinicalDateForObservation(observation);
    if (!date?.value || date.precision === 'unknown') {
        return {
            exclusion: trendExclusion(
                observation,
                'clinical-date-unknown',
                'An unknown clinical date cannot be placed on a trend timeline.',
            ),
        };
    }
    if (date.precision !== 'day') {
        return {
            exclusion: trendExclusion(
                observation,
                'clinical-date-not-exact',
                'Month-only and year-only dates remain visible but are not plotted as exact points.',
            ),
        };
    }

    const chosen = observation.value.quantity.normalized
        || observation.value.quantity.original;
    const unitLabel = chosen.unit || chosen.code || '';
    const unitKey = chosen.system || chosen.code || unitLabel
        ? [
            normalizeText(chosen.system),
            normalizeText(chosen.code),
            normalizeText(unitLabel),
        ].join('|')
        : '';
    if (!unitKey || !unitLabel) {
        return {
            exclusion: trendExclusion(
                observation,
                'unit-missing',
                'A numeric result without a recorded comparable unit is not plotted.',
            ),
        };
    }

    const loincCode = loincCodeForConcept(observation.code);
    const specimenLabel = specimenLabelForObservation(record, observation);
    let identityKey: string;
    let identityLabel: string;
    let groupingBasis: DiagnosticTrendSeries['groupingBasis'];
    if (loincCode) {
        identityKey = `loinc:${loincCode}`;
        identityLabel = `${observation.code.text} · LOINC ${loincCode}`;
        groupingBasis = 'loinc';
    } else if (specimenLabel) {
        identityKey = `name:${normalizeText(observation.code.text)}|specimen:${normalizeText(specimenLabel)}`;
        identityLabel = `${observation.code.text} · ${specimenLabel}`;
        groupingBasis = 'exact-name-and-specimen';
    } else {
        return {
            exclusion: trendExclusion(
                observation,
                'identity-insufficient',
                'Uncoded results require the same exact name and a known specimen before cross-report grouping.',
            ),
        };
    }

    const labels = resultValueLabels(observation);
    return {
        candidate: {
            observation,
            name: observation.code.text,
            ...(loincCode ? { loincCode } : {}),
            ...(specimenLabel ? { specimenLabel } : {}),
            reportNames: reports.map(report => report.code.text),
            ...(observation.provenance.source.document
                ? { source: observation.provenance.source.document }
                : {}),
            date,
            quantity: chosen,
            originalValueLabel: labels.originalValueLabel,
            ...(labels.normalizedValueLabel
                ? { normalizedValueLabel: labels.normalizedValueLabel }
                : {}),
            identityKey,
            identityLabel,
            unitKey,
            unitLabel,
            groupingBasis,
        },
    };
};

const trendSeriesFromCandidates = (
    candidates: TrendCandidate[],
): {
    series: DiagnosticTrendSeries[];
    exclusions: TrendExclusion[];
    conflicts: UnitConflict[];
} => {
    const byIdentity = new Map<string, TrendCandidate[]>();
    candidates.forEach(candidate => {
        byIdentity.set(candidate.identityKey, [
            ...(byIdentity.get(candidate.identityKey) || []),
            candidate,
        ]);
    });

    const series: DiagnosticTrendSeries[] = [];
    const exclusions: TrendExclusion[] = [];
    const conflicts: UnitConflict[] = [];

    byIdentity.forEach(identityCandidates => {
        const byUnit = new Map<string, TrendCandidate[]>();
        identityCandidates.forEach(candidate => {
            byUnit.set(candidate.unitKey, [
                ...(byUnit.get(candidate.unitKey) || []),
                candidate,
            ]);
        });
        if (byUnit.size > 1) {
            conflicts.push({
                identityLabel: identityCandidates[0].identityLabel,
                units: [...new Set(identityCandidates.map(item => item.unitLabel))],
                observationIds: identityCandidates.map(item => item.observation.id),
                message:
                    'Different recorded or normalized units are kept in separate groups. MediBrief does not assume that conversion is safe.',
            });
        }

        byUnit.forEach(unitCandidates => {
            if (unitCandidates.length < 2) {
                unitCandidates.forEach(candidate => {
                    exclusions.push(trendExclusion(
                        candidate.observation,
                        'single-point-only',
                        'At least two comparable confirmed points are required to draw a trend.',
                    ));
                });
                return;
            }
            const sorted = [...unitCandidates].sort((left, right) =>
                (left.date.value || '').localeCompare(right.date.value || ''));
            const first = sorted[0];
            series.push({
                key: `${first.identityKey}|unit:${first.unitKey}`,
                name: first.name,
                ...(first.loincCode ? { loincCode: first.loincCode } : {}),
                ...(first.specimenLabel
                    ? { specimenLabel: first.specimenLabel }
                    : {}),
                unit: first.unitLabel,
                groupingBasis: first.groupingBasis,
                points: sorted.map(candidate => ({
                    observationId: candidate.observation.id,
                    date: candidate.date.value!,
                    dateLabel: candidate.date.value!,
                    value: candidate.quantity.value,
                    unit: candidate.unitLabel,
                    originalValueLabel: candidate.originalValueLabel,
                    ...(candidate.normalizedValueLabel
                        ? {
                            normalizedValueLabel:
                                candidate.normalizedValueLabel,
                        }
                        : {}),
                    reportNames: candidate.reportNames,
                    ...(candidate.source ? { source: candidate.source } : {}),
                })),
                ...(first.groupingBasis === 'exact-name-and-specimen'
                    ? {
                        qualityNotice:
                            'Grouped by exact recorded name, specimen, and unit because no LOINC code is confirmed. Verify method compatibility before interpreting change.',
                    }
                    : {}),
            });
        });
    });

    return {
        series: series.sort((left, right) => left.name.localeCompare(right.name)),
        exclusions,
        conflicts,
    };
};

export const buildDiagnosticResultsIntelligence = (
    record: PatientClinicalRecord,
): DiagnosticResultsIntelligence => {
    const reports = record.resources.diagnosticReports.filter(confirmedReport);
    const observations = record.resources.observations.filter(confirmedObservation);
    const observationsById = new Map(
        observations.map(observation => [observation.id, observation]),
    );
    const membership = reportMembership(reports);
    const resultViews = new Map<string, DiagnosticResultView>();
    observations.forEach(observation => {
        resultViews.set(observation.id, resultView({
            record,
            observation,
            reports: membership.get(observation.id) || [],
        }));
    });

    const panels: DiagnosticPanelView[] = reports.map(report => {
        const date = clinicalDateForReport(report);
        const memberResults = report.resultIds
            .map(id => resultViews.get(id))
            .filter((value): value is DiagnosticResultView => Boolean(value));
        const missingMemberIds = report.resultIds.filter(id =>
            !resultViews.has(id));
        const specimenLabels = report.specimenIds.map(id => {
            const specimen = record.resources.specimens.find(item => item.id === id);
            return specimen?.type?.text || specimen?.note || `Specimen ${id}`;
        });
        return {
            id: report.id,
            name: report.code.text,
            status: report.status,
            statusLabel: titleCaseStatus(report.status),
            clinicalDateLabel: formatClinicalDate(date),
            memberResults,
            missingMemberIds,
            specimenLabels,
            ...(report.provenance.source.document
                ? { source: report.provenance.source.document }
                : {}),
            ...(loincCodeForConcept(report.code)
                ? { loincCode: loincCodeForConcept(report.code) }
                : {}),
            ...(loincSuggestionForPanel(report)
                ? { codingSuggestion: loincSuggestionForPanel(report) }
                : {}),
            ...(report.conclusion ? { conclusion: report.conclusion } : {}),
            membershipBasis: 'diagnostic-report-resultIds' as const,
        };
    }).sort((left, right) => left.name.localeCompare(right.name));

    const views = [...resultViews.values()];
    const unlinkedResults = views.filter(view => view.reportNames.length === 0);
    const trendCandidates: TrendCandidate[] = [];
    const trendExclusions: TrendExclusion[] = [];
    record.resources.observations.forEach(observation => {
        const result = trendCandidateFor({
            record,
            observation,
            reports: membership.get(observation.id) || [],
        });
        if (result.candidate) trendCandidates.push(result.candidate);
        if (result.exclusion) trendExclusions.push(result.exclusion);
    });
    const trendOutput = trendSeriesFromCandidates(trendCandidates);

    const byKind = (kind: ResultPresentationKind) => views.filter(view =>
        view.kind === kind);

    return {
        panels,
        unlinkedResults,
        numericResults: byKind('numeric'),
        comparatorResults: byKind('comparator'),
        qualitativeResults: byKind('qualitative'),
        narrativeResults: byKind('narrative'),
        absentResults: byKind('absent'),
        otherResults: byKind('other'),
        trendSeries: trendOutput.series,
        trendExclusions: [...trendExclusions, ...trendOutput.exclusions],
        unitConflicts: trendOutput.conflicts,
        candidateCount: [
            ...record.resources.diagnosticReports,
            ...record.resources.observations,
            ...record.resources.specimens,
        ].filter(resource => resource.verificationStatus === 'candidate').length,
        reportCount: reports.length,
        observationCount: observations.length,
        flaggedCount: views.filter(view => view.flagged).length,
    };
};

export const diagnosticResultMatchesSearch = (
    result: DiagnosticResultView,
    query: string,
): boolean => {
    const normalized = normalizeText(query);
    if (!normalized) return true;
    return [
        result.name,
        result.originalValueLabel,
        result.normalizedValueLabel,
        result.specimenLabel,
        result.loincCode,
        result.interpretationLabels.join(' '),
        result.referenceRangeLabels.join(' '),
        result.reportNames.join(' '),
        result.note,
        result.source?.fileName,
    ].some(value => normalizeText(value).includes(normalized));
};

export const diagnosticPanelMatchesSearch = (
    panel: DiagnosticPanelView,
    query: string,
): boolean => {
    const normalized = normalizeText(query);
    if (!normalized) return true;
    return [
        panel.name,
        panel.statusLabel,
        panel.clinicalDateLabel,
        panel.loincCode,
        panel.conclusion,
        panel.specimenLabels.join(' '),
        panel.memberResults.map(result => result.name).join(' '),
        panel.source?.fileName,
    ].some(value => normalizeText(value).includes(normalized));
};

export const reviewOnlyLoincSuggestionForResult = (
    record: PatientClinicalRecord,
    observation: ObservationRecord,
): ReviewCodingSuggestion | undefined => loincSuggestionForResult({
    observation,
    specimenLabel: specimenLabelForObservation(record, observation),
});

export const reviewOnlyLoincSuggestionForPanel = (
    report: DiagnosticReportRecord,
): ReviewCodingSuggestion | undefined => loincSuggestionForPanel(report);
