import type {
    ObservationRecord,
    PatientClinicalRecord,
    SpecimenRecord,
} from '../clinical-record';

export interface DiagnosticLoincSuggestion {
    observationId: string;
    observationName: string;
    code: string;
    display: string;
    system: 'http://loinc.org';
    confidence: 'high';
    reviewOnly: true;
    reason: string;
    evidence: string[];
}

interface CuratedSuggestionRule {
    code: string;
    display: string;
    aliases: string[];
    context: (
        observation: ObservationRecord,
        specimen: SpecimenRecord | undefined,
    ) => string[] | undefined;
}

const normalize = (value?: string): string => (value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const specimenText = (specimen?: SpecimenRecord): string => normalize([
    specimen?.type?.text,
    specimen?.bodySite?.text,
    specimen?.collectionMethod?.text,
    specimen?.note,
].filter(Boolean).join(' '));

const hasAny = (value: string, terms: string[]): boolean =>
    terms.some(term => value.includes(normalize(term)));

const bloodContext = (
    _observation: ObservationRecord,
    specimen: SpecimenRecord | undefined,
): string[] | undefined => {
    const text = specimenText(specimen);
    return hasAny(text, ['blood', 'whole blood', 'venous blood'])
        ? [`Specimen context: ${specimen?.type?.text || 'blood'}`]
        : undefined;
};

const serumOrPlasmaContext = (
    _observation: ObservationRecord,
    specimen: SpecimenRecord | undefined,
): string[] | undefined => {
    const text = specimenText(specimen);
    return hasAny(text, ['serum', 'plasma'])
        ? [`Specimen context: ${specimen?.type?.text || 'serum/plasma'}`]
        : undefined;
};

const automatedBloodCountContext = (
    observation: ObservationRecord,
    specimen: SpecimenRecord | undefined,
): string[] | undefined => {
    const observationText = normalize([
        observation.code.text,
        observation.note,
    ].filter(Boolean).join(' '));
    const specimenEvidence = bloodContext(observation, specimen);
    if (!specimenEvidence || !observationText.includes('automat')) {
        return undefined;
    }
    return [
        ...specimenEvidence,
        'The reviewed result name or method explicitly indicates an automated count.',
    ];
};

/**
 * Small, deliberately conservative exact-alias set. Suggestions are never
 * written to the clinical record automatically.
 */
const CURATED_RULES: CuratedSuggestionRule[] = [
    {
        code: '718-7',
        display: 'Hemoglobin [Mass/volume] in Blood',
        aliases: [
            'hemoglobin',
            'haemoglobin',
            'hgb',
            'hemoglobin blood',
            'haemoglobin blood',
        ],
        context: bloodContext,
    },
    {
        code: '2160-0',
        display: 'Creatinine [Mass/volume] in Serum or Plasma',
        aliases: [
            'creatinine',
            'serum creatinine',
            'plasma creatinine',
            'creatinine serum',
            'creatinine plasma',
        ],
        context: serumOrPlasmaContext,
    },
    {
        code: '6690-2',
        display: 'Leukocytes [#/volume] in Blood by Automated count',
        aliases: [
            'wbc automated',
            'automated wbc',
            'white blood cell count automated',
            'automated white blood cell count',
            'leukocytes automated',
            'automated leukocyte count',
        ],
        context: automatedBloodCountContext,
    },
];

const hasLoinc = (observation: ObservationRecord): boolean =>
    Boolean(observation.code.coding?.some(coding =>
        coding.system?.replace(/\/$/, '') === 'http://loinc.org'));

export const suggestLoincForObservation = (
    observation: ObservationRecord,
    record: PatientClinicalRecord,
): DiagnosticLoincSuggestion[] => {
    if (hasLoinc(observation)) return [];
    const name = normalize(observation.code.text);
    const specimen = observation.specimenId
        ? record.resources.specimens.find(value =>
            value.id === observation.specimenId)
        : undefined;

    return CURATED_RULES.flatMap(rule => {
        if (!rule.aliases.some(alias => normalize(alias) === name)) return [];
        const context = rule.context(observation, specimen);
        if (!context) return [];
        return [{
            observationId: observation.id,
            observationName: observation.code.text,
            code: rule.code,
            display: rule.display,
            system: 'http://loinc.org' as const,
            confidence: 'high' as const,
            reviewOnly: true as const,
            reason:
                'Exact reviewed test-name and specimen/method evidence matched a curated LOINC suggestion. A person must still verify and apply the code.',
            evidence: [
                `Exact test-name alias: ${observation.code.text}`,
                ...context,
            ],
        }];
    });
};

export const buildDiagnosticLoincSuggestions = (
    record: PatientClinicalRecord,
): DiagnosticLoincSuggestion[] => record.resources.observations
    .filter(observation => observation.verificationStatus === 'confirmed')
    .flatMap(observation => suggestLoincForObservation(observation, record));
