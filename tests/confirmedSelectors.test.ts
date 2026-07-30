import { describe, expect, it } from 'vitest';
import {
    selectConfirmedPatientSummary,
    selectConfirmedVitals,
} from '../features/clinical-record';
import {
    clinicalDay,
    makeAllergy,
    makeCondition,
    makeMedication,
    makeObservation,
    makePatientRecord,
    unknownClinicalDate,
} from './fixtures';

describe('confirmed-only clinical selectors', () => {
    it('excludes unreviewed and non-patient-applicable assertions', () => {
        const record = makePatientRecord();
        record.resources.conditions = [
            makeCondition({
                id: 'confirmed-condition',
                verificationStatus: 'confirmed',
                text: 'Asthma',
            }),
            makeCondition({
                id: 'candidate-condition',
                verificationStatus: 'candidate',
                text: 'Pneumonia',
            }),
            makeCondition({
                id: 'negated-condition',
                verificationStatus: 'confirmed',
                text: 'Diabetes',
                assertion: {
                    polarity: 'negated',
                    certainty: 'certain',
                    temporality: 'current',
                    experiencer: 'patient',
                },
            }),
            makeCondition({
                id: 'family-condition',
                verificationStatus: 'confirmed',
                text: 'Coronary artery disease',
                assertion: {
                    polarity: 'affirmed',
                    certainty: 'certain',
                    temporality: 'historical',
                    experiencer: 'family',
                },
            }),
            makeCondition({
                id: 'hypothetical-condition',
                verificationStatus: 'confirmed',
                text: 'Future infection risk',
                assertion: {
                    polarity: 'affirmed',
                    certainty: 'uncertain',
                    temporality: 'hypothetical',
                    experiencer: 'patient',
                },
            }),
        ];
        record.resources.allergies = [
            makeAllergy({ id: 'confirmed-allergy' }),
            makeAllergy({
                id: 'candidate-allergy',
                text: 'Latex',
                verificationStatus: 'candidate',
            }),
        ];
        record.resources.medications = [
            makeMedication({ id: 'active-medication' }),
            makeMedication({
                id: 'stopped-medication',
                text: 'Old medication',
                status: 'stopped',
            }),
        ];

        const summary = selectConfirmedPatientSummary(record);

        expect(summary.conditions.map(item => item.id))
            .toEqual(['confirmed-condition']);
        expect(summary.allergies.map(item => item.id))
            .toEqual(['confirmed-allergy']);
        expect(summary.medications.map(item => item.id))
            .toEqual(['active-medication']);
        expect(summary.candidateCount).toBe(2);
    });

    it('does not interpret an empty confirmed allergy list as NKDA', () => {
        const summary = selectConfirmedPatientSummary(makePatientRecord());

        expect(summary.allergies).toEqual([]);
    });

    it('uses the latest known clinical date and ignores undated vital snapshots', () => {
        const record = makePatientRecord();
        record.resources.observations = [
            makeObservation({
                id: 'older-heart-rate',
                value: 70,
                effective: clinicalDay('2026-07-10'),
            }),
            makeObservation({
                id: 'latest-heart-rate',
                value: 82,
                effective: clinicalDay('2026-07-20'),
            }),
            makeObservation({
                id: 'undated-heart-rate',
                value: 120,
                effective: unknownClinicalDate('Date not visible'),
            }),
        ];

        const vitals = selectConfirmedVitals(record);

        expect(vitals.heartRate?.observation.id).toBe('latest-heart-rate');
        expect(vitals.heartRate?.value).toBe('82');
        expect(vitals.heartRate?.unit).toBe('bpm');
    });
});
