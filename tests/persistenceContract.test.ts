import { describe, expect, it } from 'vitest';
import {
    CLINICAL_RECORD_SCHEMA_VERSION,
    useClinicalRecordStore,
} from '../features/clinical-record';
import { makePatientRecord } from './fixtures';

describe('clinical record persistence contract', () => {
    it('uses explicit versioning and waits for post-unlock hydration', () => {
        const options = useClinicalRecordStore.persist.getOptions();

        expect(options.version).toBe(CLINICAL_RECORD_SCHEMA_VERSION);
        expect(options.skipHydration).toBe(true);
    });

    it('fails closed on an unsupported persisted version', () => {
        const migrate = useClinicalRecordStore.persist.getOptions().migrate;
        expect(migrate).toBeTypeOf('function');

        expect(() => migrate?.({ records: {} }, 999))
            .toThrow('Unsupported clinical record persistence version');
    });

    it('validates persisted aggregates before accepting them', async () => {
        const migrate = useClinicalRecordStore.persist.getOptions().migrate;
        const valid = await migrate?.({
            records: {
                'patient-1': makePatientRecord(),
            },
        }, CLINICAL_RECORD_SCHEMA_VERSION);

        expect(valid).toEqual({
            records: {
                'patient-1': makePatientRecord(),
            },
        });

        expect(() => migrate?.({
            records: {
                'patient-1': {
                    ...makePatientRecord(),
                    patientId: 'different-patient',
                },
            },
        }, CLINICAL_RECORD_SCHEMA_VERSION)).toThrow();
    });
});
