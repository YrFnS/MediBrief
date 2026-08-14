import { describe, expect, it } from 'vitest';
import type {
    ObservationRecord,
    PatientClinicalRecord,
} from '../features/clinical-record/types';
import { normalizeValue } from '../features/fhir/unitService';
import {
    TERMINOLOGY_SYSTEMS,
    TERMINOLOGY_URIS,
    buildTerminologyCoverage,
    findExactUcumCode,
    normalizeQuantityValue,
    suggestLoincMapping,
    suggestUcumMapping,
    validateLicensedSnomedInput,
    validateSourceRxNormInput,
} from '../features/terminology';

const baseObservation = (
    overrides: Partial<ObservationRecord> = {},
): ObservationRecord => ({
    id: 'observation-1',
    patientId: 'patient-1',
    resourceType: 'Observation',
    verificationStatus: 'confirmed',
    recordedAt: '2026-08-14T12:00:00.000Z',
    provenance: {
        source: { kind: 'manual' },
        createdAt: '2026-08-14T12:00:00.000Z',
        updatedAt: '2026-08-14T12:00:00.000Z',
    },
    amendments: [],
    status: 'final',
    code: { text: 'Heart rate' },
    value: {
        type: 'quantity',
        quantity: { original: { value: 72, unit: 'bpm' } },
    },
    referenceRanges: [],
    ...overrides,
});

const emptyRecord = (): PatientClinicalRecord => ({
    schemaVersion: 1,
    patientId: 'patient-1',
    createdAt: '2026-08-14T12:00:00.000Z',
    updatedAt: '2026-08-14T12:00:00.000Z',
    profile: {
        id: 'profile-1',
        patientId: 'patient-1',
        resourceType: 'PatientProfile',
        verificationStatus: 'confirmed',
        recordedAt: '2026-08-14T12:00:00.000Z',
        provenance: {
            source: { kind: 'manual' },
            createdAt: '2026-08-14T12:00:00.000Z',
            updatedAt: '2026-08-14T12:00:00.000Z',
        },
        amendments: [],
        displayName: 'Synthetic patient',
        identifiers: [],
        contacts: [],
        addresses: [],
    },
    resources: {
        encounters: [],
        conditions: [],
        allergies: [],
        medications: [],
        observations: [],
        diagnosticReports: [],
        specimens: [],
        procedures: [],
        immunizations: [],
        appointments: [],
        tasks: [],
        carePlans: [],
        documents: [],
        notes: [],
    },
});

describe('reviewed LOINC subset', () => {
    it('suggests an exact English vital-sign alias', () => {
        const suggestion = suggestLoincMapping(baseObservation());

        expect(suggestion?.coding).toMatchObject({
            system: TERMINOLOGY_URIS.loinc,
            version: '2.82',
            code: '8867-4',
        });
        expect(suggestion?.reviewRequired).toBe(true);
    });

    it('supports reviewed Arabic aliases without enabling Arabic clinical NER', () => {
        const suggestion = suggestLoincMapping(baseObservation({
            code: { text: 'درجة حرارة الجسم' },
        }));

        expect(suggestion?.coding.code).toBe('8310-5');
        expect(TERMINOLOGY_SYSTEMS.loinc.boundary)
            .toContain('exactly matches');
    });

    it('refuses generic specimen-ambiguous labels', () => {
        expect(suggestLoincMapping(baseObservation({
            code: { text: 'Glucose' },
        }))).toBeNull();
        expect(suggestLoincMapping(baseObservation({
            code: { text: 'Creatinine' },
        }))).toBeNull();
    });


    it('keeps rejected and entered-in-error resources outside the terminology review queue', () => {
        expect(suggestLoincMapping(baseObservation({
            verificationStatus: 'rejected',
        }))).toBeNull();
        expect(suggestUcumMapping(baseObservation({
            verificationStatus: 'entered-in-error',
        }))).toBeNull();
    });
});

describe('governed UCUM normalization', () => {
    it('maps a unit alias and converts only with an explicit reviewed analyte code', () => {
        const observation = baseObservation({
            code: {
                text: 'Creatinine',
                coding: [{
                    system: TERMINOLOGY_URIS.loinc,
                    code: '2160-0',
                    display: 'Creatinine [Mass/volume] in Serum or Plasma',
                }],
            },
            value: {
                type: 'quantity',
                quantity: {
                    original: { value: 124, unit: 'µmol/L' },
                },
            },
        });
        const suggestion = suggestUcumMapping(observation);

        expect(suggestion?.conversionApplied).toBe(true);
        expect(suggestion?.normalizedQuantity).toMatchObject({
            value: 1.4,
            unit: 'mg/dL',
            system: TERMINOLOGY_URIS.ucum,
            code: 'mg/dL',
        });
    });


    it('does not convert from a simultaneous unreviewed LOINC suggestion', () => {
        const observation = baseObservation({
            code: { text: 'serum creatinine mass concentration' },
            value: {
                type: 'quantity',
                quantity: {
                    original: { value: 124, unit: 'µmol/L' },
                },
            },
        });
        const suggestion = suggestUcumMapping(observation);

        expect(suggestion?.conversionApplied).toBe(false);
        expect(suggestion?.normalizedQuantity).toMatchObject({
            value: 124,
            system: TERMINOLOGY_URIS.ucum,
            code: 'umol/L',
        });
        expect(suggestion?.warnings.join(' ')).toContain(
            'Apply and review that code first',
        );
    });

    it('treats declared UCUM codes as case-sensitive', () => {
        expect(findExactUcumCode('mg/dL')?.code).toBe('mg/dL');
        expect(findExactUcumCode('MG/DL')).toBeNull();
        const observation = baseObservation({
            value: {
                type: 'quantity',
                quantity: {
                    original: {
                        value: 5,
                        system: TERMINOLOGY_URIS.ucum,
                        code: 'MG/DL',
                    },
                },
            },
        });
        expect(suggestUcumMapping(observation)).toBeNull();
    });

    it('codes a recognized unit without guessing the analyte', () => {
        const result = normalizeQuantityValue({
            value: 9999,
            unit: 'mmol/L',
            loincCode: null,
        });

        expect(result.conversionApplied).toBe(false);
        expect(result.normalized).toMatchObject({
            value: 9999,
            system: TERMINOLOGY_URIS.ucum,
            code: 'mmol/L',
        });
        expect(result.warning).toBeUndefined();
    });

    it('does not use a free-text test name to authorize a conversion', () => {
        const textOnly = normalizeValue(
            5,
            'mmol/L',
            'serum glucose mass concentration',
        );
        expect(textOnly).toMatchObject({
            value: 5,
            unit: 'mmol/L',
            code: 'mmol/L',
            conversionApplied: false,
        });

        const coded = normalizeValue(
            5,
            'mmol/L',
            'ignored compatibility text',
            '2345-7',
        );
        expect(coded).toMatchObject({
            value: 90.1,
            unit: 'mg/dL',
            code: 'mg/dL',
            conversionApplied: true,
        });
    });

    it('preserves unknown units and does not emit physiological verdicts', () => {
        const result = normalizeValue(4.5, 'mystery-unit', 'Lactate');

        expect(result).toMatchObject({
            value: 4.5,
            unit: 'mystery-unit',
            conversionApplied: false,
        });
        expect(result.warning).toContain('UCUM_NOT_RECOGNIZED');
        expect(result.warning).not.toMatch(/fatal|safe|incompatible with life/i);
    });
});

describe('source-provided medication coding', () => {
    it('requires a reviewed identifier, display, and source description', () => {
        const rejected = validateSourceRxNormInput({
            medicationId: 'medication-1',
            rxcui: 'not-a-code',
            display: '',
            sourceDescription: '',
            sourceReviewed: false,
        });
        expect(rejected.valid).toBe(false);
        expect(rejected.errors.join(' ')).toMatch(/source|display|numeric/i);

        expect(validateSourceRxNormInput({
            medicationId: 'medication-1',
            rxcui: '0',
            display: 'Source concept',
            sourceDescription: 'Imported clinical medication list',
            sourceReviewed: true,
        }).valid).toBe(false);

        const accepted = validateSourceRxNormInput({
            medicationId: 'medication-1',
            rxcui: '123456',
            display: 'Reviewed source medication concept',
            sourceDescription: 'Imported clinical medication list',
            sourceReviewed: true,
        });
        expect(accepted.coding).toMatchObject({
            system: TERMINOLOGY_URIS.rxnorm,
            code: '123456',
        });
        expect(TERMINOLOGY_SYSTEMS.rxnorm.lookupMode).toBe('source-provided');
    });
});

describe('SNOMED CT licensing boundary', () => {
    it('requires an edition/version URI and explicit license acknowledgement', () => {
        const rejected = validateLicensedSnomedInput({
            resourceType: 'Condition',
            resourceId: 'condition-1',
            code: '38341003',
            display: 'Hypertensive disorder',
            versionUri: '',
            licenseAcknowledged: false,
        });
        expect(rejected.valid).toBe(false);
        expect(rejected.errors.join(' ')).toMatch(/licensed|edition/i);

        const badCheckDigit = validateLicensedSnomedInput({
            resourceType: 'Condition',
            resourceId: 'condition-1',
            code: '38341004',
            display: 'Source display',
            versionUri: 'http://snomed.info/sct/900000000000207008/version/20260201',
            licenseAcknowledged: true,
        });
        expect(badCheckDigit.errors.join(' ')).toContain('check digit');

        const accepted = validateLicensedSnomedInput({
            resourceType: 'Condition',
            resourceId: 'condition-1',
            code: '38341003',
            display: 'Hypertensive disorder',
            versionUri: 'http://snomed.info/sct/900000000000207008/version/20260201',
            licenseAcknowledged: true,
        });
        expect(accepted.coding).toMatchObject({
            system: TERMINOLOGY_URIS.snomedCt,
            code: '38341003',
        });
        expect(TERMINOLOGY_SYSTEMS['snomed-ct'].lookupMode)
            .toBe('external-licensed');
    });
});

describe('terminology coverage', () => {
    it('distinguishes applied codings from pending deterministic suggestions', () => {
        const record = emptyRecord();
        record.resources.observations.push(baseObservation());
        const coverage = buildTerminologyCoverage(record);

        expect(coverage.observations).toBe(1);
        expect(coverage.observationsWithLoinc).toBe(0);
        expect(coverage.quantitiesWithUcum).toBe(0);
        expect(coverage.deterministicSuggestions).toBe(2);
    });
});
