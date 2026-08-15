import type { AuditEvent } from '../audit/types';
import type { PatientClinicalRecord } from '../clinical-record';
import {
    buildMedicationReconciliationViewModel,
} from '../medication-reconciliation';
import { buildExplicitReminderViewModel } from '../trend-reminders';
import type { PersonalHealthDataNavigationIntent } from './navigationTypes';
import { buildPatientOverviewViewModel } from './viewModels';

export type TodayAttentionKind =
    | 'medication-reconciliation'
    | 'explicit-reminders'
    | 'tasks'
    | 'appointments'
    | 'record-gaps';

export interface TodayAttentionItem {
    id: TodayAttentionKind;
    kind: TodayAttentionKind;
    count: number;
    title: string;
    description: string;
    actionLabel: string;
    destination: PersonalHealthDataNavigationIntent;
}

export interface TodayAttentionSignals {
    candidateCount: number;
    medicationReconciliationCount: number;
    explicitReminderCount: number;
    openTaskCount: number;
    appointmentFollowUpCount: number;
    recordGapCount: number;
}

export interface TodayAttentionViewModel {
    candidateCount: number;
    items: TodayAttentionItem[];
    hasTrackedAttention: boolean;
    evidenceBoundary: string;
}

const plural = (count: number, singular: string, pluralLabel: string): string =>
    count === 1 ? singular : pluralLabel;

export const buildTodayAttentionFromSignals = (
    signals: TodayAttentionSignals,
): TodayAttentionViewModel => {
    const items: TodayAttentionItem[] = [];

    if (signals.medicationReconciliationCount > 0) {
        const count = signals.medicationReconciliationCount;
        items.push({
            id: 'medication-reconciliation',
            kind: 'medication-reconciliation',
            count,
            title: 'Medication reconciliation',
            description: `${count} ${plural(
                count,
                'source discrepancy or pending action needs',
                'source discrepancies or pending actions need',
            )} explicit review.`,
            actionLabel: 'Open reconciliation',
            destination: {
                area: 'medications',
                module: 'medication-reconciliation',
            },
        });
    }

    if (signals.explicitReminderCount > 0) {
        const count = signals.explicitReminderCount;
        items.push({
            id: 'explicit-reminders',
            kind: 'explicit-reminders',
            count,
            title: 'Explicit due-date reminders',
            description: `${count} ${plural(
                count,
                'reminder is',
                'reminders are',
            )} actionable from a recorded due date.`,
            actionLabel: 'Open reminders',
            destination: {
                area: 'results',
                module: 'trend-reminders',
            },
        });
    }

    if (signals.openTaskCount > 0) {
        const count = signals.openTaskCount;
        items.push({
            id: 'tasks',
            kind: 'tasks',
            count,
            title: 'Open tasks',
            description: `${count} confirmed ${plural(
                count,
                'task remains',
                'tasks remain',
            )} outside a terminal state.`,
            actionLabel: 'Open tasks',
            destination: {
                area: 'care',
                module: 'tasks',
            },
        });
    }

    if (signals.appointmentFollowUpCount > 0) {
        const count = signals.appointmentFollowUpCount;
        items.push({
            id: 'appointments',
            kind: 'appointments',
            count,
            title: 'Appointment follow-up',
            description: `${count} confirmed ${plural(
                count,
                'appointment is',
                'appointments are',
            )} proposed, pending, booked, or arrived.`,
            actionLabel: 'Open appointments',
            destination: {
                area: 'care',
                module: 'appointments',
            },
        });
    }

    if (signals.recordGapCount > 0) {
        const count = signals.recordGapCount;
        items.push({
            id: 'record-gaps',
            kind: 'record-gaps',
            count,
            title: 'Record gaps',
            description: `${count} ${plural(
                count,
                'field or status is',
                'fields or statuses are',
            )} missing or not confirmed locally.`,
            actionLabel: 'Open record manager',
            destination: {
                area: 'manage',
                module: 'manage',
            },
        });
    }

    return {
        candidateCount: Math.max(0, signals.candidateCount),
        items,
        hasTrackedAttention: items.length > 0,
        evidenceBoundary:
            'Signals are separate and may overlap. Counts do not indicate clinical severity, triage priority, or record completeness.',
    };
};

export const buildTodayAttentionViewModel = (
    record: PatientClinicalRecord,
    auditEvents: AuditEvent[],
): TodayAttentionViewModel => {
    const overview = buildPatientOverviewViewModel(record);
    const reconciliation = buildMedicationReconciliationViewModel(
        record,
        auditEvents,
    );
    const reminders = buildExplicitReminderViewModel(record);
    const taskCount = overview.pendingFollowUp.filter(
        item => item.kind === 'task',
    ).length;
    const appointmentCount = overview.pendingFollowUp.filter(
        item => item.kind === 'appointment',
    ).length;
    const candidateGapCount = overview.pendingCandidates > 0 ? 1 : 0;

    return buildTodayAttentionFromSignals({
        candidateCount: overview.pendingCandidates,
        medicationReconciliationCount:
            reconciliation.unreviewedCount
            + reconciliation.actionPendingCount,
        explicitReminderCount: reminders.actionableCount,
        openTaskCount: taskCount,
        appointmentFollowUpCount: appointmentCount,
        recordGapCount: Math.max(
            0,
            overview.dataGaps.length - candidateGapCount,
        ),
    });
};
