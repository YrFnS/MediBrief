import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Phase 5 trend explanation and reminder workspace', () => {
    const workspace = readFileSync(
        'features/trend-reminders/components/TrendAndReminderWorkspace.tsx',
        'utf8',
    );
    const reminders = readFileSync(
        'features/trend-reminders/reminders.ts',
        'utf8',
    );
    const trends = readFileSync(
        'features/trend-reminders/trends.ts',
        'utf8',
    );
    const grounding = readFileSync(
        'features/trend-reminders/grounding.ts',
        'utf8',
    );
    const modelClient = readFileSync(
        'features/trend-reminders/modelExplanation.ts',
        'utf8',
    );
    const healthData = readFileSync(
        'features/personal-health-record/components/HealthDataWorkspace.tsx',
        'utf8',
    );
    const auditTypes = readFileSync(
        'features/audit/types.ts',
        'utf8',
    );

    it('adds a dedicated Health Data destination with deterministic no-AI wording', () => {
        expect(healthData).toContain("value: 'trend-reminders'");
        expect(healthData).toContain('TrendAndReminderWorkspace');
        expect(workspace).toContain('Deterministic description · no AI required');
        expect(workspace).toContain('Recorded trends and explicit reminders');
        expect(trends).toContain('buildDiagnosticResultsIntelligence');
        expect(trends).toContain('Comparator, qualitative, narrative, absent, superseded');
    });

    it('keeps optional model wording local to selected points and disables external tools', () => {
        expect(grounding).toContain('This request is restricted to the exact Phase 4-eligible plotted points');
        expect(grounding).toContain('Every selected plotted point must be cited at least once');
        expect(grounding).toContain('Do not use web search');
        expect(grounding).toContain('did not cite every plotted point');
        expect(modelClient).toContain('External tools and web search are unavailable');
        expect(modelClient).not.toContain('googleSearch');
        expect(workspace).toContain('remains hidden until citations validate');
    });

    it('derives reminders from explicit fields and does not claim external execution', () => {
        expect(reminders).toContain('task.due');
        expect(reminders).toContain('appointment.start');
        expect(reminders).toContain('carePlan.period');
        expect(reminders).toContain('medication.end');
        expect(reminders).toContain('futureStart');
        expect(reminders).toContain('Unscheduled — no explicit date recorded');
        expect(reminders).toContain("intent: 'proposal'");
        expect(reminders).toContain("priority: 'routine'");
        expect(reminders).toContain("'not-an-order'");
        expect(reminders).toContain('does not send a notification');
        expect(workspace).toContain('does not send notifications');
        expect(workspace).toContain('No notification, booking, order, prescription, or external action was sent.');
    });

    it('requires explicit user action for task creation and preserves source review', () => {
        expect(workspace).toContain('Required review reason');
        expect(workspace).toContain('Create local review task');
        expect(workspace).toContain('Save proposal task');
        expect(workspace).toContain('DocumentSourcePreview');
        expect(workspace).toContain('View original source');
        expect(reminders).toContain('Creating a reminder follow-up task requires a review reason');
    });

    it('records separate trend and reminder audit events', () => {
        expect(auditTypes).toContain("'TREND_GROUNDING_BUNDLE_GENERATED'");
        expect(auditTypes).toContain("'TREND_ASSISTANT_COMPLETED'");
        expect(auditTypes).toContain("'TREND_ASSISTANT_REJECTED'");
        expect(auditTypes).toContain("'REMINDER_TASK_CREATED'");
        expect(workspace).toContain("'TREND_GROUNDING_BUNDLE_GENERATED'");
        expect(workspace).toContain("'REMINDER_TASK_CREATED'");
    });
});
