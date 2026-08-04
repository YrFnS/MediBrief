import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string): string =>
    readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('OpenMed accepted language boundary', () => {
    it('shows the conservative English, Arabic, mixed-script, and measurement-only policy', () => {
        const panel = source(
            '../features/settings/OpenMedSettingsPanel.tsx',
        );
        const policy = source(
            '../features/openmed/languagePolicy.ts',
        );
        const acceptance = source(
            '../docs/architecture/PHASE_3_ACCEPTANCE_EVIDENCE.md',
        );

        expect(panel).toContain('Accepted language boundary');
        expect(panel).toContain('Arabic, mixed-script, other non-Latin, and measurement-only text');
        expect(panel).toContain('does not enable Arabic clinical extraction');
        expect(policy).toContain('MIN_ALPHABETIC_EVIDENCE');
        expect(policy).toContain('unsupported-arabic-clinical-ner');
        expect(policy).toContain('mixed-script-review');
        expect(acceptance).toContain('Arabic default clinical NER: blocked');
        expect(acceptance).toContain('merged_predictions: false');
        expect(acceptance).toContain('verificationStatus: candidate');
    });
});
