import { describe, expect, it } from 'vitest';
import {
    parseClinicalRecordResource,
    type ClinicalRecordResource,
} from '../features/clinical-record';
import {
    buildAppointmentsModuleViewModel,
    buildCarePlansModuleViewModel,
    buildClinicalTasksModuleViewModel,
} from '../features/personal-health-record';
import {
    FIXED_TIME,
    clinicalDay,
    makeCondition,
    makePatientRecord,
    unknownClinicalDate,
} from './fixtures';

const confirmedBase = (
    id: string,
    patientId = 'patient-1',
) => ({
    id,
    patientId,
    verificationStatus: 'confirmed' as const,
    recordedAt: FIXED_TIME,
    assertion: {
        polarity: 'affirmed' as const,
        certainty: 'certain' as const,
        temporality: 'current' as const,
        experiencer: 'patient' as const,
    },
    provenance: {
        source: {
            kind: 'manual' as const,
            description: 'Planning module test fixture',
        },
        createdAt: FIXED_TIME,
        updatedAt: FIXED_TIME,
        confirmation: {
            reviewedAt: FIXED_TIME,
            reviewedBy: 'test-user',
            reason: 'Confirmed test record',
        },
    },
    amendments: [],
});

const candidateBase = (id: string) => ({
    ...confirmedBase(id),
    verificationStatus: 'candidate' as const,
    provenance: {
        source: {
            kind: 'ai-suggestion' as const,
            description: 'Candidate planning fixture',
        },
        createdAt: FIXED_TIME,
        updatedAt: FIXED_TIME,
    },
});

const add = (
    record: ReturnType<typeof makePatientRecord>,
    resource: ClinicalRecordResource,
): void => {
    switch (resource.resourceType) {
        case 'PatientProfile':
            record.profile = resource;
            return;
        case 'Encounter':
            record.resources.encounters.push(resource);
            return;
        case 'Condition':
            record.resources.conditions.push(resource);
            return;
        case 'AllergyIntolerance':
            record.resources.allergies.push(resource);
            return;
        case 'Medication':
            record.resources.medications.push(resource);
            return;
        case 'Observation':
            record.resources.observations.push(resource);
            return;
        case 'DiagnosticReport':
            record.resources.diagnosticReports.push(resource);
            return;
        case 'Specimen':
            record.resources.specimens.push(resource);
            return;
        case 'Procedure':
            record.resources.procedures.push(resource);
            return;
        case 'Immunization':
            record.resources.immunizations.push(resource);
            return;
        case 'Appointment':
            record.resources.appointments.push(resource);
            return;
        case 'ClinicalTask':
            record.resources.tasks.push(resource);
            return;
        case 'CarePlan':
            record.resources.carePlans.push(resource);
            return;
        case 'DocumentReference':
            record.resources.documents.push(resource);
            return;
        case 'ClinicalNote':
            record.resources.notes.push(resource);
            return;
    }
};

describe('appointments module', () => {
    it('separates proposals from booked and historical states without inferring a booking from a time', () => {
        const record = makePatientRecord();
        add(record, parseClinicalRecordResource({
            ...confirmedBase('appointment-proposed'),
            resourceType: 'Appointment',
            status: 'proposed',
            title: 'Cardiology follow-up request',
            start: '2026-08-10T09:00:00.000Z',
            end: '2026-08-10T09:30:00.000Z',
            participants: [{
                name: 'Cardiology clinic',
                status: 'needs-action',
            }],
        }));
        add(record, parseClinicalRecordResource({
            ...confirmedBase('appointment-booked'),
            resourceType: 'Appointment',
            status: 'booked',
            title: 'Recorded booked visit',
            start: '2026-08-20T12:00:00.000Z',
            participants: [{ name: 'Primary care clinic', status: 'accepted' }],
        }));
        add(record, parseClinicalRecordResource({
            ...confirmedBase('appointment-history'),
            resourceType: 'Appointment',
            status: 'fulfilled',
            title: 'Completed visit',
            start: '2026-07-01T08:00:00.000Z',
            participants: [],
        }));
        add(record, parseClinicalRecordResource({
            ...candidateBase('appointment-candidate'),
            resourceType: 'Appointment',
            status: 'proposed',
            title: 'Unreviewed request',
            participants: [],
        }));

        const view = buildAppointmentsModuleViewModel(record, {
            scope: 'all',
            referenceDate: new Date('2026-07-31T12:00:00.000Z'),
        });

        expect(view.totalConfirmed).toBe(3);
        expect(view.currentCount).toBe(2);
        expect(view.historicalCount).toBe(1);
        expect(view.candidateCount).toBe(1);
        expect(view.items.find(item => item.id === 'appointment-proposed'))
            .toMatchObject({
                bookingMeaning: 'Proposed — not booked',
                timing: 'upcoming',
                knownClinicalDate: true,
            });
        expect(view.items.find(item => item.id === 'appointment-booked'))
            .toMatchObject({
                bookingMeaning: 'Recorded as booked',
                status: 'booked',
            });
        expect(view.items.some(item => item.id === 'appointment-candidate'))
            .toBe(false);
    });

    it('keeps an explicitly unknown requested period unknown', () => {
        const record = makePatientRecord();
        add(record, parseClinicalRecordResource({
            ...confirmedBase('appointment-undated'),
            resourceType: 'Appointment',
            status: 'pending',
            title: 'Undated specialist request',
            requestedPeriod: [{
                start: unknownClinicalDate('Date not visible'),
            }],
            participants: [],
        }));

        const view = buildAppointmentsModuleViewModel(record, {
            referenceDate: new Date('2026-07-31T12:00:00.000Z'),
        });

        expect(view.items[0]).toMatchObject({
            knownClinicalDate: false,
            startLabel: 'Clinical date unknown',
            timing: 'unknown',
            bookingMeaning: 'Pending — booking not confirmed',
        });
    });
});

describe('tasks and reminders module', () => {
    it('derives overdue and unknown-date reminders from open tasks while preserving intent boundaries', () => {
        const record = makePatientRecord();
        add(record, makeCondition({
            id: 'condition-follow-up',
            verificationStatus: 'confirmed',
            text: 'Hypertension',
        }));
        add(record, parseClinicalRecordResource({
            ...confirmedBase('task-overdue'),
            resourceType: 'ClinicalTask',
            status: 'requested',
            intent: 'proposal',
            priority: 'urgent',
            title: 'Review blood pressure log',
            due: clinicalDay('2026-07-29'),
            relatedResources: [{
                resourceType: 'Condition',
                id: 'condition-follow-up',
            }],
        }));
        add(record, parseClinicalRecordResource({
            ...confirmedBase('task-undated'),
            resourceType: 'ClinicalTask',
            status: 'in-progress',
            intent: 'order',
            priority: 'routine',
            title: 'Arrange follow-up testing',
            due: unknownClinicalDate('Not specified'),
            relatedResources: [],
        }));
        add(record, parseClinicalRecordResource({
            ...confirmedBase('task-completed'),
            resourceType: 'ClinicalTask',
            status: 'completed',
            intent: 'plan',
            priority: 'routine',
            title: 'Completed reminder',
            due: clinicalDay('2026-07-20'),
            completedAt: '2026-07-20T12:00:00.000Z',
            relatedResources: [],
        }));

        const view = buildClinicalTasksModuleViewModel(record, {
            scope: 'all',
            referenceDate: new Date('2026-07-31T12:00:00.000Z'),
        });

        expect(view.openCount).toBe(2);
        expect(view.historicalCount).toBe(1);
        expect(view.overdueCount).toBe(1);
        expect(view.noDateOpenCount).toBe(1);
        expect(view.items.find(item => item.id === 'task-overdue'))
            .toMatchObject({
                reminderState: 'overdue',
                reminderLabel: 'Overdue local reminder',
                intentMeaning: 'Proposal only — not an order',
            });
        expect(view.items.find(item => item.id === 'task-overdue')
            ?.relatedResources[0]).toMatchObject({
                id: 'condition-follow-up',
                label: 'Hypertension',
            });
        expect(view.items.find(item => item.id === 'task-undated'))
            .toMatchObject({
                reminderState: 'no-date',
                dueLabel: 'Clinical date unknown',
                intentMeaning: 'Recorded order intent — external execution not confirmed',
            });
    });
});

describe('care plans module', () => {
    it('links conditions, activity tasks, and encounters while preserving missing references and unknown periods', () => {
        const record = makePatientRecord();
        add(record, makeCondition({
            id: 'condition-plan',
            verificationStatus: 'confirmed',
            text: 'Asthma',
        }));
        add(record, parseClinicalRecordResource({
            ...confirmedBase('task-plan'),
            resourceType: 'ClinicalTask',
            status: 'accepted',
            intent: 'plan',
            priority: 'routine',
            title: 'Review inhaler technique',
            relatedResources: [],
        }));
        add(record, parseClinicalRecordResource({
            ...confirmedBase('encounter-plan'),
            resourceType: 'Encounter',
            status: 'finished',
            encounterClass: 'ambulatory',
            type: { text: 'Respiratory review' },
            participants: [],
        }));
        add(record, parseClinicalRecordResource({
            ...confirmedBase('care-plan-active'),
            resourceType: 'CarePlan',
            status: 'active',
            intent: 'plan',
            title: 'Asthma self-management plan',
            period: {
                start: unknownClinicalDate('Start date not recorded'),
            },
            addressesConditionIds: ['condition-plan'],
            activityTaskIds: ['task-plan', 'missing-task'],
            encounterId: 'encounter-plan',
        }));
        add(record, parseClinicalRecordResource({
            ...candidateBase('care-plan-candidate'),
            resourceType: 'CarePlan',
            status: 'draft',
            intent: 'proposal',
            title: 'Unreviewed plan',
            addressesConditionIds: [],
            activityTaskIds: [],
        }));

        const view = buildCarePlansModuleViewModel(record);
        expect(view.totalConfirmed).toBe(1);
        expect(view.activeCount).toBe(1);
        expect(view.candidateCount).toBe(1);
        expect(view.items[0]).toMatchObject({
            title: 'Asthma self-management plan',
            periodLabel: 'Clinical date unknown',
            knownClinicalDate: false,
            intentMeaning: 'Recorded plan — activities may still be pending',
        });
        expect(view.items[0].addressedConditions[0]).toMatchObject({
            id: 'condition-plan',
            label: 'Asthma',
        });
        expect(view.items[0].activityTasks[0]).toMatchObject({
            id: 'task-plan',
            label: 'Review inhaler technique',
        });
        expect(view.items[0].activityTasks[1]).toMatchObject({
            id: 'missing-task',
            missing: true,
        });
        expect(view.items[0].encounter).toMatchObject({
            id: 'encounter-plan',
            label: 'Respiratory review',
        });
    });
});
