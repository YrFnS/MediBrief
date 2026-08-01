import { v4 as uuidv4 } from 'uuid';
import type { AuditEvent } from '../audit/types';
import { createUnknownClinicalDate } from '../clinical-record/factories';
import { parseClinicalRecordResource } from '../clinical-record/schemas';
import type {
    ClinicalDate,
    ClinicalPeriod,
    ClinicalQuantity,
    ClinicalQuantityValue,
    MedicationDosage,
    MedicationRecord,
    MedicationRecordKind,
    MedicationStatus,
    PatientClinicalRecord,
} from '../clinical-record/types';
import type {
    MedicationReconciliationAuditMetadata,
    MedicationReconciliationDecisionType,
    MedicationReconciliationGroup,
    MedicationReconciliationIssue,
    MedicationReconciliationIssueSeverity,
    MedicationReconciliationIssueType,
    MedicationReconciliationRecordView,
    MedicationReconciliationReviewDecision,
    MedicationReconciliationTaskInput,
    MedicationReconciliationTaskResult,
    MedicationReconciliationViewModel,
} from './types';

const CURRENT_STATUSES = new Set<MedicationStatus>(['active', 'on-hold']);
const HISTORICAL_STATUSES = new Set<MedicationStatus>([
    'completed',
    'stopped',
    'not-taken',
]);

const cleanText = (value: unknown): string =>
    typeof value === 'string' ? value.trim() : '';

const normalizeText = (value: unknown): string => cleanText(value)
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const stableHash = (value: string): string => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
};

const isClinicalDate = (
    value: ClinicalDate | ClinicalPeriod | undefined,
): value is ClinicalDate => Boolean(value && 'precision' in value);

const firstEffectiveDate = (
    value: ClinicalDate | ClinicalPeriod | undefined,
): ClinicalDate | undefined => {
    if (!value) return undefined;
    if (isClinicalDate(value)) return value;
    return value.start || value.end;
};

const knownDate = (value?: ClinicalDate): boolean =>
    Boolean(value?.value && value.precision !== 'unknown');

const clinicalDateLabel = (value?: ClinicalDate): string => {
    if (!knownDate(value)) return 'Clinical date unknown';
    if (value?.precision === 'day') return value.value!;
    return `${value?.value} (${value?.precision} precision)`;
};

const exactDayMillis = (value?: ClinicalDate): number | undefined => {
    if (!value?.value || value.precision !== 'day') return undefined;
    const parsed = Date.parse(`${value.value}T00:00:00.000Z`);
    return Number.isNaN(parsed) ? undefined : parsed;
};

const quantityValueLabel = (value: ClinicalQuantityValue): string => [
    value.comparator || '',
    String(value.value),
    value.unit || value.code || '',
].filter(Boolean).join(' ');

const quantityLabel = (quantity?: ClinicalQuantity): string | undefined => {
    if (!quantity) return undefined;
    const original = quantityValueLabel(quantity.original);
    const normalized = quantity.normalized
        ? quantityValueLabel(quantity.normalized)
        : undefined;
    return normalized && normalized !== original
        ? `${original}; normalized view ${normalized}`
        : original;
};

const dosageLabel = (dosage: MedicationDosage): string => [
    cleanText(dosage.text),
    quantityLabel(dosage.dose),
    cleanText(dosage.route?.text),
    cleanText(dosage.frequency),
    cleanText(dosage.timingText),
    dosage.asNeeded === true ? 'as needed' : '',
    dosage.asNeeded === false ? 'not as needed' : '',
    dosage.maximumDosePerPeriod
        ? `maximum ${quantityLabel(dosage.maximumDosePerPeriod.dose)} per ${cleanText(dosage.maximumDosePerPeriod.period)}`
        : '',
].filter(Boolean).join(' | ');

const dosageSignature = (record: MedicationRecord): string => record
    .dosageInstructions
    .map(dosage => normalizeText(dosageLabel(dosage)))
    .filter(Boolean)
    .sort()
    .join(' || ');

const medicationIdentity = (record: MedicationRecord): string => {
    const text = normalizeText(record.medication.text);
    const coding = [...(record.medication.coding || [])]
        .filter(item => cleanText(item.code))
        .sort((left, right) => {
            if (Boolean(left.userSelected) !== Boolean(right.userSelected)) {
                return left.userSelected ? -1 : 1;
            }
            return `${left.system || ''}|${left.code}`
                .localeCompare(`${right.system || ''}|${right.code}`);
        })[0];
    const codeLabel = coding
        ? `${normalizeText(coding.system || 'unspecified-system')}|${normalizeText(coding.code)}`
        : '';
    return text
        ? `text:${text}${codeLabel ? `|code:${codeLabel}` : ''}`
        : `code:${codeLabel || record.id}`;
};

const sourceLabel = (record: MedicationRecord): string => {
    const source = record.provenance.source;
    if (source.document) {
        const file = source.document.fileName || source.document.documentId;
        return source.document.pageNumber
            ? `${file}, page ${source.document.pageNumber}`
            : file;
    }
    if (cleanText(source.description)) return cleanText(source.description);
    if (source.externalSystem || source.externalId) {
        return [source.externalSystem, source.externalId].filter(Boolean).join(' · ');
    }
    return source.kind.replace(/-/g, ' ');
};

const kindLabel = (kind: MedicationRecordKind): string => {
    if (kind === 'statement') return 'Medication statement';
    if (kind === 'request') return 'Medication request';
    return 'Medication administration';
};

const statusLabel = (status: MedicationStatus): string =>
    status.replace(/-/g, ' ');

const patientApplicable = (record: MedicationRecord): boolean => {
    if (record.verificationStatus !== 'confirmed') return false;
    if (record.status === 'entered-in-error') return false;
    const assertion = record.assertion;
    if (!assertion) return true;
    if (assertion.polarity === 'negated') return false;
    if (assertion.temporality === 'hypothetical') return false;
    if (assertion.experiencer === 'family' || assertion.experiencer === 'other') {
        return false;
    }
    return true;
};

const recordView = (record: MedicationRecord): MedicationReconciliationRecordView => {
    const identityKey = medicationIdentity(record);
    const effective = firstEffectiveDate(record.effective);
    const dosages = record.dosageInstructions
        .map(dosageLabel)
        .filter(Boolean);
    const reasons = (record.reason || [])
        .map(item => cleanText(item.text))
        .filter(Boolean);
    const source = sourceLabel(record);
    const signatureObject = {
        identityKey,
        kind: record.kind,
        status: record.status,
        dosageSignature: dosageSignature(record),
        start: record.start || null,
        end: record.end || null,
        effective: effective || null,
        prescriber: cleanText(record.prescriber),
        reasons: [...reasons].sort(),
        note: cleanText(record.note),
    };
    const snapshotSignature = stableHash(JSON.stringify(signatureObject));

    return {
        id: record.id,
        evidenceId: `MB:Medication:${record.id}`,
        name: cleanText(record.medication.text) || 'Medication name not recorded',
        identityKey,
        kind: record.kind,
        kindLabel: kindLabel(record.kind),
        status: record.status,
        statusLabel: statusLabel(record.status),
        dosageText: dosages,
        dosageSignature: dosageSignature(record),
        startLabel: clinicalDateLabel(record.start),
        endLabel: clinicalDateLabel(record.end),
        effectiveLabel: clinicalDateLabel(effective),
        knownClinicalDate:
            knownDate(record.start)
            || knownDate(record.end)
            || knownDate(effective),
        ...(record.prescriber ? { prescriber: record.prescriber } : {}),
        reasons,
        ...(record.note ? { note: record.note } : {}),
        sourceLabel: source,
        ...(record.provenance.source.document
            ? { sourceDocument: record.provenance.source.document }
            : {}),
        amendmentCount: record.amendments.length,
        snapshotSignature,
        searchText: [
            record.medication.text,
            record.id,
            record.kind,
            record.status,
            dosages.join(' '),
            reasons.join(' '),
            record.prescriber,
            record.note,
            source,
        ].filter(Boolean).join(' ').toLocaleLowerCase(),
    };
};

const periodsMayOverlap = (
    left: MedicationRecord,
    right: MedicationRecord,
): boolean => {
    const leftStart = exactDayMillis(left.start || firstEffectiveDate(left.effective));
    const leftEnd = exactDayMillis(left.end);
    const rightStart = exactDayMillis(right.start || firstEffectiveDate(right.effective));
    const rightEnd = exactDayMillis(right.end);

    if (leftEnd !== undefined && rightStart !== undefined && leftEnd < rightStart) {
        return false;
    }
    if (rightEnd !== undefined && leftStart !== undefined && rightEnd < leftStart) {
        return false;
    }
    return true;
};

const statusCategory = (status: MedicationStatus): 'current' | 'history' | 'unknown' => {
    if (CURRENT_STATUSES.has(status)) return 'current';
    if (HISTORICAL_STATUSES.has(status)) return 'history';
    return 'unknown';
};

const issueDefinition = (
    type: MedicationReconciliationIssueType,
): {
    severity: MedicationReconciliationIssueSeverity;
    requiresDecision: boolean;
    title: string;
    description: string;
    questions: string[];
} => {
    switch (type) {
        case 'possible-duplicate':
            return {
                severity: 'review',
                requiresDecision: true,
                title: 'Possible duplicate medication records',
                description: 'These confirmed records use the same medication identity, record kind, status, directions, and date evidence. They may still represent separate source statements or events.',
                questions: [
                    'Do the records describe the same medication event or separate events?',
                    'Which original source should be reviewed before correcting either record?',
                    'Should both records remain separate because their provenance is clinically meaningful?',
                ],
            };
        case 'status-conflict':
            return {
                severity: 'action-required',
                requiresDecision: true,
                title: 'Medication status conflict',
                description: 'Confirmed records of the same kind describe overlapping or date-uncertain medication evidence with incompatible status values.',
                questions: [
                    'Which status is directly supported by each original source?',
                    'Do the dates show a real change over time rather than a conflict?',
                    'Does one record require a human-authored correction in Manage Records?',
                ],
            };
        case 'direction-conflict':
            return {
                severity: 'action-required',
                requiresDecision: true,
                title: 'Medication directions differ',
                description: 'Confirmed statement or request records for the same medication contain different dose, route, frequency, timing, or as-needed wording.',
                questions: [
                    'Are the directions from different periods, formulations, or prescribers?',
                    'Which exact wording appears in each source?',
                    'Is a correction needed, or should both records remain as separate historical evidence?',
                ],
            };
        case 'missing-directions':
            return {
                severity: 'review',
                requiresDecision: true,
                title: 'Medication directions are missing',
                description: 'A confirmed medication statement or request does not record usable dosage or administration directions.',
                questions: [
                    'Does the source contain strength, dose, route, frequency, or timing that has not been entered?',
                    'Is the absence intentional because the record only identifies the medication?',
                ],
            };
        case 'missing-clinical-date':
            return {
                severity: 'review',
                requiresDecision: true,
                title: 'Medication clinical date is unknown',
                description: 'The record has no known start, end, or effective clinical date. Recorded, upload, extraction, and review timestamps are not substitutes.',
                questions: [
                    'Does the source provide a medication start, stop, administration, or list date?',
                    'Should the date remain explicitly unknown because the source does not establish it?',
                ],
            };
        case 'uncertain-active-status':
            return {
                severity: 'action-required',
                requiresDecision: true,
                title: 'Active medication status is uncertain',
                description: 'The confirmed medication record has status “unknown,” so MediBrief cannot treat it as verified active or stopped use.',
                questions: [
                    'Does the source establish whether the medication is current, held, completed, stopped, or not taken?',
                    'Is additional patient, pharmacy, prescriber, or source-document evidence needed?',
                ],
            };
        case 'cross-kind-context':
            return {
                severity: 'information',
                requiresDecision: false,
                title: 'Multiple medication record kinds are present',
                description: 'Statements, requests, and administrations can describe different moments and purposes. MediBrief keeps them separate and does not choose one as automatically authoritative.',
                questions: [
                    'Does each record kind describe a distinct event or source context?',
                    'Are any apparent differences expected because an administration is not the same as an ongoing medication statement or request?',
                ],
            };
    }
};

const decisionLabel = (
    decision: MedicationReconciliationDecisionType,
): string => {
    switch (decision) {
        case 'keep-separate':
            return 'Keep records separate';
        case 'duplicate-needs-correction':
            return 'Likely duplicate — correction required';
        case 'record-correction-needed':
            return 'One or more records need correction';
        case 'insufficient-evidence':
            return 'Insufficient evidence — no record change';
        case 'reviewed-no-change':
            return 'Reviewed — no change needed';
    }
};

export const medicationReconciliationDecisionLabel = decisionLabel;

const validDecision = (
    value: unknown,
): value is MedicationReconciliationDecisionType => [
    'keep-separate',
    'duplicate-needs-correction',
    'record-correction-needed',
    'insufficient-evidence',
    'reviewed-no-change',
].includes(String(value));

const reconciliationDecisionMap = (
    auditEvents: AuditEvent[],
): Map<string, MedicationReconciliationReviewDecision> => {
    const map = new Map<string, MedicationReconciliationReviewDecision>();
    [...auditEvents]
        .filter(event => event.type === 'MEDICATION_RECONCILIATION_REVIEWED')
        .sort((left, right) => right.timestamp - left.timestamp)
        .forEach(event => {
            const metadata = event.metadata as Partial<MedicationReconciliationAuditMetadata> | undefined;
            if (
                !metadata?.issueId
                || !metadata.reason
                || !metadata.reviewedAt
                || !validDecision(metadata.decision)
                || map.has(metadata.issueId)
            ) {
                return;
            }
            map.set(metadata.issueId, {
                issueId: metadata.issueId,
                decision: metadata.decision,
                decisionLabel: metadata.decisionLabel
                    || decisionLabel(metadata.decision),
                reason: metadata.reason,
                reviewedAt: metadata.reviewedAt,
                ...(metadata.reviewedBy
                    ? { reviewedBy: metadata.reviewedBy }
                    : {}),
                ...(metadata.taskId ? { taskId: metadata.taskId } : {}),
                auditEventId: event.id,
            });
        });
    return map;
};

const issueResolutionState = (
    decision?: MedicationReconciliationReviewDecision,
): MedicationReconciliationIssue['resolutionState'] => {
    if (!decision) return 'unreviewed';
    if (
        decision.decision === 'duplicate-needs-correction'
        || decision.decision === 'record-correction-needed'
    ) {
        return 'action-pending';
    }
    return 'reviewed';
};

const makeIssue = ({
    type,
    medicationName,
    records,
    decisionMap,
}: {
    type: MedicationReconciliationIssueType;
    medicationName: string;
    records: MedicationReconciliationRecordView[];
    decisionMap: Map<string, MedicationReconciliationReviewDecision>;
}): MedicationReconciliationIssue => {
    const definition = issueDefinition(type);
    const fingerprintSource = [
        type,
        ...records
            .map(record => `${record.id}:${record.snapshotSignature}`)
            .sort(),
    ].join('|');
    const fingerprint = stableHash(fingerprintSource);
    const id = `medrec:${type}:${fingerprint}`;
    const decision = decisionMap.get(id);
    const searchText = [
        medicationName,
        definition.title,
        definition.description,
        records.map(record => record.searchText).join(' '),
        decision?.decisionLabel,
        decision?.reason,
    ].filter(Boolean).join(' ').toLocaleLowerCase();

    return {
        id,
        fingerprint,
        type,
        severity: definition.severity,
        requiresDecision: definition.requiresDecision,
        title: definition.title,
        description: definition.description,
        medicationName,
        recordIds: records.map(record => record.id),
        records,
        questions: definition.questions,
        resolutionState: issueResolutionState(decision),
        ...(decision ? { decision } : {}),
        searchText,
    };
};

const sameSnapshot = (
    left: MedicationReconciliationRecordView,
    right: MedicationReconciliationRecordView,
): boolean => left.snapshotSignature === right.snapshotSignature;

const buildGroupIssues = ({
    sourceRecords,
    views,
    decisionMap,
}: {
    sourceRecords: MedicationRecord[];
    views: MedicationReconciliationRecordView[];
    decisionMap: Map<string, MedicationReconciliationReviewDecision>;
}): MedicationReconciliationIssue[] => {
    const medicationName = views[0]?.name || 'Medication';
    const issues: MedicationReconciliationIssue[] = [];
    const recordById = new Map(sourceRecords.map(record => [record.id, record]));

    views.forEach(view => {
        const record = recordById.get(view.id)!;
        if (
            record.kind !== 'administration'
            && view.dosageText.length === 0
        ) {
            issues.push(makeIssue({
                type: 'missing-directions',
                medicationName,
                records: [view],
                decisionMap,
            }));
        }
        if (!view.knownClinicalDate) {
            issues.push(makeIssue({
                type: 'missing-clinical-date',
                medicationName,
                records: [view],
                decisionMap,
            }));
        }
        if (record.status === 'unknown') {
            issues.push(makeIssue({
                type: 'uncertain-active-status',
                medicationName,
                records: [view],
                decisionMap,
            }));
        }
    });

    for (let leftIndex = 0; leftIndex < views.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < views.length; rightIndex += 1) {
            const leftView = views[leftIndex];
            const rightView = views[rightIndex];
            const leftRecord = recordById.get(leftView.id)!;
            const rightRecord = recordById.get(rightView.id)!;
            if (leftRecord.kind !== rightRecord.kind) continue;

            if (sameSnapshot(leftView, rightView)) {
                issues.push(makeIssue({
                    type: 'possible-duplicate',
                    medicationName,
                    records: [leftView, rightView],
                    decisionMap,
                }));
                continue;
            }

            if (periodsMayOverlap(leftRecord, rightRecord)) {
                const leftCategory = statusCategory(leftRecord.status);
                const rightCategory = statusCategory(rightRecord.status);
                const incompatibleStatus =
                    leftRecord.status !== rightRecord.status
                    && leftCategory !== 'unknown'
                    && rightCategory !== 'unknown'
                    && (
                        leftCategory !== rightCategory
                        || leftCategory === 'current'
                    );
                if (incompatibleStatus) {
                    issues.push(makeIssue({
                        type: 'status-conflict',
                        medicationName,
                        records: [leftView, rightView],
                        decisionMap,
                    }));
                }

                if (
                    leftRecord.kind !== 'administration'
                    && leftView.dosageSignature
                    && rightView.dosageSignature
                    && leftView.dosageSignature !== rightView.dosageSignature
                ) {
                    issues.push(makeIssue({
                        type: 'direction-conflict',
                        medicationName,
                        records: [leftView, rightView],
                        decisionMap,
                    }));
                }
            }
        }
    }

    if (new Set(views.map(view => view.kind)).size > 1) {
        issues.push(makeIssue({
            type: 'cross-kind-context',
            medicationName,
            records: views,
            decisionMap,
        }));
    }

    return [...new Map(issues.map(issue => [issue.id, issue])).values()]
        .sort((left, right) => {
            const rank = {
                'action-required': 0,
                review: 1,
                information: 2,
            } as const;
            const severityDifference = rank[left.severity] - rank[right.severity];
            if (severityDifference !== 0) return severityDifference;
            return left.id.localeCompare(right.id);
        });
};

export const buildMedicationReconciliationViewModel = (
    record: PatientClinicalRecord,
    auditEvents: AuditEvent[] = [],
): MedicationReconciliationViewModel => {
    const decisionMap = reconciliationDecisionMap(
        auditEvents.filter(event => event.patientId === record.patientId),
    );
    const confirmed = record.resources.medications.filter(patientApplicable);
    const groupsByIdentity = new Map<string, MedicationRecord[]>();
    confirmed.forEach(medication => {
        const identity = medicationIdentity(medication);
        const current = groupsByIdentity.get(identity) || [];
        groupsByIdentity.set(identity, [...current, medication]);
    });

    const groups: MedicationReconciliationGroup[] = [...groupsByIdentity.entries()]
        .map(([identityKey, medications]) => {
            const views = medications
                .map(recordView)
                .sort((left, right) => {
                    if (left.kind !== right.kind) return left.kind.localeCompare(right.kind);
                    return left.id.localeCompare(right.id);
                });
            const issues = buildGroupIssues({
                sourceRecords: medications,
                views,
                decisionMap,
            });
            return {
                id: `medgroup:${stableHash(identityKey)}`,
                identityKey,
                medicationName: views[0]?.name || 'Medication',
                records: views,
                issues,
                sourceKinds: [...new Set(views.map(view => view.kind))].sort(),
            };
        })
        .sort((left, right) =>
            left.medicationName.localeCompare(right.medicationName));

    const issues = groups.flatMap(group => group.issues);
    const candidateMedicationCount = record.resources.medications.filter(
        medication => medication.verificationStatus === 'candidate',
    ).length;

    return {
        groups,
        issues,
        medicationCount: confirmed.length,
        groupCount: groups.length,
        candidateMedicationCount,
        unreviewedCount: issues.filter(issue =>
            issue.requiresDecision && issue.resolutionState === 'unreviewed').length,
        actionPendingCount: issues.filter(issue =>
            issue.resolutionState === 'action-pending').length,
        reviewedCount: issues.filter(issue =>
            issue.requiresDecision && issue.resolutionState !== 'unreviewed').length,
        informationalCount: issues.filter(issue => !issue.requiresDecision).length,
        possibleDuplicateCount: issues.filter(issue =>
            issue.type === 'possible-duplicate').length,
        conflictCount: issues.filter(issue =>
            issue.type === 'status-conflict'
            || issue.type === 'direction-conflict').length,
        missingInformationCount: issues.filter(issue =>
            issue.type === 'missing-directions'
            || issue.type === 'missing-clinical-date'
            || issue.type === 'uncertain-active-status').length,
    };
};

export const createMedicationReconciliationTaskRecord = ({
    patientId,
    issue,
    decision,
    reason,
    createdAt = new Date().toISOString(),
    createdBy,
}: MedicationReconciliationTaskInput): MedicationReconciliationTaskResult => {
    const cleanedReason = cleanText(reason);
    if (!cleanedReason) {
        throw new Error('A medication reconciliation task requires a review reason.');
    }
    const warnings: string[] = [];
    if (issue.records.some(record => !record.knownClinicalDate)) {
        warnings.push('One or more medication records have an unknown clinical date.');
    }
    if (issue.records.some(record => record.dosageText.length === 0)) {
        warnings.push('One or more medication records have no recorded directions.');
    }

    const task = parseClinicalRecordResource({
        id: uuidv4(),
        patientId,
        resourceType: 'ClinicalTask',
        verificationStatus: 'confirmed',
        recordedAt: createdAt,
        effective: createUnknownClinicalDate(
            'No follow-up due date was selected during medication reconciliation.',
        ),
        provenance: {
            source: {
                kind: 'manual',
                description: 'Created after an explicit local medication reconciliation review decision.',
                externalId: issue.id,
            },
            createdAt,
            updatedAt: createdAt,
            ...(createdBy ? { createdBy, updatedBy: createdBy } : {}),
            confirmation: {
                reviewedAt: createdAt,
                ...(createdBy ? { reviewedBy: createdBy } : {}),
                reason: 'The user chose to create a local reconciliation follow-up task. No medication order or regimen change was recorded.',
            },
        },
        amendments: [],
        tags: [
            'medication-reconciliation',
            'review-proposal',
            'not-an-order',
            `reconciliation-decision:${decision}`,
        ],
        status: 'requested',
        intent: 'proposal',
        priority: issue.severity === 'action-required' ? 'urgent' : 'routine',
        code: { text: 'Medication reconciliation review' },
        title: `Medication reconciliation: ${issue.medicationName}`,
        description: [
            issue.title,
            issue.description,
            `Reviewed decision: ${decisionLabel(decision)}`,
            `Review reason: ${cleanedReason}`,
            ...issue.records.map(record =>
                `${record.kindLabel} ${record.id}: status ${record.statusLabel}; directions ${record.dosageText.join('; ') || 'not recorded'}; source ${record.sourceLabel}.`),
        ].join('\n'),
        due: createUnknownClinicalDate(
            'A due date was not selected. Recorded time is not used as a due date.',
        ),
        relatedResources: issue.records.map(record => ({
            resourceType: 'Medication',
            id: record.id,
            display: `${record.name} — ${record.kindLabel}`,
        })),
        note: 'This is a local review proposal. It is not a prescription, medication order, instruction to start or stop treatment, or evidence that a regimen is safe.',
    }) as MedicationReconciliationTaskResult['task'];

    return { task, warnings };
};
