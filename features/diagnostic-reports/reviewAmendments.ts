import { v4 as uuidv4 } from 'uuid';
import {
    parseClinicalRecordResource,
    type ClinicalAmendment,
    type ClinicalRecordResource,
    type DiagnosticReportRecord,
    type ObservationRecord,
    type PatientClinicalRecord,
    type SpecimenRecord,
    useClinicalRecordStore,
} from '../clinical-record';
import {
    buildDiagnosticReportBundle,
    type BuildDiagnosticReportBundleOptions,
} from './graph';
import {
    applyDiagnosticConflictResolution,
    commitConflictAwareDiagnosticReportBundle,
} from './conflicts';
import { normalizeDiagnosticReportBundle } from './normalization';
import type {
    DiagnosticBundleCommitResult,
    DiagnosticReportBundle,
    DiagnosticReviewFieldChange,
    ReviewedDiagnosticReportDraft,
} from './types';

const previousValues = (
    changes: DiagnosticReviewFieldChange[],
): Record<string, unknown> => Object.fromEntries(
    changes.map(change => [change.field, change.previousValue]),
);

const amendmentForChanges = ({
    changes,
    reason,
    amendedAt,
    amendedBy,
}: {
    changes: DiagnosticReviewFieldChange[];
    reason: string;
    amendedAt: string;
    amendedBy?: string;
}): ClinicalAmendment | undefined => changes.length > 0
    ? {
        id: uuidv4(),
        amendedAt,
        ...(amendedBy ? { amendedBy } : {}),
        reason,
        changedFields: [...new Set(changes.map(change => change.field))],
        previousValues: previousValues(changes),
    }
    : undefined;

const withAmendment = <T extends ClinicalRecordResource>(
    resource: T,
    amendment: ClinicalAmendment | undefined,
): T => amendment
    ? parseClinicalRecordResource({
        ...resource,
        amendments: [...resource.amendments, amendment],
    }) as T
    : resource;

export const applyDiagnosticReviewEvidence = ({
    bundle,
    draft,
}: {
    bundle: DiagnosticReportBundle;
    draft: ReviewedDiagnosticReportDraft;
}): DiagnosticReportBundle => {
    const evidence = draft.reviewEvidence;
    if (!evidence) return bundle;

    const amendedAt = draft.reviewedAt || bundle.report.recordedAt;
    const amendedBy = draft.reviewedBy;
    const reportChanges: DiagnosticReviewFieldChange[] = [
        ...(evidence.reportChanges || []),
        ...(evidence.excludedResults?.length
            ? [{
                field: 'excludedResults',
                previousValue: evidence.excludedResults,
            }]
            : []),
    ];
    const report = withAmendment(
        bundle.report,
        amendmentForChanges({
            changes: reportChanges,
            reason: evidence.reason,
            amendedAt,
            amendedBy,
        }),
    ) as DiagnosticReportRecord;
    const observations = bundle.observations.map((observation, index) => {
        const localId = draft.results[index]?.localId;
        const changes = localId
            ? evidence.resultChanges?.[localId] || []
            : [];
        return withAmendment(
            observation,
            amendmentForChanges({
                changes,
                reason: evidence.reason,
                amendedAt,
                amendedBy,
            }),
        ) as ObservationRecord;
    });
    const specimens = bundle.specimens.map((specimen, index) => {
        const localId = draft.specimens?.[index]?.localId;
        const changes = localId
            ? evidence.specimenChanges?.[localId] || []
            : [];
        return withAmendment(
            specimen,
            amendmentForChanges({
                changes,
                reason: evidence.reason,
                amendedAt,
                amendedBy,
            }),
        ) as SpecimenRecord;
    });

    return {
        ...bundle,
        report,
        observations,
        specimens,
        resources: [...specimens, ...observations, report],
    };
};

export interface BuildReviewedDiagnosticReportBundleOptions
    extends BuildDiagnosticReportBundleOptions {
    record?: PatientClinicalRecord;
}

export const buildReviewedDiagnosticReportBundle = (
    draft: ReviewedDiagnosticReportDraft,
    options: BuildReviewedDiagnosticReportBundleOptions = {},
): DiagnosticReportBundle => {
    const reviewed = applyDiagnosticReviewEvidence({
        bundle: normalizeDiagnosticReportBundle(
            buildDiagnosticReportBundle(draft, options),
        ),
        draft,
    });
    const record = options.record
        || useClinicalRecordStore.getState().actions.getPatientRecord(draft.patientId);
    const now = options.now || draft.reviewedAt || new Date().toISOString();
    return applyDiagnosticConflictResolution({
        bundle: reviewed,
        draft,
        record,
        now,
        actor: options.actor || draft.reviewedBy,
    });
};

export const buildAndCommitReviewedDiagnosticReport = (
    draft: ReviewedDiagnosticReportDraft,
    options: BuildReviewedDiagnosticReportBundleOptions & {
        committedAt?: string;
    } = {},
): {
    bundle: DiagnosticReportBundle;
    commit: DiagnosticBundleCommitResult;
} => {
    const bundle = buildReviewedDiagnosticReportBundle(draft, options);
    return {
        bundle,
        commit: commitConflictAwareDiagnosticReportBundle(
            bundle,
            draft,
            {
                actor: options.actor || draft.reviewedBy,
                committedAt: options.committedAt || options.now,
            },
        ),
    };
};
