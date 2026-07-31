import type {
    DiagnosticReportReviewEvidence,
    DiagnosticReviewFieldChange,
    ReviewedDiagnosticReportDraft,
    ReviewedObservationDraft,
    ReviewedSpecimenDraft,
} from './types';

const comparable = (value: unknown): string => JSON.stringify(value ?? null);

const changedFields = <T extends object>(
    initial: T,
    reviewed: T,
    fields: Array<keyof T>,
): DiagnosticReviewFieldChange[] => fields.flatMap(field =>
    comparable(initial[field]) === comparable(reviewed[field])
        ? []
        : [{
            field: String(field),
            previousValue: initial[field],
        }]);

const REPORT_FIELDS: Array<keyof ReviewedDiagnosticReportDraft> = [
    'reportTitle',
    'status',
    'categoryTexts',
    'effectiveDate',
    'issuedAt',
    'performer',
    'conclusion',
    'identifiers',
    'accessionIdentifier',
];

const RESULT_FIELDS: Array<keyof ReviewedObservationDraft> = [
    'testName',
    'loincCode',
    'status',
    'categoryTexts',
    'valueText',
    'unitText',
    'referenceRangeText',
    'interpretationText',
    'absentReasonText',
    'clinicalDate',
    'issuedAt',
    'performer',
    'specimenLocalId',
    'methodText',
    'bodySiteText',
    'note',
    'source',
];

const SPECIMEN_FIELDS: Array<keyof ReviewedSpecimenDraft> = [
    'status',
    'typeText',
    'collectedDate',
    'receivedDate',
    'bodySiteText',
    'collectionMethodText',
    'collector',
    'identifiers',
    'note',
];

/**
 * Compare the original extracted draft with the final reviewed draft. New
 * specimens are recorded as a created resource, while edits to extracted
 * content retain the original values in clinical amendment history.
 */
export const buildDiagnosticReviewEvidence = ({
    initial,
    reviewed,
    includedResultIds,
    reason = 'Human review corrected the extracted diagnostic report before confirmation.',
}: {
    initial: ReviewedDiagnosticReportDraft;
    reviewed: ReviewedDiagnosticReportDraft;
    includedResultIds: ReadonlySet<string>;
    reason?: string;
}): DiagnosticReportReviewEvidence | undefined => {
    const reportChanges = changedFields(initial, reviewed, REPORT_FIELDS);
    const reviewedResults = new Map(
        reviewed.results.map(result => [result.localId, result]),
    );
    const initialResults = new Map(
        initial.results.map(result => [result.localId, result]),
    );
    const resultChanges: Record<string, DiagnosticReviewFieldChange[]> = {};

    reviewed.results.forEach(result => {
        const previous = initialResults.get(result.localId);
        if (!previous) return;
        const changes = changedFields(previous, result, RESULT_FIELDS);
        if (changes.length > 0) resultChanges[result.localId] = changes;
    });

    const initialSpecimens = new Map(
        (initial.specimens || []).map(specimen => [specimen.localId, specimen]),
    );
    const specimenChanges: Record<string, DiagnosticReviewFieldChange[]> = {};
    (reviewed.specimens || []).forEach(specimen => {
        const previous = initialSpecimens.get(specimen.localId);
        if (!previous) return;
        const changes = changedFields(previous, specimen, SPECIMEN_FIELDS);
        if (changes.length > 0) specimenChanges[specimen.localId] = changes;
    });

    const excludedResults = initial.results
        .filter(result => !includedResultIds.has(result.localId))
        .map(result => ({
            localId: result.localId,
            testName: result.testName,
            previousValue: result,
        }));

    // Results added manually during review are not amendments to extracted
    // rows. Their manual creation is represented by the resource provenance.
    const includedReviewedResultIds = new Set(
        [...includedResultIds].filter(localId => reviewedResults.has(localId)),
    );
    if (includedReviewedResultIds.size !== reviewed.results.length) {
        throw new Error(
            'The reviewed result list and inclusion decision are inconsistent.',
        );
    }

    if (
        reportChanges.length === 0
        && Object.keys(resultChanges).length === 0
        && Object.keys(specimenChanges).length === 0
        && excludedResults.length === 0
    ) {
        return undefined;
    }

    return {
        reason,
        ...(reportChanges.length > 0 ? { reportChanges } : {}),
        ...(Object.keys(resultChanges).length > 0 ? { resultChanges } : {}),
        ...(Object.keys(specimenChanges).length > 0
            ? { specimenChanges }
            : {}),
        ...(excludedResults.length > 0 ? { excludedResults } : {}),
    };
};
