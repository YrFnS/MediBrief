import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string): string =>
    readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('Phase 2 longitudinal clinical modules', () => {
    it('adds visits, notes, procedures, immunizations, and documents to Health Data', () => {
        const workspace = source(
            '../features/personal-health-record/components/HealthDataWorkspace.tsx',
        );

        for (const moduleName of [
            "value: 'visits'",
            "value: 'notes'",
            "value: 'procedures'",
            "value: 'immunizations'",
            "value: 'documents'",
        ]) {
            expect(workspace).toContain(moduleName);
        }
        expect(workspace).toContain('VisitsModule');
        expect(workspace).toContain('NotesModule');
        expect(workspace).toContain('ProceduresModule');
        expect(workspace).toContain('ImmunizationsModule');
        expect(workspace).toContain('DocumentsModule');
    });

    it('keeps durable notes distinct from chat and preserves full sections', () => {
        const notes = source(
            '../features/personal-health-record/components/NotesModule.tsx',
        );

        expect(notes).toContain('Chat messages are not treated as clinical notes');
        expect(notes).toContain('whitespace-pre-wrap');
        expect(notes).toContain('Source documents');
        expect(notes).toContain('Transcript document');
    });

    it('labels device matches as evidence rather than a confirmed inventory', () => {
        const procedures = source(
            '../features/personal-health-record/components/ProceduresModule.tsx',
        );

        expect(procedures).toContain('Device information boundary');
        expect(procedures).toContain('does not yet maintain a standalone implant or assistive-device inventory');
        expect(procedures).toContain('A keyword match is evidence to review');
        expect(procedures).not.toContain('Confirmed device inventory');
    });

    it('keeps sparse immunization and document states clinically honest', () => {
        const immunizations = source(
            '../features/personal-health-record/components/ImmunizationsModule.tsx',
        );
        const documents = source(
            '../features/personal-health-record/components/DocumentsModule.tsx',
        );

        expect(immunizations).toContain('does not prove that the patient is unvaccinated');
        expect(documents).toContain('Upload time never replaces an unknown authored or clinical date');
        expect(documents).toContain('Missing binary assets remain explicit');
    });

    it('provides provenance and source review across all five modules', () => {
        const modules = [
            '../features/personal-health-record/components/VisitsModule.tsx',
            '../features/personal-health-record/components/NotesModule.tsx',
            '../features/personal-health-record/components/ProceduresModule.tsx',
            '../features/personal-health-record/components/ImmunizationsModule.tsx',
            '../features/personal-health-record/components/DocumentsModule.tsx',
        ].map(source);

        for (const moduleSource of modules) {
            expect(moduleSource).toContain('ProvenancePanel');
            expect(moduleSource).toContain('DocumentSourcePreview');
        }
    });
});
