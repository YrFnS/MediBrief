import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string): string =>
    readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('Phase 2 personal record workspace', () => {
    it('launches the record workspace instead of making chat the application root', () => {
        const app = source('../App.tsx');
        const workspace = source('../features/layout/Phase2Workspace.tsx');

        expect(app).toContain('Phase2Workspace');
        expect(workspace).toContain("useState<PersonalRecordView>('overview')");
        expect(workspace).toContain('PersonalRecordNavigation');
        expect(workspace).toContain('PersonalHealthRecordShell');
    });

    it('keeps the local record available without an AI key', () => {
        const workspace = source('../features/layout/Phase2Workspace.tsx');
        const prompt = source(
            '../features/personal-health-record/components/AssistantAccessPrompt.tsx',
        );

        expect(workspace).toContain("view === 'assistant' && hasAnyApiKey");
        expect(prompt).toContain('record remain available without an AI key');
        expect(prompt).toContain('assistant is no longer the gatekeeper');
    });

    it('uses personal-record product language in the primary header', () => {
        const header = source('../components/Header.tsx');

        expect(header).toContain('LOCAL PERSONAL HEALTH RECORD');
        expect(header).toContain('Record workspace');
    });

    it('keeps undated events and emergency uncertainty explicit', () => {
        const timeline = source(
            '../features/personal-health-record/components/PatientTimeline.tsx',
        );
        const emergency = source(
            '../features/personal-health-record/components/EmergencySummary.tsx',
        );

        expect(timeline).toContain('Clinical date unknown');
        expect(timeline).toContain('not as the event date');
        expect(emergency).toContain('Allergy status unknown');
        expect(emergency).not.toContain('NKDA');
        expect(emergency).toContain('confirmed structured records');
    });
});
