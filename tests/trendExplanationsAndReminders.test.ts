import { describe, expect, it } from 'vitest';
import {
    createPatientClinicalRecord,
    parseClinicalRecordResource,
    type AppointmentRecord,
    type CarePlanRecord,
    type ClinicalTaskRecord,
    type MedicationRecord,
    type ObservationRecord,
    type PatientClinicalRecord,
    type SpecimenRecord,
} from '../features/clinical-record';
import {
    buildDeterministicTrendViewModel,
    buildExplicitReminderViewModel,
    buildTrendGroundingRequest,
    createReminderFollowUpTaskRecord,
    finalizeTrendModelExplanation,
    renderDeterministicTrendExplanationMarkdown,
} from '../features/trend-reminders';

const NOW = '2026-08-01T12:00:00.000Z';
const PATIENT_ID = 'patient-trend-reminders';
const referenceDate = new Date(NOW);

const day = (value: string) => ({
    value,
    precision: 'day' as const,
    sourceText: value,
});

const month = (value: string) => ({
    value,
    precision: 'month' as const,
    sourceText: value,
});

const unknownDate = () => ({
    value: null,
    precision: 'unknown' as const,
    sourceText: 'Date not recorded',
});

const provenance = (description: string) => ({
    source: {
        kind: 'manual' as const,
        description,
    },
    createdAt: NOW,
    updatedAt: NOW,
    confirmation: {
        reviewedAt: NOW,
        reviewedBy: 'tester',
        reason: 'Synthetic confirmed fixture',
    },
});

const specimen = (): SpecimenRecord => parseClinicalRecordResource({
    id: 'specimen-blood',
    patientId: PATIENT_ID,
    resourceType: 'Specimen',
    verificationStatus: 'confirmed',
    recordedAt: NOW,
    provenance: provenance('Synthetic specimen'),
    amendments: [],
    status: 'available',
    type: { text: 'Venous blood' },
    collectedAt: day('2026-07-01'),
}) as SpecimenRecord;

const observation = ({
    id,
    date,
    value,
    unit,
    comparator,
    normalized,
    verificationStatus = 'confirmed',
}: {
    id: string;
    date: ReturnType<typeof day> | ReturnType<typeof month>;
    value: number;
    unit: string;
    comparator?: '<';
    normalized?: { value: number; unit: string };
    verificationStatus?: ObservationRecord['verificationStatus'];
}): ObservationRecord => parseClinicalRecordResource({
    id,
    patientId: PATIENT_ID,
    resourceType: 'Observation',
    verificationStatus,
    recordedAt: NOW,
    effective: date,
    provenance: {
        source: {
            kind: 'document-extraction',
            document: {
                documentId: `document-${id}`,
                fileName: `${id}.pdf`,
                pageNumber: 2,
            },
        },
        createdAt: NOW,
        updatedAt: NOW,
        confirmation: {
            reviewedAt: NOW,
            reviewedBy: 'tester',
            reason: 'Synthetic reviewed result',
        },
    },
    amendments: [],
    status: 'final',
    category: [{ text: 'Laboratory' }],
    code: {
        text: 'Hemoglobin',
        coding: [{
            system: 'http://loinc.org',
            code: '718-7',
            display: 'Hemoglobin',
        }],
    },
    value: {
        type: 'quantity',
        quantity: {
            original: {
                value,
                unit,
                system: 'http://unitsofmeasure.org',
                code: unit,
                ...(comparator ? { comparator } : {}),
            },
            ...(normalized
                ? {
                    normalized: {
                        value: normalized.value,
                        unit: normalized.unit,
                        system: 'http://unitsofmeasure.org',
                        code: normalized.unit,
                    },
                }
                : {}),
        },
    },
    interpretation: [],
    referenceRanges: [],
    specimenId: 'specimen-blood',
}) as ObservationRecord;

const appointment = ({
    id,
    status,
    date,
    verificationStatus = 'confirmed',
}: {
    id: string;
    status: AppointmentRecord['status'];
    date?: string;
    verificationStatus?: AppointmentRecord['verificationStatus'];
}): AppointmentRecord => parseClinicalRecordResource({
    id,
    patientId: PATIENT_ID,
    resourceType: 'Appointment',
    verificationStatus,
    recordedAt: NOW,
    provenance: provenance(`Appointment ${id}`),
    amendments: [],
    status,
    title: `Appointment ${id}`,
    ...(date ? { start: `${date}T10:00:00.000Z` } : {}),
    participants: [],
}) as AppointmentRecord;

const task = ({
    id,
    status,
    due,
    verificationStatus = 'confirmed',
}: {
    id: string;
    status: ClinicalTaskRecord['status'];
    due?: ReturnType<typeof day> | ReturnType<typeof unknownDate>;
    verificationStatus?: ClinicalTaskRecord['verificationStatus'];
}): ClinicalTaskRecord => parseClinicalRecordResource({
    id,
    patientId: PATIENT_ID,
    resourceType: 'ClinicalTask',
    verificationStatus,
    recordedAt: NOW,
    provenance: provenance(`Task ${id}`),
    amendments: [],
    status,
    intent: 'proposal',
    priority: 'routine',
    title: `Task ${id}`,
    ...(due ? { due } : {}),
    relatedResources: [],
}) as ClinicalTaskRecord;

const carePlan = (): CarePlanRecord => parseClinicalRecordResource({
    id: 'care-plan-unknown-date',
    patientId: PATIENT_ID,
    resourceType: 'CarePlan',
    verificationStatus: 'confirmed',
    recordedAt: NOW,
    provenance: provenance('Care plan source'),
    amendments: [],
    status: 'active',
    intent: 'plan',
    title: 'Care plan with unknown period',
    period: { end: unknownDate() },
    addressesConditionIds: [],
    activityTaskIds: [],
}) as CarePlanRecord;

const medication = ({
    id,
    status = 'active',
    start,
    end,
    verificationStatus = 'confirmed',
}: {
    id: string;
    status?: MedicationRecord['status'];
    start?: ReturnType<typeof day>;
    end?: ReturnType<typeof day>;
    verificationStatus?: MedicationRecord['verificationStatus'];
}): MedicationRecord => parseClinicalRecordResource({
    id,
    patientId: PATIENT_ID,
    resourceType: 'Medication',
    verificationStatus,
    recordedAt: NOW,
    provenance: provenance(`Medication ${id}`),
    amendments: [],
    kind: 'statement',
    medication: { text: `Medicine ${id}` },
    status,
    dosageInstructions: [{ text: 'Source directions retained' }],
    ...(start ? { start } : {}),
    ...(end ? { end } : {}),
}) as MedicationRecord;

const recordFixture = (): PatientClinicalRecord => {
    const base = createPatientClinicalRecord({
        patientId: PATIENT_ID,
        displayName: 'Synthetic Trend Reminder Patient',
        now: NOW,
    });
    return {
        ...base,
        resources: {
            ...base.resources,
            specimens: [specimen()],
            observations: [
                observation({
                    id: 'hgb-1',
                    date: day('2026-06-01'),
                    value: 132,
                    unit: 'g/L',
                    normalized: { value: 13.2, unit: 'g/dL' },
                }),
                observation({
                    id: 'hgb-2',
                    date: day('2026-07-01'),
                    value: 13.8,
                    unit: 'g/dL',
                }),
                observation({
                    id: 'hgb-comparator',
                    date: day('2026-07-10'),
                    value: 14,
                    unit: 'g/dL',
                    comparator: '<',
                }),
                observation({
                    id: 'hgb-partial-date',
                    date: month('2026-07'),
                    value: 13.5,
                    unit: 'g/dL',
                }),
                observation({
                    id: 'hgb-candidate',
                    date: day('2026-07-20'),
                    value: 14.1,
                    unit: 'g/dL',
                    verificationStatus: 'candidate',
                }),
            ],
            appointments: [
                appointment({ id: 'booked', status: 'booked', date: '2026-08-03' }),
                appointment({ id: 'cancelled', status: 'cancelled', date: '2026-08-04' }),
                appointment({
                    id: 'candidate-appointment',
                    status: 'booked',
                    date: '2026-08-02',
                    verificationStatus: 'candidate',
                }),
            ],
            tasks: [
                task({ id: 'overdue', status: 'requested', due: day('2026-07-31') }),
                task({ id: 'completed', status: 'completed', due: day('2026-07-30') }),
                task({ id: 'unscheduled', status: 'requested' }),
            ],
            carePlans: [carePlan()],
            medications: [
                medication({ id: 'future-end', end: day('2026-08-05') }),
                medication({ id: 'past-start', start: day('2026-06-01') }),
                medication({
                    id: 'candidate-medication',
                    end: day('2026-08-02'),
                    verificationStatus: 'candidate',
                }),
            ],
        },
    };
};

describe('Phase 5 deterministic trend explanations', () => {
    it('uses only Phase 4-eligible points and retains exclusions and source truth', () => {
        const view = buildDeterministicTrendViewModel(recordFixture());
        const explanation = view.explanations.find(item =>
            item.name === 'Hemoglobin')!;

        expect(explanation.points.map(point => point.observationId))
            .toEqual(['hgb-1', 'hgb-2']);
        expect(explanation.normalizationBasis)
            .toBe('mixed-original-and-normalized');
        expect(explanation.direction).toBe('higher');
        expect(explanation.absoluteChange).toBeCloseTo(0.6);
        expect(explanation.deterministicStatements.join(' '))
            .toContain('[MB:Observation:hgb-1]');
        expect(explanation.deterministicStatements.join(' '))
            .toContain('[MB:Observation:hgb-2]');
        expect(explanation.matchingExclusions.map(item => item.reason))
            .toEqual(expect.arrayContaining([
                'comparator-value',
                'clinical-date-not-exact',
                'not-confirmed',
            ]));
        expect(explanation.points[0]).toMatchObject({
            originalValueLabel: '132 g/L',
            normalizedValueLabel: '13.2 g/dL',
            source: {
                fileName: 'hgb-1.pdf',
                pageNumber: 2,
            },
        });

        const markdown = renderDeterministicTrendExplanationMarkdown(explanation);
        expect(markdown).toContain('Original source value: 132 g/L');
        expect(markdown).toContain('Comparator, qualitative, narrative, absent');
        expect(markdown.toLowerCase()).not.toContain('treatment recommendation');
    });

    it('limits optional model wording to all selected plotted points and rejects incomplete citations', () => {
        const record = recordFixture();
        const explanation = buildDeterministicTrendViewModel(record)
            .explanations[0];
        const request = buildTrendGroundingRequest({
            record,
            explanation,
            generatedAt: NOW,
        });

        expect(request.bundle.evidence.map(item => item.resourceId))
            .toEqual(['hgb-1', 'hgb-2']);
        expect(request.prompt).toContain('Do not use web search');
        expect(request.prompt).toContain('Every selected plotted point must be cited');
        expect(request.prompt).not.toContain('hgb-comparator.pdf');

        const accepted = finalizeTrendModelExplanation(
            `The first recorded value was 13.2 g/dL [MB:Observation:hgb-1]. The last recorded value was 13.8 g/dL [MB:Observation:hgb-2].`,
            request,
        );
        expect(accepted.finalization.accepted).toBe(true);

        const incomplete = finalizeTrendModelExplanation(
            'The last recorded value was higher [MB:Observation:hgb-2].',
            request,
        );
        expect(incomplete.finalization).toMatchObject({
            accepted: false,
            status: 'citation-rejected',
        });
        expect(incomplete.finalization.displayText)
            .toContain('did not cite every plotted point');
    });
});

describe('Phase 5 explicit record-derived reminders', () => {
    it('classifies durable records without using recordedAt as a due date', () => {
        const view = buildExplicitReminderViewModel(recordFixture(), {
            referenceDate,
        });
        const stateByResource = new Map(view.items.map(item => [
            item.resourceId,
            item.state,
        ]));

        expect(stateByResource.get('booked')).toBe('upcoming');
        expect(stateByResource.get('cancelled')).toBe('cancelled');
        expect(stateByResource.get('overdue')).toBe('overdue');
        expect(stateByResource.get('completed')).toBe('completed');
        expect(stateByResource.get('unscheduled')).toBe('unscheduled');
        expect(stateByResource.get('care-plan-unknown-date')).toBe('unknown-date');
        expect(stateByResource.get('future-end')).toBe('upcoming');
        expect(stateByResource.get('past-start')).toBe('unscheduled');
        expect(stateByResource.has('candidate-appointment')).toBe(false);
        expect(stateByResource.has('candidate-medication')).toBe(false);
        expect(view.candidateCount).toBe(2);
        expect(view.items.find(item => item.resourceId === 'unscheduled')?.dateLabel)
            .toContain('Unscheduled');
    });

    it('creates a routine local proposal task only after an explicit reason', () => {
        const reminder = buildExplicitReminderViewModel(recordFixture(), {
            referenceDate,
        }).items.find(item => item.resourceId === 'booked')!;

        expect(() => createReminderFollowUpTaskRecord({
            patientId: PATIENT_ID,
            reminder,
            reason: '   ',
        })).toThrow('requires a review reason');

        const result = createReminderFollowUpTaskRecord({
            patientId: PATIENT_ID,
            reminder,
            reason: 'Review the recorded appointment information.',
            createdAt: NOW,
            createdBy: 'tester',
        });

        expect(result.task).toMatchObject({
            resourceType: 'ClinicalTask',
            verificationStatus: 'confirmed',
            status: 'requested',
            intent: 'proposal',
            priority: 'routine',
            due: {
                value: '2026-08-03',
                precision: 'day',
            },
            relatedResources: [{
                resourceType: 'Appointment',
                id: 'booked',
            }],
        });
        expect(result.task.tags).toEqual(expect.arrayContaining([
            'explicit-reminder-follow-up',
            'review-proposal',
            'not-an-order',
        ]));
        expect(result.task.note).toContain('does not send a notification');
        expect(result.task.note).toContain('not an order');
    });
});
