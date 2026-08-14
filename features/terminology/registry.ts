import type { ClinicalCoding } from '../clinical-record/types';
import type {
    TerminologySystemDefinition,
    TerminologySystemId,
} from './types';

export const TERMINOLOGY_URIS = {
    loinc: 'http://loinc.org',
    ucum: 'http://unitsofmeasure.org',
    rxnorm: 'http://www.nlm.nih.gov/research/umls/rxnorm',
    snomedCt: 'http://snomed.info/sct',
} as const;

export const LOINC_CONTENT_VERSION = '2.82';

export const TERMINOLOGY_SYSTEMS: Record<
    TerminologySystemId,
    TerminologySystemDefinition
> = {
    loinc: {
        id: 'loinc',
        name: 'LOINC',
        canonicalUri: TERMINOLOGY_URIS.loinc,
        contentVersion: LOINC_CONTENT_VERSION,
        lookupMode: 'bundled-reviewed-subset',
        description:
            'Reviewed exact-alias candidates for a small set of common laboratory and vital-sign observations.',
        boundary:
            'A candidate is offered only when the local text exactly matches a reviewed alias with sufficient specimen or measurement context. Generic or ambiguous labels remain uncoded.',
        licenseNotice:
            'This material contains selected LOINC identifiers and names and is available under the LOINC license. LOINC is copyright Regenstrief Institute, Inc. and the LOINC Committee.',
    },
    ucum: {
        id: 'ucum',
        name: 'UCUM',
        canonicalUri: TERMINOLOGY_URIS.ucum,
        lookupMode: 'bundled-reviewed-subset',
        description:
            'Maps reviewed source-unit aliases to case-sensitive UCUM codes and performs only explicitly governed conversions.',
        boundary:
            'Recognizing a unit does not prove that the value, analyte, specimen, or source transcription is correct. Unknown units are preserved and not guessed.',
        licenseNotice:
            'UCUM symbols are used according to the UCUM specification. Case-sensitive UCUM codes are preserved exactly.',
    },
    rxnorm: {
        id: 'rxnorm',
        name: 'RxNorm',
        canonicalUri: TERMINOLOGY_URIS.rxnorm,
        lookupMode: 'source-provided',
        description:
            'Records a medication identifier supplied by an existing clinical source, imported record, or separately reviewed terminology workflow.',
        boundary:
            'MediBrief does not search for medication concepts or choose an identifier. The user must provide a reviewed RxCUI, display, and source description; this does not perform dose, interaction, or medication-safety checking.',
        licenseNotice:
            'RxNorm is maintained by the U.S. National Library of Medicine. User-supplied identifiers remain subject to NLM terms and source-vocabulary restrictions.',
    },
    'snomed-ct': {
        id: 'snomed-ct',
        name: 'SNOMED CT',
        canonicalUri: TERMINOLOGY_URIS.snomedCt,
        lookupMode: 'external-licensed',
        description:
            'Accepts a code supplied from a separately licensed SNOMED CT source for a condition, allergy, or procedure.',
        boundary:
            'MediBrief does not bundle SNOMED CT content, search it, translate free text into it, or establish that a deployment is licensed. The user must supply an edition/version URI and acknowledge the licensing boundary.',
        licenseNotice:
            'SNOMED CT use and distribution are governed by SNOMED International licensing and territorial arrangements.',
    },
};

export interface LoincAliasDefinition {
    id: string;
    aliases: string[];
    coding: ClinicalCoding;
    context: string;
}

const loincCoding = (
    code: string,
    display: string,
): ClinicalCoding => ({
    system: TERMINOLOGY_URIS.loinc,
    version: LOINC_CONTENT_VERSION,
    code,
    display,
    userSelected: true,
});

/**
 * Deliberately small reviewed subset. Aliases are exact after Unicode,
 * punctuation, Arabic-diacritic, and whitespace normalization. Ambiguous
 * labels such as bare “glucose”, “creatinine”, or “oxygen saturation” are not
 * included because LOINC meaning depends on specimen, property, and method.
 */
export const LOINC_EXACT_ALIASES: LoincAliasDefinition[] = [
    {
        id: 'heart-rate',
        aliases: [
            'heart rate',
            'pulse rate',
            'معدل ضربات القلب',
            'معدل نبض القلب',
        ],
        coding: loincCoding('8867-4', 'Heart rate'),
        context: 'Vital-sign heart rate.',
    },
    {
        id: 'body-temperature',
        aliases: [
            'body temperature',
            'درجة حرارة الجسم',
        ],
        coding: loincCoding('8310-5', 'Body temperature'),
        context: 'Measured body temperature.',
    },
    {
        id: 'pulse-oximetry',
        aliases: [
            'oxygen saturation by pulse oximetry',
            'pulse oximetry oxygen saturation',
            'spo2 by pulse oximetry',
            'تشبع الاكسجين بقياس التاكسج النبضي',
            'تشبع الأكسجين بقياس التأكسج النبضي',
        ],
        coding: loincCoding(
            '59408-5',
            'Oxygen saturation in Arterial blood by Pulse oximetry',
        ),
        context: 'Pulse-oximetry measurement; not a generic oxygen-saturation label.',
    },
    {
        id: 'systolic-blood-pressure',
        aliases: [
            'systolic blood pressure',
            'ضغط الدم الانقباضي',
        ],
        coding: loincCoding('8480-6', 'Systolic blood pressure'),
        context: 'Systolic component of a blood-pressure measurement.',
    },
    {
        id: 'diastolic-blood-pressure',
        aliases: [
            'diastolic blood pressure',
            'ضغط الدم الانبساطي',
        ],
        coding: loincCoding('8462-4', 'Diastolic blood pressure'),
        context: 'Diastolic component of a blood-pressure measurement.',
    },
    {
        id: 'blood-glucose-mass',
        aliases: [
            'blood glucose mass concentration',
            'glucose mass concentration in blood',
            'سكر الدم بالكتلة',
            'تركيز غلوكوز الدم الكتلي',
        ],
        coding: loincCoding('2339-0', 'Glucose [Mass/volume] in Blood'),
        context: 'Mass concentration measured in blood.',
    },
    {
        id: 'serum-plasma-glucose-mass',
        aliases: [
            'serum glucose mass concentration',
            'plasma glucose mass concentration',
            'glucose mass concentration in serum or plasma',
            'تركيز غلوكوز المصل او البلازما الكتلي',
            'تركيز غلوكوز المصل أو البلازما الكتلي',
        ],
        coding: loincCoding(
            '2345-7',
            'Glucose [Mass/volume] in Serum or Plasma',
        ),
        context: 'Mass concentration measured in serum or plasma.',
    },
    {
        id: 'serum-plasma-creatinine-mass',
        aliases: [
            'serum creatinine mass concentration',
            'plasma creatinine mass concentration',
            'creatinine mass concentration in serum or plasma',
            'تركيز كرياتينين المصل او البلازما الكتلي',
            'تركيز كرياتينين المصل أو البلازما الكتلي',
        ],
        coding: loincCoding(
            '2160-0',
            'Creatinine [Mass/volume] in Serum or Plasma',
        ),
        context: 'Mass concentration measured in serum or plasma.',
    },
    {
        id: 'serum-plasma-potassium-molar',
        aliases: [
            'serum potassium molar concentration',
            'plasma potassium molar concentration',
            'potassium molar concentration in serum or plasma',
            'تركيز بوتاسيوم المصل او البلازما المولي',
            'تركيز بوتاسيوم المصل أو البلازما المولي',
        ],
        coding: loincCoding(
            '2823-3',
            'Potassium [Moles/volume] in Serum or Plasma',
        ),
        context: 'Molar concentration measured in serum or plasma.',
    },
    {
        id: 'serum-plasma-lactate-molar',
        aliases: [
            'serum lactate molar concentration',
            'plasma lactate molar concentration',
            'lactate molar concentration in serum or plasma',
            'تركيز لاكتات المصل او البلازما المولي',
            'تركيز لاكتات المصل أو البلازما المولي',
        ],
        coding: loincCoding(
            '2524-7',
            'Lactate [Moles/volume] in Serum or Plasma',
        ),
        context: 'Molar concentration measured in serum or plasma.',
    },
];

export interface UcumAliasDefinition {
    aliases: string[];
    code: string;
    display: string;
}

export const UCUM_ALIASES: UcumAliasDefinition[] = [
    { aliases: ['mg/dl', 'mg per dl'], code: 'mg/dL', display: 'mg/dL' },
    { aliases: ['g/dl', 'g per dl'], code: 'g/dL', display: 'g/dL' },
    { aliases: ['mmol/l', 'mmol per l'], code: 'mmol/L', display: 'mmol/L' },
    {
        aliases: ['umol/l', 'µmol/l', 'μmol/l', 'micromol/l', 'micromole/l'],
        code: 'umol/L',
        display: 'µmol/L',
    },
    { aliases: ['ng/ml', 'ng per ml'], code: 'ng/mL', display: 'ng/mL' },
    { aliases: ['iu/l', 'international units/l'], code: '[IU]/L', display: 'IU/L' },
    { aliases: ['c', '°c', 'degc', 'celsius'], code: 'Cel', display: '°C' },
    { aliases: ['f', '°f', 'degf', 'fahrenheit'], code: '[degF]', display: '°F' },
    {
        aliases: ['bpm', 'beats/min', 'beats per minute', 'نبضة/دقيقة', 'نبضة بالدقيقة'],
        code: '/min',
        display: 'beats/min',
    },
    { aliases: ['%', 'percent', 'percentage', 'بالمئة', '٪'], code: '%', display: '%' },
    { aliases: ['mmhg', 'mm hg', 'ملم زئبق'], code: 'mm[Hg]', display: 'mmHg' },
];

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;

export const normalizeTerminologyText = (value: string): string =>
    value
        .normalize('NFKC')
        .toLowerCase()
        .replace(ARABIC_DIACRITICS, '')
        .replace(/[أإآ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه')
        .replace(/[^\p{Letter}\p{Number}%٪]+/gu, ' ')
        .trim()
        .replace(/\s+/g, ' ');

export const normalizeUnitAlias = (value: string): string =>
    value
        .normalize('NFKC')
        .trim()
        .replace(/μ/g, 'µ')
        .replace(/\s+/g, ' ')
        .toLowerCase();

const loincAliasIndex = new Map<string, LoincAliasDefinition>();
LOINC_EXACT_ALIASES.forEach(definition => {
    definition.aliases.forEach(alias => {
        loincAliasIndex.set(normalizeTerminologyText(alias), definition);
    });
});

const ucumCanonicalIndex = new Map<string, UcumAliasDefinition>();
const ucumAliasIndex = new Map<string, UcumAliasDefinition>();
UCUM_ALIASES.forEach(definition => {
    ucumCanonicalIndex.set(definition.code, definition);
    definition.aliases.forEach(alias => {
        ucumAliasIndex.set(normalizeUnitAlias(alias), definition);
    });
    // Display values are human-readable aliases. Canonical UCUM codes are
    // checked separately without case folding because UCUM is case-sensitive.
    ucumAliasIndex.set(normalizeUnitAlias(definition.display), definition);
});

export const findExactLoincAlias = (
    text: string,
): LoincAliasDefinition | null =>
    loincAliasIndex.get(normalizeTerminologyText(text)) || null;

export const findExactUcumCode = (
    code: string,
): UcumAliasDefinition | null =>
    ucumCanonicalIndex.get(code.normalize('NFKC').trim().replace(/μ/g, 'µ'))
    || null;

export const findUcumAlias = (
    unit: string,
): UcumAliasDefinition | null => {
    const trimmed = unit.normalize('NFKC').trim().replace(/μ/g, 'µ');
    return findExactUcumCode(trimmed)
        || ucumAliasIndex.get(normalizeUnitAlias(trimmed))
        || null;
};
