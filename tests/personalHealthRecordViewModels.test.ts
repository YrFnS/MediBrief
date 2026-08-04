import { describe, expect, it } from 'vitest';
import {
    createAdvisoryTaskRecord,
    createProposedAppointmentRecord,
    createReviewedSoapNoteRecord,
    type ObservationRecord,
    type PatientClinicalRecord,
} from '../features/clinical-record';
import {
    buildEmergencySummaryViewModel,
    buildPatientOverviewViewModel,
    buildTimelineViewModel,
} from '../features/personal-health-record';
import {
    clinicalDay,
    FIXED_TIME,
    makeAllergy,
    makeCondition,
    makeMedication,
    makeObservation,
    makePatientRecord,
} from './fixtures';

const withResources = (
    record: PatientClinicalRecord,
    resources: Partial<PatientClinicalRecord['resources']>,
): PatientClinicalRecord => ({
    ...record,
    resources: {
        ...record.resources,
        ...resources,
    },
});

describe('patient overview view model', () => {
    it('uses confirmed resources, reports candidates, and keeps follow-up durable', () => {
        const base = makePatientRecord();
        const appointment = createProposedAppointmentRecord({
            patientId: base.patientId,
            date: '2026-08-10',
            time: '09:30',
            notes: 'Follow-up request',
            createdAt: FIXED_TIME,
        }).record;
        const task = createAdvisoryTaskRecord({
            patientId: base.patientId,
            advisoryTitle: 'Review result',
            actionLabel: 'Discuss at next visit',
            createdAt: FIXED_TIME,
        });
        const note = createReviewedSoapNoteRecord({
            patientId: base.patientId,
            subjective: 'Feeling better',
            authoredAt: FIXED_TIME,
        });

        const record = withResources({
            ...base,
            profile: {
                ...base.profile,
                dateOfBirth: clinicalDay('2000-07-15'),
                administrativeSex: 'female',
                bloodType: 'O+',
                preferredLanguage: 'English',
                contacts: [{
                    system: 'phone',
                    value: '000-000',
                    use: 'mobile',
                }],
            },
        }, {
            conditions: [
                makeCondition({
                    id: 'confirmed-condition',
                    verificationStatus: 'confirmed',
                }),
                makeCondition({
                    id: 'candidate-condition',
                    verificationStatus: 'candidate',
                    text: 'Needs review',
                }),
            ],
            allergies: [makeAllergy()],
            medications: [makeMedication()],
            observations: [makeObservation()],
            appointments: [appointment],
            tasks: [task],
            notes: [note],
        });

        const overview = buildPatientOverviewViewModel(
            record,
            new Date('2026-07-31T00:00:00.000Z'),
        );

        expect(overview.patientName).toBe('Test Patient');
        expect(overview.ageLabel).toBe('26 years');
        expect(overview.activeConditions.map(item => item.name))
            .toEqual(['Asthma']);
        expect(overview.activeAllergies).toHaveLength(1);
        expect(overview.activeMedications).toHaveLength(1);
        expect(overview.pendingCandidates).toBe(1);
        expect(overview.pendingFollowUp.map(item => item.kind).sort())
            .toEqual(['appointment', 'task']);
        expect(overview.recentTimeline.some(item =>
            item.label === 'Needs review',
        )).toBe(false);
    });
});

describe('longitudinal timeline view model', () => {
    it('separates clinically undated records and never promotes candidates', () => {
        const base = makePatientRecord();
        const dated = makeCondition({
            id: 'dated-condition',
            verificationStatus: 'confirmed',
            text: 'Dated condition',
        });
        const undated = {
            ...makeCondition({
                id: 'undated-condition',
                verificationStatus: 'confirmed',
                text: 'Undated condition',
            }),
            effective: undefined,
            onset: undefined,
        };
        const candidate = makeCondition({
            id: 'candidate-condition',
            verificationStatus: 'candidate',
            text: 'Candidate condition',
        });
        const sourced = {
            ...makeCondition({
                id: 'sourced-condition',
                verificationStatus: 'confirmed',
                text: 'Source-linked condition',
            }),
            provenance: {
                ...dated.provenance,
                source: {
                    kind: 'document-extraction' as const,
                    document: {
                        documentId: 'document-1',
                        fileName: 'report.pdf',
                        pageNumber: 2,
                        excerpt: 'Source-linked condition',
                    },
                },
            },
        };

        const record = withResources(base, {
            conditions: [dated, undated, candidate, sourced],
        });
        const timeline = buildTimelineViewModel(record);

        expect(timeline.dated.map(item => item.label))
            .toContain('Dated condition');
        expect(timeline.undated.map(item => item.label))
            .toEqual(['Undated condition']);
        expect([...timeline.dated, ...timeline.undated].map(item => item.label))
            .not.toContain('Candidate condition');
        expect(timeline.dated.find(item =>
            item.label === 'Source-linked condition',
        )?.sourceDocument?.pageNumber).toBe(2);
    });

    it('filters by resource type and searchable clinical detail', () => {
        const record = withResources(makePatientRecord(), {
            conditions: [makeCondition({
                verificationStatus: 'confirmed',
                text: 'Asthma',
            })],
            medications: [makeMedication({ text: 'Metformin' })],
        });

        expect(buildTimelineViewModel(record, {
            resourceType: 'Medication',
        }).total).toBe(1);
        expect(buildTimelineViewModel(record, {
            search: 'asthma',
        }).dated.map(item => item.label)).toEqual(['Asthma']);
    });
});

describe('emergency summary view model', () => {
    it('uses confirmed patient-applicable facts and labels missing safety data', () => {
        const base = makePatientRecord();
        const codeStatus: ObservationRecord = {
            ...makeObservation({
                id: 'code-status',
                verificationStatus: 'confirmed',
                code: 'Code status',
                effective: clinicalDay('2026-07-30'),
            }),
            value: {
                type: 'string',
                text: 'Full Code',
            },
        };
        const record = withResources(base, {
            conditions: [
                makeCondition({
                    verificationStatus: 'confirmed',
                    text: 'Asthma',
                }),
                makeCondition({
                    id: 'candidate-condition',
                    verificationStatus: 'candidate',
                    text: 'Unreviewed diagnosis',
                }),
            ],
            allergies: [],
            medications: [makeMedication()],
            observations: [codeStatus, makeObservation()],
        });

        const summary = buildEmergencySummaryViewModel(
            record,
            new Date('2026-07-31T00:00:00.000Z'),
        );

        expect(summary.conditions.map(item => item.name)).toEqual(['Asthma']);
        expect(summary.medications.map(item => item.name)).toEqual(['Metformin']);
        expect(summary.codeStatus).toBe('Full Code');
        expect(summary.allergies).toEqual([]);
        expect(summary.limitations.some(item =>
            item.includes('Allergy status is unknown'),
        )).toBe(true);
        expect(summary.limitations.some(item =>
            item.includes('candidate record'),
        )).toBe(true);
        expect(summary.vitals[0]?.value).toBe('72 bpm');
    });
});
