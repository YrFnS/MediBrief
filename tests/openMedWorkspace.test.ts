import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string): string =>
    readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('Phase 3 OpenMed workspace contracts', () => {
    it('keeps clinical extraction settings separate from chat-provider settings', () => {
        const settings = source(
            '../features/settings/useSettingsStore.ts',
        );
        const modal = source(
            '../features/settings/SettingsModal.tsx',
        );
        const openMedPanel = source(
            '../features/settings/OpenMedSettingsPanel.tsx',
        );

        expect(settings).toContain("extractionMode: 'auto'");
        expect(settings).toContain('openMedBaseUrl');
        expect(settings).toContain('openMedDiseaseModel');
        expect(settings).toContain('openMedMedicationModel');
        expect(settings).toContain('allowGeminiExtractionFallback: false');
        expect(modal).toContain('Assistant AI');
        expect(modal).toContain('OpenMedSettingsPanel');
        expect(openMedPanel).toContain('Clinical document extraction');
        expect(openMedPanel).toContain('OpenMed only');
        expect(openMedPanel).toContain('Gemini only');
        expect(openMedPanel).toContain('Test local service');
    });

    it('never represents OpenMed named entities as confirmed patient facts', () => {
        const mapping = source(
            '../features/openmed/candidateMapping.ts',
        );

        expect(mapping).toContain("verificationStatus: 'candidate'");
        expect(mapping).toContain("polarity: 'unknown'");
        expect(mapping).toContain("certainty: 'unknown'");
        expect(mapping).toContain("temporality: 'unknown'");
        expect(mapping).toContain("experiencer: 'unknown'");
        expect(mapping).toContain('startOffset: entity.start');
        expect(mapping).toContain('endOffset: entity.end');
        expect(mapping).toContain("externalSystem: 'openmed:rest'");
        expect(mapping).not.toContain("verificationStatus: 'confirmed'");
    });

    it('keeps local OpenMed and cloud Gemini provenance distinguishable', () => {
        const extractionHook = source('../hooks/useEntityExtractor.ts');
        const mapping = source(
            '../features/openmed/candidateMapping.ts',
        );

        expect(mapping).toContain('OpenMed local REST NER');
        expect(mapping).toContain('openmed-extracted');
        expect(extractionHook).toContain(
            'Google Gemini compatibility extraction',
        );
        expect(extractionHook).toContain(
            'medibrief:gemini-entity-extraction',
        );
        expect(extractionHook).toContain('gemini-extracted');
    });

    it('allows fallback only through explicit Auto-mode policy', () => {
        const extractionHook = source('../hooks/useEntityExtractor.ts');
        const settingsPanel = source(
            '../features/settings/OpenMedSettingsPanel.tsx',
        );

        expect(extractionHook).toContain(
            "settings.extractionMode === 'openmed'",
        );
        expect(extractionHook).toContain(
            '!settings.allowGeminiExtractionFallback',
        );
        expect(extractionHook).toContain(
            "openMedResult.status === 'invalid'",
        );
        expect(extractionHook).toContain(
            "openMedResult.status === 'too-large'",
        );
        expect(extractionHook).toContain(
            'Auto mode reaches this branch only when local extraction is',
        );
        expect(settingsPanel).toContain(
            'Use local OpenMed for supported text',
        );
        expect(settingsPanel).toContain(
            'Gemini output keeps separate cloud-extraction provenance',
        );
    });

    it('does not claim PDF or image OCR exists in the text-only slice', () => {
        const decoder = source(
            '../features/openmed/documentText.ts',
        );
        const plan = source(
            '../docs/PHASE_3_OPENMED_EXTRACTION_PLAN.md',
        );

        expect(decoder).toContain(
            'PDF and image OCR are not enabled yet',
        );
        expect(plan).toContain(
            'PDF and image content is never represented as text',
        );
        expect(plan).toContain(
            'PDF and image processing needs a real local extraction or OCR pipeline',
        );
    });
});
