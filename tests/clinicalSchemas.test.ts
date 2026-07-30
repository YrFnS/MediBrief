import { describe, expect, it } from 'vitest';
import {
    ClinicalDateSchema,
    RecordSourceSchema,
    safeParsePatientClinicalRecord,
} from '../features/clinical-record';
import {
    makeCondition,
    makePatientRecord,
} from './fixtures';

describe('clinical date validation', () => {
    it('preserves an explicitly unknown date without inventing a value', () => {
        expect(ClinicalDateSchema.parse({
            value: null,
            precision: 'unknown',
            sourceText: 'Not visible',
        })).toEqual({
            value: null,
            precision: 'unknown',
            sourceText: 'Not visible',
        });
    });

    it('rejects a fabricated value on an unknown date', () => {
        const result = ClinicalDateSchema.safeParse({
            value: '2026-07-30',
            precision: 'unknown',
        });

        expect(result.success).toBe(false);
    });

    it.each([
        [{ value: '2026', precision: 'year' }],
        [{ value: '2026-07', precision: 'month' }],
        [{ value: '2026-07-30', precision: 'day' }],
    ])('accepts supported partial-date precision: %o', date => {
        expect(ClinicalDateSchema.safeParse(date).success).toBe(true);
    });

    it.each([
        [{ value: '2026-13', precision: 'month' }],
        [{ value: '2026-02-30', precision: 'day' }],
        [{ value: '26', precision: 'year' }],
    ])('rejects impossible or malformed dates: %o', date => {
        expect(ClinicalDateSchema.safeParse(date).success).toBe(false);
    });
});

describe('provenance and patient ownership validation', () => {
    it('requires document-extraction provenance to identify its source document', () => {
        const result = RecordSourceSchema.safeParse({
            kind: 'document-extraction',
            description: 'Missing document reference',
        });

        expect(result.success).toBe(false);
    });

    it('rejects resources owned by another patient inside an aggregate', () => {
        const record = makePatientRecord('patient-a');
        const foreignCondition = makeCondition({
            id: 'foreign-condition',
            patientId: 'patient-b',
        });

        const result = safeParsePatientClinicalRecord({
            ...record,
            resources: {
                ...record.resources,
                conditions: [foreignCondition],
            },
        });

        expect(result.success).toBe(false);
    });
});
