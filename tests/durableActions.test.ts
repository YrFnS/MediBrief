import { describe, expect, it } from 'vitest';
import {
    createAdvisoryTaskRecord,
    createProposedAppointmentRecord,
    createReviewedSoapNoteRecord,
} from '../features/clinical-record';
import { FIXED_TIME } from './fixtures';

describe('durable action records', () => {
    it('stores appointment requests as proposals rather than bookings', () => {
        const result = createProposedAppointmentRecord({
            patientId: 'patient-1',
            date: '2026-08-15',
            time: '14:30',
            notes: 'Discuss follow-up results',
            createdAt: FIXED_TIME,
            createdBy: 'user',
        });

        expect(result.warnings).toEqual([]);
        expect(result.record.status).toBe('proposed');
        expect(result.record.verificationStatus).toBe('confirmed');
        expect(result.record.tags).toContain('not-booked');
        expect(result.record.participants[0]?.status).toBe('needs-action');
        expect(result.record.note).toContain('not confirmation from a clinic');
        expect(result.record.start).toBeDefined();
    });

    it('preserves unparseable appointment dates as unknown', () => {
        const result = createProposedAppointmentRecord({
            patientId: 'patient-1',
            date: 'next Thursday',
            time: 'afternoon',
            createdAt: FIXED_TIME,
        });

        expect(result.record.start).toBeUndefined();
        expect(result.record.effective).toEqual({
            value: null,
            precision: 'unknown',
            sourceText: 'next Thursday',
        });
        expect(result.warnings).toHaveLength(2);
    });

    it('creates advisory follow-up as a proposal task, never an order', () => {
        const task = createAdvisoryTaskRecord({
            patientId: 'patient-1',
            advisoryTitle: 'Reviewed observation reminder',
            actionLabel: 'Discuss result with clinician',
            sourceRuleId: 'advisory-1',
            createdAt: FIXED_TIME,
            createdBy: 'user',
        });

        expect(task.intent).toBe('proposal');
        expect(task.status).toBe('requested');
        expect(task.tags).toContain('not-an-order');
        expect(task.note).toContain('not an order');
        expect(task.completedAt).toBeUndefined();
    });

    it('creates a durable reviewed SOAP note with source transcript', () => {
        const note = createReviewedSoapNoteRecord({
            patientId: 'patient-1',
            subjective: 'Headache for two days',
            objective: 'Temperature reported as normal',
            assessment: 'Assessment requires clinician review',
            plan: 'Arrange follow-up',
            transcript: ['Patient reports headache.', 'Discussed follow-up.'],
            authoredAt: FIXED_TIME,
            author: 'user',
        });

        expect(note.status).toBe('final');
        expect(note.noteType).toBe('soap');
        expect(note.verificationStatus).toBe('confirmed');
        expect(note.sections.map(section => section.title)).toEqual([
            'Subjective',
            'Objective',
            'Assessment',
            'Plan',
            'Source transcript',
        ]);
        expect(note.provenance.confirmation?.reason)
            .toContain('saved the note');
    });

    it('refuses to create an empty clinical note', () => {
        expect(() => createReviewedSoapNoteRecord({
            patientId: 'patient-1',
            authoredAt: FIXED_TIME,
        })).toThrow('at least one non-empty section');
    });
});
