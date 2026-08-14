import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string): string =>
    readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('P4 workspace information hierarchy', () => {
    it('uses task-oriented primary patient-record destinations', () => {
        const navigation = source(
            '../features/personal-health-record/components/PersonalRecordNavigation.tsx',
        );

        expect(navigation).toContain("label: 'Today'");
        expect(navigation).toContain("label: 'Health Record'");
        expect(navigation).toContain("label: 'Timeline'");
        expect(navigation).toContain("label: 'Search & Export'");
        expect(navigation).toContain("label: 'Emergency'");
        expect(navigation).toContain("label: 'Assistant'");
        expect(navigation).toContain(
            'Attention items and confirmed record at a glance',
        );
    });

    it('replaces the flat fifteen-module strip with six clinical areas', () => {
        const workspace = source(
            '../features/personal-health-record/components/HealthDataWorkspace.tsx',
        );

        for (const area of [
            "'record'",
            "'medications'",
            "'results'",
            "'care'",
            "'documents'",
            "'manage'",
        ]) {
            expect(workspace).toContain(area);
        }

        expect(workspace).toContain('aria-label="Health record areas"');
        expect(workspace).toContain('role="tablist"');
        expect(workspace).toContain('aria-controls="health-data-panel"');
        expect(workspace).toContain('INITIAL_AREA_SELECTIONS');
        expect(workspace).toContain('areaBadges');
    });

    it('keeps every existing clinical module reachable inside one area', () => {
        const workspace = source(
            '../features/personal-health-record/components/HealthDataWorkspace.tsx',
        );

        const expectedMappings = [
            ["value: 'conditions'", "area: 'record'"],
            ["value: 'allergies'", "area: 'record'"],
            ["value: 'visits'", "area: 'record'"],
            ["value: 'procedures'", "area: 'record'"],
            ["value: 'immunizations'", "area: 'record'"],
            ["value: 'notes'", "area: 'record'"],
            ["value: 'medications'", "area: 'medications'"],
            [
                "value: 'medication-reconciliation'",
                "area: 'medications'",
            ],
            ["value: 'results'", "area: 'results'"],
            ["value: 'trend-reminders'", "area: 'results'"],
            ["value: 'appointments'", "area: 'care'"],
            ["value: 'tasks'", "area: 'care'"],
            ["value: 'care-plans'", "area: 'care'"],
            ["value: 'documents'", "area: 'documents'"],
            ["value: 'manage'", "area: 'manage'"],
        ];

        for (const [value, area] of expectedMappings) {
            const valueIndex = workspace.indexOf(value);
            expect(valueIndex).toBeGreaterThan(-1);
            expect(workspace.slice(valueIndex, valueIndex + 180))
                .toContain(area);
        }
    });

    it('uses progressive secondary navigation on desktop and mobile', () => {
        const workspace = source(
            '../features/personal-health-record/components/HealthDataWorkspace.tsx',
        );

        expect(workspace).toContain('id="health-data-module-select"');
        expect(workspace).toContain(
            'aria-label={`${activeArea.label} section`}',
        );
        expect(workspace).toContain(
            'aria-label={`${activeArea.label} sections`}',
        );
        expect(workspace).toContain('className="hidden max-w-full');
        expect(workspace).toContain('className="flex min-w-0 flex-col');
        expect(workspace).toContain('aria-current={active');
    });

    it('preserves the existing candidate-only modules and review entry points', () => {
        const workspace = source(
            '../features/personal-health-record/components/HealthDataWorkspace.tsx',
        );

        for (const component of [
            'ConditionsModule',
            'AllergiesModule',
            'MedicationsModule',
            'MedicationReconciliationWorkspace',
            'ResultsModule',
            'TrendAndReminderWorkspace',
            'VisitsModule',
            'NotesModule',
            'ProceduresModule',
            'ImmunizationsModule',
            'DocumentsModule',
            'AppointmentsModule',
            'TasksModule',
            'CarePlansModule',
            'RecordManagementModule',
        ]) {
            expect(workspace).toContain(`<${component}`);
        }

        expect(workspace).toContain(
            'onReviewCandidates={onReviewCandidates}',
        );
    });
});
