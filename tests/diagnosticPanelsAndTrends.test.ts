import { beforeEach, describe, expect, it } from 'vitest';
import {
    parseClinicalRecordResource,
    parsePatientClinicalRecord,
    type DiagnosticReportRecord,
    type ObservationRecord,
    type PatientClinicalRecord,
    type SpecimenRecord,
    useClinicalRecordStore,
} from '../features/clinical-record';
import {
    buildDiagnosticResultsIntelligence,
    reviewOnlyLoincSuggestionForPanel,
    reviewOnlyLoincSuggestionForResult,
} from '../features/diagnostic-reports/resultIntelligence';

const NOW = '2026-07-31T12:00:00.000Z';
const PATIENT_ID = 'patient-panels-trends';

const provenance = () => ({
    source: {
        kind: 'manual' as const,
        description: 'Synthetic Phase 4 panel and trend fixture',
    },
    createdAt: NOW,
    updatedAt: NOW,
    confirmation: {
        reviewedAt: NOW,
        reviewedBy: 'tester',
        reason: 'Synthetic confirmed fixture',
    },
});

const day = (value: string) => ({
    value,
    precision: 'day' as const,
    sourceText: value,
});

const unknownDate = () => ({
    value: null,
    precision: 'unknown' as const,
    sourceText: 'Not visible',
});

const specimen = (
    id: string,
    typeText: string,
): SpecimenRecord => parseClinicalRecordResource({
    id,
    patientId: PATIENT_ID,
    resourceType: 'Specimen',
    verificationStatus: 'confirmed',
    recordedAt: NOW,
    effective: day('2026-07-01'),
    provenance: provenance(),
    amendments: [],
    status: 'available',
    type: { text: typeText },
    collectedAt: day('2026-07-01'),
}) as SpecimenRecord;

const quantityObservation = ({
    id,
    name,
    date,
    value,
    unit,
    loinc,
    specimenId,
    reportId,
    verificationStatus = 'confirmed',
    status = 'final',
    comparator,
    normalized,
    normalizationWarning,
}: {
    id: string;
    name: string;
    date: ReturnType<typeof day> | ReturnType<typeof unknownDate>;
    value: number;
    unit: string;
    loinc?: string;
    specimenId?: string;
    reportId?: string;
    verificationStatus?: ObservationRecord['verificationStatus'];
    status?: ObservationRecord['status'];
    comparator?: '<' | '<=' | '>=' | '>';
    normalized?: { value: number; unit: string; code?: string };
    normalizationWarning?: string;
}): ObservationRecord => parseClinicalRecordResource({
    id,
    patientId: PATIENT_ID,
    resourceType: 'Observation',
    verificationStatus,
    recordedAt: NOW,
    effective: date,
    provenance: provenance(),
    amendments: [],
    status,
    category: [{ text: 'Laboratory' }],
    code: {
        text: name,
        ...(loinc
            ? {
                coding: [{
                    system: 'http://loinc.org',
                    code: loinc,
                    display: name,
                }],
            }
            : {}),
    },
    value: {
        type: 'quantity',
        quantity: {
            original: {
                value,
                unit,
                system: 'http://unitsofmeasure.org',
                code: unit,
                ...(comparator ? { comparator } : {}),
            },
            ...(normalized
                ? {
                    normalized: {
                        value: normalized.value,
                        unit: normalized.unit,
                        system: 'http://unitsofmeasure.org',
                        code: normalized.code || normalized.unit,
                    },
                }
                : {}),
            ...(normalizationWarning ? { normalizationWarning } : {}),
        },
    },
    interpretation: [],
    referenceRanges: [],
    ...(specimenId ? { specimenId } : {}),
    ...(reportId ? { diagnosticReportId: reportId } : {}),
}) as ObservationRecord;

const nonNumericObservation = ({
    id,
    name,
    kind,
    reportId,
}: {
    id: string;
    name: string;
    kind: 'qualitative' | 'narrative' | 'absent';
    reportId?: string;
}): ObservationRecord => parseClinicalRecordResource({
    id,
    patientId: PATIENT_ID,
    resourceType: 'Observation',
    verificationStatus: 'confirmed',
    recordedAt: NOW,
    effective: day('2026-07-02'),
    provenance: provenance(),
    amendments: [],
    tags: kind === 'absent' ? ['data-absent'] : [],
    status: 'final',
    category: [{ text: 'Laboratory' }],
    code: { text: name },
    ...(kind === 'qualitative'
        ? {
            value: {
                type: 'codeable-concept',
                concept: { text: 'Not detected' },
            },
        }
        : kind === 'narrative'
            ? { value: { type: 'string', text: 'Rare atypical cells noted.' } }
            : {}),
    interpretation: [],
    referenceRanges: [],
    ...(kind === 'absent' ? { note: 'Specimen quantity insufficient' } : {}),
    ...(reportId ? { diagnosticReportId: reportId } : {}),
}) as ObservationRecord;

const report = ({
    id,
    name,
    resultIds,
    specimenIds = [],
    loinc,
}: {
    id: string;
    name: string;
    resultIds: string[];
    specimenIds?: string[];
    loinc?: string;
}): DiagnosticReportRecord => parseClinicalRecordResource({
    id,
    patientId: PATIENT_ID,
    resourceType: 'DiagnosticReport',
    verificationStatus: 'confirmed',
    recordedAt: NOW,
    effective: day('2026-07-01'),
    provenance: provenance(),
    amendments: [],
    status: 'final',
    code: {
        text: name,
        ...(loinc
            ? {
                coding: [{
                    system: 'http://loinc.org',
                    code: loinc,
                    display: name,
                }],
            }
            : {}),
    },
    category: [{ text: 'Laboratory' }],
    effectivePeriod: {
        start: day('2026-07-01'),
        end: day('2026-07-01'),
    },
    resultIds,
    specimenIds,
    documentIds: [],
    performer: ['Synthetic laboratory'],
}) as DiagnosticReportRecord;

const buildRecord = (): PatientClinicalRecord => {
    const actions = useClinicalRecordStore.getState().actions;
    actions.initializePatientRecord({
        patientId: PATIENT_ID,
        displayName: 'Synthetic Trend Patient',
        now: NOW,
    });
    const base = actions.getPatientRecord(PATIENT_ID)!;

    const observations: ObservationRecord[] = [
        quantityObservation({
            id: 'hgb-1',
            name: 'Hemoglobin',
            date: day('2026-06-01'),
            value: 132,
            unit: 'g/L',
            loinc: '718-7',
            specimenId: 'blood-1',
            reportId: 'cbc-1',
            normalized: { value: 13.2, unit: 'g/dL' },
        }),
        quantityObservation({
            id: 'hgb-2',
            name: 'Hemoglobin',
            date: day('2026-07-01'),
            value: 13.6,
            unit: 'g/dL',
            loinc: '718-7',
            specimenId: 'blood-1',
            reportId: 'cbc-2',
        }),
        quantityObservation({
            id: 'wbc-comparator',
            name: 'White blood cell count',
            date: day('2026-07-01'),
            value: 5,
            unit: '10*3/uL',
            loinc: '6690-2',
            specimenId: 'blood-1',
            reportId: 'cbc-2',
            comparator: '<',
        }),
        quantityObservation({
            id: 'creatinine-1',
            name: 'Creatinine',
            date: day('2026-06-01'),
            value: 0.9,
            unit: 'mg/dL',
            specimenId: 'serum-1',
            reportId: 'renal-1',
        }),
        quantityObservation({
            id: 'creatinine-2',
            name: 'Creatinine',
            date: day('2026-07-01'),
            value: 1.0,
            unit: 'mg/dL',
            specimenId: 'serum-1',
            reportId: 'renal-2',
        }),
        quantityObservation({
            id: 'glucose-mg',
            name: 'Glucose',
            date: day('2026-06-10'),
            value: 90,
            unit: 'mg/dL',
            loinc: '2345-7',
            specimenId: 'serum-1',
        }),
        quantityObservation({
            id: 'glucose-mmol',
            name: 'Glucose',
            date: day('2026-07-10'),
            value: 5,
            unit: 'mmol/L',
            loinc: '2345-7',
            specimenId: 'serum-1',
        }),
        quantityObservation({
            id: 'undated-creatinine',
            name: 'Creatinine',
            date: unknownDate(),
            value: 1.1,
            unit: 'mg/dL',
            specimenId: 'serum-1',
        }),
        quantityObservation({
            id: 'warning-creatinine',
            name: 'Creatinine',
            date: day('2026-07-20'),
            value: 10,
            unit: 'mg/dL',
            specimenId: 'serum-1',
            normalizationWarning: 'Unit and magnitude require source review.',
        }),
        quantityObservation({
            id: 'candidate-hgb',
            name: 'Hemoglobin',
            date: day('2026-07-15'),
            value: 14,
            unit: 'g/dL',
            loinc: '718-7',
            specimenId: 'blood-1',
            verificationStatus: 'candidate',
        }),
        nonNumericObservation({
            id: 'viral-result',
            name: 'Respiratory virus screen',
            kind: 'qualitative',
            reportId: 'molecular-1',
        }),
        nonNumericObservation({
            id: 'pathology-note',
            name: 'Microscopic description',
            kind: 'narrative',
            reportId: 'molecular-1',
        }),
        nonNumericObservation({
            id: 'insufficient-result',
            name: 'Culture result',
            kind: 'absent',
            reportId: 'molecular-1',
        }),
    ];

    const reports: DiagnosticReportRecord[] = [
        report({
            id: 'cbc-1',
            name: 'Complete blood count',
            resultIds: ['hgb-1', 'missing-cbc-member'],
            specimenIds: ['blood-1'],
        }),
        report({
            id: 'cbc-2',
            name: 'Complete blood count',
            resultIds: ['hgb-2', 'wbc-comparator'],
            specimenIds: ['blood-1'],
        }),
        report({
            id: 'renal-1',
            name: 'Renal profile',
            resultIds: ['creatinine-1'],
            specimenIds: ['serum-1'],
        }),
        report({
            id: 'renal-2',
            name: 'Renal profile',
            resultIds: ['creatinine-2'],
            specimenIds: ['serum-1'],
        }),
        report({
            id: 'molecular-1',
            name: 'Molecular and pathology report',
            resultIds: ['viral-result', 'pathology-note', 'insufficient-result'],
        }),
    ];

    return parsePatientClinicalRecord({
        ...base,
        resources: {
            ...base.resources,
            specimens: [
                specimen('blood-1', 'Venous blood specimen'),
                specimen('serum-1', 'Serum specimen'),
            ],
            observations,
            diagnosticReports: reports,
        },
        updatedAt: NOW,
    });
};

describe('Phase 4 panel membership and result presentation', () => {
    beforeEach(() => {
        useClinicalRecordStore.setState({ records: {} });
    });

    it('uses DiagnosticReport.resultIds as the explicit panel membership source', () => {
        const intelligence = buildDiagnosticResultsIntelligence(buildRecord());
        const firstCbc = intelligence.panels.find(panel => panel.id === 'cbc-1')!;
        const secondCbc = intelligence.panels.find(panel => panel.id === 'cbc-2')!;

        expect(firstCbc.membershipBasis).toBe('diagnostic-report-resultIds');
        expect(firstCbc.memberResults.map(result => result.id)).toEqual(['hgb-1']);
        expect(firstCbc.missingMemberIds).toEqual(['missing-cbc-member']);
        expect(secondCbc.memberResults.map(result => result.id)).toEqual([
            'hgb-2',
            'wbc-comparator',
        ]);
        expect(intelligence.unlinkedResults.map(result => result.id)).toEqual(
            expect.arrayContaining([
                'glucose-mg',
                'glucose-mmol',
                'undated-creatinine',
                'warning-creatinine',
            ]),
        );
    });

    it('keeps qualitative, narrative, comparator, and absent results outside numeric trends', () => {
        const intelligence = buildDiagnosticResultsIntelligence(buildRecord());

        expect(intelligence.comparatorResults.map(item => item.id))
            .toContain('wbc-comparator');
        expect(intelligence.qualitativeResults.map(item => item.id))
            .toContain('viral-result');
        expect(intelligence.narrativeResults.map(item => item.id))
            .toContain('pathology-note');
        expect(intelligence.absentResults.map(item => item.id))
            .toContain('insufficient-result');
        expect(intelligence.trendSeries.flatMap(series =>
            series.points.map(point => point.observationId)))
            .not.toEqual(expect.arrayContaining([
                'wbc-comparator',
                'viral-result',
                'pathology-note',
                'insufficient-result',
            ]));
    });
});

describe('Phase 4 conservative trend eligibility', () => {
    beforeEach(() => {
        useClinicalRecordStore.setState({ records: {} });
    });

    it('trends confirmed comparable results and retains original versus normalized labels', () => {
        const intelligence = buildDiagnosticResultsIntelligence(buildRecord());
        const hemoglobin = intelligence.trendSeries.find(series =>
            series.loincCode === '718-7')!;
        const creatinine = intelligence.trendSeries.find(series =>
            series.name === 'Creatinine')!;

        expect(hemoglobin.groupingBasis).toBe('loinc');
        expect(hemoglobin.unit).toBe('g/dL');
        expect(hemoglobin.points).toHaveLength(2);
        expect(hemoglobin.points[0]).toMatchObject({
            originalValueLabel: '132 g/L',
            normalizedValueLabel: '13.2 g/dL',
            value: 13.2,
        });
        expect(creatinine.groupingBasis).toBe('exact-name-and-specimen');
        expect(creatinine.points.map(point => point.observationId)).toEqual([
            'creatinine-1',
            'creatinine-2',
        ]);
        expect(creatinine.qualityNotice).toContain('no LOINC code is confirmed');
    });

    it('excludes candidates, comparator values, unknown dates, and normalization warnings with reasons', () => {
        const intelligence = buildDiagnosticResultsIntelligence(buildRecord());
        const reasons = new Map(intelligence.trendExclusions.map(item => [
            item.observationId,
            item.reason,
        ]));

        expect(reasons.get('candidate-hgb')).toBe('not-confirmed');
        expect(reasons.get('wbc-comparator')).toBe('comparator-value');
        expect(reasons.get('undated-creatinine')).toBe('clinical-date-unknown');
        expect(reasons.get('warning-creatinine')).toBe('normalization-warning');
    });

    it('keeps incompatible units in separate groups and surfaces a conflict instead of converting', () => {
        const intelligence = buildDiagnosticResultsIntelligence(buildRecord());
        const conflict = intelligence.unitConflicts.find(item =>
            item.identityLabel.includes('Glucose'))!;

        expect(conflict.units).toEqual(expect.arrayContaining(['mg/dL', 'mmol/L']));
        expect(conflict.observationIds).toEqual(expect.arrayContaining([
            'glucose-mg',
            'glucose-mmol',
        ]));
        expect(intelligence.trendSeries.some(series =>
            series.loincCode === '2345-7')).toBe(false);
    });
});

describe('Phase 4 review-only LOINC suggestions', () => {
    beforeEach(() => {
        useClinicalRecordStore.setState({ records: {} });
    });

    it('returns bounded suggestions without mutating the confirmed record', () => {
        const record = buildRecord();
        const creatinine = record.resources.observations.find(item =>
            item.id === 'creatinine-1')!;
        const cbc = record.resources.diagnosticReports.find(item =>
            item.id === 'cbc-1')!;
        const before = JSON.stringify(record);

        const resultSuggestion = reviewOnlyLoincSuggestionForResult(
            record,
            creatinine,
        );
        const panelSuggestion = reviewOnlyLoincSuggestionForPanel(cbc);

        expect(resultSuggestion).toMatchObject({
            system: 'http://loinc.org',
            code: '2160-0',
        });
        expect(resultSuggestion?.caveat).toContain('Review-only');
        expect(panelSuggestion).toMatchObject({
            system: 'http://loinc.org',
            code: '58410-2',
        });
        expect(JSON.stringify(record)).toBe(before);
        expect(creatinine.code.coding).toBeUndefined();
        expect(cbc.code.coding).toBeUndefined();
    });

    it('does not suggest a context-specific code without the required specimen context', () => {
        const record = buildRecord();
        const unlinked = quantityObservation({
            id: 'creatinine-no-specimen',
            name: 'Creatinine',
            date: day('2026-07-25'),
            value: 1,
            unit: 'mg/dL',
        });

        expect(reviewOnlyLoincSuggestionForResult(record, unlinked))
            .toBeUndefined();
    });
});
