import {
    isConfirmedPatientFact,
    selectConfirmedMedications,
    selectConfirmedResources,
} from '../clinical-record';
import type {
    ClinicalDate,
    ClinicalPeriod,
    ClinicalRecordResource,
    ClinicalTaskRecord,
    MedicationRecord,
    PatientClinicalRecord,
} from '../clinical-record/types';
import { localEvidenceIdForResource } from '../grounded-assistance/evidenceReview';
import type { CDSSAlert } from './types';
import type {
    ClinicalRuleEvidenceCitation,
    ValidatedClinicalRuleDefinition,
} from './validatedRules';

const VALIDATION_DATE = '2026-08-01';
const VALIDATION_OWNER = 'MediBrief Phase 5 low-risk rule review';
const REGRESSION_PACKAGE_ID = 'medibrief-phase5-low-risk-rule-pilots-v1';

const INTERNAL_POLICY_CITATION: ClinicalRuleEvidenceCitation = {
    id: 'medibrief-phase5-low-risk-policy-v1',
    title: 'Phase 5 low-risk validated rule pilots, evidence, and audit architecture',
    publisher: 'MediBrief',
    versionOrDate: VALIDATION_DATE,
    locator: 'docs/architecture/PHASE_5_LOW_RISK_RULES_EVIDENCE_AUDIT.md',
    note: 'Reviewed application policy limiting pilots to workflow and data-quality advisories.',
};

const FHIR_DATA_QUALITY_CITATION: ClinicalRuleEvidenceCitation = {
    id: 'hl7-fhir-r4-resource-metadata',
    title: 'HL7 FHIR Release 4 resource and data type definitions',
    publisher: 'HL7 International',
    versionOrDate: 'R4 (4.0.1)',
    locator: 'Resource metadata, date/dateTime, Medication, and Task structures',
    note: 'Used only to define explicit structured-field completeness checks, not clinical interpretation.',
};

const REGRESSION_PACKAGE = {
    id: REGRESSION_PACKAGE_ID,
    phiFree: true,
    caseCount: 12,
    fixtureFile: 'evaluation/phase5/low_risk_rule_pilots_v1.json',
    testFile: 'tests/validatedLowRiskRules.test.ts',
    reviewedBy: VALIDATION_OWNER,
    reviewedAt: VALIDATION_DATE,
};

const hasUsableClinicalDate = (date?: ClinicalDate): boolean =>
    Boolean(date?.value && date.precision !== 'unknown');

const hasUsableDateLike = (
    value?: ClinicalDate | ClinicalPeriod,
): boolean => {
    if (!value) return false;
    if ('precision' in value) return hasUsableClinicalDate(value);
    return hasUsableClinicalDate(value.start) || hasUsableClinicalDate(value.end);
};

/**
 * Uses only explicit clinical fields that represent the resource's clinical
 * timing. It intentionally does not accept recordedAt, upload, extraction,
 * review, storage, or report-issuance timestamps as substitutes.
 */
const hasExplicitClinicalDate = (resource: ClinicalRecordResource): boolean => {
    if (hasUsableDateLike(resource.effective)) return true;

    switch (resource.resourceType) {
        case 'PatientProfile':
            return hasUsableClinicalDate(resource.dateOfBirth);
        case 'Encounter':
            return hasUsableDateLike(resource.period);
        case 'Condition':
            return hasUsableClinicalDate(resource.onset)
                || hasUsableClinicalDate(resource.abatement);
        case 'AllergyIntolerance':
            return hasUsableClinicalDate(resource.lastOccurrence);
        case 'Medication':
            return hasUsableClinicalDate(resource.start)
                || hasUsableClinicalDate(resource.end);
        case 'Observation':
            return false;
        case 'DiagnosticReport':
            return hasUsableDateLike(resource.effectivePeriod);
        case 'Specimen':
            return hasUsableClinicalDate(resource.collectedAt)
                || hasUsableClinicalDate(resource.receivedAt);
        case 'Procedure':
            return hasUsableDateLike(resource.performed);
        case 'Immunization':
            return hasUsableClinicalDate(resource.occurrence);
        case 'Appointment':
        case 'ClinicalTask':
        case 'CarePlan':
        case 'DocumentReference':
        case 'ClinicalNote':
            return false;
    }
};

const stableHash = (value: string): string => {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
};

const sortedAffected = (
    resources: ClinicalRecordResource[],
): ClinicalRecordResource[] => [...resources].sort((left, right) =>
    localEvidenceIdForResource(left).localeCompare(localEvidenceIdForResource(right)));

const resourceSnapshot = (resource: ClinicalRecordResource): Record<string, unknown> => {
    const base: Record<string, unknown> = {
        evidenceId: localEvidenceIdForResource(resource),
        resourceType: resource.resourceType,
        verificationStatus: resource.verificationStatus,
        updatedAt: resource.provenance.updatedAt,
        amendmentCount: resource.amendments.length,
    };

    if (resource.resourceType === 'Medication') {
        return {
            ...base,
            kind: resource.kind,
            status: resource.status,
            start: resource.start || null,
            end: resource.end || null,
            dosageInstructions: resource.dosageInstructions.map(item => ({
                text: item.text,
                frequency: item.frequency || null,
                timingText: item.timingText || null,
                route: item.route?.text || null,
            })),
        };
    }
    if (resource.resourceType === 'ClinicalTask') {
        return {
            ...base,
            status: resource.status,
            intent: resource.intent,
            priority: resource.priority,
            due: resource.due || null,
        };
    }

    return {
        ...base,
        hasExplicitClinicalDate: hasExplicitClinicalDate(resource),
        effective: resource.effective || null,
    };
};

const advisoryFingerprint = ({
    ruleId,
    version,
    resources,
}: {
    ruleId: string;
    version: string;
    resources: ClinicalRecordResource[];
}): string => {
    const snapshots = sortedAffected(resources).map(resourceSnapshot);
    return `${ruleId}@${version}:${stableHash(JSON.stringify(snapshots))}`;
};

const buildInfoAdvisory = ({
    ruleId,
    version,
    title,
    description,
    resources,
    triggers,
    actionLabel,
    advisoryKind,
    limitations,
}: {
    ruleId: string;
    version: string;
    title: string;
    description: string;
    resources: ClinicalRecordResource[];
    triggers: string[];
    actionLabel: string;
    advisoryKind: 'workflow' | 'data-quality';
    limitations: string[];
}): CDSSAlert => {
    const affected = sortedAffected(resources);
    const fingerprint = advisoryFingerprint({ ruleId, version, resources: affected });
    return {
        id: `validated-${stableHash(fingerprint)}`,
        ruleId,
        title,
        description,
        level: 'Info',
        timestamp: Date.now(),
        triggers,
        actions: [
            {
                label: actionLabel,
                type: 'create-task',
                payload: [
                    description,
                    ...limitations,
                    'Review the linked local evidence before correcting any source-backed field.',
                ].join(' '),
            },
            {
                label: 'Acknowledge this evidence snapshot',
                type: 'acknowledge',
            },
        ],
        advisoryKind,
        evidenceIds: affected.map(localEvidenceIdForResource),
        fingerprint,
        limitations,
    };
};

const DATE_REVIEW_TYPES = new Set<ClinicalRecordResource['resourceType']>([
    'Encounter',
    'Condition',
    'AllergyIntolerance',
    'Medication',
    'Observation',
    'DiagnosticReport',
    'Specimen',
    'Procedure',
    'Immunization',
]);

const DATE_REVIEW_RULE_ID = 'mb-confirmed-record-clinical-date-review';
const DATE_REVIEW_RULE_VERSION = '1.0.0';

export const CONFIRMED_RECORD_CLINICAL_DATE_REVIEW_RULE: ValidatedClinicalRuleDefinition<PatientClinicalRecord> = {
    id: DATE_REVIEW_RULE_ID,
    version: DATE_REVIEW_RULE_VERSION,
    name: 'Confirmed record clinical-date review',
    description: 'Identifies confirmed patient-applicable clinical records that have no explicit usable clinical date and would otherwise fall back to a storage timestamp in timeline utilities.',
    owner: VALIDATION_OWNER,
    intendedPopulation: 'Locally stored patient records containing confirmed patient-applicable structured clinical facts.',
    requiredInputs: [
        'confirmed verification status',
        'patient-applicable assertion context',
        'explicit resource clinical-date fields',
    ],
    exclusions: [
        'candidate, rejected, and entered-in-error resources',
        'negated, hypothetical, family, and other-person assertions',
        'planning-only resources handled by the explicit reminder workspace',
        'records with a usable explicit clinical date or dateTime',
    ],
    allowedLevels: ['Info'],
    evidence: [INTERNAL_POLICY_CITATION, FHIR_DATA_QUALITY_CITATION],
    validationStatus: 'validated',
    validatedAt: VALIDATION_DATE,
    riskClass: 'data-quality',
    reviewedBy: VALIDATION_OWNER,
    reviewedAt: VALIDATION_DATE,
    safetyBoundaries: [
        'This advisory reports missing structured date evidence only.',
        'It does not infer when an event occurred from recorded, upload, extraction, review, or storage timestamps.',
        'It does not determine urgency, clinical significance, diagnosis, prognosis, or treatment.',
    ],
    regressionPackage: REGRESSION_PACKAGE,
    evaluate: record => {
        const affected = selectConfirmedResources(record).filter(resource =>
            DATE_REVIEW_TYPES.has(resource.resourceType)
            && !hasExplicitClinicalDate(resource));
        if (affected.length === 0) return null;

        const typeCount = new Set(affected.map(item => item.resourceType)).size;
        return buildInfoAdvisory({
            ruleId: DATE_REVIEW_RULE_ID,
            version: DATE_REVIEW_RULE_VERSION,
            title: 'Confirmed records need clinical-date review',
            description: `${affected.length} confirmed patient-applicable record${affected.length === 1 ? ' has' : 's have'} no explicit usable clinical date across ${typeCount} resource type${typeCount === 1 ? '' : 's'}. Recorded or storage timestamps were not substituted.`,
            resources: affected,
            triggers: [
                `${affected.length} confirmed record${affected.length === 1 ? '' : 's'}`,
                'Clinical date unknown',
                'Storage timestamp not substituted',
            ],
            actionLabel: 'Create local date-review task',
            advisoryKind: 'data-quality',
            limitations: [
                'A missing date does not mean the underlying clinical fact is false.',
                'The advisory does not estimate or manufacture an event date.',
            ],
        });
    },
};

const MEDICATION_DIRECTIONS_RULE_ID = 'mb-active-medication-directions-review';
const MEDICATION_DIRECTIONS_RULE_VERSION = '1.0.0';

const hasUsableDirections = (medication: MedicationRecord): boolean =>
    medication.dosageInstructions.some(item => item.text.trim().length > 0);

export const ACTIVE_MEDICATION_DIRECTIONS_REVIEW_RULE: ValidatedClinicalRuleDefinition<PatientClinicalRecord> = {
    id: MEDICATION_DIRECTIONS_RULE_ID,
    version: MEDICATION_DIRECTIONS_RULE_VERSION,
    name: 'Active medication direction completeness review',
    description: 'Identifies current confirmed medication records whose structured dosage-instruction list contains no usable source wording.',
    owner: VALIDATION_OWNER,
    intendedPopulation: 'Locally stored patient records containing confirmed active, on-hold, or unknown-status medication statements, requests, or administrations.',
    requiredInputs: [
        'confirmed patient-applicable medication record',
        'medication record kind and status',
        'dosage instruction source wording',
    ],
    exclusions: [
        'candidate, rejected, entered-in-error, negated, hypothetical, family, and other-person medication evidence',
        'completed, stopped, and not-taken medications',
        'medication records with at least one non-empty direction text',
    ],
    allowedLevels: ['Info'],
    evidence: [INTERNAL_POLICY_CITATION, FHIR_DATA_QUALITY_CITATION],
    validationStatus: 'validated',
    validatedAt: VALIDATION_DATE,
    riskClass: 'data-quality',
    reviewedBy: VALIDATION_OWNER,
    reviewedAt: VALIDATION_DATE,
    safetyBoundaries: [
        'This advisory checks documentation completeness only.',
        'It does not infer a dose, route, frequency, duration, adherence state, prescribing intent, or regimen safety.',
        'It does not recommend starting, stopping, or changing a medication.',
    ],
    regressionPackage: REGRESSION_PACKAGE,
    evaluate: record => {
        const affected = selectConfirmedMedications(record)
            .filter(medication => !hasUsableDirections(medication));
        if (affected.length === 0) return null;

        const kinds = [...new Set(affected.map(item => item.kind))].sort();
        return buildInfoAdvisory({
            ruleId: MEDICATION_DIRECTIONS_RULE_ID,
            version: MEDICATION_DIRECTIONS_RULE_VERSION,
            title: 'Medication records need direction review',
            description: `${affected.length} current confirmed medication record${affected.length === 1 ? ' has' : 's have'} no usable direction wording in the structured record. The affected record kind${kinds.length === 1 ? ' is' : 's are'} ${kinds.join(', ')}.`,
            resources: affected,
            triggers: [
                `${affected.length} medication record${affected.length === 1 ? '' : 's'}`,
                'Directions not recorded',
                'Documentation review only',
            ],
            actionLabel: 'Create local medication-record review task',
            advisoryKind: 'data-quality',
            limitations: [
                'Missing structured directions do not prove that no instructions exist in an external source.',
                'No dose or treatment instruction is generated by this rule.',
            ],
        });
    },
};

const OPEN_TASK_DUE_DATE_RULE_ID = 'mb-open-task-due-date-review';
const OPEN_TASK_DUE_DATE_RULE_VERSION = '1.0.0';
const CLOSED_TASK_STATUSES = new Set<ClinicalTaskRecord['status']>([
    'completed',
    'cancelled',
    'failed',
    'entered-in-error',
]);

const isIntentionalReviewProposal = (task: ClinicalTaskRecord): boolean =>
    task.intent === 'proposal'
    && (task.tags || []).includes('not-an-order');

export const OPEN_TASK_DUE_DATE_REVIEW_RULE: ValidatedClinicalRuleDefinition<PatientClinicalRecord> = {
    id: OPEN_TASK_DUE_DATE_RULE_ID,
    version: OPEN_TASK_DUE_DATE_RULE_VERSION,
    name: 'Open task due-date completeness review',
    description: 'Identifies confirmed open clinical tasks that do not contain an explicit usable due date or due period.',
    owner: VALIDATION_OWNER,
    intendedPopulation: 'Locally stored patient records containing confirmed open workflow tasks.',
    requiredInputs: [
        'confirmed patient-applicable clinical task',
        'task status',
        'explicit due date or due period',
    ],
    exclusions: [
        'candidate, rejected, entered-in-error, negated, hypothetical, family, and other-person task evidence',
        'completed, cancelled, failed, and entered-in-error tasks',
        'intentional not-an-order proposal tasks created by review workflows',
        'tasks with a usable explicit due date or period',
    ],
    allowedLevels: ['Info'],
    evidence: [INTERNAL_POLICY_CITATION, FHIR_DATA_QUALITY_CITATION],
    validationStatus: 'validated',
    validatedAt: VALIDATION_DATE,
    riskClass: 'workflow',
    reviewedBy: VALIDATION_OWNER,
    reviewedAt: VALIDATION_DATE,
    safetyBoundaries: [
        'This advisory reports an unscheduled local workflow item only.',
        'It does not manufacture a due date from record creation, review, or storage time.',
        'It does not assign clinical urgency or claim that care was missed.',
    ],
    regressionPackage: REGRESSION_PACKAGE,
    evaluate: record => {
        const affected = record.resources.tasks.filter(task =>
            isConfirmedPatientFact(task)
            && !CLOSED_TASK_STATUSES.has(task.status)
            && !isIntentionalReviewProposal(task)
            && !hasUsableDateLike(task.due));
        if (affected.length === 0) return null;

        return buildInfoAdvisory({
            ruleId: OPEN_TASK_DUE_DATE_RULE_ID,
            version: OPEN_TASK_DUE_DATE_RULE_VERSION,
            title: 'Open tasks have no recorded due date',
            description: `${affected.length} confirmed open local task${affected.length === 1 ? ' has' : 's have'} no explicit usable due date. The tasks remain unscheduled; recorded, review, and storage times were not converted into deadlines.`,
            resources: affected,
            triggers: [
                `${affected.length} open task${affected.length === 1 ? '' : 's'}`,
                'Due date not recorded',
                'No urgency inferred',
            ],
            actionLabel: 'Create local scheduling-review task',
            advisoryKind: 'workflow',
            limitations: [
                'An unscheduled task is not automatically overdue or urgent.',
                'No external notification, booking, order, or clinical action is sent.',
            ],
        });
    },
};

export const LOW_RISK_VALIDATED_RULES: ValidatedClinicalRuleDefinition<PatientClinicalRecord>[] = [
    CONFIRMED_RECORD_CLINICAL_DATE_REVIEW_RULE,
    ACTIVE_MEDICATION_DIRECTIONS_REVIEW_RULE,
    OPEN_TASK_DUE_DATE_REVIEW_RULE,
];
