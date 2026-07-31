import { beforeEach, describe, expect, it } from 'vitest';
import {
    getResourceDateBounds,
    useClinicalRecordStore,
} from '../features/clinical-record';
import {
    buildManualClinicalAmendment,
    buildManualClinicalResource,
    createInitialManualFormValues,
    manualFormValuesFromResource,
    validateManualResourceRelationships,
} from '../features/personal-health-record';
import {
    FIXED_TIME,
    makeCondition,
    makePatientRecord,
} from './fixtures';

describe('guided manual clinical record entry', () => {
    it('creates a confirmed user-entered observation without inventing its clinical date', () => {
        const record = makePatientRecord();
        const values = createInitialManualFormValues('Observation', record);
        Object.assign(values, {
            title: 'Serum potassium',
            status: 'final',
            category: 'Laboratory',
            valueType: 'quantity',
            value: '4.2',
            unit: 'mmol/L',
            effectiveDate: '',
        });

        const result = buildManualClinicalResource({
            record,
            resourceType: 'Observation',
            values,
            now: FIXED_TIME,
            actor: 'test-user',
        });

        expect(result.ok).toBe(true);
        expect(result.resource).toMatchObject({
            resourceType: 'Observation',
            verificationStatus: 'confirmed',
            effective: {
                value: null,
                precision: 'unknown',
            },
            provenance: {
                source: { kind: 'manual' },
                confirmation: {
                    reviewedBy: 'test-user',
                },
            },
        });
        expect(result.resource?.tags).toContain('manual-entry');
        expect(getResourceDateBounds(result.resource!)).toMatchObject({
            usesRecordedAtFallback: true,
        });
    });

    it('rejects invalid original values and broken relationships before persistence', () => {
        const record = makePatientRecord();
        const observationValues = createInitialManualFormValues('Observation', record);
        Object.assign(observationValues, {
            title: 'Creatinine',
            valueType: 'quantity',
            value: 'not-a-number',
            unit: 'mg/dL',
        });

        const invalidObservation = buildManualClinicalResource({
            record,
            resourceType: 'Observation',
            values: observationValues,
            now: FIXED_TIME,
        });
        expect(invalidObservation.ok).toBe(false);
        expect(invalidObservation.issues.some(item => item.field === 'value')).toBe(true);

        const carePlanValues = createInitialManualFormValues('CarePlan', record);
        Object.assign(carePlanValues, {
            title: 'Asthma follow-up plan',
            status: 'active',
            intent: 'plan',
            conditionIds: 'missing-condition',
        });
        const invalidPlan = buildManualClinicalResource({
            record,
            resourceType: 'CarePlan',
            values: carePlanValues,
            now: FIXED_TIME,
        });
        expect(invalidPlan.ok).toBe(false);
        expect(invalidPlan.issues).toContainEqual(expect.objectContaining({
            field: 'conditionIds',
        }));
    });

    it('accepts same-patient relationship targets and rejects protected targets', () => {
        const record = makePatientRecord();
        const condition = makeCondition({
            id: 'condition-confirmed',
            verificationStatus: 'confirmed',
        });
        const erroneous = makeCondition({
            id: 'condition-error',
            verificationStatus: 'confirmed',
        });
        erroneous.verificationStatus = 'entered-in-error';
        record.resources.conditions.push(condition, erroneous);

        const validValues = createInitialManualFormValues('CarePlan', record);
        Object.assign(validValues, {
            title: 'Confirmed condition plan',
            status: 'active',
            intent: 'plan',
            conditionIds: condition.id,
        });
        const valid = buildManualClinicalResource({
            record,
            resourceType: 'CarePlan',
            values: validValues,
            now: FIXED_TIME,
        });
        expect(valid.ok).toBe(true);
        expect(validateManualResourceRelationships(record, valid.resource!)).toEqual([]);

        const invalidValues = createInitialManualFormValues('CarePlan', record);
        Object.assign(invalidValues, {
            title: 'Invalid condition plan',
            status: 'active',
            intent: 'plan',
            conditionIds: erroneous.id,
        });
        const invalid = buildManualClinicalResource({
            record,
            resourceType: 'CarePlan',
            values: invalidValues,
            now: FIXED_TIME,
        });
        expect(invalid.ok).toBe(false);
        expect(invalid.issues[0]?.message).toContain('not an active confirmed relationship target');
    });
});

describe('history-preserving corrections', () => {
    beforeEach(() => {
        useClinicalRecordStore.setState({ records: {} });
    });

    it('builds a validated correction and preserves previous values with a required reason', () => {
        const actions = useClinicalRecordStore.getState().actions;
        const record = actions.initializePatientRecord({
            patientId: 'patient-1',
            displayName: 'Test Patient',
            now: FIXED_TIME,
        });
        const condition = makeCondition({
            id: 'condition-manual-correction',
            verificationStatus: 'confirmed',
            text: 'Asthma',
        });
        actions.addResource(condition);

        const current = actions.getResource(
            record.patientId,
            'Condition',
            condition.id,
        )!;
        const values = manualFormValuesFromResource(current);
        values.title = 'Persistent asthma';
        values.note = 'Corrected after reviewing the original clinic note.';

        const built = buildManualClinicalAmendment({
            record: actions.getPatientRecord(record.patientId)!,
            resource: current,
            values,
            now: '2026-07-30T12:30:00.000Z',
        });
        expect(built.ok).toBe(true);

        const write = actions.amendResource(
            record.patientId,
            'Condition',
            condition.id,
            built.updates!,
            {
                amendedAt: '2026-07-30T12:30:00.000Z',
                amendedBy: 'test-user',
                reason: 'Source review corrected the condition wording',
            },
        );

        expect(write.ok).toBe(true);
        expect(write.resource).toMatchObject({
            code: { text: 'Persistent asthma' },
            note: 'Corrected after reviewing the original clinic note.',
        });
        expect(write.resource?.amendments.at(-1)).toMatchObject({
            reason: 'Source review corrected the condition wording',
            changedFields: expect.arrayContaining(['code', 'note']),
            previousValues: {
                code: { text: 'Asthma' },
            },
        });
    });

    it('protects candidates and requires a reason before entering confirmed history in error', () => {
        const actions = useClinicalRecordStore.getState().actions;
        const record = actions.initializePatientRecord({
            patientId: 'patient-1',
            displayName: 'Test Patient',
            now: FIXED_TIME,
        });
        const candidate = makeCondition({
            id: 'candidate-condition',
            verificationStatus: 'candidate',
        });
        const confirmed = makeCondition({
            id: 'confirmed-condition',
            verificationStatus: 'confirmed',
        });
        actions.addResource(candidate);
        actions.addResource(confirmed);

        const candidateBuild = buildManualClinicalAmendment({
            record: actions.getPatientRecord(record.patientId)!,
            resource: candidate,
            values: manualFormValuesFromResource(candidate),
        });
        expect(candidateBuild.ok).toBe(false);
        expect(candidateBuild.issues[0]?.message).toContain('Only confirmed records');

        const missingReason = actions.markResourceEnteredInError(
            record.patientId,
            'Condition',
            confirmed.id,
            { amendedBy: 'test-user' },
        );
        expect(missingReason.ok).toBe(false);

        const marked = actions.markResourceEnteredInError(
            record.patientId,
            'Condition',
            confirmed.id,
            {
                amendedAt: '2026-07-30T12:40:00.000Z',
                amendedBy: 'test-user',
                reason: 'The entry belonged to another patient',
            },
        );
        expect(marked.resource?.verificationStatus).toBe('entered-in-error');
        expect(marked.resource?.amendments.at(-1)).toMatchObject({
            reason: 'The entry belonged to another patient',
            previousValues: { verificationStatus: 'confirmed' },
        });
    });
});
