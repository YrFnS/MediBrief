import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string): string =>
    readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('Phase 2 planning and follow-up modules', () => {
    it('adds appointments, tasks, and care plans to the scalable health data workspace', () => {
        const workspace = source(
            '../features/personal-health-record/components/HealthDataWorkspace.tsx',
        );

        expect(workspace).toContain("value: 'appointments'");
        expect(workspace).toContain("value: 'tasks'");
        expect(workspace).toContain("value: 'care-plans'");
        expect(workspace).toContain('AppointmentsModule');
        expect(workspace).toContain('TasksModule');
        expect(workspace).toContain('CarePlansModule');
    });

    it('does not turn appointment proposals into bookings', () => {
        const appointments = source(
            '../features/personal-health-record/components/AppointmentsModule.tsx',
        );
        const models = source(
            '../features/personal-health-record/planningModuleViewModels.ts',
        );

        expect(appointments).toContain('Proposed and pending records are not bookings');
        expect(appointments).toContain('does not contact a clinic');
        expect(models).toContain('Proposed — not booked');
        expect(models).toContain('Pending — booking not confirmed');
        expect(models).toContain('Recorded as booked');
    });

    it('keeps reminders local and order execution unconfirmed', () => {
        const tasks = source(
            '../features/personal-health-record/components/TasksModule.tsx',
        );
        const models = source(
            '../features/personal-health-record/planningModuleViewModels.ts',
        );

        expect(tasks).toContain('does not send an external order');
        expect(tasks).toContain('does not prove that care was performed');
        expect(models).toContain('Proposal only — not an order');
        expect(models).toContain('external execution not confirmed');
        expect(models).toContain("return 'no-date'");
    });

    it('keeps care-plan intent separate from completed care', () => {
        const plans = source(
            '../features/personal-health-record/components/CarePlansModule.tsx',
        );
        const models = source(
            '../features/personal-health-record/planningModuleViewModels.ts',
        );

        expect(plans).toContain('Plan state is not execution evidence');
        expect(plans).toContain('does not prove that an external order was transmitted');
        expect(models).toContain('activities may still be pending');
        expect(models).toContain('not selected or executed by implication');
    });

    it('preserves provenance and original-source review in all three modules', () => {
        const appointments = source(
            '../features/personal-health-record/components/AppointmentsModule.tsx',
        );
        const tasks = source(
            '../features/personal-health-record/components/TasksModule.tsx',
        );
        const plans = source(
            '../features/personal-health-record/components/CarePlansModule.tsx',
        );

        for (const moduleSource of [appointments, tasks, plans]) {
            expect(moduleSource).toContain('ProvenancePanel');
            expect(moduleSource).toContain('DocumentSourcePreview');
        }
    });
});
