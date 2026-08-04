export type OpenMedClinicalLanguage = 'en' | 'ar' | 'mixed' | 'other' | 'unknown';

export type OpenMedLanguageRoute =
    | 'evaluated-english-defaults'
    | 'latin-script-language-unverified'
    | 'unsupported-arabic-clinical-ner'
    | 'unsupported-non-latin-clinical-ner'
    | 'mixed-script-review'
    | 'undetermined';

export interface OpenMedLanguageEvidence {
    totalLetters: number;
    latinLetters: number;
    arabicLetters: number;
    otherLetters: number;
    latinShare: number;
    arabicShare: number;
    otherShare: number;
    latinWordCount: number;
    englishMarkerCount: number;
    englishMarkerShare: number;
    englishMarkers: string[];
}

export interface OpenMedLanguageAssessment {
    route: OpenMedLanguageRoute;
    inferredLanguage: OpenMedClinicalLanguage;
    basis: 'script-and-lexical-heuristic';
    allowDefaultClinicalNer: boolean;
    allowEnglishContext: boolean;
    fallbackEligible: boolean;
    message: string;
    evidence: OpenMedLanguageEvidence;
}

const LETTER = /\p{Letter}/u;
const LATIN = /\p{Script=Latin}/u;
const ARABIC = /\p{Script=Arabic}/u;
const LATIN_WORD = /\p{Script=Latin}[\p{Script=Latin}\p{Mark}'’-]*/gu;

// A unit suffix, isolated abbreviation, medication name, or diagnosis label is
// not enough evidence to call an otherwise ambiguous source English.
const MIN_ALPHABETIC_EVIDENCE = 4;
const MIN_DISTINCT_ENGLISH_MARKERS = 2;

/**
 * Routing markers are deliberately limited to common English clinical and
 * function words. International disease and medication names are excluded
 * because they do not identify a language reliably.
 */
const ENGLISH_ROUTE_MARKERS = new Set([
    'and',
    'are',
    'continue',
    'daily',
    'denies',
    'diagnosed',
    'dose',
    'family',
    'father',
    'has',
    'have',
    'history',
    'medication',
    'medications',
    'mother',
    'not',
    'patient',
    'possible',
    'reports',
    'start',
    'stop',
    'take',
    'takes',
    'taking',
    'treated',
    'treatment',
    'twice',
    'use',
    'uses',
    'using',
    'with',
    'without',
]);

const share = (value: number, total: number): number =>
    total > 0 ? value / total : 0;

const extractLatinWords = (text: string): string[] =>
    [...text.normalize('NFKC').toLowerCase().matchAll(LATIN_WORD)]
        .map(match => match[0].replace(/’/g, "'"));

const extractEnglishMarkers = (words: string[]): string[] =>
    [...new Set(words.filter(word => ENGLISH_ROUTE_MARKERS.has(word)))].sort();

/**
 * Conservative routing for the default disease and medication models.
 *
 * This is a script-and-lexical assessment, not a general-purpose language
 * detector. Latin script alone does not prove English. MediBrief currently has
 * accepted integration and context evidence only for an English/default-model
 * route. Arabic OCR, multilingual PII, and Arabic clinical NER are separate
 * capabilities and must not be conflated.
 */
export const assessOpenMedClinicalLanguage = (
    text: string,
): OpenMedLanguageAssessment => {
    let totalLetters = 0;
    let latinLetters = 0;
    let arabicLetters = 0;
    let otherLetters = 0;

    for (const character of text.normalize('NFKC')) {
        if (!LETTER.test(character)) continue;
        totalLetters += 1;
        if (LATIN.test(character)) latinLetters += 1;
        else if (ARABIC.test(character)) arabicLetters += 1;
        else otherLetters += 1;
    }

    const words = extractLatinWords(text);
    const markers = extractEnglishMarkers(words);
    const evidence: OpenMedLanguageEvidence = {
        totalLetters,
        latinLetters,
        arabicLetters,
        otherLetters,
        latinShare: share(latinLetters, totalLetters),
        arabicShare: share(arabicLetters, totalLetters),
        otherShare: share(otherLetters, totalLetters),
        latinWordCount: words.length,
        englishMarkerCount: markers.length,
        englishMarkerShare: share(markers.length, words.length),
        englishMarkers: markers,
    };

    if (totalLetters < MIN_ALPHABETIC_EVIDENCE) {
        return {
            route: 'undetermined',
            inferredLanguage: 'unknown',
            basis: 'script-and-lexical-heuristic',
            allowDefaultClinicalNer: false,
            allowEnglishContext: false,
            fallbackEligible: true,
            message:
                'There is not enough alphabetic clinical text to establish an evaluated local language route.',
            evidence,
        };
    }

    if (evidence.arabicShare >= 0.60) {
        return {
            route: 'unsupported-arabic-clinical-ner',
            inferredLanguage: 'ar',
            basis: 'script-and-lexical-heuristic',
            allowDefaultClinicalNer: false,
            allowEnglishContext: false,
            fallbackEligible: true,
            message:
                'Arabic text was preserved as document evidence, but the configured default disease and medication models have no accepted Arabic clinical-NER evidence in MediBrief. Local clinical NER was skipped. Arabic OCR capability does not establish Arabic clinical NER or assertion-context quality.',
            evidence,
        };
    }

    if (evidence.latinShare >= 0.85) {
        if (markers.length >= MIN_DISTINCT_ENGLISH_MARKERS) {
            return {
                route: 'evaluated-english-defaults',
                inferredLanguage: 'en',
                basis: 'script-and-lexical-heuristic',
                allowDefaultClinicalNer: true,
                allowEnglishContext: true,
                fallbackEligible: false,
                message:
                    'The text is Latin-script dominant and contains sufficient English routing evidence for MediBrief’s evaluated English/default-model path.',
                evidence,
            };
        }

        return {
            route: 'latin-script-language-unverified',
            inferredLanguage: 'unknown',
            basis: 'script-and-lexical-heuristic',
            allowDefaultClinicalNer: false,
            allowEnglishContext: false,
            fallbackEligible: true,
            message:
                'Latin script alone does not establish English. The source text was preserved, but the default English disease, medication, and assertion-context route was skipped because the language could not be established conservatively.',
            evidence,
        };
    }

    if (latinLetters > 0 && (arabicLetters > 0 || otherLetters > 0)) {
        return {
            route: 'mixed-script-review',
            inferredLanguage: 'mixed',
            basis: 'script-and-lexical-heuristic',
            allowDefaultClinicalNer: false,
            allowEnglishContext: false,
            fallbackEligible: true,
            message:
                'Mixed-script clinical text is not covered by an accepted MediBrief model route. The derived text was preserved, but local clinical NER was skipped.',
            evidence,
        };
    }

    return {
        route: 'unsupported-non-latin-clinical-ner',
        inferredLanguage: 'other',
        basis: 'script-and-lexical-heuristic',
        allowDefaultClinicalNer: false,
        allowEnglishContext: false,
        fallbackEligible: true,
        message:
            'The detected script is not covered by MediBrief’s evaluated default clinical-NER route. The source text was preserved, but local clinical NER was skipped.',
        evidence,
    };
};
