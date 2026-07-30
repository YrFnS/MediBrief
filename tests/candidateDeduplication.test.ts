import { beforeEach, describe, expect, it } from 'vitest';
import {
    parseClinicalRecordResource,
    useClinicalRecordStore,
    type ConditionRecord,
} from '../features/clinical-record';
import { FIXED_TIME, makeCondition } from './fixtures';

const sourcedCondition = (
    id: string,
    documentId: string,
): ConditionRecord => parseClinicalRecordResource({
    ...makeCondition({ id }),
    provenance: {
        source: {
            kind: 'document-extraction',
            document: {
                documentId,
                pageNumber: 1,
                startOffset: 10,
                endOffset: 16,
                excerpt: 'Asthma',
            },
        },
        createdAt: FIXED_TIME,
        updatedAt: FIXED_TIME,
        extraction: {
            engine: 'test-extractor',
            engineVersion: '1',
            confidence: 0.9,
            extractedAt: FIXED_TIME,
        },
    },
}) as ConditionRecord;

describe('candidate deduplication', () => {
    beforeEach(() => {
        useClinicalRecordStore.setState({ records: {} });
        useClinicalRecordStore.getState().actions.initializePatientRecord({
            patientId: 'patient-1',
            displayName: 'Test Patient',
            now: FIXED_TIME,
        });
    });

    it('deduplicates the same assertion from the same stable source span', () => {
        const actions = useClinicalRecordStore.getState().actions;
        const first = sourcedCondition('condition-1', 'document-1');
        const duplicate = sourcedCondition('condition-2', 'document-1');

        expect(actions.addResource(first).status).toBe('created');
        const result = actions.addResource(duplicate);

        expect(result.status).toBe('duplicate');
        expect(result.duplicateOf).toBe(first.id);
        expect(actions.findResources({
            patientId: 'patient-1',
            resourceTypes: ['Condition'],
        })).toHaveLength(1);
    });

    it('keeps equivalent assertions from independent documents separate', () => {
        const actions = useClinicalRecordStore.getState().actions;

        expect(actions.addResource(
            sourcedCondition('condition-1', 'document-1'),
        ).status).toBe('created');
        expect(actions.addResource(
            sourcedCondition('condition-2', 'document-2'),
        ).status).toBe('created');
        expect(actions.findResources({
            patientId: 'patient-1',
            resourceTypes: ['Condition'],
        })).toHaveLength(2);
    });
});
