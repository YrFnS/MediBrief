import type {
    ClinicalCodeableConcept,
    ClinicalCoding,
    ClinicalQuantityValue,
    MedicationRecord,
    ObservationRecord,
    PatientClinicalRecord,
    VerificationStatus,
} from '../clinical-record/types';
import {
    findExactLoincAlias,
    findExactUcumCode,
    findUcumAlias,
    TERMINOLOGY_URIS,
} from './registry';
import type {
    CodeMappingSuggestion,
    QuantityMappingSuggestion,
    TerminologyCoverage,
    TerminologySuggestion,
} from './types';

const REVIEWABLE_STATUSES = new Set<VerificationStatus>([
    'candidate',
    'confirmed',
]);

export const isTerminologyReviewable = (
    resource: { verificationStatus: VerificationStatus },
): boolean => REVIEWABLE_STATUSES.has(resource.verificationStatus);

const codingMatches = (
    coding: ClinicalCoding,
    system: string,
    code?: string,
): boolean => coding.system === system && (!code || coding.code === code);

export const hasCoding = (
    concept: ClinicalCodeableConcept | undefined,
    system: string,
): boolean => Boolean(concept?.coding?.some(coding =>
    codingMatches(coding, system)));

export const mergeCoding = (
    concept: ClinicalCodeableConcept,
    coding: ClinicalCoding,
): ClinicalCodeableConcept => {
    const existing = concept.coding || [];
    if (existing.some(item =>
        item.system === coding.system && item.code === coding.code)) {
        return concept;
    }
    return {
        ...concept,
        coding: [...existing, coding],
    };
};

const currentLoincCode = (observation: ObservationRecord): string | null =>
    observation.code.coding?.find(coding =>
        coding.system === TERMINOLOGY_URIS.loinc)?.code || null;

export const suggestLoincMapping = (
    observation: ObservationRecord,
): CodeMappingSuggestion | null => {
    if (!isTerminologyReviewable(observation)) return null;
    if (hasCoding(observation.code, TERMINOLOGY_URIS.loinc)) return null;
    const definition = findExactLoincAlias(observation.code.text);
    if (!definition) return null;

    return {
        id: `loinc:${observation.id}:${definition.coding.code}`,
        kind: 'code',
        patientId: observation.patientId,
        resourceId: observation.id,
        resourceType: 'Observation',
        target: 'Observation.code',
        sourceText: observation.code.text,
        system: 'loinc',
        coding: definition.coding,
        method: 'deterministic-exact-alias',
        rationale:
            `Exact reviewed alias for ${definition.context} Original observation text remains unchanged.`,
        warnings: [
            'Review the source document, specimen, method, and measurement context before applying this candidate.',
        ],
        reviewRequired: true,
    };
};

const rounded = (value: number, digits: number): number =>
    Number(value.toFixed(digits));

interface GovernedConversion {
    value: number;
    unit: string;
    code: string;
    rationale: string;
}

export const governedConversion = ({
    loincCode,
    value,
    unitCode,
}: {
    loincCode: string | null;
    value: number;
    unitCode: string;
}): GovernedConversion | null => {
    if (['2339-0', '2345-7'].includes(loincCode || '')
        && unitCode === 'mmol/L') {
        return {
            value: rounded(value * 18.0182, 1),
            unit: 'mg/dL',
            code: 'mg/dL',
            rationale: 'Glucose molar-to-mass conversion for an explicitly coded blood or serum/plasma glucose observation.',
        };
    }

    if (loincCode === '2160-0' && unitCode === 'umol/L') {
        return {
            value: rounded(value / 88.4, 2),
            unit: 'mg/dL',
            code: 'mg/dL',
            rationale: 'Creatinine molar-to-mass conversion for an explicitly coded serum/plasma creatinine observation.',
        };
    }

    if (loincCode === '2524-7' && unitCode === 'mg/dL') {
        return {
            value: rounded(value / 9.008, 1),
            unit: 'mmol/L',
            code: 'mmol/L',
            rationale: 'Lactate mass-to-molar conversion for an explicitly coded serum/plasma lactate observation.',
        };
    }

    if (loincCode === '8310-5' && unitCode === '[degF]') {
        return {
            value: rounded((value - 32) * 5 / 9, 1),
            unit: '°C',
            code: 'Cel',
            rationale: 'Fahrenheit-to-Celsius conversion for an explicitly coded body-temperature observation.',
        };
    }

    return null;
};

export interface NormalizedQuantityResult {
    normalized: ClinicalQuantityValue | null;
    conversionApplied: boolean;
    warning?: string;
    rationale?: string;
}

export const normalizeQuantityValue = ({
    value,
    unit,
    loincCode,
    comparator,
}: {
    value: number;
    unit: string;
    loincCode?: string | null;
    comparator?: ClinicalQuantityValue['comparator'];
}): NormalizedQuantityResult => {
    const ucum = findUcumAlias(unit);
    if (!ucum) {
        return {
            normalized: null,
            conversionApplied: false,
            warning: `UCUM_NOT_RECOGNIZED: “${unit}” was preserved and not guessed.`,
        };
    }
    const conversion = governedConversion({
        loincCode: loincCode || null,
        value,
        unitCode: ucum.code,
    });
    if (conversion) {
        return {
            normalized: {
                value: conversion.value,
                unit: conversion.unit,
                system: TERMINOLOGY_URIS.ucum,
                code: conversion.code,
                ...(comparator ? { comparator } : {}),
            },
            conversionApplied: true,
            rationale: conversion.rationale,
        };
    }
    return {
        normalized: {
            value,
            unit: ucum.display,
            system: TERMINOLOGY_URIS.ucum,
            code: ucum.code,
            ...(comparator ? { comparator } : {}),
        },
        conversionApplied: false,
        rationale: 'Source unit matched a reviewed UCUM alias; no analyte conversion was performed.',
    };
};

const quantitiesEqual = (
    left: ClinicalQuantityValue | undefined,
    right: ClinicalQuantityValue,
): boolean => Boolean(left
    && left.value === right.value
    && left.unit === right.unit
    && left.system === right.system
    && left.code === right.code
    && left.comparator === right.comparator);

interface SourceUnitSelection {
    value: string;
    declaredUcum: boolean;
}

const sourceUnitForObservation = (
    observation: ObservationRecord,
): SourceUnitSelection | null => {
    if (observation.value?.type !== 'quantity') return null;
    const original = observation.value.quantity.original;
    if (original.system === TERMINOLOGY_URIS.ucum && original.code) {
        return { value: original.code, declaredUcum: true };
    }
    const value = original.unit || original.code;
    return value ? { value, declaredUcum: false } : null;
};

export const suggestUcumMapping = (
    observation: ObservationRecord,
): QuantityMappingSuggestion | null => {
    if (!isTerminologyReviewable(observation)) return null;
    if (observation.value?.type !== 'quantity') return null;

    const original = observation.value.quantity.original;
    const sourceUnit = sourceUnitForObservation(observation);
    if (!sourceUnit) return null;
    const unit = sourceUnit.declaredUcum
        ? findExactUcumCode(sourceUnit.value)
        : findUcumAlias(sourceUnit.value);
    if (!unit) return null;

    // A conversion requires an already-applied LOINC code. A simultaneous
    // LOINC suggestion is not treated as reviewed clinical context.
    const loincCode = currentLoincCode(observation);
    const normalized = normalizeQuantityValue({
        value: original.value,
        unit: sourceUnit.value,
        loincCode,
        comparator: original.comparator,
    });
    if (!normalized.normalized) return null;
    const normalizedQuantity = normalized.normalized;
    if (quantitiesEqual(
        observation.value.quantity.normalized,
        normalizedQuantity,
    )) {
        return null;
    }

    return {
        id: `ucum:${observation.id}:${unit.code}:${normalizedQuantity.code || 'same'}:${normalizedQuantity.value}`,
        kind: 'quantity',
        patientId: observation.patientId,
        resourceId: observation.id,
        resourceType: 'Observation',
        target: 'Observation.value.quantity',
        sourceText: `${original.value} ${sourceUnit.value}`,
        system: 'ucum',
        method: 'deterministic-exact-alias',
        normalizedQuantity,
        conversionApplied: normalized.conversionApplied,
        rationale: normalized.conversionApplied
            ? `${normalized.rationale} Original value and unit remain preserved.`
            : 'The source unit exactly matches a reviewed UCUM alias. No analyte conversion was performed; the original value is retained.',
        warnings: [
            'UCUM coding does not verify that the source value or unit was transcribed correctly.',
            ...(!loincCode && governedConversion({
                loincCode: suggestLoincMapping(observation)?.coding.code || null,
                value: original.value,
                unitCode: unit.code,
            })
                ? ['A reviewed LOINC candidate exists. Apply and review that code first before any analyte conversion is offered.']
                : []),
            ...(normalized.conversionApplied
                ? ['Review the applied analyte code, specimen, source value, and conversion before accepting this normalized value.']
                : []),
        ],
        reviewRequired: true,
    };
};

export const collectTerminologySuggestions = (
    record: PatientClinicalRecord,
): TerminologySuggestion[] => record.resources.observations
    .filter(isTerminologyReviewable)
    .flatMap(observation => [
        suggestLoincMapping(observation),
        suggestUcumMapping(observation),
    ].filter((suggestion): suggestion is TerminologySuggestion =>
        Boolean(suggestion)),
    );

const quantityUnitRecognized = (observation: ObservationRecord): boolean => {
    if (observation.value?.type !== 'quantity') return true;
    const sourceUnit = sourceUnitForObservation(observation);
    if (!sourceUnit) return true;
    return Boolean(sourceUnit.declaredUcum
        ? findExactUcumCode(sourceUnit.value)
        : findUcumAlias(sourceUnit.value));
};

const quantityHasUcum = (observation: ObservationRecord): boolean => {
    if (observation.value?.type !== 'quantity') return false;
    const quantity = observation.value.quantity;
    return Boolean(
        (quantity.original.system === TERMINOLOGY_URIS.ucum
            && quantity.original.code
            && findExactUcumCode(quantity.original.code))
        || (quantity.normalized?.system === TERMINOLOGY_URIS.ucum
            && quantity.normalized.code
            && findExactUcumCode(quantity.normalized.code)),
    );
};

const hasRxNorm = (medication: MedicationRecord): boolean =>
    hasCoding(medication.medication, TERMINOLOGY_URIS.rxnorm);

export const buildTerminologyCoverage = (
    record: PatientClinicalRecord,
): TerminologyCoverage => {
    const observations = record.resources.observations.filter(
        isTerminologyReviewable,
    );
    const quantityObservations = observations.filter(observation =>
        observation.value?.type === 'quantity');
    const medications = record.resources.medications.filter(
        isTerminologyReviewable,
    );
    const conditionAllergyProcedure = [
        ...record.resources.conditions.filter(isTerminologyReviewable),
        ...record.resources.allergies.filter(isTerminologyReviewable),
        ...record.resources.procedures.filter(isTerminologyReviewable),
    ];
    const suggestions = collectTerminologySuggestions(record);

    return {
        observations: observations.length,
        observationsWithLoinc: observations.filter(observation =>
            hasCoding(observation.code, TERMINOLOGY_URIS.loinc)).length,
        quantityObservations: quantityObservations.length,
        quantitiesWithUcum: quantityObservations.filter(quantityHasUcum).length,
        medications: medications.length,
        medicationsWithRxNorm: medications.filter(hasRxNorm).length,
        conditionAllergyProcedureResources: conditionAllergyProcedure.length,
        resourcesWithSnomedCt: conditionAllergyProcedure.filter(resource => {
            const concept = resource.resourceType === 'Condition'
                ? resource.code
                : resource.resourceType === 'AllergyIntolerance'
                    ? resource.substance
                    : resource.code;
            return hasCoding(concept, TERMINOLOGY_URIS.snomedCt);
        }).length,
        deterministicSuggestions: suggestions.length,
        unresolvedObservationCodes: observations.filter(observation =>
            !hasCoding(observation.code, TERMINOLOGY_URIS.loinc)
            && !suggestLoincMapping(observation)).length,
        unrecognizedQuantityUnits: quantityObservations.filter(observation =>
            !quantityUnitRecognized(observation)).length,
    };
};
