import { describe, expect, it } from 'vitest';
import {
    migrateLegacyStoresToClinicalRecords,
} from '../features/clinical-record';
import type { PatientMetadata } from '../features/patient-management/types';
import type { ClinicalDataStore } from '../features/fhir/types';
import { FIXED_TIME } from './fixtures';

const legacyPatient = (): PatientMetadata => ({
    id: 'patient-1',
    name: 'Legacy Patient',
    mrn: 'MRN-100',
    status: 'Stable',
    entities: {
        allergies: ['Penicillin', 'Penicillin'],
        codeStatus: 'Full Code',
        diagnosis: ['Asthma', 'Asthma'],
    },
    demographics: {
        age: 42,
        weight: 70,
        sex: 'Female',
    },
    documents: [{
        storageId: 'legacy-document-1',
        name: 'old-report.pdf',
        type: 'application/pdf',
        uploadedAt: Date.parse('2026-07-01T10:00:00.000Z'),
    }],
    createdAt: Date.parse('2025-01-01T00:00:00.000Z'),
    lastActive: Date.parse(FIXED_TIME),
});

const legacyClinicalData = (): ClinicalDataStore => ({
    observations: [{
        resourceType: 'Observation',
        id: 'legacy-observation-1',
        status: 'final',
        code: {
            text: 'Potassium',
            coding: [{ system: 'http://loinc.org', code: '2823-3' }],
        },
        valueQuantity: {
            value: 4.2,
            unit: 'mmol/L',
            system: 'http://unitsofmeasure.org',
        },
        effectiveDateTime: '2026-07-01T09:00:00.000Z',
        referenceRange: [{
            low: { value: 3.5, unit: 'mmol/L' },
            high: { value: 5.0, unit: 'mmol/L' },
            text: '3.5-5.0',
        }],
    }],
});

describe('legacy clinical migration', () => {
    it('preserves legacy data as reviewable candidates without inventing dates', () => {
        const result = migrateLegacyStoresToClinicalRecords({
            patients: { 'patient-1': legacyPatient() },
            clinicalData: { 'patient-1': legacyClinicalData() },
            migratedAt: FIXED_TIME,
        });

        const record = result.records['patient-1'];
        expect(record.profile.displayName).toBe('Legacy Patient');
        expect(record.profile.dateOfBirth).toBeUndefined();
        expect(record.profile.identifiers[0]?.value).toBe('MRN-100');
        expect(record.resources.conditions).toHaveLength(1);
        expect(record.resources.allergies).toHaveLength(1);
        expect(record.resources.documents).toHaveLength(1);
        expect(record.resources.documents[0].verificationStatus).toBe('confirmed');

        const migratedClaims = [
            ...record.resources.conditions,
            ...record.resources.allergies,
            ...record.resources.observations,
        ];
        expect(migratedClaims.every(resource =>
            resource.verificationStatus === 'candidate',
        )).toBe(true);

        const age = record.resources.observations.find(observation =>
            observation.code.text === 'Age at legacy snapshot',
        );
        const weight = record.resources.observations.find(observation =>
            observation.code.text === 'Body weight',
        );
        expect(age?.effective).toEqual({
            value: null,
            precision: 'unknown',
        });
        expect(weight?.effective).toEqual({
            value: null,
            precision: 'unknown',
        });

        const potassium = record.resources.observations.find(observation =>
            observation.code.text === 'Potassium',
        );
        expect(potassium?.value).toEqual({
            type: 'quantity',
            quantity: {
                original: {
                    value: 4.2,
                    unit: 'mmol/L',
                    system: 'http://unitsofmeasure.org',
                },
            },
        });
        expect(result.report.patientRecordsCreated).toBe(1);
        expect(result.changed).toBe(true);
    });

    it('is idempotent when run repeatedly over the same legacy sources', () => {
        const first = migrateLegacyStoresToClinicalRecords({
            patients: { 'patient-1': legacyPatient() },
            clinicalData: { 'patient-1': legacyClinicalData() },
            migratedAt: FIXED_TIME,
        });
        const second = migrateLegacyStoresToClinicalRecords({
            patients: { 'patient-1': legacyPatient() },
            clinicalData: { 'patient-1': legacyClinicalData() },
            existingRecords: first.records,
            migratedAt: FIXED_TIME,
        });

        expect(second.changed).toBe(false);
        expect(second.report.patientRecordsUnchanged).toBe(1);
        expect(second.report.resourcesAdded).toBe(0);
        expect(second.records).toEqual(first.records);
    });

    it('preserves orphaned observations in a synthetic reviewable patient', () => {
        const result = migrateLegacyStoresToClinicalRecords({
            patients: {},
            clinicalData: { 'orphan-patient': legacyClinicalData() },
            migratedAt: FIXED_TIME,
        });

        expect(result.records['orphan-patient']).toBeDefined();
        expect(result.records['orphan-patient'].resources.observations)
            .toHaveLength(1);
        expect(result.report.warnings.some(warning =>
            warning.code === 'ORPHAN_LEGACY_CLINICAL_DATA',
        )).toBe(true);
    });
});
