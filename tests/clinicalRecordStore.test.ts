import { beforeEach, describe, expect, it } from 'vitest';
import {
    useClinicalRecordStore,
} from '../features/clinical-record';
import {
    FIXED_TIME,
    clinicalDay,
    makeCondition,
    makeObservation,
    unknownClinicalDate,
} from './fixtures';

describe('clinical record store lifecycle', () => {
    beforeEach(() => {
        useClinicalRecordStore.setState({ records: {} });
    });

    it('confirms a candidate while preserving review and amendment history', () => {
        const actions = useClinicalRecordStore.getState().actions;
        actions.initializePatientRecord({
            patientId: 'patient-1',
            displayName: 'Test Patient',
            now: FIXED_TIME,
        });

        const candidate = makeCondition();
        expect(actions.addResource(candidate).status).toBe('created');

        const edited = actions.amendResource(
            'patient-1',
            'Condition',
            candidate.id,
            { note: 'Reviewed wording before confirmation' },
            {
                amendedAt: '2026-07-30T12:05:00.000Z',
                amendedBy: 'reviewer',
                reason: 'Clarified candidate wording',
            },
        );
        expect(edited.ok).toBe(true);
        expect(edited.resource?.amendments).toHaveLength(1);

        const confirmed = actions.confirmCandidate(
            'patient-1',
            'Condition',
            candidate.id,
            {
                reviewedAt: '2026-07-30T12:10:00.000Z',
                reviewedBy: 'reviewer',
                reason: 'Accepted after source review',
            },
        );

        expect(confirmed.ok).toBe(true);
        expect(confirmed.resource?.verificationStatus).toBe('confirmed');
        expect(confirmed.resource?.provenance.confirmation?.reviewedBy)
            .toBe('reviewer');
        expect(confirmed.resource?.amendments).toHaveLength(2);

        const deletion = actions.deleteResource(
            'patient-1',
            'Condition',
            candidate.id,
        );
        expect(deletion.ok).toBe(false);
        expect(deletion.status).toBe('protected-record');
    });

    it('rejects candidates without allowing them into the confirmed timeline', () => {
        const actions = useClinicalRecordStore.getState().actions;
        actions.initializePatientRecord({
            patientId: 'patient-1',
            displayName: 'Test Patient',
            now: FIXED_TIME,
        });
        const candidate = makeCondition({ id: 'condition-reject' });
        actions.addResource(candidate);

        expect(actions.getTimeline('patient-1')).toEqual([]);

        const rejected = actions.rejectCandidate(
            'patient-1',
            'Condition',
            candidate.id,
            {
                reviewedAt: '2026-07-30T12:15:00.000Z',
                reviewedBy: 'reviewer',
                reason: 'Not supported by the source',
            },
        );

        expect(rejected.resource?.verificationStatus).toBe('rejected');
        expect(actions.getTimeline('patient-1')).toEqual([]);
        expect(actions.findResources({
            patientId: 'patient-1',
            verificationStatuses: ['rejected'],
        })).toHaveLength(1);
    });

    it('requires a reason before marking reviewed history entered in error', () => {
        const actions = useClinicalRecordStore.getState().actions;
        actions.initializePatientRecord({
            patientId: 'patient-1',
            displayName: 'Test Patient',
            now: FIXED_TIME,
        });
        const confirmed = makeCondition({
            id: 'condition-error',
            verificationStatus: 'confirmed',
        });
        actions.addResource(confirmed);

        const missingReason = actions.markResourceEnteredInError(
            'patient-1',
            'Condition',
            confirmed.id,
            { amendedBy: 'reviewer' },
        );
        expect(missingReason.ok).toBe(false);
        expect(missingReason.status).toBe('invalid-transition');

        const corrected = actions.markResourceEnteredInError(
            'patient-1',
            'Condition',
            confirmed.id,
            {
                amendedAt: '2026-07-30T12:20:00.000Z',
                amendedBy: 'reviewer',
                reason: 'Wrong patient document',
            },
        );
        expect(corrected.resource?.verificationStatus).toBe('entered-in-error');
        expect(corrected.resource?.amendments.at(-1)?.previousValues)
            .toEqual({ verificationStatus: 'confirmed' });
    });

    it('keeps unknown clinical dates outside bounded queries unless requested', () => {
        const actions = useClinicalRecordStore.getState().actions;
        actions.initializePatientRecord({
            patientId: 'patient-1',
            displayName: 'Test Patient',
            now: FIXED_TIME,
        });

        actions.addResource(makeObservation({
            id: 'dated-observation',
            effective: clinicalDay('2026-07-15'),
        }));
        actions.addResource(makeObservation({
            id: 'unknown-observation',
            code: 'Body weight',
            effective: unknownClinicalDate('Date not visible'),
        }));

        const bounded = actions.findResources({
            patientId: 'patient-1',
            resourceTypes: ['Observation'],
            verificationStatuses: ['confirmed'],
            date: {
                from: '2026-07-01',
                to: '2026-07-31',
            },
        });
        expect(bounded.map(resource => resource.id))
            .toEqual(['dated-observation']);

        const withUnknown = actions.findResources({
            patientId: 'patient-1',
            resourceTypes: ['Observation'],
            verificationStatuses: ['confirmed'],
            date: {
                from: '2026-07-01',
                to: '2026-07-31',
                includeUnknown: true,
            },
        });
        expect(withUnknown.map(resource => resource.id).sort())
            .toEqual(['dated-observation', 'unknown-observation']);
    });
});
