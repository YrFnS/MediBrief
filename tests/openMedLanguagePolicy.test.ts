import { describe, expect, it } from 'vitest';
import { assessOpenMedClinicalLanguage } from '../features/openmed';

describe('OpenMed clinical language routing', () => {
    it('allows the evaluated English/default-model route only with lexical evidence', () => {
        const result = assessOpenMedClinicalLanguage(
            'Patient has asthma and takes albuterol 2 puffs twice daily.',
        );

        expect(result).toMatchObject({
            route: 'evaluated-english-defaults',
            inferredLanguage: 'en',
            basis: 'script-and-lexical-heuristic',
            allowDefaultClinicalNer: true,
            allowEnglishContext: true,
            fallbackEligible: false,
        });
        expect(result.evidence.latinShare).toBe(1);
        expect(result.evidence.englishMarkers).toEqual(
            expect.arrayContaining(['daily', 'has', 'patient', 'takes', 'twice']),
        );
        expect(result.evidence.englishMarkerCount).toBeGreaterThanOrEqual(2);
    });

    it('does not confuse Latin script with established English', () => {
        const spanish = assessOpenMedClinicalLanguage(
            'El paciente tiene asma y usa albuterol.',
        );
        const isolatedLabels = assessOpenMedClinicalLanguage(
            'Asthma albuterol metformin',
        );

        expect(spanish).toMatchObject({
            route: 'latin-script-language-unverified',
            inferredLanguage: 'unknown',
            allowDefaultClinicalNer: false,
            allowEnglishContext: false,
            fallbackEligible: true,
        });
        expect(isolatedLabels.route).toBe('latin-script-language-unverified');
        expect(isolatedLabels.evidence.englishMarkerCount).toBe(0);
        expect(spanish.message).toContain('Latin script alone does not establish English');
    });

    it('keeps Arabic text as source evidence but blocks unevaluated default clinical NER', () => {
        const result = assessOpenMedClinicalLanguage(
            'المريض لديه ربو ويستخدم بخاخ سالبوتامول.',
        );

        expect(result).toMatchObject({
            route: 'unsupported-arabic-clinical-ner',
            inferredLanguage: 'ar',
            allowDefaultClinicalNer: false,
            allowEnglishContext: false,
            fallbackEligible: true,
        });
        expect(result.message).toContain('Arabic text was preserved');
        expect(result.message).toContain('clinical NER was skipped');
        expect(result.message).toContain('Arabic OCR capability');
        expect(result.evidence.arabicShare).toBe(1);
    });

    it('blocks mixed-script notes until a measured route is accepted', () => {
        const result = assessOpenMedClinicalLanguage(
            'Diagnosis التشخيص: asthma ربو',
        );

        expect(result).toMatchObject({
            route: 'mixed-script-review',
            inferredLanguage: 'mixed',
            allowDefaultClinicalNer: false,
            allowEnglishContext: false,
            fallbackEligible: true,
        });
        expect(result.evidence.latinLetters).toBeGreaterThan(0);
        expect(result.evidence.arabicLetters).toBeGreaterThan(0);
    });

    it('does not invent a language route for measurement-only content', () => {
        const result = assessOpenMedClinicalLanguage('120/80 · 98% · 37.0°C');

        expect(result).toMatchObject({
            route: 'undetermined',
            inferredLanguage: 'unknown',
            allowDefaultClinicalNer: false,
            allowEnglishContext: false,
            fallbackEligible: true,
        });
        expect(result.evidence.totalLetters).toBe(1);
        expect(result.message).toContain('not enough alphabetic clinical text');
    });

    it('tolerates a small number of non-Latin symbols in an English note', () => {
        const result = assessOpenMedClinicalLanguage(
            'The patient takes a β-blocker with treatment continuing daily.',
        );

        expect(result.route).toBe('evaluated-english-defaults');
        expect(result.allowDefaultClinicalNer).toBe(true);
        expect(result.evidence.otherLetters).toBe(1);
        expect(result.evidence.englishMarkerCount).toBeGreaterThanOrEqual(2);
    });
});
