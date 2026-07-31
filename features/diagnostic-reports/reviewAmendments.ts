import { v4 as uuidv4 } from 'uuid';
import {
    parseClinicalRecordResource,
    type ClinicalAmendment,
    type ClinicalRecordResource,
    type DiagnosticReportRecord,
    type ObservationRecord,
    type SpecimenRecord,
} from '../clinical-record';
import {
    buildDiagnosticReportBundle,
    commitDiagnosticReportBundle,
    type BuildDiagnosticReportBundleOptions,
} from './graph';
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

/**
 * Attach the original extracted values to the clinical resources produced by
 * the reviewed draft. Excluded rows are retained on the report amendment even
 * though no Observation is created for them.
 *
 * The graph builder preserves reviewed draft order for specimens and results,
 * so review evidence can be mapped without embedding UI-local IDs in the
 * clinical resource identity or external provenance identifier.
 */
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

export const buildReviewedDiagnosticReportBundle = (
    draft: ReviewedDiagnosticReportDraft,
    options: BuildDiagnosticReportBundleOptions = {},
): DiagnosticReportBundle => applyDiagnosticReviewEvidence({
    bundle: buildDiagnosticReportBundle(draft, options),
    draft,
});

export const buildAndCommitReviewedDiagnosticReport = (
    draft: ReviewedDiagnosticReportDraft,
    options: BuildDiagnosticReportBundleOptions & {
        committedAt?: string;
    } = {},
): {
    bundle: DiagnosticReportBundle;
    commit: DiagnosticBundleCommitResult;
} => {
    const bundle = buildReviewedDiagnosticReportBundle(draft, options);
    return {
        bundle,
        commit: commitDiagnosticReportBundle(bundle, {
            actor: options.actor || draft.reviewedBy,
            committedAt: options.committedAt || options.now,
        }),
    };
};
