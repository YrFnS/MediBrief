import { describe, expect, it } from 'vitest';
import type { AuditEvent } from '../features/audit/types';
import {
    createPatientClinicalRecord,
    parseClinicalRecordResource,
    type MedicationRecord,
    type PatientClinicalRecord,
} from '../features/clinical-record';
import {
    buildMedicationReconciliationViewModel,
    createMedicationReconciliationTaskRecord,
    medicationReconciliationDecisionLabel,
} from '../features/medication-reconciliation';

const NOW = '2026-08-01T14:00:00.000Z';
const PATIENT_ID = 'patient-medication-reconciliation';

const medication = ({
    id,
    name = 'Example medicine',
    kind = 'statement',
    status = 'active',
    dosage = 'One tablet daily',
    start = '2026-07-01',
    verificationStatus = 'confirmed',
    source = `${id}.pdf`,
    assertion,
    coding,
}: {
    id: string;
    name?: string;
    kind?: MedicationRecord['kind'];
    status?: MedicationRecord['status'];
    dosage?: string | null;
    start?: string | null;
    verificationStatus?: MedicationRecord['verificationStatus'];
    source?: string;
    assertion?: MedicationRecord['assertion'];
    coding?: MedicationRecord['medication']['coding'];
}): MedicationRecord => parseClinicalRecordResource({
    id,
    patientId: PATIENT_ID,
    resourceType: 'Medication',
    verificationStatus,
    recordedAt: NOW,
    ...(start === null
        ? {
            effective: {
                value: null,
                precision: 'unknown',
                sourceText: 'Date not visible',
            },
        }
        : {
            effective: {
                value: start,
                precision: 'day',
                sourceText: start,
            },
            start: {
                value: start,
                precision: 'day',
                sourceText: start,
            },
        }),
    ...(assertion ? { assertion } : {}),
    provenance: {
        source: {
            kind: 'document-extraction',
            document: {
                documentId: `document-${id}`,
                fileName: source,
                pageNumber: 1,
            },
        },
        createdAt: NOW,
        updatedAt: NOW,
        confirmation: {
            reviewedAt: NOW,
            reviewedBy: 'tester',
            reason: 'Synthetic reviewed medication fixture',
        },
    },
    amendments: [],
    kind,
    medication: {
        text: name,
        ...(coding ? { coding } : {}),
    },
    status,
    dosageInstructions: dosage === null ? [] : [{ text: dosage }],
}) as MedicationRecord;

const recordWith = (medications: MedicationRecord[]): PatientClinicalRecord => {
    const base = createPatientClinicalRecord({
        patientId: PATIENT_ID,
        displayName: 'Synthetic Medication Patient',
        now: NOW,
    });
    return {
        ...base,
        resources: {
            ...base.resources,
            medications,
        },
    };
};

const reviewEvent = ({
    issueId,
    fingerprint,
    decision = 'keep-separate',
    taskId,
    timestamp = Date.parse(NOW),
}: {
    issueId: string;
    fingerprint: string;
    decision?: 'keep-separate' | 'record-correction-needed';
    taskId?: string;
    timestamp?: number;
}): AuditEvent => ({
    id: `audit-${issueId}-${timestamp}`,
    timestamp,
    type: 'MEDICATION_RECONCILIATION_REVIEWED',
    patientId: PATIENT_ID,
    actor: 'USER',
    details: 'Synthetic medication reconciliation review',
    metadata: {
        issueId,
        fingerprint,
        issueType: 'possible-duplicate',
        decision,
        decisionLabel: medicationReconciliationDecisionLabel(decision),
        reason: 'Reviewed both original sources.',
        medicationName: 'Example medicine',
        recordIds: ['med-a', 'med-b'],
        sourceLabels: ['a.pdf', 'b.pdf'],
        reviewedAt: NOW,
        reviewedBy: 'tester',
        ...(taskId ? { taskId } : {}),
    },
});

describe('Phase 5 medication reconciliation selection boundary', () => {
    it('uses only confirmed patient-applicable medication records', () => {
        const confirmed = medication({ id: 'confirmed' });
        const candidate = medication({
            id: 'candidate',
            verificationStatus: 'candidate',
        });
        const rejected = medication({
            id: 'rejected',
            verificationStatus: 'rejected',
        });
        const negated = medication({
            id: 'negated',
            assertion: {
                polarity: 'negated',
                certainty: 'certain',
                temporality: 'current',
                experiencer: 'patient',
            },
        });
        const family = medication({
            id: 'family',
            assertion: {
                polarity: 'affirmed',
                certainty: 'certain',
                temporality: 'historical',
                experiencer: 'family',
            },
        });
        const enteredInError = medication({
            id: 'error',
            status: 'entered-in-error',
        });

        const view = buildMedicationReconciliationViewModel(recordWith([
            confirmed,
            candidate,
            rejected,
            negated,
            family,
            enteredInError,
        ]));

        expect(view.medicationCount).toBe(1);
        expect(view.candidateMedicationCount).toBe(1);
        expect(view.groups.flatMap(group => group.records)
            .map(item => item.id))
            .toEqual(['confirmed']);
    });

    it('groups equal source text even when only one record carries coding', () => {
        const coded = medication({
            id: 'coded',
            coding: [{
                system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                code: '12345',
                display: 'Example medicine',
                userSelected: true,
            }],
        });
        const uncoded = medication({ id: 'uncoded' });

        const view = buildMedicationReconciliationViewModel(
            recordWith([coded, uncoded]),
        );

        expect(view.groupCount).toBe(1);
        expect(view.groups[0].records).toHaveLength(2);
        expect(view.groups[0].issues.some(issue =>
            issue.type === 'possible-duplicate')).toBe(true);
    });
});

describe('Phase 5 medication discrepancy detection', () => {
    it('detects duplicate, status, direction, missing-data, and uncertain-status review items', () => {
        const duplicateA = medication({ id: 'dup-a', source: 'a.pdf' });
        const duplicateB = medication({ id: 'dup-b', source: 'b.pdf' });
        const stopped = medication({
            id: 'stopped',
            status: 'stopped',
            dosage: 'One tablet daily',
            start: null,
        });
        const differentDirections = medication({
            id: 'different-directions',
            dosage: 'Two tablets twice daily',
            start: null,
        });
        const missing = medication({
            id: 'missing',
            status: 'unknown',
            dosage: null,
            start: null,
        });

        const view = buildMedicationReconciliationViewModel(recordWith([
            duplicateA,
            duplicateB,
            stopped,
            differentDirections,
            missing,
        ]));
        const types = new Set(view.issues.map(issue => issue.type));

        expect(types).toEqual(expect.objectContaining({
            has: expect.any(Function),
        }));
        expect(types.has('possible-duplicate')).toBe(true);
        expect(types.has('status-conflict')).toBe(true);
        expect(types.has('direction-conflict')).toBe(true);
        expect(types.has('missing-directions')).toBe(true);
        expect(types.has('missing-clinical-date')).toBe(true);
        expect(types.has('uncertain-active-status')).toBe(true);
        expect(view.conflictCount).toBeGreaterThan(0);
        expect(view.missingInformationCount).toBeGreaterThan(0);
    });

    it('keeps administrations separate from statements and requests', () => {
        const statement = medication({
            id: 'statement',
            kind: 'statement',
            status: 'active',
            dosage: 'One tablet daily',
        });
        const administration = medication({
            id: 'administration',
            kind: 'administration',
            status: 'completed',
            dosage: 'One tablet administered',
        });

        const view = buildMedicationReconciliationViewModel(
            recordWith([statement, administration]),
        );
        const issues = view.groups[0].issues;

        expect(issues.some(issue =>
            issue.type === 'cross-kind-context')).toBe(true);
        expect(issues.some(issue =>
            issue.type === 'possible-duplicate')).toBe(false);
        expect(issues.some(issue =>
            issue.type === 'status-conflict')).toBe(false);
        expect(issues.some(issue =>
            issue.type === 'direction-conflict')).toBe(false);
    });
});

describe('Phase 5 medication reconciliation decisions and tasks', () => {
    it('applies the latest matching audit decision without mutating medication records', () => {
        const record = recordWith([
            medication({ id: 'med-a', source: 'a.pdf' }),
            medication({ id: 'med-b', source: 'b.pdf' }),
        ]);
        const before = JSON.stringify(record);
        const initial = buildMedicationReconciliationViewModel(record);
        const issue = initial.issues.find(item =>
            item.type === 'possible-duplicate')!;

        const reviewed = buildMedicationReconciliationViewModel(record, [
            reviewEvent({
                issueId: issue.id,
                fingerprint: issue.fingerprint,
            }),
        ]);
        const reviewedIssue = reviewed.issues.find(item => item.id === issue.id)!;

        expect(reviewedIssue.resolutionState).toBe('reviewed');
        expect(reviewedIssue.decision).toMatchObject({
            decision: 'keep-separate',
            reason: 'Reviewed both original sources.',
        });
        expect(JSON.stringify(record)).toBe(before);
    });

    it('creates only a local proposal task and requires a human reason', () => {
        const record = recordWith([
            medication({ id: 'med-a', source: 'a.pdf', start: null }),
            medication({ id: 'med-b', source: 'b.pdf', start: null }),
        ]);
        const issue = buildMedicationReconciliationViewModel(record)
            .issues.find(item => item.type === 'possible-duplicate')!;

        expect(() => createMedicationReconciliationTaskRecord({
            patientId: PATIENT_ID,
            issue,
            decision: 'record-correction-needed',
            reason: '   ',
        })).toThrow('requires a review reason');

        const { task, warnings } = createMedicationReconciliationTaskRecord({
            patientId: PATIENT_ID,
            issue,
            decision: 'record-correction-needed',
            reason: 'Both source documents need manual comparison.',
            createdAt: NOW,
            createdBy: 'tester',
        });

        expect(task).toMatchObject({
            resourceType: 'ClinicalTask',
            verificationStatus: 'confirmed',
            status: 'requested',
            intent: 'proposal',
            relatedResources: [
                { resourceType: 'Medication', id: 'med-a' },
                { resourceType: 'Medication', id: 'med-b' },
            ],
        });
        expect(task.tags).toEqual(expect.arrayContaining([
            'medication-reconciliation',
            'review-proposal',
            'not-an-order',
        ]));
        expect(task.note).toContain('not a prescription');
        expect(task.due).toMatchObject({
            value: null,
            precision: 'unknown',
        });
        expect(warnings).toContain(
            'One or more medication records have an unknown clinical date.',
        );
    });
});
