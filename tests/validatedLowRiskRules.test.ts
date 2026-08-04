import { describe, expect, it, vi } from 'vitest';
import type { AuditEvent } from '../features/audit/types';
import {
    createPatientClinicalRecord,
    parseClinicalRecordResource,
    type ClinicalTaskRecord,
    type ConditionRecord,
    type MedicationRecord,
    type ObservationRecord,
    type PatientClinicalRecord,
} from '../features/clinical-record';
import {
    localEvidenceIdForResource,
    resolveLocalEvidence,
} from '../features/grounded-assistance';
import {
    ACTIVE_MEDICATION_DIRECTIONS_REVIEW_RULE,
    CONFIRMED_RECORD_CLINICAL_DATE_REVIEW_RULE,
    LOW_RISK_VALIDATED_RULES,
    OPEN_TASK_DUE_DATE_REVIEW_RULE,
} from '../features/cdss/lowRiskPilotRules';
import {
    evaluateValidatedRule,
    validatedRuleMetadataIssues,
    type ValidatedClinicalRuleDefinition,
} from '../features/cdss/validatedRules';
import {
    buildValidatedRuleReviewViewModel,
    createValidatedAdvisoryReviewTask,
} from '../features/cdss/validatedRuleReview';
import type { CDSSAlert } from '../features/cdss/types';

const NOW = '2026-08-01T18:00:00.000Z';
const PATIENT_ID = 'patient-phase5-low-risk-pilots';

const day = (value: string) => ({
    value,
    precision: 'day' as const,
    sourceText: value,
});

const unknownDate = () => ({
    value: null,
    precision: 'unknown' as const,
    sourceText: 'Date not recorded',
});

const provenance = (description: string, updatedAt = NOW) => ({
    source: {
        kind: 'manual' as const,
        description,
    },
    createdAt: NOW,
    updatedAt,
    confirmation: {
        reviewedAt: NOW,
        reviewedBy: 'synthetic-reviewer',
        reason: 'PHI-free reviewed test fixture',
    },
});

const condition = ({
    id,
    verificationStatus = 'confirmed',
    assertion,
    onset,
    updatedAt,
}: {
    id: string;
    verificationStatus?: ConditionRecord['verificationStatus'];
    assertion?: ConditionRecord['assertion'];
    onset?: ReturnType<typeof day>;
    updatedAt?: string;
}): ConditionRecord => parseClinicalRecordResource({
    id,
    patientId: PATIENT_ID,
    resourceType: 'Condition',
    verificationStatus,
    recordedAt: NOW,
    provenance: provenance(`Condition ${id}`, updatedAt),
    amendments: [],
    ...(assertion ? { assertion } : {}),
    ...(onset ? { onset } : {}),
    code: { text: `Synthetic condition ${id}` },
    clinicalStatus: 'active',
}) as ConditionRecord;

const medication = ({
    id,
    verificationStatus = 'confirmed',
    status = 'active',
    directions,
}: {
    id: string;
    verificationStatus?: MedicationRecord['verificationStatus'];
    status?: MedicationRecord['status'];
    directions?: string;
}): MedicationRecord => parseClinicalRecordResource({
    id,
    patientId: PATIENT_ID,
    resourceType: 'Medication',
    verificationStatus,
    recordedAt: NOW,
    provenance: provenance(`Medication ${id}`),
    amendments: [],
    kind: 'statement',
    medication: { text: `Synthetic medicine ${id}` },
    status,
    dosageInstructions: directions === undefined ? [] : [{ text: directions }],
}) as MedicationRecord;

const task = ({
    id,
    verificationStatus = 'confirmed',
    status = 'requested',
    due,
}: {
    id: string;
    verificationStatus?: ClinicalTaskRecord['verificationStatus'];
    status?: ClinicalTaskRecord['status'];
    due?: ReturnType<typeof day> | ReturnType<typeof unknownDate>;
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
    title: `Synthetic task ${id}`,
    ...(due ? { due } : {}),
    relatedResources: [],
}) as ClinicalTaskRecord;

const observationWithIssuedAtOnly = (): ObservationRecord =>
    parseClinicalRecordResource({
        id: 'observation-issued-only',
        patientId: PATIENT_ID,
        resourceType: 'Observation',
        verificationStatus: 'confirmed',
        recordedAt: NOW,
        issuedAt: '2026-07-31T08:00:00.000Z',
        provenance: provenance('Synthetic issued result without effective date'),
        amendments: [],
        status: 'final',
        category: [{ text: 'Laboratory' }],
        code: { text: 'Synthetic analyte' },
        value: {
            type: 'quantity',
            quantity: {
                original: { value: 10, unit: 'mg/L' },
            },
        },
        interpretation: [],
        referenceRanges: [],
    }) as ObservationRecord;

const recordWith = ({
    conditions = [],
    medications = [],
    tasks = [],
    observations = [],
}: {
    conditions?: ConditionRecord[];
    medications?: MedicationRecord[];
    tasks?: ClinicalTaskRecord[];
    observations?: ObservationRecord[];
} = {}): PatientClinicalRecord => {
    const base = createPatientClinicalRecord({
        patientId: PATIENT_ID,
        displayName: 'Synthetic Phase 5 Patient',
        now: NOW,
    });
    return {
        ...base,
        resources: {
            ...base.resources,
            conditions,
            medications,
            tasks,
            observations,
        },
    };
};

const evaluate = (
    rule: ValidatedClinicalRuleDefinition<PatientClinicalRecord>,
    record: PatientClinicalRecord,
) => evaluateValidatedRule(rule, record);

describe('Phase 5 low-risk rule registry metadata', () => {
    it('registers only reviewed Info-level workflow and data-quality pilots', () => {
        expect(LOW_RISK_VALIDATED_RULES).toHaveLength(3);
        LOW_RISK_VALIDATED_RULES.forEach(rule => {
            expect(rule.validationStatus).toBe('validated');
            expect(rule.allowedLevels).toEqual(['Info']);
            expect(['workflow', 'data-quality']).toContain(rule.riskClass);
            expect(rule.exclusions.length).toBeGreaterThan(0);
            expect(rule.safetyBoundaries?.length).toBeGreaterThan(0);
            expect(rule.regressionPackage).toMatchObject({
                id: 'medibrief-phase5-low-risk-rule-pilots-v1',
                phiFree: true,
                caseCount: 12,
            });
            expect(validatedRuleMetadataIssues(rule)).toEqual([]);
        });
    });

    it('fails closed when a low-risk rule is not Info-only or lacks reviewed exclusions', () => {
        const unsafeLevel = {
            ...CONFIRMED_RECORD_CLINICAL_DATE_REVIEW_RULE,
            allowedLevels: ['Info', 'Warning'] as const,
        } as unknown as ValidatedClinicalRuleDefinition<PatientClinicalRecord>;
        expect(validatedRuleMetadataIssues(unsafeLevel))
            .toContain('A low-risk pilot rule must be Info-only.');
        expect(evaluateValidatedRule(unsafeLevel, recordWith()))
            .toMatchObject({ executed: false, skippedReason: 'metadata-incomplete' });

        const noExclusions = {
            ...CONFIRMED_RECORD_CLINICAL_DATE_REVIEW_RULE,
            exclusions: [],
        };
        expect(validatedRuleMetadataIssues(noExclusions))
            .toContain('A low-risk pilot rule requires explicit exclusions.');
    });
});

describe('Phase 5 low-risk pilot behavior', () => {
    it('reports missing explicit clinical dates without substituting issued or recorded timestamps', () => {
        const missing = condition({ id: 'condition-date-missing' });
        const known = condition({
            id: 'condition-date-known',
            onset: day('2026-07-01'),
        });
        const candidate = condition({
            id: 'condition-date-candidate',
            verificationStatus: 'candidate',
        });
        const negated = condition({
            id: 'condition-date-negated',
            assertion: {
                polarity: 'negated',
                certainty: 'certain',
                temporality: 'current',
                experiencer: 'patient',
            },
        });
        const issuedOnly = observationWithIssuedAtOnly();
        const result = evaluate(
            CONFIRMED_RECORD_CLINICAL_DATE_REVIEW_RULE,
            recordWith({
                conditions: [missing, known, candidate, negated],
                observations: [issuedOnly],
            }),
        );

        expect(result.matched).toBe(true);
        expect(result.advisory).toMatchObject({
            level: 'Info',
            advisoryKind: 'data-quality',
            validationStatus: 'validated',
        });
        expect(result.advisory?.evidenceIds).toEqual(expect.arrayContaining([
            localEvidenceIdForResource(missing),
            localEvidenceIdForResource(issuedOnly),
        ]));
        expect(result.advisory?.evidenceIds).not.toEqual(expect.arrayContaining([
            localEvidenceIdForResource(known),
            localEvidenceIdForResource(candidate),
            localEvidenceIdForResource(negated),
        ]));
        expect(result.advisory?.description).toContain('were not substituted');
    });

    it('reports missing medication source directions without generating dose or safety advice', () => {
        const missing = medication({ id: 'med-directions-missing' });
        const present = medication({
            id: 'med-directions-present',
            directions: 'Use the reviewed source wording.',
        });
        const completed = medication({
            id: 'med-directions-completed',
            status: 'completed',
        });
        const candidate = medication({
            id: 'med-directions-candidate',
            verificationStatus: 'candidate',
        });
        const result = evaluate(
            ACTIVE_MEDICATION_DIRECTIONS_REVIEW_RULE,
            recordWith({ medications: [missing, present, completed, candidate] }),
        );

        expect(result.advisory?.evidenceIds)
            .toEqual([localEvidenceIdForResource(missing)]);
        expect(result.advisory?.level).toBe('Info');
        const text = JSON.stringify(result.advisory).toLowerCase();
        expect(text).toContain('documentation');
        expect(text).toContain('does not recommend');
        expect(text).not.toContain('safe dose');
        expect(text).not.toContain('start taking');
    });

    it('reports only confirmed open tasks with no usable explicit due date', () => {
        const missing = task({ id: 'task-due-missing' });
        const unknown = task({ id: 'task-due-unknown', due: unknownDate() });
        const scheduled = task({ id: 'task-due-known', due: day('2026-08-05') });
        const completed = task({ id: 'task-due-completed', status: 'completed' });
        const result = evaluate(
            OPEN_TASK_DUE_DATE_REVIEW_RULE,
            recordWith({ tasks: [missing, unknown, scheduled, completed] }),
        );

        expect(result.advisory?.evidenceIds).toEqual(expect.arrayContaining([
            localEvidenceIdForResource(missing),
            localEvidenceIdForResource(unknown),
        ]));
        expect(result.advisory?.evidenceIds).not.toEqual(expect.arrayContaining([
            localEvidenceIdForResource(scheduled),
            localEvidenceIdForResource(completed),
        ]));
        expect(result.advisory?.limitations?.join(' '))
            .toContain('not automatically overdue or urgent');
    });
});

describe('Phase 5 stronger fail-closed output boundary', () => {
    const ruleWith = (
        advisory: Partial<CDSSAlert>,
    ): ValidatedClinicalRuleDefinition<PatientClinicalRecord> => ({
        ...CONFIRMED_RECORD_CLINICAL_DATE_REVIEW_RULE,
        id: `synthetic-${String(advisory.advisoryKind || 'boundary')}`,
        evaluate: () => ({
            id: 'synthetic-output',
            ruleId: 'replaced',
            title: 'Synthetic reviewed output',
            description: 'Synthetic output for fail-closed testing.',
            level: 'Info',
            timestamp: Date.parse(NOW),
            triggers: ['synthetic'],
            actions: [{ label: 'Review locally', type: 'create-task' }],
            advisoryKind: 'data-quality',
            evidenceIds: ['MB:Condition:synthetic'],
            ...advisory,
        }),
    });

    it('withholds wrong-risk, missing-evidence, invalid-evidence, and evaluator-error output', () => {
        expect(evaluateValidatedRule(
            ruleWith({ advisoryKind: 'workflow' }),
            recordWith(),
        )).toMatchObject({
            executed: false,
            skippedReason: 'risk-boundary-mismatch',
        });
        expect(evaluateValidatedRule(
            ruleWith({ evidenceIds: [] }),
            recordWith(),
        )).toMatchObject({
            executed: false,
            skippedReason: 'evidence-missing',
        });
        expect(evaluateValidatedRule(
            ruleWith({ evidenceIds: ['not-local-evidence'] }),
            recordWith(),
        )).toMatchObject({
            executed: false,
            skippedReason: 'invalid-evidence-id',
        });
        expect(evaluateValidatedRule(
            ruleWith({ evidenceIds: ['MB:NotAClinicalResource:synthetic'] }),
            recordWith(),
        )).toMatchObject({
            executed: false,
            skippedReason: 'invalid-evidence-id',
        });

        const throwing = {
            ...CONFIRMED_RECORD_CLINICAL_DATE_REVIEW_RULE,
            id: 'synthetic-throwing-rule',
            evaluate: vi.fn(() => {
                throw new Error('Synthetic evaluator error');
            }),
        };
        expect(evaluateValidatedRule(throwing, recordWith()))
            .toMatchObject({
                executed: false,
                skippedReason: 'evaluation-error',
                error: 'Synthetic evaluator error',
            });
    });
});

describe('Phase 5 durable advisory review', () => {
    it('applies a decision only to the exact snapshot fingerprint', () => {
        const source = condition({ id: 'condition-snapshot' });
        const record = recordWith({ conditions: [source] });
        const first = buildValidatedRuleReviewViewModel(record, []);
        const item = first.advisories.find(current =>
            current.advisory.ruleId.startsWith(
                CONFIRMED_RECORD_CLINICAL_DATE_REVIEW_RULE.id,
            ))!;
        const logs: AuditEvent[] = [{
            id: 'audit-acknowledgment',
            timestamp: Date.parse(NOW),
            type: 'VALIDATED_ADVISORY_ACKNOWLEDGED',
            patientId: PATIENT_ID,
            actor: 'USER',
            details: 'Synthetic acknowledgment',
            metadata: {
                fingerprint: item.fingerprint,
                reason: 'Reviewed the exact synthetic source.',
                reviewedAt: NOW,
                reviewedBy: 'tester',
            },
        }];
        expect(buildValidatedRuleReviewViewModel(record, logs)
            .advisories.find(current => current.fingerprint === item.fingerprint))
            .toMatchObject({ state: 'acknowledged' });

        const amended = condition({
            id: source.id,
            updatedAt: '2026-08-01T19:00:00.000Z',
        });
        const changedRecord = recordWith({ conditions: [amended] });
        const changed = buildValidatedRuleReviewViewModel(changedRecord, logs)
            .advisories.find(current => current.advisory.ruleId.startsWith(
                CONFIRMED_RECORD_CLINICAL_DATE_REVIEW_RULE.id,
            ))!;
        expect(changed.fingerprint).not.toBe(item.fingerprint);
        expect(changed.state).toBe('unreviewed');
    });

    it('creates only a routine local proposal task after a non-empty reason', () => {
        const record = recordWith({
            conditions: [condition({ id: 'condition-task-source' })],
        });
        const advisory = buildValidatedRuleReviewViewModel(record, [])
            .advisories[0].advisory;

        expect(() => createValidatedAdvisoryReviewTask({
            patientId: PATIENT_ID,
            advisory,
            reason: '   ',
        })).toThrow('review reason is required');

        const created = createValidatedAdvisoryReviewTask({
            patientId: PATIENT_ID,
            advisory,
            reason: 'Review and correct the source-backed date field if evidence supports it.',
            createdAt: NOW,
            createdBy: 'tester',
        });
        expect(created).toMatchObject({
            resourceType: 'ClinicalTask',
            verificationStatus: 'confirmed',
            status: 'requested',
            intent: 'proposal',
            priority: 'routine',
            due: {
                value: null,
                precision: 'unknown',
            },
        });
        expect(created.relatedResources.map(item => item.id))
            .toEqual(advisory.evidenceIds?.map(id => id.split(':').slice(2).join(':')));
        expect(created.tags).toEqual(expect.arrayContaining([
            'not-an-order',
            'validated-low-risk-rule',
        ]));
        expect(created.note).toContain('does not send a notification');
        expect(created.note).toContain('place an order or prescription');
        expect(created.note).toContain('assign clinical urgency');

        const selfCheck = evaluate(
            OPEN_TASK_DUE_DATE_REVIEW_RULE,
            recordWith({ tasks: [created] }),
        );
        expect(selfCheck.matched).toBe(false);
    });

    it('resolves advisory evidence through the same confirmed grounding boundary', () => {
        const confirmed = condition({ id: 'evidence-confirmed' });
        const candidate = condition({
            id: 'evidence-candidate',
            verificationStatus: 'candidate',
        });
        const record = recordWith({ conditions: [confirmed, candidate] });
        const resolution = resolveLocalEvidence(record, [
            localEvidenceIdForResource(confirmed),
            localEvidenceIdForResource(candidate),
            'MB:Condition:invented',
        ]);
        expect(resolution.evidence.map(item => item.resourceId))
            .toEqual(['evidence-confirmed']);
        expect(resolution.missingIds).toEqual(expect.arrayContaining([
            localEvidenceIdForResource(candidate),
            'MB:Condition:invented',
        ]));
    });
});
