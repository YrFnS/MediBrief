import { v4 as uuidv4 } from 'uuid';
import type {
    AllergyCategory,
    AllergyClinicalStatus,
    AllergyCriticality,
    AllergyIntoleranceRecord,
    ClinicalCodeableConcept,
    ClinicalDate,
    ClinicalPeriod,
    ClinicalQuantity,
    ConditionClinicalStatus,
    ConditionRecord,
    DiagnosticReportRecord,
    DiagnosticReportStatus,
    ImmunizationRecord,
    ImmunizationStatus,
    MedicationDosage,
    MedicationRecord,
    MedicationStatus,
    ObservationRecord,
    ObservationReferenceRange,
    ObservationStatus,
    ObservationValue,
    PatientClinicalResource,
    ProcedureRecord,
    ProcedureStatus,
    ReactionSeverity,
    SpecimenRecord,
    SpecimenStatus,
} from '../clinical-record';
import {
    createClinicalProvenance,
    createRecordSource,
} from '../clinical-record';
import {
    IPS_CANONICAL_BASE,
    IPS_EXPORT_TAGS,
    IPS_VERSION,
} from './ipsConstants';
import type {
    FhirCodeableConcept,
    FhirDocumentBundle,
    FhirR4Resource,
    IpsValidationResult,
} from './ipsTypes';
import { validateIpsDocumentBundle } from './ipsValidation';

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

const text = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? value.trim() : undefined;

const codeFromConcept = (value: unknown): string | undefined => {
    if (!isObject(value)) return undefined;
    const coding = array(value.coding).find(item =>
        isObject(item) && text(item.code));
    return isObject(coding) ? text(coding.code) : undefined;
};

const clinicalConcept = (
    value: unknown,
): ClinicalCodeableConcept | undefined => {
    if (!isObject(value)) return undefined;
    const codings = array(value.coding).flatMap(item => {
        if (!isObject(item)) return [];
        const code = text(item.code);
        if (!code) return [];
        return [{
            code,
            ...(text(item.system) ? { system: text(item.system) } : {}),
            ...(text(item.version) ? { version: text(item.version) } : {}),
            ...(text(item.display) ? { display: text(item.display) } : {}),
            ...(typeof item.userSelected === 'boolean'
                ? { userSelected: item.userSelected }
                : {}),
        }];
    });
    const conceptText = text(value.text)
        || codings.find(item => item.display)?.display
        || codings[0]?.code;
    if (!conceptText) return undefined;
    return {
        text: conceptText,
        ...(codings.length > 0 ? { coding: codings } : {}),
    };
};

const annotationText = (value: unknown): string | undefined => {
    const notes = array(value).flatMap(item =>
        isObject(item) && text(item.text) ? [text(item.text)!] : []);
    return notes.length > 0 ? notes.join('\n') : undefined;
};

const clinicalDateFromFhir = (
    value: unknown,
    warnings: string[],
    context: string,
): ClinicalDate | undefined => {
    const raw = text(value);
    if (!raw) return undefined;
    const datePart = raw.match(/^\d{4}(?:-\d{2})?(?:-\d{2})?/)?.[0];
    if (!datePart) {
        warnings.push(`${context}: unsupported FHIR date “${raw}” was not imported.`);
        return undefined;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        return { value: datePart, precision: 'day', sourceText: raw };
    }
    if (/^\d{4}-\d{2}$/.test(datePart)) {
        return { value: datePart, precision: 'month', sourceText: raw };
    }
    if (/^\d{4}$/.test(datePart)) {
        return { value: datePart, precision: 'year', sourceText: raw };
    }
    return undefined;
};

const clinicalPeriodFromFhir = (
    value: unknown,
    warnings: string[],
    context: string,
): ClinicalPeriod | undefined => {
    if (!isObject(value)) return undefined;
    const start = clinicalDateFromFhir(value.start, warnings, `${context}.start`);
    const end = clinicalDateFromFhir(value.end, warnings, `${context}.end`);
    return start || end ? {
        ...(start ? { start } : {}),
        ...(end ? { end } : {}),
    } : undefined;
};

const quantityFromFhir = (value: unknown): ClinicalQuantity | undefined => {
    if (!isObject(value) || typeof value.value !== 'number') return undefined;
    const comparator = text(value.comparator);
    return {
        original: {
            value: value.value,
            ...(text(value.unit) ? { unit: text(value.unit) } : {}),
            ...(text(value.system) ? { system: text(value.system) } : {}),
            ...(text(value.code) ? { code: text(value.code) } : {}),
            ...(comparator && ['<', '<=', '>=', '>'].includes(comparator)
                ? { comparator: comparator as '<' | '<=' | '>=' | '>' }
                : {}),
        },
    };
};

const observationValueFromFhir = (
    resource: Record<string, unknown>,
): ObservationValue | undefined => {
    const quantity = quantityFromFhir(resource.valueQuantity);
    if (quantity) return { type: 'quantity', quantity };
    if (typeof resource.valueString === 'string') {
        return { type: 'string', text: resource.valueString };
    }
    if (typeof resource.valueBoolean === 'boolean') {
        return { type: 'boolean', value: resource.valueBoolean };
    }
    if (typeof resource.valueInteger === 'number'
        && Number.isInteger(resource.valueInteger)) {
        return { type: 'integer', value: resource.valueInteger };
    }
    const concept = clinicalConcept(resource.valueCodeableConcept);
    return concept ? { type: 'codeable-concept', concept } : undefined;
};

const baseCandidate = ({
    resource,
    fullUrl,
    patientId,
    now,
    candidateId,
}: {
    resource: FhirR4Resource;
    fullUrl: string;
    patientId: string;
    now: string;
    candidateId: string;
}) => ({
    id: candidateId,
    patientId,
    verificationStatus: 'candidate' as const,
    recordedAt: now,
    provenance: createClinicalProvenance({
        source: createRecordSource({
            kind: 'import',
            externalSystem: IPS_CANONICAL_BASE,
            externalId: fullUrl,
            description: `FHIR R4 International Patient Summary ${IPS_VERSION} import (${resource.resourceType}).`,
        }),
        now,
    }),
    amendments: [],
    tags: [...IPS_EXPORT_TAGS, 'candidate-import'],
});

const referenceValue = (value: unknown): string | undefined =>
    isObject(value) ? text(value.reference) : undefined;

const resolveLocalIds = (
    values: unknown,
    referenceMap: Map<string, string>,
): string[] => array(values).flatMap(item => {
    const reference = referenceValue(item);
    const localId = reference ? referenceMap.get(reference) : undefined;
    return localId ? [localId] : [];
});

const conditionStatus = (value: unknown): ConditionClinicalStatus => {
    const code = codeFromConcept(value);
    return ['active', 'inactive', 'resolved', 'remission'].includes(code || '')
        ? code as ConditionClinicalStatus
        : 'unknown';
};

const allergyStatus = (value: unknown): AllergyClinicalStatus => {
    const code = codeFromConcept(value);
    return ['active', 'inactive', 'resolved'].includes(code || '')
        ? code as AllergyClinicalStatus
        : 'unknown';
};

const medicationStatus = (
    value: unknown,
    kind: 'statement' | 'request',
): MedicationStatus => {
    const status = text(value) || 'unknown';
    if (kind === 'statement') {
        return [
            'active',
            'completed',
            'stopped',
            'on-hold',
            'not-taken',
            'entered-in-error',
            'unknown',
        ].includes(status) ? status as MedicationStatus : 'unknown';
    }
    if (status === 'on-hold') return 'on-hold';
    if (status === 'completed') return 'completed';
    if (status === 'entered-in-error') return 'entered-in-error';
    if (['stopped', 'revoked', 'cancelled'].includes(status)) return 'stopped';
    if (['active', 'draft', 'unknown'].includes(status)) {
        return status === 'draft' ? 'active' : status as MedicationStatus;
    }
    return 'unknown';
};

const procedureStatus = (value: unknown): ProcedureStatus => {
    const status = text(value);
    return [
        'preparation',
        'in-progress',
        'not-done',
        'on-hold',
        'stopped',
        'completed',
        'entered-in-error',
        'unknown',
    ].includes(status || '') ? status as ProcedureStatus : 'unknown';
};

const observationStatus = (value: unknown): ObservationStatus => {
    const status = text(value);
    return [
        'registered',
        'preliminary',
        'final',
        'amended',
        'corrected',
        'cancelled',
        'entered-in-error',
        'unknown',
    ].includes(status || '') ? status as ObservationStatus : 'unknown';
};

const diagnosticReportStatus = (value: unknown): DiagnosticReportStatus => {
    const status = text(value);
    return [
        'registered',
        'partial',
        'preliminary',
        'final',
        'amended',
        'corrected',
        'cancelled',
        'entered-in-error',
        'unknown',
    ].includes(status || '') ? status as DiagnosticReportStatus : 'unknown';
};

const specimenStatus = (value: unknown): SpecimenStatus => {
    const status = text(value);
    return [
        'available',
        'unavailable',
        'unsatisfactory',
        'entered-in-error',
        'unknown',
    ].includes(status || '') ? status as SpecimenStatus : 'unknown';
};

const immunizationStatus = (value: unknown): ImmunizationStatus => {
    const status = text(value);
    return ['completed', 'entered-in-error', 'not-done'].includes(status || '')
        ? status as ImmunizationStatus
        : 'unknown';
};

const medicationDosages = (
    value: unknown,
): MedicationDosage[] => array(value).flatMap(item => {
    if (!isObject(item)) return [];
    const doseAndRate = array(item.doseAndRate)
        .find(entry => isObject(entry) && entry.doseQuantity);
    const dose = isObject(doseAndRate)
        ? quantityFromFhir(doseAndRate.doseQuantity)
        : undefined;
    const route = clinicalConcept(item.route);
    const timing = isObject(item.timing)
        ? clinicalConcept(item.timing.code)?.text
        : undefined;
    const dosageText = text(item.text)
        || [dose?.original.value, dose?.original.unit, route?.text, timing]
            .filter(value => value !== undefined && value !== '')
            .join(' ')
        || 'Dosage details imported from IPS; verify against the source.';
    return [{
        text: dosageText,
        ...(dose ? { dose } : {}),
        ...(route ? { route } : {}),
        ...(timing ? { timingText: timing } : {}),
        ...(typeof item.asNeededBoolean === 'boolean'
            ? { asNeeded: item.asNeededBoolean }
            : {}),
    }];
});

const mapCondition = (
    resource: FhirR4Resource,
    fullUrl: string,
    patientId: string,
    now: string,
    candidateId: string,
    warnings: string[],
): ConditionRecord | null => {
    const value = resource as Record<string, unknown>;
    const code = clinicalConcept(value.code);
    if (!code) {
        warnings.push(`${fullUrl}: Condition skipped because code is missing.`);
        return null;
    }
    return {
        ...baseCandidate({ resource, fullUrl, patientId, now, candidateId }),
        resourceType: 'Condition',
        code,
        clinicalStatus: conditionStatus(value.clinicalStatus),
        ...(clinicalConcept(value.severity)
            ? { severity: clinicalConcept(value.severity) }
            : {}),
        ...(array(value.bodySite).map(clinicalConcept)
            .filter((item): item is ClinicalCodeableConcept => Boolean(item)).length > 0
            ? {
                bodySite: array(value.bodySite).map(clinicalConcept)
                    .filter((item): item is ClinicalCodeableConcept => Boolean(item)),
            }
            : {}),
        ...(clinicalDateFromFhir(value.onsetDateTime, warnings, `${fullUrl}.onset`)
            ? { onset: clinicalDateFromFhir(value.onsetDateTime, warnings, `${fullUrl}.onset`)! }
            : {}),
        ...(clinicalDateFromFhir(value.abatementDateTime, warnings, `${fullUrl}.abatement`)
            ? { abatement: clinicalDateFromFhir(value.abatementDateTime, warnings, `${fullUrl}.abatement`)! }
            : {}),
        ...(annotationText(value.note) ? { note: annotationText(value.note) } : {}),
    };
};

const mapAllergy = (
    resource: FhirR4Resource,
    fullUrl: string,
    patientId: string,
    now: string,
    candidateId: string,
    warnings: string[],
): AllergyIntoleranceRecord | null => {
    const value = resource as Record<string, unknown>;
    const substance = clinicalConcept(value.code);
    if (!substance) {
        warnings.push(`${fullUrl}: AllergyIntolerance skipped because code is missing.`);
        return null;
    }
    const categories = array(value.category).flatMap(item => {
        const category = text(item);
        return ['food', 'medication', 'environment', 'biologic'].includes(category || '')
            ? [category as AllergyCategory]
            : category ? ['other' as AllergyCategory] : [];
    });
    const criticality = text(value.criticality);
    const validCriticality: AllergyCriticality = [
        'low',
        'high',
        'unable-to-assess',
    ].includes(criticality || '')
        ? criticality as AllergyCriticality
        : 'unable-to-assess';

    return {
        ...baseCandidate({ resource, fullUrl, patientId, now, candidateId }),
        resourceType: 'AllergyIntolerance',
        substance,
        clinicalStatus: allergyStatus(value.clinicalStatus),
        criticality: validCriticality,
        categories,
        reactions: array(value.reaction).flatMap(reaction => {
            if (!isObject(reaction)) return [];
            const manifestations = array(reaction.manifestation)
                .map(clinicalConcept)
                .filter((item): item is ClinicalCodeableConcept => Boolean(item));
            if (manifestations.length === 0) return [];
            const severity = text(reaction.severity);
            return [{
                manifestation: manifestations,
                ...(text(reaction.description)
                    ? { description: text(reaction.description) }
                    : {}),
                ...(clinicalDateFromFhir(
                    reaction.onset,
                    warnings,
                    `${fullUrl}.reaction.onset`,
                ) ? {
                    onset: clinicalDateFromFhir(
                        reaction.onset,
                        warnings,
                        `${fullUrl}.reaction.onset`,
                    )!,
                } : {}),
                ...(severity && ['mild', 'moderate', 'severe'].includes(severity)
                    ? { severity: severity as ReactionSeverity }
                    : {}),
                ...(clinicalConcept(reaction.exposureRoute) ? {
                    exposureRoute: clinicalConcept(reaction.exposureRoute),
                } : {}),
            }];
        }),
        ...(clinicalDateFromFhir(
            value.lastOccurrence,
            warnings,
            `${fullUrl}.lastOccurrence`,
        ) ? {
            lastOccurrence: clinicalDateFromFhir(
                value.lastOccurrence,
                warnings,
                `${fullUrl}.lastOccurrence`,
            )!,
        } : {}),
        ...(annotationText(value.note) ? { note: annotationText(value.note) } : {}),
    };
};

const mapMedication = (
    resource: FhirR4Resource,
    fullUrl: string,
    patientId: string,
    now: string,
    candidateId: string,
    warnings: string[],
): MedicationRecord | null => {
    const value = resource as Record<string, unknown>;
    const kind = resource.resourceType === 'MedicationRequest'
        ? 'request' as const
        : 'statement' as const;
    const medication = clinicalConcept(value.medicationCodeableConcept);
    if (!medication) {
        warnings.push(`${fullUrl}: ${resource.resourceType} skipped because medicationCodeableConcept is missing. Referenced standalone Medication resources are not imported in this P1 slice.`);
        return null;
    }
    const effective = clinicalPeriodFromFhir(
        value.effectivePeriod,
        warnings,
        `${fullUrl}.effectivePeriod`,
    );
    const authored = clinicalDateFromFhir(
        value.authoredOn,
        warnings,
        `${fullUrl}.authoredOn`,
    );
    return {
        ...baseCandidate({ resource, fullUrl, patientId, now, candidateId }),
        resourceType: 'Medication',
        kind,
        medication,
        status: medicationStatus(value.status, kind),
        dosageInstructions: medicationDosages(
            kind === 'request' ? value.dosageInstruction : value.dosage,
        ),
        ...(array(value.reasonCode).map(clinicalConcept)
            .filter((item): item is ClinicalCodeableConcept => Boolean(item)).length > 0
            ? {
                reason: array(value.reasonCode).map(clinicalConcept)
                    .filter((item): item is ClinicalCodeableConcept => Boolean(item)),
            }
            : {}),
        ...(effective?.start ? { start: effective.start } : authored ? { start: authored } : {}),
        ...(effective?.end ? { end: effective.end } : {}),
        ...(annotationText(value.note) ? { note: annotationText(value.note) } : {}),
    };
};

const mapProcedure = (
    resource: FhirR4Resource,
    fullUrl: string,
    patientId: string,
    now: string,
    candidateId: string,
    warnings: string[],
): ProcedureRecord | null => {
    const value = resource as Record<string, unknown>;
    const code = clinicalConcept(value.code);
    if (!code) {
        warnings.push(`${fullUrl}: Procedure skipped because code is missing.`);
        return null;
    }
    const performedDate = clinicalDateFromFhir(
        value.performedDateTime,
        warnings,
        `${fullUrl}.performedDateTime`,
    );
    const performedPeriod = clinicalPeriodFromFhir(
        value.performedPeriod,
        warnings,
        `${fullUrl}.performedPeriod`,
    );
    return {
        ...baseCandidate({ resource, fullUrl, patientId, now, candidateId }),
        resourceType: 'Procedure',
        status: procedureStatus(value.status),
        code,
        ...(performedDate ? { performed: performedDate } : performedPeriod ? { performed: performedPeriod } : {}),
        ...(array(value.bodySite).map(clinicalConcept)
            .filter((item): item is ClinicalCodeableConcept => Boolean(item)).length > 0
            ? {
                bodySite: array(value.bodySite).map(clinicalConcept)
                    .filter((item): item is ClinicalCodeableConcept => Boolean(item)),
            }
            : {}),
        ...(array(value.reasonCode).map(clinicalConcept)
            .filter((item): item is ClinicalCodeableConcept => Boolean(item)).length > 0
            ? {
                reason: array(value.reasonCode).map(clinicalConcept)
                    .filter((item): item is ClinicalCodeableConcept => Boolean(item)),
            }
            : {}),
        ...(clinicalConcept(value.outcome) ? { outcome: clinicalConcept(value.outcome) } : {}),
        ...(array(value.complication).map(clinicalConcept)
            .filter((item): item is ClinicalCodeableConcept => Boolean(item)).length > 0
            ? {
                complications: array(value.complication).map(clinicalConcept)
                    .filter((item): item is ClinicalCodeableConcept => Boolean(item)),
            }
            : {}),
        ...(annotationText(value.note) ? { note: annotationText(value.note) } : {}),
    };
};

const mapImmunization = (
    resource: FhirR4Resource,
    fullUrl: string,
    patientId: string,
    now: string,
    candidateId: string,
    warnings: string[],
): ImmunizationRecord | null => {
    const value = resource as Record<string, unknown>;
    const vaccineCode = clinicalConcept(value.vaccineCode);
    if (!vaccineCode) {
        warnings.push(`${fullUrl}: Immunization skipped because vaccineCode is missing.`);
        return null;
    }
    const occurrence = clinicalDateFromFhir(
        value.occurrenceDateTime,
        warnings,
        `${fullUrl}.occurrenceDateTime`,
    );
    return {
        ...baseCandidate({ resource, fullUrl, patientId, now, candidateId }),
        resourceType: 'Immunization',
        status: immunizationStatus(value.status),
        vaccineCode,
        ...(occurrence ? { occurrence } : {}),
        ...(text(value.lotNumber) ? { lotNumber: text(value.lotNumber) } : {}),
        ...(quantityFromFhir(value.doseQuantity)
            ? { doseQuantity: quantityFromFhir(value.doseQuantity) }
            : {}),
        ...(clinicalConcept(value.site) ? { site: clinicalConcept(value.site) } : {}),
        ...(clinicalConcept(value.route) ? { route: clinicalConcept(value.route) } : {}),
        ...(array(value.reasonCode).map(clinicalConcept)
            .filter((item): item is ClinicalCodeableConcept => Boolean(item)).length > 0
            ? {
                reason: array(value.reasonCode).map(clinicalConcept)
                    .filter((item): item is ClinicalCodeableConcept => Boolean(item)),
            }
            : {}),
        ...(annotationText(value.note) ? { note: annotationText(value.note) } : {}),
    };
};

const mapObservation = (
    resource: FhirR4Resource,
    fullUrl: string,
    patientId: string,
    now: string,
    candidateId: string,
    referenceMap: Map<string, string>,
    warnings: string[],
): ObservationRecord | null => {
    const value = resource as Record<string, unknown>;
    const code = clinicalConcept(value.code);
    if (!code) {
        warnings.push(`${fullUrl}: Observation skipped because code is missing.`);
        return null;
    }
    const date = clinicalDateFromFhir(
        value.effectiveDateTime,
        warnings,
        `${fullUrl}.effectiveDateTime`,
    );
    const period = clinicalPeriodFromFhir(
        value.effectivePeriod,
        warnings,
        `${fullUrl}.effectivePeriod`,
    );
    const specimenReference = referenceValue(value.specimen);
    const ranges: ObservationReferenceRange[] = array(value.referenceRange)
        .flatMap(item => {
            if (!isObject(item)) return [];
            const low = quantityFromFhir(item.low)?.original;
            const high = quantityFromFhir(item.high)?.original;
            const appliesTo = array(item.appliesTo).map(clinicalConcept)
                .filter((entry): entry is ClinicalCodeableConcept => Boolean(entry));
            return [{
                ...(low ? { low } : {}),
                ...(high ? { high } : {}),
                ...(text(item.text) ? { text: text(item.text) } : {}),
                ...(appliesTo.length > 0 ? { appliesTo } : {}),
            }];
        });

    return {
        ...baseCandidate({ resource, fullUrl, patientId, now, candidateId }),
        resourceType: 'Observation',
        status: observationStatus(value.status),
        ...(array(value.category).map(clinicalConcept)
            .filter((item): item is ClinicalCodeableConcept => Boolean(item)).length > 0
            ? {
                category: array(value.category).map(clinicalConcept)
                    .filter((item): item is ClinicalCodeableConcept => Boolean(item)),
            }
            : {}),
        code,
        ...(observationValueFromFhir(value)
            ? { value: observationValueFromFhir(value) }
            : {}),
        ...(array(value.interpretation).map(clinicalConcept)
            .filter((item): item is ClinicalCodeableConcept => Boolean(item)).length > 0
            ? {
                interpretation: array(value.interpretation).map(clinicalConcept)
                    .filter((item): item is ClinicalCodeableConcept => Boolean(item)),
            }
            : {}),
        referenceRanges: ranges,
        ...(specimenReference && referenceMap.get(specimenReference)
            ? { specimenId: referenceMap.get(specimenReference) }
            : {}),
        ...(date ? { effective: date } : period ? { effective: period } : {}),
        ...(text(value.issued) ? { issuedAt: text(value.issued) } : {}),
        ...(array(value.performer).flatMap(item =>
            isObject(item) && text(item.display) ? [text(item.display)!] : []).length > 0
            ? {
                performer: array(value.performer).flatMap(item =>
                    isObject(item) && text(item.display) ? [text(item.display)!] : []),
            }
            : {}),
        ...(annotationText(value.note) ? { note: annotationText(value.note) } : {}),
    };
};

const mapDiagnosticReport = (
    resource: FhirR4Resource,
    fullUrl: string,
    patientId: string,
    now: string,
    candidateId: string,
    referenceMap: Map<string, string>,
    warnings: string[],
): DiagnosticReportRecord | null => {
    const value = resource as Record<string, unknown>;
    const code = clinicalConcept(value.code);
    if (!code) {
        warnings.push(`${fullUrl}: DiagnosticReport skipped because code is missing.`);
        return null;
    }
    return {
        ...baseCandidate({ resource, fullUrl, patientId, now, candidateId }),
        resourceType: 'DiagnosticReport',
        status: diagnosticReportStatus(value.status),
        code,
        ...(array(value.category).map(clinicalConcept)
            .filter((item): item is ClinicalCodeableConcept => Boolean(item)).length > 0
            ? {
                category: array(value.category).map(clinicalConcept)
                    .filter((item): item is ClinicalCodeableConcept => Boolean(item)),
            }
            : {}),
        ...(clinicalPeriodFromFhir(
            value.effectivePeriod,
            warnings,
            `${fullUrl}.effectivePeriod`,
        ) ? {
            effectivePeriod: clinicalPeriodFromFhir(
                value.effectivePeriod,
                warnings,
                `${fullUrl}.effectivePeriod`,
            ),
        } : {}),
        ...(text(value.issued) ? { issuedAt: text(value.issued) } : {}),
        resultIds: resolveLocalIds(value.result, referenceMap),
        specimenIds: resolveLocalIds(value.specimen, referenceMap),
        documentIds: [],
        ...(text(value.conclusion) ? { conclusion: text(value.conclusion) } : {}),
        ...(array(value.conclusionCode).map(clinicalConcept)
            .filter((item): item is ClinicalCodeableConcept => Boolean(item)).length > 0
            ? {
                conclusionCodes: array(value.conclusionCode).map(clinicalConcept)
                    .filter((item): item is ClinicalCodeableConcept => Boolean(item)),
            }
            : {}),
        ...(array(value.performer).flatMap(item =>
            isObject(item) && text(item.display) ? [text(item.display)!] : []).length > 0
            ? {
                performer: array(value.performer).flatMap(item =>
                    isObject(item) && text(item.display) ? [text(item.display)!] : []),
            }
            : {}),
    };
};

const mapSpecimen = (
    resource: FhirR4Resource,
    fullUrl: string,
    patientId: string,
    now: string,
    candidateId: string,
    warnings: string[],
): SpecimenRecord => {
    const value = resource as Record<string, unknown>;
    const collection = isObject(value.collection) ? value.collection : {};
    return {
        ...baseCandidate({ resource, fullUrl, patientId, now, candidateId }),
        resourceType: 'Specimen',
        status: specimenStatus(value.status),
        ...(clinicalConcept(value.type) ? { type: clinicalConcept(value.type) } : {}),
        ...(clinicalDateFromFhir(
            collection.collectedDateTime,
            warnings,
            `${fullUrl}.collection.collectedDateTime`,
        ) ? {
            collectedAt: clinicalDateFromFhir(
                collection.collectedDateTime,
                warnings,
                `${fullUrl}.collection.collectedDateTime`,
            ),
        } : {}),
        ...(clinicalDateFromFhir(
            value.receivedTime,
            warnings,
            `${fullUrl}.receivedTime`,
        ) ? {
            receivedAt: clinicalDateFromFhir(
                value.receivedTime,
                warnings,
                `${fullUrl}.receivedTime`,
            ),
        } : {}),
        ...(clinicalConcept(collection.bodySite)
            ? { bodySite: clinicalConcept(collection.bodySite) }
            : {}),
        ...(clinicalConcept(collection.method)
            ? { collectionMethod: clinicalConcept(collection.method) }
            : {}),
        ...(annotationText(value.note) ? { note: annotationText(value.note) } : {}),
    };
};

export interface IpsPatientImportPreview {
    sourceFullUrl: string;
    displayName: string;
    birthDate?: string;
    gender?: string;
    identifiers: Array<{ system?: string; value: string }>;
}

export interface IpsImportPreview {
    bundle?: FhirDocumentBundle;
    validation: IpsValidationResult;
    patient?: IpsPatientImportPreview;
    candidates: PatientClinicalResource[];
    skippedResourceTypes: Record<string, number>;
    warnings: string[];
    limitations: string[];
}

const emptyValidation = (message: string): IpsValidationResult => ({
    valid: false,
    errors: [{
        severity: 'error',
        code: 'invalid-json',
        path: 'Bundle',
        message,
    }],
    warnings: [],
    summary: {
        entries: 0,
        sections: 0,
        requiredSectionsPresent: 0,
        unresolvedReferences: 0,
    },
});

const patientPreview = (
    resource: FhirR4Resource,
    fullUrl: string,
): IpsPatientImportPreview => {
    const value = resource as Record<string, unknown>;
    const name = array(value.name).find(isObject);
    const given = isObject(name)
        ? array(name.given).map(text).filter((item): item is string => Boolean(item))
        : [];
    const displayName = isObject(name)
        ? text(name.text)
            || [...given, text(name.family)].filter(Boolean).join(' ')
            || 'Unnamed IPS patient'
        : 'Unnamed IPS patient';
    return {
        sourceFullUrl: fullUrl,
        displayName,
        ...(text(value.birthDate) ? { birthDate: text(value.birthDate) } : {}),
        ...(text(value.gender) ? { gender: text(value.gender) } : {}),
        identifiers: array(value.identifier).flatMap(item => {
            if (!isObject(item) || !text(item.value)) return [];
            return [{
                ...(text(item.system) ? { system: text(item.system) } : {}),
                value: text(item.value)!,
            }];
        }),
    };
};

export const parseIpsImport = (
    input: string | unknown,
    patientId: string,
    importedAt = new Date().toISOString(),
): IpsImportPreview => {
    let payload: unknown = input;
    if (typeof input === 'string') {
        try {
            payload = JSON.parse(input) as unknown;
        } catch {
            return {
                validation: emptyValidation('The selected file is not valid JSON.'),
                candidates: [],
                skippedResourceTypes: {},
                warnings: [],
                limitations: [
                    'No local record was changed.',
                ],
            };
        }
    }

    const validation = validateIpsDocumentBundle(payload);
    if (!validation.valid) {
        return {
            validation,
            candidates: [],
            skippedResourceTypes: {},
            warnings: validation.warnings.map(issue => issue.message),
            limitations: [
                'The bundle failed local IPS structural validation and was not converted into candidate records.',
                'No local record was changed.',
            ],
        };
    }

    const bundle = payload as FhirDocumentBundle;
    const supported = new Set([
        'Condition',
        'AllergyIntolerance',
        'MedicationStatement',
        'MedicationRequest',
        'Procedure',
        'Immunization',
        'Observation',
        'DiagnosticReport',
        'Specimen',
    ]);
    const candidateIdByFullUrl = new Map<string, string>();
    const referenceMap = new Map<string, string>();
    bundle.entry.forEach(entry => {
        if (!supported.has(entry.resource.resourceType)) return;
        const candidateId = uuidv4();
        candidateIdByFullUrl.set(entry.fullUrl, candidateId);
        referenceMap.set(entry.fullUrl, candidateId);
        if (entry.resource.id) {
            referenceMap.set(
                `${entry.resource.resourceType}/${entry.resource.id}`,
                candidateId,
            );
        }
    });

    const warnings = validation.warnings.map(issue => issue.message);
    const skippedResourceTypes: Record<string, number> = {};
    let patient: IpsPatientImportPreview | undefined;
    const candidates: PatientClinicalResource[] = [];

    bundle.entry.forEach(entry => {
        const resource = entry.resource;
        if (resource.resourceType === 'Patient' && !patient) {
            patient = patientPreview(resource, entry.fullUrl);
            return;
        }
        const candidateId = candidateIdByFullUrl.get(entry.fullUrl);
        if (!candidateId) {
            if (!['Composition', 'Device', 'Patient', 'Practitioner', 'PractitionerRole', 'Organization', 'Medication'].includes(resource.resourceType)) {
                skippedResourceTypes[resource.resourceType] =
                    (skippedResourceTypes[resource.resourceType] || 0) + 1;
            }
            return;
        }

        let mapped: PatientClinicalResource | null = null;
        switch (resource.resourceType) {
            case 'Condition':
                mapped = mapCondition(
                    resource,
                    entry.fullUrl,
                    patientId,
                    importedAt,
                    candidateId,
                    warnings,
                );
                break;
            case 'AllergyIntolerance':
                mapped = mapAllergy(
                    resource,
                    entry.fullUrl,
                    patientId,
                    importedAt,
                    candidateId,
                    warnings,
                );
                break;
            case 'MedicationStatement':
            case 'MedicationRequest':
                mapped = mapMedication(
                    resource,
                    entry.fullUrl,
                    patientId,
                    importedAt,
                    candidateId,
                    warnings,
                );
                break;
            case 'Procedure':
                mapped = mapProcedure(
                    resource,
                    entry.fullUrl,
                    patientId,
                    importedAt,
                    candidateId,
                    warnings,
                );
                break;
            case 'Immunization':
                mapped = mapImmunization(
                    resource,
                    entry.fullUrl,
                    patientId,
                    importedAt,
                    candidateId,
                    warnings,
                );
                break;
            case 'Observation':
                mapped = mapObservation(
                    resource,
                    entry.fullUrl,
                    patientId,
                    importedAt,
                    candidateId,
                    referenceMap,
                    warnings,
                );
                break;
            case 'DiagnosticReport':
                mapped = mapDiagnosticReport(
                    resource,
                    entry.fullUrl,
                    patientId,
                    importedAt,
                    candidateId,
                    referenceMap,
                    warnings,
                );
                break;
            case 'Specimen':
                mapped = mapSpecimen(
                    resource,
                    entry.fullUrl,
                    patientId,
                    importedAt,
                    candidateId,
                    warnings,
                );
                break;
        }
        if (mapped) candidates.push(mapped);
        else {
            skippedResourceTypes[resource.resourceType] =
                (skippedResourceTypes[resource.resourceType] || 0) + 1;
        }
    });

    return {
        bundle,
        validation,
        ...(patient ? { patient } : {}),
        candidates,
        skippedResourceTypes,
        warnings,
        limitations: [
            'Imported clinical resources are candidates only and require source review before confirmation.',
            'The IPS Patient resource is shown for identity comparison but does not overwrite the active MediBrief patient profile.',
            'Unsupported resources are preserved in the original file but are not silently converted into local clinical facts.',
            'Successful structural validation does not establish patient identity, terminology equivalence, clinical accuracy, or source authenticity.',
        ],
    };
};
