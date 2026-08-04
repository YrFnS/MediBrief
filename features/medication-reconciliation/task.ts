import { parseClinicalRecordResource } from '../clinical-record/schemas';
import type { ClinicalTaskRecord } from '../clinical-record/types';
import {
    createMedicationReconciliationTaskRecord as createBaseMedicationReconciliationTaskRecord,
} from './reconciliation';
import type {
    MedicationReconciliationTaskInput,
    MedicationReconciliationTaskResult,
} from './types';

/**
 * Reconciliation severity describes workflow attention, not clinical urgency.
 * The canonical exported task builder therefore keeps every generated local
 * follow-up at routine priority. A clinician or user may later review and amend
 * task priority separately when a source-backed workflow reason exists.
 */
export const createMedicationReconciliationTaskRecord = (
    input: MedicationReconciliationTaskInput,
): MedicationReconciliationTaskResult => {
    const result = createBaseMedicationReconciliationTaskRecord(input);
    const task = parseClinicalRecordResource({
        ...result.task,
        priority: 'routine',
        note: [
            result.task.note,
            'Reconciliation discrepancy severity is not a clinical urgency classification. This task remains routine until separately reviewed.',
        ].filter(Boolean).join('\n'),
    }) as ClinicalTaskRecord;

    return {
        ...result,
        task,
    };
};
