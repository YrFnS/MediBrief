export type OpenMedClinicalLanguage = 'en' | 'ar' | 'mixed' | 'other' | 'unknown';

export type OpenMedLanguageRoute =
    | 'evaluated-english-defaults'
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
}

export interface OpenMedLanguageAssessment {
    route: OpenMedLanguageRoute;
    inferredLanguage: OpenMedClinicalLanguage;
    basis: 'script-heuristic';
    allowDefaultClinicalNer: boolean;
    allowEnglishContext: boolean;
    fallbackEligible: boolean;
    message: string;
    evidence: OpenMedLanguageEvidence;
}

const LETTER = /\p{Letter}/u;
const LATIN = /\p{Script=Latin}/u;
const ARABIC = /\p{Script=Arabic}/u;

// A single unit suffix or abbreviation is not enough evidence to route an
// otherwise numeric measurement string through an English clinical model.
const MIN_ALPHABETIC_EVIDENCE = 4;

const share = (value: number, total: number): number =>
    total > 0 ? value / total : 0;

const undeterminedAssessment = (
    evidence: OpenMedLanguageEvidence,
): OpenMedLanguageAssessment => ({
    route: 'undetermined',
    inferredLanguage: 'unknown',
    basis: 'script-heuristic',
    allowDefaultClinicalNer: false,
    allowEnglishContext: false,
    fallbackEligible: true,
    message:
        'There was not enough alphabetic clinical text to route through the evaluated default OpenMed models.',
    evidence,
});

/**
 * Conservative routing for the default disease and medication models.
 *
 * This is intentionally a script assessment rather than a claim of full
 * language identification. MediBrief currently has accepted regression
 * evidence only for its English/default-model route. Arabic OCR capability,
 * Arabic PII support, and Arabic clinical NER are separate capabilities.
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

    const evidence: OpenMedLanguageEvidence = {
        totalLetters,
        latinLetters,
        arabicLetters,
        otherLetters,
        latinShare: share(latinLetters, totalLetters),
        arabicShare: share(arabicLetters, totalLetters),
        otherShare: share(otherLetters, totalLetters),
    };

    if (totalLetters < MIN_ALPHABETIC_EVIDENCE) {
        return undeterminedAssessment(evidence);
    }

    if (evidence.latinShare >= 0.85) {
        return {
            route: 'evaluated-english-defaults',
            inferredLanguage: 'en',
            basis: 'script-heuristic',
            allowDefaultClinicalNer: true,
            allowEnglishContext: true,
            fallbackEligible: false,
            message:
                'The text is Latin-script dominant and can use MediBrief’s evaluated English/default-model route.',
            evidence,
        };
    }

    if (evidence.arabicShare >= 0.60) {
        return {
            route: 'unsupported-arabic-clinical-ner',
            inferredLanguage: 'ar',
            basis: 'script-heuristic',
            allowDefaultClinicalNer: false,
            allowEnglishContext: false,
            fallbackEligible: true,
            message:
                'Arabic text was preserved as document evidence, but the configured default disease and medication models have no accepted Arabic clinical-NER evidence in MediBrief. Local clinical NER was skipped.',
            evidence,
        };
    }

    if (latinLetters > 0 && (arabicLetters > 0 || otherLetters > 0)) {
        return {
            route: 'mixed-script-review',
            inferredLanguage: 'mixed',
            basis: 'script-heuristic',
            allowDefaultClinicalNer: false,
            allowEnglishContext: false,
            fallbackEligible: true,
            message:
                'Mixed-script clinical text is not yet covered by an accepted MediBrief model route. The derived text was preserved, but local clinical NER was skipped.',
            evidence,
        };
    }

    return {
        route: 'unsupported-non-latin-clinical-ner',
        inferredLanguage: 'other',
        basis: 'script-heuristic',
        allowDefaultClinicalNer: false,
        allowEnglishContext: false,
        fallbackEligible: true,
        message:
            'The detected script is not covered by MediBrief’s evaluated default clinical-NER route. The source text was preserved, but local clinical NER was skipped.',
        evidence,
    };
};