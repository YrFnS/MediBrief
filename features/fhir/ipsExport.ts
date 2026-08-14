import { v5 as uuidv5 } from 'uuid';
import type {
    AllergyIntoleranceRecord,
    ClinicalCodeableConcept,
    ClinicalDate,
    ClinicalPeriod,
    ClinicalQuantityValue,
    ConditionRecord,
    DiagnosticReportRecord,
    ImmunizationRecord,
    MedicationRecord,
    ObservationRecord,
    ObservationValue,
    PatientClinicalRecord,
    PatientProfileRecord,
    ProcedureRecord,
    SpecimenRecord,
} from '../clinical-record';
import {
    flattenPatientResources,
    isConfirmedPatientFact,
    selectConfirmedResources,
} from '../clinical-record';
import {
    FHIR_PROFILES,
    FHIR_R4_VERSION,
    FHIR_SYSTEMS,
    IPS_DOCUMENT_TYPE,
    IPS_PACKAGE,
    IPS_PROFILES,
    IPS_SECTIONS,
    IPS_VERSION,
    MEDIBRIEF_FHIR_IDENTIFIER_BASE,
    MEDIBRIEF_IPS_UUID_NAMESPACE,
    type IpsSectionDefinition,
} from './ipsConstants';
import type {
    FhirCodeableConcept,
    FhirCoding,
    FhirComposition,
    FhirCompositionSection,
    FhirDocumentBundle,
    FhirNarrative,
    FhirQuantity,
    FhirR4Resource,
    IpsExportResult,
} from './ipsTypes';
import { validateIpsDocumentBundle } from './ipsValidation';

const escapeHtml = (value: unknown): string => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const narrative = (html: string): FhirNarrative => ({
    status: 'generated',
    div: `<div xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">${html}</div>`,
});

const profileMeta = (profile: string) => ({ profile: [profile] });

const deterministicId = (kind: string, sourceId: string): string =>
    uuidv5(`${kind}:${sourceId}`, MEDIBRIEF_IPS_UUID_NAMESPACE);

const fullUrl = (kind: string, sourceId: string): string =>
    `urn:uuid:${deterministicId(kind, sourceId)}`;

const clinicalDate = (value?: ClinicalDate): string | undefined => {
    if (!value || value.precision === 'unknown' || !value.value) return undefined;
    return value.value;
};

const clinicalPeriod = (value?: ClinicalPeriod): Record<string, string> | undefined => {
    if (!value) return undefined;
    const start = clinicalDate(value.start);
    const end = clinicalDate(value.end);
    return start || end ? {
        ...(start ? { start } : {}),
        ...(end ? { end } : {}),
    } : undefined;
};

const effectiveValue = (
    value?: ClinicalDate | ClinicalPeriod,
): { effectiveDateTime?: string; effectivePeriod?: Record<string, string> } => {
    if (!value) return {};
    if ('precision' in value) {
        const date = clinicalDate(value);
        return date ? { effectiveDateTime: date } : {};
    }
    const period = clinicalPeriod(value);
    return period ? { effectivePeriod: period } : {};
};

const toCoding = (coding: ClinicalCodeableConcept['coding']): FhirCoding[] | undefined => {
    const converted = (coding || [])
        .filter(item => Boolean(item.code?.trim()))
        .map(item => ({
            ...(item.system ? { system: item.system } : {}),
            ...(item.version ? { version: item.version } : {}),
            code: item.code,
            ...(item.display ? { display: item.display } : {}),
            ...(item.userSelected !== undefined
                ? { userSelected: item.userSelected }
                : {}),
        }));
    return converted.length > 0 ? converted : undefined;
};

const toConcept = (concept: ClinicalCodeableConcept): FhirCodeableConcept => {
    const coding = toCoding(concept.coding);
    return {
        ...(coding ? { coding } : {}),
        text: concept.text,
    };
};

const toQuantity = (
    quantity: ClinicalQuantityValue,
    warnings: string[],
    context: string,
): FhirQuantity => {
    const isUcum = quantity.system === FHIR_SYSTEMS.ucum;
    if ((quantity.code || quantity.system) && !isUcum) {
        warnings.push(
            `${context}: non-UCUM quantity coding was omitted from the interoperable value; the original display unit was preserved.`,
        );
    }
    return {
        value: quantity.value,
        ...(quantity.comparator ? { comparator: quantity.comparator } : {}),
        ...(quantity.unit ? { unit: quantity.unit } : {}),
        ...(isUcum && quantity.code
            ? { system: FHIR_SYSTEMS.ucum, code: quantity.code }
            : {}),
    };
};

const observationValue = (
    value: ObservationValue | undefined,
    warnings: string[],
    context: string,
): Record<string, unknown> => {
    if (!value) return {};
    switch (value.type) {
        case 'quantity':
            return {
                valueQuantity: toQuantity(
                    value.quantity.original,
                    warnings,
                    context,
                ),
            };
        case 'string':
            return { valueString: value.text };
        case 'boolean':
            return { valueBoolean: value.value };
        case 'integer':
            return { valueInteger: value.value };
        case 'codeable-concept':
            return { valueCodeableConcept: toConcept(value.concept) };
        default:
            return {};
    }
};

const notes = (note?: string): Array<{ text: string }> | undefined =>
    note?.trim() ? [{ text: note.trim() }] : undefined;

const displayReferences = (values?: string[]) => {
    const references = (values || [])
        .map(value => value.trim())
        .filter(Boolean)
        .map(display => ({ display }));
    return references.length > 0 ? references : undefined;
};

const patientName = (profile: PatientProfileRecord) => {
    const tokens = profile.displayName.trim().split(/\s+/).filter(Boolean);
    const family = tokens.length > 1 ? tokens[tokens.length - 1] : tokens[0];
    const given = tokens.length > 1 ? tokens.slice(0, -1) : tokens;
    return {
        use: 'usual',
        text: profile.displayName,
        ...(family ? { family } : {}),
        ...(given.length > 0 ? { given } : {}),
    };
};

const patientNarrative = (profile: PatientProfileRecord): FhirNarrative => narrative([
    `<p><strong>${escapeHtml(profile.displayName)}</strong></p>`,
    profile.dateOfBirth?.value
        ? `<p>Date of birth: ${escapeHtml(profile.dateOfBirth.value)}</p>`
        : '<p>Date of birth: not available in the confirmed local record.</p>',
    profile.administrativeSex
        ? `<p>Administrative sex: ${escapeHtml(profile.administrativeSex)}</p>`
        : '',
].join(''));

const placeholderIdentifierSystem = (system?: string): boolean =>
    Boolean(system && /^https?:\/\/(?:[^/]+\.)?example\.(?:com|org|net)(?:[/:]|$)/i.test(system));

const patientIdentifierType = (
    value?: string,
): FhirCodeableConcept | undefined => {
    const text = value?.trim();
    if (!text) return undefined;
    const normalizedType = text.toLowerCase();
    const match = normalizedType.includes('medical record')
        || normalizedType === 'mrn'
        ? { code: 'MR', display: 'Medical record number' }
        : normalizedType.includes('national')
            ? { code: 'NI', display: 'National unique individual identifier' }
            : normalizedType.includes('passport')
                ? { code: 'PPN', display: 'Passport number' }
                : normalizedType.includes('patient')
                    ? { code: 'PI', display: 'Patient internal identifier' }
                    : undefined;
    return match ? {
        coding: [{
            system: FHIR_SYSTEMS.identifierType,
            code: match.code,
            display: match.display,
        }],
        text,
    } : { text };
};

const buildPatient = (
    profile: PatientProfileRecord,
    warnings: string[],
): FhirR4Resource => {
    const id = deterministicId('Patient', profile.id);
    const identifiers = profile.identifiers.length > 0
        ? profile.identifiers.map(identifier => {
            const type = patientIdentifierType(identifier.type);
            const system = placeholderIdentifierSystem(identifier.system)
                ? undefined
                : identifier.system;
            if (identifier.system && !system) {
                warnings.push(
                    `Patient identifier ${identifier.value}: placeholder system ${identifier.system} was omitted; the identifier value and type were preserved.`,
                );
            }
            return {
                ...(identifier.use ? { use: identifier.use } : {}),
                ...(type ? { type } : {}),
                ...(system ? { system } : {}),
                value: identifier.value,
            };
        })
        : [{
            type: {
                coding: [{
                    system: FHIR_SYSTEMS.identifierType,
                    code: 'PI',
                    display: 'Patient internal identifier',
                }],
                text: 'MediBrief patient identifier',
            },
            system: `${MEDIBRIEF_FHIR_IDENTIFIER_BASE}/patient`,
            value: profile.patientId,
        }];

    const language = profile.preferredLanguage?.trim();
    const bcp47 = language && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(language)
        ? language
        : undefined;
    if (language && !bcp47) {
        warnings.push(
            `Patient preferred language “${language}” was retained only in narrative because it is not a recognized BCP 47-style code.`,
        );
    }

    return {
        resourceType: 'Patient',
        id,
        meta: profileMeta(IPS_PROFILES.patient),
        text: patientNarrative(profile),
        identifier: identifiers,
        active: true,
        name: [patientName(profile)],
        ...(profile.contacts.length > 0 ? {
            telecom: profile.contacts.map(contact => ({
                system: contact.system,
                value: contact.value,
                ...(contact.use ? { use: contact.use } : {}),
            })),
        } : {}),
        ...(profile.administrativeSex
            ? { gender: profile.administrativeSex }
            : {}),
        ...(clinicalDate(profile.dateOfBirth)
            ? { birthDate: clinicalDate(profile.dateOfBirth) }
            : {}),
        ...(profile.deceased !== undefined
            ? { deceasedBoolean: profile.deceased }
            : {}),
        ...(profile.addresses.length > 0 ? {
            address: profile.addresses.map(address => ({
                ...(address.text ? { text: address.text } : {}),
                ...(address.lines ? { line: address.lines } : {}),
                ...(address.city ? { city: address.city } : {}),
                ...(address.district ? { district: address.district } : {}),
                ...(address.state ? { state: address.state } : {}),
                ...(address.postalCode ? { postalCode: address.postalCode } : {}),
                ...(address.country ? { country: address.country } : {}),
            })),
        } : {}),
        ...(language ? {
            communication: [{
                language: bcp47
                    ? {
                        coding: [{
                            system: FHIR_SYSTEMS.language,
                            code: bcp47,
                            display: language,
                        }],
                        text: language,
                    }
                    : { text: language },
                preferred: true,
            }],
        } : {}),
    };
};

const buildAuthorDevice = (): FhirR4Resource => ({
    resourceType: 'Device',
    id: deterministicId('Device', 'medibrief-ips-generator'),
    meta: profileMeta(IPS_PROFILES.device),
    text: narrative(
        '<p>MediBrief local International Patient Summary generator.</p>',
    ),
    status: 'active',
    type: {
        text: 'Personal health record software',
    },
    deviceName: [{
        name: 'MediBrief',
        type: 'model-name',
    }],
    version: [{ value: `IPS ${IPS_VERSION}` }],
});

const conditionClinicalStatus = (condition: ConditionRecord) =>
    condition.clinicalStatus === 'unknown' ? undefined : {
        coding: [{
            system: FHIR_SYSTEMS.conditionClinical,
            code: condition.clinicalStatus,
            display: condition.clinicalStatus,
        }],
    };

const conditionResource = (
    condition: ConditionRecord,
    patientReference: string,
): FhirR4Resource => ({
    resourceType: 'Condition',
    id: deterministicId('Condition', condition.id),
    meta: profileMeta(IPS_PROFILES.condition),
    text: narrative(`<p>${escapeHtml(condition.code.text)}</p>`),
    ...(conditionClinicalStatus(condition)
        ? { clinicalStatus: conditionClinicalStatus(condition) }
        : {}),
    verificationStatus: {
        coding: [{
            system: FHIR_SYSTEMS.conditionVerification,
            code: 'confirmed',
            display: 'Confirmed',
        }],
    },
    code: toConcept(condition.code),
    subject: { reference: patientReference },
    ...(condition.severity ? { severity: toConcept(condition.severity) } : {}),
    ...(condition.bodySite && condition.bodySite.length > 0
        ? { bodySite: condition.bodySite.map(toConcept) }
        : {}),
    ...(clinicalDate(condition.onset)
        ? { onsetDateTime: clinicalDate(condition.onset) }
        : {}),
    ...(clinicalDate(condition.abatement)
        ? { abatementDateTime: clinicalDate(condition.abatement) }
        : {}),
    recordedDate: condition.recordedAt,
    ...(notes(condition.note) ? { note: notes(condition.note) } : {}),
});

const allergyResource = (
    allergy: AllergyIntoleranceRecord,
    patientReference: string,
): FhirR4Resource => {
    const clinicalStatus = allergy.clinicalStatus === 'unknown'
        ? undefined
        : {
            coding: [{
                system: FHIR_SYSTEMS.allergyClinical,
                code: allergy.clinicalStatus,
                display: allergy.clinicalStatus,
            }],
        };
    const categories = allergy.categories.filter(category =>
        category !== 'other');

    return {
        resourceType: 'AllergyIntolerance',
        id: deterministicId('AllergyIntolerance', allergy.id),
        meta: profileMeta(IPS_PROFILES.allergyIntolerance),
        text: narrative(`<p>${escapeHtml(allergy.substance.text)}</p>`),
        ...(clinicalStatus ? { clinicalStatus } : {}),
        verificationStatus: {
            coding: [{
                system: FHIR_SYSTEMS.allergyVerification,
                code: 'confirmed',
                display: 'Confirmed',
            }],
        },
        type: 'allergy',
        ...(categories.length > 0 ? { category: categories } : {}),
        criticality: allergy.criticality,
        code: toConcept(allergy.substance),
        patient: { reference: patientReference },
        recordedDate: allergy.recordedAt,
        ...(clinicalDate(allergy.lastOccurrence)
            ? { lastOccurrence: clinicalDate(allergy.lastOccurrence) }
            : {}),
        ...(allergy.reactions.length > 0 ? {
            reaction: allergy.reactions.map(reaction => ({
                manifestation: reaction.manifestation.map(toConcept),
                ...(reaction.description
                    ? { description: reaction.description }
                    : {}),
                ...(clinicalDate(reaction.onset)
                    ? { onset: clinicalDate(reaction.onset) }
                    : {}),
                ...(reaction.severity && reaction.severity !== 'unknown'
                    ? { severity: reaction.severity }
                    : {}),
                ...(reaction.exposureRoute
                    ? { exposureRoute: toConcept(reaction.exposureRoute) }
                    : {}),
            })),
        } : {}),
        ...(notes(allergy.note) ? { note: notes(allergy.note) } : {}),
    };
};

const medicationResource = (
    medication: MedicationRecord,
    patientReference: string,
    warnings: string[],
): FhirR4Resource => ({
    resourceType: 'MedicationStatement',
    id: deterministicId('MedicationStatement', medication.id),
    meta: profileMeta(IPS_PROFILES.medicationStatement),
    text: narrative(`<p>${escapeHtml(medication.medication.text)}</p>`),
    status: medication.status,
    medicationCodeableConcept: toConcept(medication.medication),
    subject: { reference: patientReference },
    ...(medication.start || medication.end ? {
        effectivePeriod: {
            ...(clinicalDate(medication.start)
                ? { start: clinicalDate(medication.start) }
                : {}),
            ...(clinicalDate(medication.end)
                ? { end: clinicalDate(medication.end) }
                : {}),
        },
    } : {}),
    dateAsserted: medication.recordedAt,
    ...(medication.reason && medication.reason.length > 0
        ? { reasonCode: medication.reason.map(toConcept) }
        : {}),
    ...(medication.dosageInstructions.length > 0 ? {
        dosage: medication.dosageInstructions.map((dosage, index) => {
            if (dosage.maximumDosePerPeriod) {
                warnings.push(
                    `${medication.medication.text} dosage ${index + 1}: maximumDosePerPeriod was not exported because the local period is free text and cannot be safely converted to a FHIR Ratio.`,
                );
            }
            const timingText = [dosage.frequency, dosage.timingText]
                .filter(Boolean).join(' · ');
            return {
                text: dosage.text,
                ...(timingText
                    ? { timing: { code: { text: timingText } } }
                    : {}),
                ...(dosage.asNeeded !== undefined
                    ? { asNeededBoolean: dosage.asNeeded }
                    : {}),
                ...(dosage.route ? { route: toConcept(dosage.route) } : {}),
                ...(dosage.dose ? {
                    doseAndRate: [{
                        doseQuantity: toQuantity(
                            dosage.dose.original,
                            warnings,
                            `${medication.medication.text} dosage ${index + 1}`,
                        ),
                    }],
                } : {}),
            };
        }),
    } : {}),
    ...(notes(medication.note) ? { note: notes(medication.note) } : {}),
});

const procedureResource = (
    procedure: ProcedureRecord,
    patientReference: string,
): FhirR4Resource => ({
    resourceType: 'Procedure',
    id: deterministicId('Procedure', procedure.id),
    meta: profileMeta(IPS_PROFILES.procedure),
    text: narrative(`<p>${escapeHtml(procedure.code.text)}</p>`),
    status: procedure.status,
    code: toConcept(procedure.code),
    subject: { reference: patientReference },
    ...(() => {
        if (!procedure.performed) return {};
        if ('precision' in procedure.performed) {
            const date = clinicalDate(procedure.performed);
            return date ? { performedDateTime: date } : {};
        }
        const period = clinicalPeriod(procedure.performed);
        return period ? { performedPeriod: period } : {};
    })(),
    ...(procedure.bodySite && procedure.bodySite.length > 0
        ? { bodySite: procedure.bodySite.map(toConcept) }
        : {}),
    ...(procedure.reason && procedure.reason.length > 0
        ? { reasonCode: procedure.reason.map(toConcept) }
        : {}),
    ...(procedure.outcome ? { outcome: toConcept(procedure.outcome) } : {}),
    ...(procedure.complications && procedure.complications.length > 0
        ? { complication: procedure.complications.map(toConcept) }
        : {}),
    ...(displayReferences(procedure.performer) ? {
        performer: displayReferences(procedure.performer)!.map(actor => ({
            actor,
        })),
    } : {}),
    ...(notes(procedure.note) ? { note: notes(procedure.note) } : {}),
});

const immunizationResource = (
    immunization: ImmunizationRecord,
    patientReference: string,
    warnings: string[],
): FhirR4Resource | null => {
    const occurrence = clinicalDate(immunization.occurrence);
    if (!occurrence) {
        warnings.push(
            `${immunization.vaccineCode.text}: immunization excluded because IPS/FHIR requires an occurrence value and the confirmed local clinical date is unknown.`,
        );
        return null;
    }
    if (!['completed', 'not-done'].includes(immunization.status)) {
        warnings.push(
            `${immunization.vaccineCode.text}: immunization excluded because local status “${immunization.status}” cannot be represented as an active IPS Immunization event.`,
        );
        return null;
    }
    return {
        resourceType: 'Immunization',
        id: deterministicId('Immunization', immunization.id),
        meta: profileMeta(IPS_PROFILES.immunization),
        text: narrative(`<p>${escapeHtml(immunization.vaccineCode.text)} — ${escapeHtml(occurrence)}</p>`),
        status: immunization.status,
        vaccineCode: toConcept(immunization.vaccineCode),
        patient: { reference: patientReference },
        occurrenceDateTime: occurrence,
        primarySource: false,
        ...(immunization.lotNumber ? { lotNumber: immunization.lotNumber } : {}),
        ...(immunization.doseQuantity ? {
            doseQuantity: toQuantity(
                immunization.doseQuantity.original,
                warnings,
                immunization.vaccineCode.text,
            ),
        } : {}),
        ...(immunization.site ? { site: toConcept(immunization.site) } : {}),
        ...(immunization.route ? { route: toConcept(immunization.route) } : {}),
        ...(immunization.reason && immunization.reason.length > 0
            ? { reasonCode: immunization.reason.map(toConcept) }
            : {}),
        ...(notes(immunization.note) ? { note: notes(immunization.note) } : {}),
    };
};

const VITAL_LOINC_CODES = new Set([
    '8310-5',
    '8867-4',
    '2708-6',
    '59408-5',
    '8480-6',
    '8462-4',
    '85354-9',
    '29463-7',
    '8302-2',
    '39156-5',
    '9279-1',
]);

const normalized = (value?: string): string =>
    (value || '').trim().toLowerCase();

const conceptContains = (
    concept: ClinicalCodeableConcept | undefined,
    terms: string[],
): boolean => {
    if (!concept) return false;
    const haystack = [
        concept.text,
        ...(concept.coding || []).flatMap(coding => [
            coding.code,
            coding.display || '',
        ]),
    ].join(' ').toLowerCase();
    return terms.some(term => haystack.includes(term));
};

export type IpsObservationClass = 'vital-signs' | 'laboratory' | 'radiology';

export const classifyObservationForIps = (
    observation: ObservationRecord,
): IpsObservationClass | null => {
    const loincCodes = new Set<string>((observation.code.coding || [])
        .filter(coding => normalized(coding.system).includes('loinc'))
        .map(coding => coding.code));
    const categories = observation.category || [];
    const categoryCodes = new Set<string>(categories.flatMap(category =>
        (category.coding || []).map(coding => normalized(coding.code))));

    if (
        [...loincCodes].some(code => VITAL_LOINC_CODES.has(code))
        || categoryCodes.has('vital-signs')
        || categories.some(category => conceptContains(category, [
            'vital sign',
            'heart rate',
            'blood pressure',
            'temperature',
            'oxygen saturation',
        ]))
    ) return 'vital-signs';

    if (
        categoryCodes.has('imaging')
        || categoryCodes.has('radiology')
        || categories.some(category => conceptContains(category, [
            'radiology',
            'imaging',
        ]))
    ) return 'radiology';

    if (
        categoryCodes.has('laboratory')
        || observation.diagnosticReportId
        || loincCodes.size > 0
        || categories.some(category => conceptContains(category, [
            'laboratory',
            'pathology',
            'lab result',
        ]))
    ) return 'laboratory';

    return null;
};

const observationProfile = (classification: IpsObservationClass): string => {
    if (classification === 'vital-signs') return FHIR_PROFILES.vitalSigns;
    if (classification === 'radiology') {
        return IPS_PROFILES.observationRadiology;
    }
    return IPS_PROFILES.observationLaboratoryPathology;
};

const observationResource = (
    observation: ObservationRecord,
    classification: IpsObservationClass,
    patientReference: string,
    includedSpecimenIds: Set<string>,
    warnings: string[],
): FhirR4Resource | null => {
    if (classification === 'vital-signs') {
        const effective = effectiveValue(observation.effective);
        if (!('effectiveDateTime' in effective || 'effectivePeriod' in effective)
            || observation.value?.type !== 'quantity') {
            warnings.push(
                `${observation.code.text}: not exported as a vital sign because a dated quantity is required by the FHIR vital-signs profile.`,
            );
            return null;
        }
    }

    if (classification !== 'vital-signs') {
        if (observation.status !== 'final') {
            warnings.push(
                `${observation.code.text}: not exported as an IPS ${classification} result because that profile requires a final result.`,
            );
            return null;
        }
        if (!displayReferences(observation.performer)) {
            warnings.push(
                `${observation.code.text}: not exported as an IPS ${classification} result because no responsible performer is recorded. MediBrief does not invent clinical attribution.`,
            );
            return null;
        }
    }

    const category = observation.category?.map(toConcept) || [];
    if (classification === 'vital-signs'
        && !category.some(item => item.coding?.some(coding =>
            coding.system === FHIR_SYSTEMS.observationCategory
            && coding.code === 'vital-signs'))) {
        category.unshift({
            coding: [{
                system: FHIR_SYSTEMS.observationCategory,
                code: 'vital-signs',
                display: 'Vital Signs',
            }],
            text: 'Vital Signs',
        });
    }
    if (classification === 'laboratory'
        && !category.some(item => item.coding?.some(coding =>
            coding.system === FHIR_SYSTEMS.observationCategory
            && coding.code === 'laboratory'))) {
        category.unshift({
            coding: [{
                system: FHIR_SYSTEMS.observationCategory,
                code: 'laboratory',
                display: 'Laboratory',
            }],
            text: 'Laboratory',
        });
    }
    if (classification === 'radiology'
        && !category.some(item => item.coding?.some(coding =>
            coding.code === 'imaging'))) {
        category.unshift({
            coding: [{
                system: FHIR_SYSTEMS.observationCategory,
                code: 'imaging',
                display: 'Imaging',
            }],
            text: 'Imaging',
        });
    }

    return {
        resourceType: 'Observation',
        id: deterministicId('Observation', observation.id),
        meta: profileMeta(observationProfile(classification)),
        text: narrative(`<p>${escapeHtml(observation.code.text)}</p>`),
        status: observation.status,
        category,
        code: toConcept(observation.code),
        subject: { reference: patientReference },
        ...effectiveValue(observation.effective),
        ...(observation.issuedAt ? { issued: observation.issuedAt } : {}),
        ...(displayReferences(observation.performer)
            ? { performer: displayReferences(observation.performer) }
            : {}),
        ...observationValue(
            observation.value,
            warnings,
            observation.code.text,
        ),
        ...(observation.interpretation
            ? { interpretation: observation.interpretation.map(toConcept) }
            : {}),
        ...(observation.referenceRanges.length > 0 ? {
            referenceRange: observation.referenceRanges.map(range => ({
                ...(range.low
                    ? { low: toQuantity(range.low, warnings, observation.code.text) }
                    : {}),
                ...(range.high
                    ? { high: toQuantity(range.high, warnings, observation.code.text) }
                    : {}),
                ...(range.text ? { text: range.text } : {}),
                ...(range.appliesTo
                    ? { appliesTo: range.appliesTo.map(toConcept) }
                    : {}),
            })),
        } : {}),
        ...(observation.specimenId
            && includedSpecimenIds.has(observation.specimenId)
            ? {
                specimen: {
                    reference: fullUrl('Specimen', observation.specimenId),
                },
            }
            : {}),
        ...(notes(observation.note) ? { note: notes(observation.note) } : {}),
    };
};

const specimenResource = (
    specimen: SpecimenRecord,
    patientReference: string,
): FhirR4Resource => ({
    resourceType: 'Specimen',
    id: deterministicId('Specimen', specimen.id),
    meta: profileMeta(IPS_PROFILES.specimen),
    text: narrative(`<p>${escapeHtml(specimen.type?.text || 'Specimen')}</p>`),
    status: specimen.status,
    ...(specimen.type ? { type: toConcept(specimen.type) } : {}),
    subject: { reference: patientReference },
    ...(clinicalDate(specimen.receivedAt)
        ? { receivedTime: clinicalDate(specimen.receivedAt) }
        : {}),
    ...(specimen.collectedAt || specimen.bodySite || specimen.collectionMethod ? {
        collection: {
            ...(clinicalDate(specimen.collectedAt)
                ? { collectedDateTime: clinicalDate(specimen.collectedAt) }
                : {}),
            ...(specimen.bodySite
                ? { bodySite: toConcept(specimen.bodySite) }
                : {}),
            ...(specimen.collectionMethod
                ? { method: toConcept(specimen.collectionMethod) }
                : {}),
        },
    } : {}),
    ...(notes(specimen.note) ? { note: notes(specimen.note) } : {}),
});

const diagnosticReportResource = (
    report: DiagnosticReportRecord,
    patientReference: string,
    includedObservationIds: Set<string>,
    includedSpecimenIds: Set<string>,
): FhirR4Resource => ({
    resourceType: 'DiagnosticReport',
    id: deterministicId('DiagnosticReport', report.id),
    meta: profileMeta(IPS_PROFILES.diagnosticReport),
    text: narrative(`<p>${escapeHtml(report.code.text)}</p>`),
    status: report.status,
    ...(report.category && report.category.length > 0
        ? { category: report.category.map(toConcept) }
        : {}),
    code: toConcept(report.code),
    subject: { reference: patientReference },
    ...(report.effectivePeriod
        ? { effectivePeriod: clinicalPeriod(report.effectivePeriod) }
        : {}),
    ...(report.issuedAt ? { issued: report.issuedAt } : {}),
    ...(displayReferences(report.performer)
        ? { performer: displayReferences(report.performer) }
        : {}),
    ...(report.specimenIds.some(id => includedSpecimenIds.has(id)) ? {
        specimen: report.specimenIds
            .filter(id => includedSpecimenIds.has(id))
            .map(id => ({ reference: fullUrl('Specimen', id) })),
    } : {}),
    ...(report.resultIds.some(id => includedObservationIds.has(id)) ? {
        result: report.resultIds
            .filter(id => includedObservationIds.has(id))
            .map(id => ({ reference: fullUrl('Observation', id) })),
    } : {}),
    ...(report.conclusion ? { conclusion: report.conclusion } : {}),
    ...(report.conclusionCodes && report.conclusionCodes.length > 0
        ? { conclusionCode: report.conclusionCodes.map(toConcept) }
        : {}),
});

const sectionNarrative = (
    definition: IpsSectionDefinition,
    labels: string[],
): FhirNarrative => {
    if (labels.length === 0) {
        return narrative(
            `<p>No confirmed local information is available for ${escapeHtml(definition.title.toLowerCase())}. This does not establish clinical absence.</p>`,
        );
    }
    return narrative([
        `<p>${escapeHtml(definition.title)} from the confirmed local MediBrief record.</p>`,
        `<ul>${labels.map(label => `<li>${escapeHtml(label)}</li>`).join('')}</ul>`,
    ].join(''));
};

const compositionSection = (
    definition: IpsSectionDefinition,
    references: string[],
    labels: string[],
): FhirCompositionSection => ({
    title: definition.title,
    code: {
        coding: [{
            system: FHIR_SYSTEMS.loinc,
            code: definition.code,
            display: definition.display,
        }],
        text: definition.title,
    },
    text: sectionNarrative(definition, labels),
    mode: 'snapshot',
    ...(references.length > 0 ? {
        entry: references.map(reference => ({ reference })),
    } : definition.required && labels.length === 0 ? {
        emptyReason: {
            coding: [{
                system: FHIR_SYSTEMS.listEmptyReason,
                code: 'unavailable',
                display: 'Unavailable',
            }],
            text: 'No confirmed local information is available.',
        },
    } : {}),
});

const increment = (counts: Record<string, number>, key: string): void => {
    counts[key] = (counts[key] || 0) + 1;
};

export const createIpsFileStem = (record: PatientClinicalRecord): string => {
    const name = record.profile.displayName
        .normalize('NFKD')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase() || 'patient';
    return `medibrief-${name}-ips-${IPS_VERSION}`;
};

export const serializeIpsBundle = (bundle: FhirDocumentBundle): string =>
    JSON.stringify(bundle, null, 2);

export const buildIpsDocument = (
    record: PatientClinicalRecord,
    generatedAt = new Date().toISOString(),
): IpsExportResult => {
    const warnings: string[] = [];
    const includedCounts: Record<string, number> = {};
    const excludedCounts: Record<string, number> = {};

    const patientUrl = fullUrl('Patient', record.profile.id);
    const authorUrl = fullUrl('Device', 'medibrief-ips-generator');
    const patient = buildPatient(record.profile, warnings);
    const authorDevice = buildAuthorDevice();

    const confirmed = selectConfirmedResources(record);
    const conditions = confirmed.filter(
        (resource): resource is ConditionRecord =>
            resource.resourceType === 'Condition',
    );
    const allergies = confirmed.filter(
        (resource): resource is AllergyIntoleranceRecord =>
            resource.resourceType === 'AllergyIntolerance',
    );
    const medications = confirmed.filter(
        (resource): resource is MedicationRecord =>
            resource.resourceType === 'Medication',
    );
    const procedures = confirmed.filter(
        (resource): resource is ProcedureRecord =>
            resource.resourceType === 'Procedure',
    );
    const immunizations = confirmed.filter(
        (resource): resource is ImmunizationRecord =>
            resource.resourceType === 'Immunization',
    );
    const observations = confirmed.filter(
        (resource): resource is ObservationRecord =>
            resource.resourceType === 'Observation',
    );
    const diagnosticReports = confirmed.filter(
        (resource): resource is DiagnosticReportRecord =>
            resource.resourceType === 'DiagnosticReport',
    );
    const specimens = confirmed.filter(
        (resource): resource is SpecimenRecord =>
            resource.resourceType === 'Specimen',
    );

    const observationClasses = new Map<string, IpsObservationClass>();
    observations.forEach(observation => {
        const classification = classifyObservationForIps(observation);
        if (classification) observationClasses.set(observation.id, classification);
        else {
            increment(excludedCounts, 'unclassified-observation');
            warnings.push(
                `${observation.code.text}: observation was not exported because it could not be safely classified as a vital sign, laboratory/pathology result, or radiology result.`,
            );
        }
    });

    const prelimIncludedObservationIds = new Set(observationClasses.keys());
    const requiredSpecimenIds = new Set<string>();
    observations.forEach(observation => {
        if (prelimIncludedObservationIds.has(observation.id)
            && observation.specimenId) {
            requiredSpecimenIds.add(observation.specimenId);
        }
    });
    diagnosticReports.forEach(report => {
        report.specimenIds.forEach(id => requiredSpecimenIds.add(id));
    });
    const includedSpecimenIds = new Set<string>(specimens
        .filter(specimen => requiredSpecimenIds.has(specimen.id))
        .map(specimen => specimen.id));

    const observationResources = observations.flatMap(observation => {
        const classification = observationClasses.get(observation.id);
        if (!classification) return [];
        const converted = observationResource(
            observation,
            classification,
            patientUrl,
            includedSpecimenIds,
            warnings,
        );
        if (!converted) {
            observationClasses.delete(observation.id);
            increment(excludedCounts, 'observation-profile-requirement');
            return [];
        }
        if (classification === 'vital-signs') {
            increment(excludedCounts, 'vital-sign-structured-deferred');
        } else {
            increment(includedCounts, converted.resourceType);
        }
        return [{ local: observation, classification, resource: converted }];
    });
    const includedObservationIds = new Set<string>(observationResources
        .filter(item => item.classification !== 'vital-signs')
        .map(item => item.local.id));

    const conditionResources = conditions.map(condition => {
        const resource = conditionResource(condition, patientUrl);
        increment(includedCounts, resource.resourceType);
        return { local: condition, resource };
    });
    const allergyResources = allergies.map(allergy => {
        const resource = allergyResource(allergy, patientUrl);
        increment(includedCounts, resource.resourceType);
        return { local: allergy, resource };
    });
    const medicationResources = medications.map(medication => {
        const resource = medicationResource(
            medication,
            patientUrl,
            warnings,
        );
        increment(includedCounts, resource.resourceType);
        return { local: medication, resource };
    });
    const procedureResources = procedures.map(procedure => {
        const resource = procedureResource(procedure, patientUrl);
        increment(includedCounts, resource.resourceType);
        return { local: procedure, resource };
    });
    const immunizationResources = immunizations.flatMap(immunization => {
        const resource = immunizationResource(
            immunization,
            patientUrl,
            warnings,
        );
        if (!resource) {
            increment(excludedCounts, 'immunization-profile-requirement');
            return [];
        }
        increment(includedCounts, resource.resourceType);
        return [{ local: immunization, resource }];
    });
    const specimenResources = specimens
        .filter(specimen => includedSpecimenIds.has(specimen.id))
        .map(specimen => {
            const resource = specimenResource(specimen, patientUrl);
            increment(includedCounts, resource.resourceType);
            return { local: specimen, resource };
        });
    const reportResources = diagnosticReports.map(report => {
        const resource = diagnosticReportResource(
            report,
            patientUrl,
            includedObservationIds,
            includedSpecimenIds,
        );
        increment(includedCounts, resource.resourceType);
        return { local: report, resource };
    });

    increment(includedCounts, 'Patient');
    increment(includedCounts, 'Device');

    const activeConditions = conditionResources.filter(item =>
        ['active', 'unknown'].includes(item.local.clinicalStatus));
    const pastConditions = conditionResources.filter(item =>
        !['active', 'unknown'].includes(item.local.clinicalStatus));
    const vitalObservations = observationResources.filter(item =>
        item.classification === 'vital-signs');
    const resultObservations = observationResources.filter(item =>
        item.classification !== 'vital-signs');
    if (vitalObservations.length > 0) {
        warnings.push(
            `${vitalObservations.length} confirmed vital-sign observation${vitalObservations.length === 1 ? '' : 's'} were retained in the Vital Signs section narrative but omitted as structured Bundle entries because IPS 2.0.1 Bundle slicing can classify a FHIR R4 vital-sign Observation into overlapping slices. MediBrief does not publish an ambiguously profiled entry.`,
        );
    }

    const sections: FhirCompositionSection[] = [
        compositionSection(
            IPS_SECTIONS.problems,
            activeConditions.map(item => fullUrl('Condition', item.local.id)),
            activeConditions.map(item => item.local.code.text),
        ),
        compositionSection(
            IPS_SECTIONS.allergies,
            allergyResources.map(item =>
                fullUrl('AllergyIntolerance', item.local.id)),
            allergyResources.map(item => item.local.substance.text),
        ),
        compositionSection(
            IPS_SECTIONS.medicationSummary,
            medicationResources.map(item =>
                fullUrl('MedicationStatement', item.local.id)),
            medicationResources.map(item => item.local.medication.text),
        ),
    ];

    const optionalSections: Array<{
        definition: IpsSectionDefinition;
        references: string[];
        labels: string[];
    }> = [
        {
            definition: IPS_SECTIONS.immunizations,
            references: immunizationResources.map(item =>
                fullUrl('Immunization', item.local.id)),
            labels: immunizationResources.map(item =>
                item.local.vaccineCode.text),
        },
        {
            definition: IPS_SECTIONS.procedures,
            references: procedureResources.map(item =>
                fullUrl('Procedure', item.local.id)),
            labels: procedureResources.map(item => item.local.code.text),
        },
        {
            definition: IPS_SECTIONS.results,
            references: [
                ...reportResources.map(item =>
                    fullUrl('DiagnosticReport', item.local.id)),
                ...resultObservations.map(item =>
                    fullUrl('Observation', item.local.id)),
            ],
            labels: [
                ...reportResources.map(item => item.local.code.text),
                ...resultObservations.map(item => item.local.code.text),
            ],
        },
        {
            definition: IPS_SECTIONS.vitalSigns,
            references: [],
            labels: vitalObservations.map(item => item.local.code.text),
        },
        {
            definition: IPS_SECTIONS.pastProblems,
            references: pastConditions.map(item =>
                fullUrl('Condition', item.local.id)),
            labels: pastConditions.map(item => item.local.code.text),
        },
    ];
    optionalSections.forEach(item => {
        if (item.references.length > 0 || item.labels.length > 0) {
            sections.push(compositionSection(
                item.definition,
                item.references,
                item.labels,
            ));
        }
    });

    const documentId = deterministicId(
        'Bundle',
        `${record.patientId}:${record.updatedAt}`,
    );
    const compositionId = deterministicId(
        'Composition',
        `${record.patientId}:${record.updatedAt}`,
    );
    const documentIdentifier = {
        system: `${MEDIBRIEF_FHIR_IDENTIFIER_BASE}/ips-document`,
        value: documentId,
    };
    const composition: FhirComposition = {
        resourceType: 'Composition',
        id: compositionId,
        meta: profileMeta(IPS_PROFILES.composition),
        language: 'en',
        text: narrative(
            `<p>International Patient Summary for <strong>${escapeHtml(record.profile.displayName)}</strong>, assembled from confirmed local MediBrief records on ${escapeHtml(generatedAt)}.</p>`,
        ),
        identifier: documentIdentifier,
        status: 'final',
        type: {
            coding: [{ ...IPS_DOCUMENT_TYPE }],
            text: 'International Patient Summary',
        },
        subject: {
            reference: patientUrl,
            display: record.profile.displayName,
        },
        date: generatedAt,
        author: [{
            reference: authorUrl,
            display: 'MediBrief',
        }],
        title: `International Patient Summary — ${record.profile.displayName}`,
        confidentiality: 'N',
        section: sections,
    };

    const entryResources: Array<{
        fullUrl: string;
        resource: FhirR4Resource;
    }> = [
        {
            fullUrl: `urn:uuid:${compositionId}`,
            resource: composition,
        },
        { fullUrl: patientUrl, resource: patient },
        { fullUrl: authorUrl, resource: authorDevice },
        ...conditionResources.map(item => ({
            fullUrl: fullUrl('Condition', item.local.id),
            resource: item.resource,
        })),
        ...allergyResources.map(item => ({
            fullUrl: fullUrl('AllergyIntolerance', item.local.id),
            resource: item.resource,
        })),
        ...medicationResources.map(item => ({
            fullUrl: fullUrl('MedicationStatement', item.local.id),
            resource: item.resource,
        })),
        ...procedureResources.map(item => ({
            fullUrl: fullUrl('Procedure', item.local.id),
            resource: item.resource,
        })),
        ...immunizationResources.map(item => ({
            fullUrl: fullUrl('Immunization', item.local.id),
            resource: item.resource,
        })),
        ...specimenResources.map(item => ({
            fullUrl: fullUrl('Specimen', item.local.id),
            resource: item.resource,
        })),
        ...resultObservations.map(item => ({
            fullUrl: fullUrl('Observation', item.local.id),
            resource: item.resource,
        })),
        ...reportResources.map(item => ({
            fullUrl: fullUrl('DiagnosticReport', item.local.id),
            resource: item.resource,
        })),
    ];

    const bundle: FhirDocumentBundle = {
        resourceType: 'Bundle',
        id: documentId,
        meta: {
            profile: [IPS_PROFILES.bundle],
            security: [{
                system: FHIR_SYSTEMS.confidentiality,
                code: 'N',
                display: 'normal',
            }],
        },
        identifier: documentIdentifier,
        type: 'document',
        timestamp: generatedAt,
        entry: entryResources,
    };

    const allResources = flattenPatientResources(record);
    allResources.forEach(resource => {
        if (resource.verificationStatus !== 'confirmed') {
            increment(excludedCounts, resource.verificationStatus);
        } else if (!isConfirmedPatientFact(resource)) {
            increment(excludedCounts, 'non-patient-applicable-assertion');
        }
    });
    const supportedLocalIds = new Set([
        ...conditionResources.map(item => item.local.id),
        ...allergyResources.map(item => item.local.id),
        ...medicationResources.map(item => item.local.id),
        ...procedureResources.map(item => item.local.id),
        ...immunizationResources.map(item => item.local.id),
        ...specimenResources.map(item => item.local.id),
        ...observationResources.map(item => item.local.id),
        ...reportResources.map(item => item.local.id),
    ]);
    confirmed.forEach(resource => {
        if (!supportedLocalIds.has(resource.id)) {
            increment(excludedCounts, `unsupported-${resource.resourceType}`);
        }
    });

    const validation = validateIpsDocumentBundle(bundle);
    return {
        bundle,
        report: {
            generatedAt,
            fhirVersion: FHIR_R4_VERSION,
            ipsVersion: IPS_VERSION,
            packageId: IPS_PACKAGE,
            includedCounts,
            excludedCounts,
            warnings,
            validation,
            limitations: [
                'The IPS contains only locally confirmed, patient-applicable resources that MediBrief can map without inventing missing clinical context.',
                'An empty required section is marked unavailable; it does not assert that no condition, allergy, or medication exists.',
                'Candidate, rejected, entered-in-error, negated, family-history, hypothetical, and unsupported resources are excluded.',
                'Local structural validation and HL7 validator success do not prove semantic completeness, terminology equivalence, clinical correctness, or acceptance by every receiving system.',
                'Original quantity values are exported. Non-UCUM machine codings are omitted rather than being silently treated as UCUM.',
            ],
        },
    };
};
