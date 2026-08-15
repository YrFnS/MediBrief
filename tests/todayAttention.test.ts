import { describe, expect, it } from 'vitest';
import {
    buildTodayAttentionFromSignals,
    buildTodayAttentionViewModel,
} from '../features/personal-health-record';
import {
    makeCondition,
    makeMedication,
    makePatientRecord,
} from './fixtures';

describe('Today attention view model', () => {
    it('keeps deterministic signals separate and maps them to real sections', () => {
        const view = buildTodayAttentionFromSignals({
            candidateCount: 4,
            medicationReconciliationCount: 2,
            explicitReminderCount: 1,
            openTaskCount: 3,
            appointmentFollowUpCount: 2,
            recordGapCount: 5,
        });

        expect(view.candidateCount).toBe(4);
        expect(view.items.map(item => ({
            kind: item.kind,
            count: item.count,
            destination: item.destination,
        }))).toEqual([
            {
                kind: 'medication-reconciliation',
                count: 2,
                destination: {
                    area: 'medications',
                    module: 'medication-reconciliation',
                },
            },
            {
                kind: 'explicit-reminders',
                count: 1,
                destination: {
                    area: 'results',
                    module: 'trend-reminders',
                },
            },
            {
                kind: 'tasks',
                count: 3,
                destination: { area: 'care', module: 'tasks' },
            },
            {
                kind: 'appointments',
                count: 2,
                destination: { area: 'care', module: 'appointments' },
            },
            {
                kind: 'record-gaps',
                count: 5,
                destination: { area: 'manage', module: 'manage' },
            },
        ]);
        expect('total' in view).toBe(false);
        expect(view.evidenceBoundary).toContain('may overlap');
        expect(view.evidenceBoundary).toContain('do not indicate clinical severity');
    });

    it('does not turn candidate medications into reconciliation attention', () => {
        const record = makePatientRecord();
        record.resources.medications.push(makeMedication({
            verificationStatus: 'candidate',
        }));
        record.resources.conditions.push(makeCondition({
            id: 'condition-candidate',
            verificationStatus: 'candidate',
        }));

        const view = buildTodayAttentionViewModel(record, []);

        expect(view.candidateCount).toBe(2);
        expect(view.items.some(item =>
            item.kind === 'medication-reconciliation')).toBe(false);
        expect(view.items.find(item => item.kind === 'record-gaps')?.count)
            .toBeGreaterThan(0);
    });

    it('uses an explicit safe empty state rather than an all-clear', () => {
        const view = buildTodayAttentionFromSignals({
            candidateCount: 0,
            medicationReconciliationCount: 0,
            explicitReminderCount: 0,
            openTaskCount: 0,
            appointmentFollowUpCount: 0,
            recordGapCount: 0,
        });

        expect(view.hasTrackedAttention).toBe(false);
        expect(view.items).toEqual([]);
        expect(view.evidenceBoundary).toContain('record completeness');
    });
});
