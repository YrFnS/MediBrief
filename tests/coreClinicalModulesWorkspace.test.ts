import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string): string =>
    readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('Phase 2 core clinical modules', () => {
    it('exposes one scalable health-data destination with four dedicated modules', () => {
        const navigation = source(
            '../features/personal-health-record/components/PersonalRecordNavigation.tsx',
        );
        const workspace = source(
            '../features/personal-health-record/components/HealthDataWorkspace.tsx',
        );
        const shell = source(
            '../features/personal-health-record/PersonalHealthRecordShell.tsx',
        );

        expect(navigation).toContain("value: 'health-data'");
        expect(workspace).toContain("'conditions'");
        expect(workspace).toContain("'allergies'");
        expect(workspace).toContain("'medications'");
        expect(workspace).toContain("'results'");
        expect(shell).toContain("case 'health-data'");
    });

    it('keeps allergy and medication empty states clinically honest', () => {
        const allergies = source(
            '../features/personal-health-record/components/AllergiesModule.tsx',
        );
        const medications = source(
            '../features/personal-health-record/components/MedicationsModule.tsx',
        );

        expect(allergies).toContain('Allergy status unknown');
        expect(allergies).toContain('does not mean the patient has no allergies');
        expect(allergies).toContain('Do not interpret this empty state as NKDA');
        expect(medications).toContain('does not prove that the patient takes no medications');
        expect(medications).toContain('does not verify that a regimen is safe or appropriate');
    });

    it('keeps original result values and unknown clinical dates explicit', () => {
        const results = source(
            '../features/personal-health-record/components/ResultsModule.tsx',
        );
        const models = source(
            '../features/personal-health-record/coreModuleViewModels.ts',
        );

        expect(results).toContain('Original source value');
        expect(results).toContain(
            'Normalized values never replace the original source value',
        );
        expect(results).toContain('Clinical date unknown');
        expect(models).toContain(
            "UNKNOWN_CLINICAL_DATE_LABEL = 'Clinical date unknown'",
        );
        expect(models).toContain('hasExplicitUnknownEffectiveDate');
    });

    it('makes provenance and source review available across all four modules', () => {
        const conditions = source(
            '../features/personal-health-record/components/ConditionsModule.tsx',
        );
        const allergies = source(
            '../features/personal-health-record/components/AllergiesModule.tsx',
        );
        const medications = source(
            '../features/personal-health-record/components/MedicationsModule.tsx',
        );
        const results = source(
            '../features/personal-health-record/components/ResultsModule.tsx',
        );

        for (const moduleSource of [
            conditions,
            allergies,
            medications,
            results,
        ]) {
            expect(moduleSource).toContain('ProvenancePanel');
            expect(moduleSource).toContain('DocumentSourcePreview');
        }
    });
});
