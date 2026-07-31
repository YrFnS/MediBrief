from __future__ import annotations

from pathlib import Path
import textwrap

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(
            f"Expected exactly one match in {path}, found {count}: {old[:120]!r}"
        )
    write(path, content.replace(old, new, 1))


# ---------------------------------------------------------------------------
# Backward-compatible clinical record contracts
# ---------------------------------------------------------------------------
replace_once(
    "features/clinical-record/types.ts",
    """export interface ClinicalReference {
    resourceType?: ClinicalResourceType;
    id: string;
    display?: string;
}
""",
    """export interface ClinicalReference {
    resourceType?: ClinicalResourceType;
    id: string;
    display?: string;
}

export type DiagnosticVersionRelationshipType =
    | 'amends'
    | 'corrects'
    | 'replaces';

export type DiagnosticReportRelationshipType =
    | DiagnosticVersionRelationshipType
    | 'duplicate-of'
    | 'distinct-from';

/**
 * Records a reviewed relationship between two diagnostic reports. The related
 * report remains immutable; reverse relationships are derived by scanning the
 * patient record rather than rewriting historical source truth.
 */
export interface DiagnosticReportRelationship {
    id: string;
    type: DiagnosticReportRelationshipType;
    relatedReportId: string;
    recordedAt: string;
    recordedBy?: string;
    reason: string;
}

/**
 * Links a newly reviewed result to the prior result it supersedes. The prior
 * Observation remains in the record and is presented as superseded history.
 */
export interface ObservationLineage {
    relationship: DiagnosticVersionRelationshipType;
    predecessorObservationId: string;
    recordedAt: string;
    recordedBy?: string;
    reason: string;
}
""",
)

replace_once(
    "features/clinical-record/types.ts",
    """    specimenId?: string;
    encounterId?: string;
    diagnosticReportId?: string;
    issuedAt?: string;
""",
    """    specimenId?: string;
    encounterId?: string;
    diagnosticReportId?: string;
    lineage?: ObservationLineage;
    issuedAt?: string;
""",
)

replace_once(
    "features/clinical-record/types.ts",
    """    conclusionCodes?: ClinicalCodeableConcept[];
    encounterId?: string;
    performer?: string[];
}
""",
    """    conclusionCodes?: ClinicalCodeableConcept[];
    encounterId?: string;
    performer?: string[];
    relationships?: DiagnosticReportRelationship[];
}
""",
)

replace_once(
    "features/clinical-record/schemas.ts",
    """export const ClinicalReferenceSchema = z.object({
    resourceType: ClinicalResourceTypeSchema.optional(),
    id: z.string().min(1),
    display: z.string().min(1).optional(),
}).strict();
""",
    """export const ClinicalReferenceSchema = z.object({
    resourceType: ClinicalResourceTypeSchema.optional(),
    id: z.string().min(1),
    display: z.string().min(1).optional(),
}).strict();

export const DiagnosticVersionRelationshipTypeSchema = z.enum([
    'amends',
    'corrects',
    'replaces',
]);

export const DiagnosticReportRelationshipSchema = z.object({
    id: z.string().min(1),
    type: z.union([
        DiagnosticVersionRelationshipTypeSchema,
        z.enum(['duplicate-of', 'distinct-from']),
    ]),
    relatedReportId: z.string().min(1),
    recordedAt: IsoDateTimeSchema,
    recordedBy: z.string().min(1).optional(),
    reason: z.string().min(1),
}).strict();

export const ObservationLineageSchema = z.object({
    relationship: DiagnosticVersionRelationshipTypeSchema,
    predecessorObservationId: z.string().min(1),
    recordedAt: IsoDateTimeSchema,
    recordedBy: z.string().min(1).optional(),
    reason: z.string().min(1),
}).strict();
""",
)

replace_once(
    "features/clinical-record/schemas.ts",
    """    specimenId: z.string().min(1).optional(),
    encounterId: z.string().min(1).optional(),
    diagnosticReportId: z.string().min(1).optional(),
    issuedAt: IsoDateTimeSchema.optional(),
""",
    """    specimenId: z.string().min(1).optional(),
    encounterId: z.string().min(1).optional(),
    diagnosticReportId: z.string().min(1).optional(),
    lineage: ObservationLineageSchema.optional(),
    issuedAt: IsoDateTimeSchema.optional(),
""",
)

replace_once(
    "features/clinical-record/schemas.ts",
    """    conclusionCodes: z.array(ClinicalCodeableConceptSchema).optional(),
    encounterId: z.string().min(1).optional(),
    performer: z.array(z.string().min(1)).optional(),
}).strict();
""",
    """    conclusionCodes: z.array(ClinicalCodeableConceptSchema).optional(),
    encounterId: z.string().min(1).optional(),
    performer: z.array(z.string().min(1)).optional(),
    relationships: z.array(DiagnosticReportRelationshipSchema).optional(),
}).strict();
""",
)

# ---------------------------------------------------------------------------
# Diagnostic review and conflict contracts
# ---------------------------------------------------------------------------
replace_once(
    "features/diagnostic-reports/types.ts",
    """export interface ReviewedDiagnosticReportDraft {
""",
    """export type DiagnosticReportConflictKind =
    | 'exact-duplicate'
    | 'same-event-conflict'
    | 'possible-duplicate';

export type DiagnosticConflictDecision =
    | 'amends'
    | 'corrects'
    | 'replaces'
    | 'duplicate'
    | 'distinct';

export interface ReviewedDiagnosticConflictResolution {
    relatedReportId: string;
    decision: DiagnosticConflictDecision;
    reason: string;
}

export interface DiagnosticReportConflictCandidate {
    reportId: string;
    reportTitle: string;
    reportStatus: DiagnosticReportRecord['status'];
    clinicalDateLabel: string;
    sourceLabel: string;
    kind: DiagnosticReportConflictKind;
    score: number;
    blocking: boolean;
    evidence: string[];
    differingResultKeys: string[];
    recommendedDecision: DiagnosticConflictDecision;
}

export interface DiagnosticReportConflictAnalysis {
    candidates: DiagnosticReportConflictCandidate[];
    blockingCandidates: DiagnosticReportConflictCandidate[];
    requiresResolution: boolean;
}

export interface ReviewedDiagnosticReportDraft {
""",
)

replace_once(
    "features/diagnostic-reports/types.ts",
    """    reviewedBy?: string;
    reviewEvidence?: DiagnosticReportReviewEvidence;
}
""",
    """    reviewedBy?: string;
    reviewEvidence?: DiagnosticReportReviewEvidence;
    conflictResolution?: ReviewedDiagnosticConflictResolution;
}
""",
)

replace_once(
    "features/diagnostic-reports/types.ts",
    """    | 'resource-id-conflict'
    | 'duplicate-report-source';
""",
    """    | 'resource-id-conflict'
    | 'duplicate-report-source'
    | 'duplicate-report-content'
    | 'unresolved-report-conflict'
    | 'invalid-conflict-resolution'
    | 'related-report-missing'
    | 'related-report-patient-mismatch'
    | 'result-lineage-invalid';
""",
)

replace_once(
    "features/diagnostic-reports/types.ts",
    """export type DiagnosticBundleCommitStatus =
    | 'created'
    | 'duplicate'
""",
    """export type DiagnosticBundleCommitStatus =
    | 'created'
    | 'resolved-duplicate'
    | 'duplicate'
""",
)

replace_once(
    "features/diagnostic-reports/schemas.ts",
    """export const ReviewedDiagnosticReportDraftSchema = z.object({
""",
    """const ConflictResolutionSchema = z.object({
    relatedReportId: z.string().trim().min(1),
    decision: z.enum([
        'amends',
        'corrects',
        'replaces',
        'duplicate',
        'distinct',
    ]),
    reason: z.string().trim().min(1),
}).strict();

export const ReviewedDiagnosticReportDraftSchema = z.object({
""",
)

replace_once(
    "features/diagnostic-reports/schemas.ts",
    """    reviewedBy: optionalTrimmed,
    reviewEvidence: ReviewEvidenceSchema.optional(),
}).strict().superRefine((draft, context) => {
""",
    """    reviewedBy: optionalTrimmed,
    reviewEvidence: ReviewEvidenceSchema.optional(),
    conflictResolution: ConflictResolutionSchema.optional(),
}).strict().superRefine((draft, context) => {
""",
)

replace_once(
    "features/diagnostic-reports/schemas.ts",
    """    Object.keys(draft.reviewEvidence?.specimenChanges || {}).forEach(localId => {
        if (!knownSpecimens.has(localId)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['reviewEvidence', 'specimenChanges', localId],
                message: `Review evidence references unknown specimen ${localId}`,
            });
        }
    });
});
""",
    """    Object.keys(draft.reviewEvidence?.specimenChanges || {}).forEach(localId => {
        if (!knownSpecimens.has(localId)) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['reviewEvidence', 'specimenChanges', localId],
                message: `Review evidence references unknown specimen ${localId}`,
            });
        }
    });

    const resolution = draft.conflictResolution;
    if (resolution?.decision === 'amends' && draft.status !== 'amended') {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['status'],
            message: 'An amended relationship requires report status amended',
        });
    }
    if (resolution?.decision === 'corrects' && draft.status !== 'corrected') {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['status'],
            message: 'A corrected relationship requires report status corrected',
        });
    }
    if (
        resolution?.decision === 'replaces'
        && !['final', 'amended', 'corrected'].includes(draft.status || '')
    ) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['status'],
            message: 'A replacement report must be final, amended, or corrected',
        });
    }
});
""",
)

# ---------------------------------------------------------------------------
# Conflict, duplicate, and lineage engine
# ---------------------------------------------------------------------------
write(
    "features/diagnostic-reports/conflicts.ts",
    r'''import { v4 as uuidv4 } from 'uuid';
import {
    parseClinicalRecordResource,
    parsePatientClinicalRecord,
    type ClinicalAmendment,
    type ClinicalDate,
    type DiagnosticReportRecord,
    type DiagnosticVersionRelationshipType,
    type DocumentReferenceRecord,
    type ObservationRecord,
    type PatientClinicalRecord,
    type SpecimenRecord,
    useClinicalRecordStore,
} from '../clinical-record';
import { validateDiagnosticReportBundleGraph } from './graph';
import type {
    DiagnosticBundleCommitResult,
    DiagnosticGraphValidationIssue,
    DiagnosticGraphValidationResult,
    DiagnosticReportBundle,
    DiagnosticReportConflictAnalysis,
    DiagnosticReportConflictCandidate,
    ReviewedDiagnosticConflictResolution,
    ReviewedDiagnosticReportDraft,
} from './types';

const LOINC_SYSTEM = 'http://loinc.org';

const normalize = (value?: string | null): string => (value || '')
    .trim()
    .toLowerCase()
    .replace(/[µμ]/g, 'u')
    .replace(/\s+/g, ' ');

const unique = <T>(values: T[]): T[] => [...new Set(values)];

const isClinicalDate = (
    value: DiagnosticReportRecord['effective'],
): value is ClinicalDate => Boolean(value && 'precision' in value);

const reportDate = (report: DiagnosticReportRecord): ClinicalDate | undefined => {
    if (isClinicalDate(report.effective)) return report.effective;
    return report.effectivePeriod?.start
        || (!isClinicalDate(report.effective)
            ? report.effective?.start
            : undefined);
};

const reportDateLabel = (report: DiagnosticReportRecord): string => {
    const date = reportDate(report);
    return date?.value || 'Clinical date unknown';
};

const reportIdentifiers = (report: DiagnosticReportRecord): string[] => unique([
    ...(report.tags || [])
        .filter(tag => tag.startsWith('accession:'))
        .map(tag => normalize(tag.slice('accession:'.length))),
    normalize(report.provenance.source.externalId),
].filter(Boolean));

const loincCode = (observation: ObservationRecord): string | undefined =>
    observation.code.coding?.find(coding =>
        normalize(coding.system) === LOINC_SYSTEM)?.code;

const specimenType = ({
    observation,
    record,
    bundle,
}: {
    observation: ObservationRecord;
    record: PatientClinicalRecord;
    bundle?: DiagnosticReportBundle;
}): string => {
    if (!observation.specimenId) return '';
    const specimen = [
        ...(bundle?.specimens || []),
        ...record.resources.specimens,
    ].find(item => item.id === observation.specimenId);
    return normalize(specimen?.type?.text || specimen?.note);
};

const observationIdentity = ({
    observation,
    record,
    bundle,
}: {
    observation: ObservationRecord;
    record: PatientClinicalRecord;
    bundle?: DiagnosticReportBundle;
}): string => {
    const code = loincCode(observation);
    if (code) return `loinc:${normalize(code)}`;
    const specimen = specimenType({ observation, record, bundle });
    return `name:${normalize(observation.code.text)}|specimen:${specimen || 'unknown'}`;
};

const observationValueSignature = (observation: ObservationRecord): string =>
    JSON.stringify({
        value: observation.value,
        interpretation: observation.interpretation || [],
        referenceRanges: observation.referenceRanges,
    });

interface ResultSummary {
    byIdentity: Map<string, string[]>;
    orderedKeys: string[];
}

const resultSummary = ({
    report,
    record,
    bundle,
}: {
    report: DiagnosticReportRecord;
    record: PatientClinicalRecord;
    bundle?: DiagnosticReportBundle;
}): ResultSummary => {
    const observations = [
        ...(bundle?.observations || []),
        ...record.resources.observations,
    ];
    const byIdentity = new Map<string, string[]>();
    const orderedKeys: string[] = [];
    report.resultIds.forEach(id => {
        const observation = observations.find(item => item.id === id);
        if (!observation) return;
        const key = observationIdentity({ observation, record, bundle });
        orderedKeys.push(key);
        byIdentity.set(key, [
            ...(byIdentity.get(key) || []),
            observationValueSignature(observation),
        ].sort());
    });
    return { byIdentity, orderedKeys };
};

const summariesEqual = (left: ResultSummary, right: ResultSummary): boolean => {
    const leftEntries = [...left.byIdentity.entries()].sort(([a], [b]) =>
        a.localeCompare(b));
    const rightEntries = [...right.byIdentity.entries()].sort(([a], [b]) =>
        a.localeCompare(b));
    return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
};

const resultOverlap = (left: ResultSummary, right: ResultSummary): number => {
    const leftKeys = new Set(left.byIdentity.keys());
    const rightKeys = new Set(right.byIdentity.keys());
    const denominator = Math.max(leftKeys.size, rightKeys.size, 1);
    const intersection = [...leftKeys].filter(key => rightKeys.has(key)).length;
    return intersection / denominator;
};

const differingResultKeys = (
    left: ResultSummary,
    right: ResultSummary,
): string[] => [...left.byIdentity.keys()].filter(key =>
    right.byIdentity.has(key)
    && JSON.stringify(left.byIdentity.get(key))
        !== JSON.stringify(right.byIdentity.get(key)));

const sourceLabel = (report: DiagnosticReportRecord): string =>
    report.provenance.source.document?.fileName
    || report.provenance.source.document?.documentId
    || report.provenance.source.description
    || 'Recorded diagnostic source';

const compareCandidate = ({
    record,
    incoming,
    existing,
    bundle,
}: {
    record: PatientClinicalRecord;
    incoming: DiagnosticReportRecord;
    existing: DiagnosticReportRecord;
    bundle: DiagnosticReportBundle;
}): DiagnosticReportConflictCandidate | undefined => {
    const incomingIdentifiers = new Set(reportIdentifiers(incoming));
    const existingIdentifiers = new Set(reportIdentifiers(existing));
    const sharedIdentifiers = [...incomingIdentifiers].filter(value =>
        existingIdentifiers.has(value));
    const sameDocument = Boolean(
        incoming.provenance.source.document?.documentId
        && incoming.provenance.source.document?.documentId
            === existing.provenance.source.document?.documentId,
    );
    const sameTitle = normalize(incoming.code.text) === normalize(existing.code.text);
    const incomingDate = reportDate(incoming)?.value;
    const existingDate = reportDate(existing)?.value;
    const sameDate = Boolean(incomingDate && existingDate && incomingDate === existingDate);
    const incomingResults = resultSummary({
        report: incoming,
        record,
        bundle,
    });
    const existingResults = resultSummary({ report: existing, record });
    const exactContent = summariesEqual(incomingResults, existingResults);
    const overlap = resultOverlap(incomingResults, existingResults);
    const differences = differingResultKeys(incomingResults, existingResults);

    const evidence: string[] = [];
    if (sharedIdentifiers.length > 0) {
        evidence.push(`Shared accession or source identifier: ${sharedIdentifiers.join(', ')}`);
    }
    if (sameDocument) evidence.push('References the same original document.');
    if (sameTitle) evidence.push('Uses the same reviewed report title.');
    if (sameDate) evidence.push(`Uses the same clinical date: ${incomingDate}.`);
    if (overlap > 0) {
        evidence.push(`${Math.round(overlap * 100)}% result-identity overlap.`);
    }
    if (exactContent) evidence.push('All structured result values match.');
    if (differences.length > 0) {
        evidence.push(`${differences.length} shared result identity value set(s) differ.`);
    }

    let kind: DiagnosticReportConflictCandidate['kind'];
    let score: number;
    let blocking: boolean;
    let recommendedDecision: DiagnosticReportConflictCandidate['recommendedDecision'];

    if ((sameDocument || sharedIdentifiers.length > 0) && exactContent) {
        kind = 'exact-duplicate';
        score = 100;
        blocking = true;
        recommendedDecision = 'duplicate';
    } else if ((sameDocument || sharedIdentifiers.length > 0) && !exactContent) {
        kind = 'same-event-conflict';
        score = 95;
        blocking = true;
        recommendedDecision = incoming.status === 'amended'
            ? 'amends'
            : 'corrects';
    } else if (sameTitle && sameDate && exactContent) {
        kind = 'exact-duplicate';
        score = 90;
        blocking = true;
        recommendedDecision = 'duplicate';
    } else if (sameTitle && sameDate && overlap >= 0.5) {
        kind = 'possible-duplicate';
        score = Math.round(60 + overlap * 25);
        blocking = false;
        recommendedDecision = 'distinct';
    } else {
        return undefined;
    }

    return {
        reportId: existing.id,
        reportTitle: existing.code.text,
        reportStatus: existing.status,
        clinicalDateLabel: reportDateLabel(existing),
        sourceLabel: sourceLabel(existing),
        kind,
        score,
        blocking,
        evidence,
        differingResultKeys: differences,
        recommendedDecision,
    };
};

export const analyzeDiagnosticReportConflicts = (
    record: PatientClinicalRecord | undefined,
    bundle: DiagnosticReportBundle,
): DiagnosticReportConflictAnalysis => {
    if (!record) {
        return {
            candidates: [],
            blockingCandidates: [],
            requiresResolution: false,
        };
    }

    const candidates = record.resources.diagnosticReports
        .filter(report =>
            report.verificationStatus === 'confirmed'
            && report.status !== 'entered-in-error')
        .flatMap(report => {
            const candidate = compareCandidate({
                record,
                incoming: bundle.report,
                existing: report,
                bundle,
            });
            return candidate ? [candidate] : [];
        })
        .sort((left, right) => right.score - left.score);
    const blockingCandidates = candidates.filter(candidate => candidate.blocking);
    return {
        candidates,
        blockingCandidates,
        requiresResolution: blockingCandidates.length > 0,
    };
};

const conflictIssue = (
    code: DiagnosticGraphValidationIssue['code'],
    message: string,
    resourceId?: string,
): DiagnosticGraphValidationIssue => ({
    code,
    message,
    ...(resourceId ? { resourceId } : {}),
});

export const validateConflictAwareDiagnosticReportBundle = ({
    bundle,
    record,
    resolution,
}: {
    bundle: DiagnosticReportBundle;
    record?: PatientClinicalRecord;
    resolution?: ReviewedDiagnosticConflictResolution;
}): DiagnosticGraphValidationResult => {
    const graph = validateDiagnosticReportBundleGraph(bundle, record);
    const issues = graph.issues.filter(issue =>
        issue.code !== 'duplicate-report-source' || !resolution);
    const analysis = analyzeDiagnosticReportConflicts(record, bundle);

    if (analysis.requiresResolution && !resolution) {
        analysis.blockingCandidates.forEach(candidate => {
            issues.push(conflictIssue(
                candidate.kind === 'exact-duplicate'
                    ? 'duplicate-report-content'
                    : 'unresolved-report-conflict',
                candidate.kind === 'exact-duplicate'
                    ? `The reviewed graph matches existing report ${candidate.reportId}. Choose duplicate handling before confirmation.`
                    : `The reviewed graph appears to be another version of report ${candidate.reportId}. Select a correction relationship or explicitly keep both reports distinct.`,
                candidate.reportId,
            ));
        });
    }

    if (resolution) {
        const related = record?.resources.diagnosticReports.find(report =>
            report.id === resolution.relatedReportId);
        if (!related) {
            issues.push(conflictIssue(
                'related-report-missing',
                `Related report ${resolution.relatedReportId} is not present in the patient record.`,
                resolution.relatedReportId,
            ));
        } else if (related.patientId !== bundle.report.patientId) {
            issues.push(conflictIssue(
                'related-report-patient-mismatch',
                'The selected related report belongs to another patient.',
                related.id,
            ));
        }

        const selected = analysis.candidates.find(candidate =>
            candidate.reportId === resolution.relatedReportId);
        if (!selected) {
            issues.push(conflictIssue(
                'invalid-conflict-resolution',
                'The selected report is not one of the detected duplicate or conflict candidates.',
                resolution.relatedReportId,
            ));
        } else {
            if (
                selected.kind === 'exact-duplicate'
                && resolution.decision !== 'duplicate'
            ) {
                issues.push(conflictIssue(
                    'invalid-conflict-resolution',
                    'An exact duplicate must be skipped as a duplicate rather than saved as another version.',
                    selected.reportId,
                ));
            }
            if (
                selected.kind !== 'exact-duplicate'
                && resolution.decision === 'duplicate'
            ) {
                issues.push(conflictIssue(
                    'invalid-conflict-resolution',
                    'Reports with differing result content cannot be silently discarded as exact duplicates.',
                    selected.reportId,
                ));
            }
        }

        analysis.blockingCandidates
            .filter(candidate => candidate.reportId !== resolution.relatedReportId)
            .forEach(candidate => {
                issues.push(conflictIssue(
                    'unresolved-report-conflict',
                    `Blocking candidate ${candidate.reportId} still requires a reviewed decision.`,
                    candidate.reportId,
                ));
            });

        if (['amends', 'corrects', 'replaces'].includes(resolution.decision)) {
            const relationship = bundle.report.relationships?.find(item =>
                item.relatedReportId === resolution.relatedReportId
                && item.type === resolution.decision);
            if (!relationship) {
                issues.push(conflictIssue(
                    'invalid-conflict-resolution',
                    'The reviewed bundle does not contain the selected report-version relationship.',
                    resolution.relatedReportId,
                ));
            }

            const allowedIds = new Set(related?.resultIds || []);
            const lineageTargets = bundle.observations
                .map(observation => observation.lineage?.predecessorObservationId)
                .filter((value): value is string => Boolean(value));
            lineageTargets.forEach(target => {
                if (!allowedIds.has(target)) {
                    issues.push(conflictIssue(
                        'result-lineage-invalid',
                        `Result lineage points to ${target}, which is not a member of the related report.`,
                        target,
                    ));
                }
            });
            if (new Set(lineageTargets).size !== lineageTargets.length) {
                issues.push(conflictIssue(
                    'result-lineage-invalid',
                    'One prior result cannot be superseded by multiple results in the same reviewed version.',
                ));
            }
        }
    }

    return { valid: issues.length === 0, issues };
};

const lineageType = (
    decision: ReviewedDiagnosticConflictResolution['decision'],
): DiagnosticVersionRelationshipType | undefined =>
    ['amends', 'corrects', 'replaces'].includes(decision)
        ? decision as DiagnosticVersionRelationshipType
        : undefined;

const appendTag = (tags: string[] | undefined, value: string): string[] =>
    unique([...(tags || []), value]);

export const applyDiagnosticConflictResolution = ({
    bundle,
    draft,
    record,
    now,
    actor,
}: {
    bundle: DiagnosticReportBundle;
    draft: ReviewedDiagnosticReportDraft;
    record?: PatientClinicalRecord;
    now: string;
    actor?: string;
}): DiagnosticReportBundle => {
    const resolution = draft.conflictResolution;
    if (!resolution || resolution.decision === 'duplicate' || !record) {
        return bundle;
    }
    const related = record.resources.diagnosticReports.find(report =>
        report.id === resolution.relatedReportId);
    if (!related) return bundle;

    const relationshipType = resolution.decision === 'distinct'
        ? 'distinct-from' as const
        : resolution.decision;
    const relationship = {
        id: uuidv4(),
        type: relationshipType,
        relatedReportId: related.id,
        recordedAt: now,
        ...(actor ? { recordedBy: actor } : {}),
        reason: resolution.reason,
    };
    const relationshipAmendment: ClinicalAmendment = {
        id: uuidv4(),
        amendedAt: now,
        ...(actor ? { amendedBy: actor } : {}),
        reason: resolution.reason,
        changedFields: ['relationships'],
        previousValues: {
            relationships: bundle.report.relationships || [],
        },
    };
    const report = parseClinicalRecordResource({
        ...bundle.report,
        relationships: [
            ...(bundle.report.relationships || []),
            relationship,
        ],
        tags: appendTag(
            appendTag(bundle.report.tags, `related-report:${related.id}`),
            `diagnostic-resolution:${relationshipType}`,
        ),
        amendments: [...bundle.report.amendments, relationshipAmendment],
    }) as DiagnosticReportRecord;

    const versionType = lineageType(resolution.decision);
    if (!versionType) {
        return {
            ...bundle,
            report,
            resources: [...bundle.specimens, ...bundle.observations, report],
        };
    }

    const relatedObservations = related.resultIds
        .map(id => record.resources.observations.find(item => item.id === id))
        .filter((item): item is ObservationRecord => Boolean(item));
    const previousByIdentity = new Map<string, ObservationRecord[]>();
    relatedObservations.forEach(observation => {
        const key = observationIdentity({ observation, record });
        previousByIdentity.set(key, [
            ...(previousByIdentity.get(key) || []),
            observation,
        ]);
    });

    const observations = bundle.observations.map(observation => {
        const key = observationIdentity({ observation, record, bundle });
        const candidates = previousByIdentity.get(key) || [];
        const predecessor = candidates.shift();
        previousByIdentity.set(key, candidates);
        if (!predecessor) return observation;
        return parseClinicalRecordResource({
            ...observation,
            lineage: {
                relationship: versionType,
                predecessorObservationId: predecessor.id,
                recordedAt: now,
                ...(actor ? { recordedBy: actor } : {}),
                reason: resolution.reason,
            },
            tags: appendTag(
                appendTag(observation.tags, `supersedes-observation:${predecessor.id}`),
                `diagnostic-lineage:${versionType}`,
            ),
        }) as ObservationRecord;
    });

    return {
        ...bundle,
        report,
        observations,
        resources: [...bundle.specimens, ...observations, report],
    };
};

const linkDocumentToReport = ({
    document,
    report,
    now,
    actor,
}: {
    document: DocumentReferenceRecord;
    report: DiagnosticReportRecord;
    now: string;
    actor?: string;
}): DocumentReferenceRecord => {
    if (document.relatedResources.some(reference =>
        reference.resourceType === 'DiagnosticReport'
        && reference.id === report.id)) {
        return document;
    }
    const previous = document.relatedResources;
    const amendment: ClinicalAmendment = {
        id: uuidv4(),
        amendedAt: now,
        ...(actor ? { amendedBy: actor } : {}),
        reason: 'Linked a reviewed diagnostic report version to its original source document.',
        changedFields: ['relatedResources'],
        previousValues: { relatedResources: previous },
    };
    return parseClinicalRecordResource({
        ...document,
        relatedResources: [
            ...previous,
            {
                resourceType: 'DiagnosticReport' as const,
                id: report.id,
                display: report.code.text,
            },
        ],
        provenance: {
            ...document.provenance,
            updatedAt: now,
            ...(actor ? { updatedBy: actor } : {}),
        },
        amendments: [...document.amendments, amendment],
    }) as DocumentReferenceRecord;
};

export const commitConflictAwareDiagnosticReportBundle = (
    bundle: DiagnosticReportBundle,
    draft: ReviewedDiagnosticReportDraft,
    options: {
        actor?: string;
        committedAt?: string;
    } = {},
): DiagnosticBundleCommitResult => {
    const actions = useClinicalRecordStore.getState().actions;
    const record = actions.getPatientRecord(bundle.report.patientId);
    if (!record) {
        return {
            ok: false,
            status: 'patient-not-found',
            createdResourceIds: [],
            issues: [],
            message: 'The target patient record does not exist.',
        };
    }

    const validation = validateConflictAwareDiagnosticReportBundle({
        bundle,
        record,
        resolution: draft.conflictResolution,
    });
    if (!validation.valid) {
        const duplicate = validation.issues.find(issue =>
            issue.code === 'duplicate-report-content');
        const conflict = validation.issues.some(issue => [
            'unresolved-report-conflict',
            'invalid-conflict-resolution',
            'related-report-missing',
            'related-report-patient-mismatch',
            'result-lineage-invalid',
        ].includes(issue.code));
        return {
            ok: false,
            status: duplicate ? 'duplicate' : conflict ? 'conflict' : 'invalid-graph',
            reportId: bundle.report.id,
            createdResourceIds: [],
            ...(duplicate?.resourceId ? { duplicateOf: duplicate.resourceId } : {}),
            issues: validation.issues,
            message: duplicate
                ? 'An equivalent diagnostic report already exists.'
                : conflict
                    ? 'A duplicate or corrected-report conflict requires reviewed resolution.'
                    : 'The diagnostic graph failed validation and was not saved.',
        };
    }

    if (draft.conflictResolution?.decision === 'duplicate') {
        return {
            ok: true,
            status: 'resolved-duplicate',
            createdResourceIds: [],
            duplicateOf: draft.conflictResolution.relatedReportId,
            issues: [],
            message: 'The reviewed upload was confirmed as a duplicate; no clinical resource was created.',
        };
    }

    const committedAt = options.committedAt || new Date().toISOString();
    const documentId = bundle.report.documentIds[0];
    const nextDocuments = record.resources.documents.map(document =>
        document.id === documentId
            ? linkDocumentToReport({
                document,
                report: bundle.report,
                now: committedAt,
                actor: options.actor,
            })
            : document);

    try {
        const nextRecord = parsePatientClinicalRecord({
            ...record,
            resources: {
                ...record.resources,
                specimens: [...record.resources.specimens, ...bundle.specimens],
                observations: [...record.resources.observations, ...bundle.observations],
                diagnosticReports: [
                    ...record.resources.diagnosticReports,
                    bundle.report,
                ],
                documents: nextDocuments,
            },
            updatedAt: committedAt,
        });
        actions.replacePatientRecord(nextRecord);
        return {
            ok: true,
            status: 'created',
            reportId: bundle.report.id,
            createdResourceIds: bundle.resources.map(resource => resource.id),
            issues: [],
            message: draft.conflictResolution
                ? `Saved a reviewed ${draft.conflictResolution.decision} report version while preserving the related report and result history.`
                : `Saved one report, ${bundle.observations.length} result(s), and ${bundle.specimens.length} specimen(s) atomically.`,
        };
    } catch (error) {
        return {
            ok: false,
            status: 'invalid-graph',
            reportId: bundle.report.id,
            createdResourceIds: [],
            issues: [conflictIssue(
                'missing-report',
                error instanceof Error
                    ? error.message
                    : 'The clinical record rejected the diagnostic graph.',
            )],
            message: 'The diagnostic graph was rejected before any resource was saved.',
        };
    }
};
''',
)

# ---------------------------------------------------------------------------
# Conflict-aware reviewed bundle build and commit
# ---------------------------------------------------------------------------
write(
    "features/diagnostic-reports/reviewAmendments.ts",
    r'''import { v4 as uuidv4 } from 'uuid';
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
''',
)

replace_once(
    "features/diagnostic-reports/index.ts",
    """export * from './graph';
""",
    """export * from './conflicts';
export * from './graph';
""",
)

replace_once(
    "features/audit/types.ts",
    """    | 'DIAGNOSTIC_REPORT_REVIEW_STARTED'
    | 'DIAGNOSTIC_REPORT_REVIEW_CONFIRMED'
    | 'DIAGNOSTIC_REPORT_REVIEW_CANCELLED';
""",
    """    | 'DIAGNOSTIC_REPORT_REVIEW_STARTED'
    | 'DIAGNOSTIC_REPORT_REVIEW_CONFIRMED'
    | 'DIAGNOSTIC_REPORT_REVIEW_CANCELLED'
    | 'DIAGNOSTIC_REPORT_CONFLICT_RESOLVED'
    | 'DIAGNOSTIC_REPORT_DUPLICATE_SKIPPED';
""",
)

# ---------------------------------------------------------------------------
# Review workspace: explicit conflict decision and reason
# ---------------------------------------------------------------------------
replace_once(
    "features/diagnostic-reports/components/DiagnosticReportReviewWorkspace.tsx",
    """import {
    buildAndCommitReviewedDiagnosticReport,
    buildReviewedDiagnosticReportBundle,
} from '../reviewAmendments';
""",
    """import {
    analyzeDiagnosticReportConflicts,
    validateConflictAwareDiagnosticReportBundle,
} from '../conflicts';
import {
    buildAndCommitReviewedDiagnosticReport,
    buildReviewedDiagnosticReportBundle,
} from '../reviewAmendments';
""",
)

replace_once(
    "features/diagnostic-reports/components/DiagnosticReportReviewWorkspace.tsx",
    """    DiagnosticBundleCommitResult,
    DiagnosticReportReviewEvidence,
    PendingLegacyLabReview,
""",
    """    DiagnosticBundleCommitResult,
    DiagnosticConflictDecision,
    DiagnosticReportConflictAnalysis,
    DiagnosticReportReviewEvidence,
    PendingLegacyLabReview,
""",
)

replace_once(
    "features/diagnostic-reports/components/DiagnosticReportReviewWorkspace.tsx",
    """interface PreparedReview {
    draft: ReviewedDiagnosticReportDraft;
    evidence?: DiagnosticReportReviewEvidence;
    bundle: ReturnType<typeof buildReviewedDiagnosticReportBundle>;
    validation: ReturnType<typeof validateDiagnosticReportBundleGraph>;
}
""",
    """interface PreparedReview {
    draft: ReviewedDiagnosticReportDraft;
    evidence?: DiagnosticReportReviewEvidence;
    bundle: ReturnType<typeof buildReviewedDiagnosticReportBundle>;
    validation: ReturnType<typeof validateConflictAwareDiagnosticReportBundle>;
    conflicts: DiagnosticReportConflictAnalysis;
}
""",
)

replace_once(
    "features/diagnostic-reports/components/DiagnosticReportReviewWorkspace.tsx",
    """    const [commitError, setCommitError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
""",
    """    const [commitError, setCommitError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [relatedReportId, setRelatedReportId] = useState('');
    const [conflictDecision, setConflictDecision] = useState<
        DiagnosticConflictDecision | ''
    >('');
    const [conflictReason, setConflictReason] = useState('');
""",
)

old_prepared = """    const prepared = useMemo<{
        value?: PreparedReview;
        error?: string;
    }>(() => {
        const results = draft.results.filter(result =>
            includedResultIds.has(result.localId));
        if (results.length === 0) {
            return {
                error:
                    'At least one reviewed result must remain included before the report can be confirmed.',
            };
        }

        try {
            const reviewedAt = pending.detectedAt;
            const withoutEvidence: ReviewedDiagnosticReportDraft = {
                ...draft,
                patientId,
                results,
                verificationStatus: 'confirmed',
                reviewedAt,
                reviewedBy: REVIEW_ACTOR,
            };
            const evidence = buildDiagnosticReviewEvidence({
                initial: seed.draft,
                reviewed: withoutEvidence,
                includedResultIds,
                reason: reviewReason.trim() || DEFAULT_REVIEW_REASON,
            });
            const reviewedDraft: ReviewedDiagnosticReportDraft = {
                ...withoutEvidence,
                ...(evidence ? { reviewEvidence: evidence } : {}),
            };
            const bundle = buildReviewedDiagnosticReportBundle(reviewedDraft, {
                now: reviewedAt,
                actor: REVIEW_ACTOR,
            });
            return {
                value: {
                    draft: reviewedDraft,
                    ...(evidence ? { evidence } : {}),
                    bundle,
                    validation: validateDiagnosticReportBundleGraph(
                        bundle,
                        record,
                    ),
                },
            };
        } catch (error) {
            return {
                error: error instanceof Error
                    ? error.message
                    : 'The reviewed diagnostic report is invalid.',
            };
        }
    }, [
        draft,
        includedResultIds,
        patientId,
        pending.detectedAt,
        record,
        reviewReason,
        seed.draft,
    ]);
"""
new_prepared = """    const prepared = useMemo<{
        value?: PreparedReview;
        error?: string;
    }>(() => {
        const results = draft.results.filter(result =>
            includedResultIds.has(result.localId));
        if (results.length === 0) {
            return {
                error:
                    'At least one reviewed result must remain included before the report can be confirmed.',
            };
        }

        try {
            const reviewedAt = pending.detectedAt;
            const withoutEvidence: ReviewedDiagnosticReportDraft = {
                ...draft,
                patientId,
                results,
                verificationStatus: 'confirmed',
                reviewedAt,
                reviewedBy: REVIEW_ACTOR,
            };
            const evidence = buildDiagnosticReviewEvidence({
                initial: seed.draft,
                reviewed: withoutEvidence,
                includedResultIds,
                reason: reviewReason.trim() || DEFAULT_REVIEW_REASON,
            });
            const resolution = conflictDecision
                && relatedReportId
                && conflictReason.trim()
                ? {
                    relatedReportId,
                    decision: conflictDecision,
                    reason: conflictReason.trim(),
                }
                : undefined;
            const reviewedDraft: ReviewedDiagnosticReportDraft = {
                ...withoutEvidence,
                ...(evidence ? { reviewEvidence: evidence } : {}),
                ...(resolution ? { conflictResolution: resolution } : {}),
            };
            const bundle = buildReviewedDiagnosticReportBundle(reviewedDraft, {
                now: reviewedAt,
                actor: REVIEW_ACTOR,
                record,
            });
            const conflicts = analyzeDiagnosticReportConflicts(record, bundle);
            return {
                value: {
                    draft: reviewedDraft,
                    ...(evidence ? { evidence } : {}),
                    bundle,
                    conflicts,
                    validation: validateConflictAwareDiagnosticReportBundle({
                        bundle,
                        record,
                        resolution,
                    }),
                },
            };
        } catch (error) {
            return {
                error: error instanceof Error
                    ? error.message
                    : 'The reviewed diagnostic report is invalid.',
            };
        }
    }, [
        conflictDecision,
        conflictReason,
        draft,
        includedResultIds,
        patientId,
        pending.detectedAt,
        record,
        relatedReportId,
        reviewReason,
        seed.draft,
    ]);
"""
replace_once(
    "features/diagnostic-reports/components/DiagnosticReportReviewWorkspace.tsx",
    old_prepared,
    new_prepared,
)

replace_once(
    "features/diagnostic-reports/components/DiagnosticReportReviewWorkspace.tsx",
    """            logEvent(
                'DIAGNOSTIC_REPORT_REVIEW_CONFIRMED',
                patientId,
                'Confirmed and atomically saved a reviewed diagnostic report graph.',
                'USER',
                {
                    reportId: result.commit.reportId,
                    documentId: pending.source.documentId,
                    createdResourceIds: result.commit.createdResourceIds,
                    resultCount: result.bundle.observations.length,
                    specimenCount: result.bundle.specimens.length,
                    excludedResultCount,
                    reviewEvidence: finalDraft.reviewEvidence,
                    warnings: result.bundle.warnings,
                },
            );
""",
    """            const auditType = result.commit.status === 'resolved-duplicate'
                ? 'DIAGNOSTIC_REPORT_DUPLICATE_SKIPPED'
                : finalDraft.conflictResolution
                    ? 'DIAGNOSTIC_REPORT_CONFLICT_RESOLVED'
                    : 'DIAGNOSTIC_REPORT_REVIEW_CONFIRMED';
            logEvent(
                auditType,
                patientId,
                result.commit.status === 'resolved-duplicate'
                    ? 'Confirmed that the reviewed upload duplicates an existing diagnostic report; no clinical resource was created.'
                    : finalDraft.conflictResolution
                        ? 'Confirmed and atomically saved a reviewed diagnostic report relationship while preserving prior versions.'
                        : 'Confirmed and atomically saved a reviewed diagnostic report graph.',
                'USER',
                {
                    reportId: result.commit.reportId,
                    duplicateOf: result.commit.duplicateOf,
                    documentId: pending.source.documentId,
                    createdResourceIds: result.commit.createdResourceIds,
                    resultCount: result.bundle.observations.length,
                    specimenCount: result.bundle.specimens.length,
                    excludedResultCount,
                    reviewEvidence: finalDraft.reviewEvidence,
                    conflictResolution: finalDraft.conflictResolution,
                    warnings: result.bundle.warnings,
                },
            );
""",
)

replace_once(
    "features/diagnostic-reports/components/DiagnosticReportReviewWorkspace.tsx",
    """    const validationIssues = prepared.value?.validation.issues || [];
    const parsingWarnings = prepared.value?.bundle.warnings || [];
""",
    """    const validationIssues = prepared.value?.validation.issues || [];
    const conflictCandidates = prepared.value?.conflicts.candidates || [];
    const parsingWarnings = prepared.value?.bundle.warnings || [];
""",
)

conflict_section = r'''
                            {conflictCandidates.length > 0 && (
                                <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
                                    <div className="flex items-start gap-3">
                                        <AlertTriangleIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-violet-600 dark:text-violet-300" />
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-sm font-bold text-violet-950 dark:text-violet-100">
                                                Potential duplicate or corrected report
                                            </h3>
                                            <p className="mt-1 text-xs leading-relaxed text-violet-800 dark:text-violet-200">
                                                Blocking matches require an explicit reviewed decision. A corrected or amended report creates a new version and preserves every prior report and result.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-3 space-y-2">
                                        {conflictCandidates.map(candidate => (
                                            <article
                                                key={candidate.reportId}
                                                className={`rounded-xl border p-3 ${candidate.blocking
                                                    ? 'border-red-200 bg-white dark:border-red-900/60 dark:bg-slate-950/60'
                                                    : 'border-violet-200 bg-white dark:border-violet-900/50 dark:bg-slate-950/60'
                                                }`}
                                            >
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                                        {candidate.reportTitle}
                                                    </span>
                                                    <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                                        {fieldLabel(candidate.kind)}
                                                    </span>
                                                    <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-[9px] text-slate-500 dark:bg-slate-800">
                                                        score {candidate.score}
                                                    </span>
                                                    {candidate.blocking && (
                                                        <span className="rounded-full bg-red-100 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-red-700 dark:bg-red-950/40 dark:text-red-300">
                                                            Decision required
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                                                    {candidate.clinicalDateLabel} · {candidate.sourceLabel} · report {candidate.reportId}
                                                </p>
                                                <ul className="mt-2 list-disc space-y-1 pl-5 text-[10px] text-slate-600 dark:text-slate-300">
                                                    {candidate.evidence.map(item => (
                                                        <li key={item}>{item}</li>
                                                    ))}
                                                </ul>
                                            </article>
                                        ))}
                                    </div>

                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                        <label>
                                            <span className={labelClass}>Related existing report</span>
                                            <select
                                                value={relatedReportId}
                                                onChange={event => setRelatedReportId(event.target.value)}
                                                className={inputClass}
                                            >
                                                <option value="">Select a report</option>
                                                {conflictCandidates.map(candidate => (
                                                    <option key={candidate.reportId} value={candidate.reportId}>
                                                        {candidate.reportTitle} · {fieldLabel(candidate.kind)}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <label>
                                            <span className={labelClass}>Reviewed decision</span>
                                            <select
                                                value={conflictDecision}
                                                onChange={event => {
                                                    const decision = event.target.value as DiagnosticConflictDecision | '';
                                                    setConflictDecision(decision);
                                                    if (decision === 'corrects') {
                                                        setReportField('status', 'corrected');
                                                    } else if (decision === 'amends') {
                                                        setReportField('status', 'amended');
                                                    } else if (decision === 'replaces' && ![
                                                        'final',
                                                        'amended',
                                                        'corrected',
                                                    ].includes(draft.status || '')) {
                                                        setReportField('status', 'final');
                                                    }
                                                }}
                                                className={inputClass}
                                            >
                                                <option value="">Select a decision</option>
                                                <option value="duplicate">Duplicate — do not save another copy</option>
                                                <option value="corrects">Corrects the selected report</option>
                                                <option value="amends">Amends the selected report</option>
                                                <option value="replaces">Replaces the selected report</option>
                                                <option value="distinct">Keep both as distinct reports</option>
                                            </select>
                                        </label>
                                        <label className="sm:col-span-2">
                                            <span className={labelClass}>Conflict-resolution reason</span>
                                            <textarea
                                                value={conflictReason}
                                                onChange={event => setConflictReason(event.target.value)}
                                                rows={2}
                                                placeholder="State what the original reports show and why this relationship is correct."
                                                className={inputClass}
                                            />
                                        </label>
                                    </div>
                                </section>
                            )}

'''
replace_once(
    "features/diagnostic-reports/components/DiagnosticReportReviewWorkspace.tsx",
    """                            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                    Review evidence and graph validation
""",
    conflict_section + """                            <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                    Review evidence and graph validation
""",
)

# Remove now-unused direct graph validation import.
replace_once(
    "features/diagnostic-reports/components/DiagnosticReportReviewWorkspace.tsx",
    """import { validateDiagnosticReportBundleGraph } from '../graph';
""",
    """,
)

# ---------------------------------------------------------------------------
# Result intelligence: current versions versus superseded history
# ---------------------------------------------------------------------------
replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """    | 'unit-missing'
    | 'single-point-only';
""",
    """    | 'unit-missing'
    | 'single-point-only'
    | 'superseded-result';
""",
)

replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """    normalizationWarning?: string;
    note?: string;
}
""",
    """    normalizationWarning?: string;
    note?: string;
    isSuperseded: boolean;
    supersededByObservationIds: string[];
    lineage?: ObservationRecord['lineage'];
}
""",
)

replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """    conclusion?: string;
    membershipBasis: 'diagnostic-report-resultIds';
}
""",
    """    conclusion?: string;
    membershipBasis: 'diagnostic-report-resultIds';
    relationships: NonNullable<DiagnosticReportRecord['relationships']>;
    isSuperseded: boolean;
    supersededByReportIds: string[];
}
""",
)

replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """    otherResults: DiagnosticResultView[];
    trendSeries: DiagnosticTrendSeries[];
""",
    """    otherResults: DiagnosticResultView[];
    supersededResults: DiagnosticResultView[];
    trendSeries: DiagnosticTrendSeries[];
""",
)

replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """    reportCount: number;
    observationCount: number;
    flaggedCount: number;
}
""",
    """    reportCount: number;
    historicalReportCount: number;
    observationCount: number;
    flaggedCount: number;
    lineageCount: number;
}
""",
)

replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """const reportMembership = (
    reports: DiagnosticReportRecord[],
): Map<string, DiagnosticReportRecord[]> => {
""",
    """const observationSuccessors = (
    observations: ObservationRecord[],
): Map<string, string[]> => {
    const successors = new Map<string, string[]>();
    observations.forEach(observation => {
        const predecessor = observation.lineage?.predecessorObservationId;
        if (!predecessor) return;
        successors.set(predecessor, [
            ...(successors.get(predecessor) || []),
            observation.id,
        ]);
    });
    return successors;
};

const reportSuccessors = (
    reports: DiagnosticReportRecord[],
): Map<string, string[]> => {
    const successors = new Map<string, string[]>();
    reports.forEach(report => {
        (report.relationships || [])
            .filter(relationship => [
                'amends',
                'corrects',
                'replaces',
            ].includes(relationship.type))
            .forEach(relationship => {
                successors.set(relationship.relatedReportId, [
                    ...(successors.get(relationship.relatedReportId) || []),
                    report.id,
                ]);
            });
    });
    return successors;
};

const reportMembership = (
    reports: DiagnosticReportRecord[],
): Map<string, DiagnosticReportRecord[]> => {
""",
)

replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """    reports,
}: {
    record: PatientClinicalRecord;
    observation: ObservationRecord;
    reports: DiagnosticReportRecord[];
}): DiagnosticResultView => {
""",
    """    reports,
    successorIds,
}: {
    record: PatientClinicalRecord;
    observation: ObservationRecord;
    reports: DiagnosticReportRecord[];
    successorIds: string[];
}): DiagnosticResultView => {
""",
)

replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """        ...(observation.note ? { note: observation.note } : {}),
    };
};
""",
    """        ...(observation.note ? { note: observation.note } : {}),
        isSuperseded: successorIds.length > 0,
        supersededByObservationIds: successorIds,
        ...(observation.lineage ? { lineage: observation.lineage } : {}),
    };
};
""",
)

replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """    reports,
}: {
    record: PatientClinicalRecord;
    observation: ObservationRecord;
    reports: DiagnosticReportRecord[];
}): { candidate?: TrendCandidate; exclusion?: TrendExclusion } => {
""",
    """    reports,
    superseded,
}: {
    record: PatientClinicalRecord;
    observation: ObservationRecord;
    reports: DiagnosticReportRecord[];
    superseded: boolean;
}): { candidate?: TrendCandidate; exclusion?: TrendExclusion } => {
""",
)

replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """    if (!TRENDABLE_STATUSES.has(observation.status)) {
""",
    """    if (superseded) {
        return {
            exclusion: trendExclusion(
                observation,
                'superseded-result',
                'A newer reviewed report version supersedes this result. It remains available in diagnostic history but is excluded from current trends.',
            ),
        };
    }
    if (!TRENDABLE_STATUSES.has(observation.status)) {
""",
)

replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """    const observationsById = new Map(
        observations.map(observation => [observation.id, observation]),
    );
    const membership = reportMembership(reports);
""",
    """    const observationsById = new Map(
        observations.map(observation => [observation.id, observation]),
    );
    const observationSuccessorMap = observationSuccessors(observations);
    const reportSuccessorMap = reportSuccessors(reports);
    const membership = reportMembership(reports);
""",
)

replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """            observation,
            reports: membership.get(observation.id) || [],
        }));
""",
    """            observation,
            reports: membership.get(observation.id) || [],
            successorIds: observationSuccessorMap.get(observation.id) || [],
        }));
""",
)

replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """            ...(report.conclusion ? { conclusion: report.conclusion } : {}),
            membershipBasis: 'diagnostic-report-resultIds' as const,
        };
    }).sort((left, right) => left.name.localeCompare(right.name));

    const views = [...resultViews.values()];
    const unlinkedResults = views.filter(view => view.reportNames.length === 0);
""",
    """            ...(report.conclusion ? { conclusion: report.conclusion } : {}),
            membershipBasis: 'diagnostic-report-resultIds' as const,
            relationships: report.relationships || [],
            isSuperseded: reportSuccessorMap.has(report.id),
            supersededByReportIds: reportSuccessorMap.get(report.id) || [],
        };
    }).sort((left, right) => {
        if (left.isSuperseded !== right.isSuperseded) {
            return left.isSuperseded ? 1 : -1;
        }
        return left.name.localeCompare(right.name);
    });

    const views = [...resultViews.values()];
    const activeViews = views.filter(view => !view.isSuperseded);
    const supersededResults = views.filter(view => view.isSuperseded);
    const unlinkedResults = activeViews.filter(view => view.reportNames.length === 0);
""",
)

replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """            observation,
            reports: membership.get(observation.id) || [],
        });
""",
    """            observation,
            reports: membership.get(observation.id) || [],
            superseded: observationSuccessorMap.has(observation.id),
        });
""",
)

replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """    const byKind = (kind: ResultPresentationKind) => views.filter(view =>
        view.kind === kind);
""",
    """    const byKind = (kind: ResultPresentationKind) => activeViews.filter(view =>
        view.kind === kind);
""",
)

replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """        otherResults: byKind('other'),
        trendSeries: trendOutput.series,
""",
    """        otherResults: byKind('other'),
        supersededResults,
        trendSeries: trendOutput.series,
""",
)

replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """        reportCount: reports.length,
        observationCount: observations.length,
        flaggedCount: views.filter(view => view.flagged).length,
    };
};
""",
    """        reportCount: panels.filter(panel => !panel.isSuperseded).length,
        historicalReportCount: panels.filter(panel => panel.isSuperseded).length,
        observationCount: activeViews.length,
        flaggedCount: activeViews.filter(view => view.flagged).length,
        lineageCount: reports.reduce(
            (total, report) => total + (report.relationships?.length || 0),
            0,
        ),
    };
};
""",
)

replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """        result.source?.fileName,
    ].some(value => normalizeText(value).includes(normalized));
""",
    """        result.source?.fileName,
        result.isSuperseded ? 'superseded history' : 'current result',
        result.lineage?.relationship,
        result.lineage?.predecessorObservationId,
        result.supersededByObservationIds.join(' '),
    ].some(value => normalizeText(value).includes(normalized));
""",
)

replace_once(
    "features/diagnostic-reports/resultIntelligence.ts",
    """        panel.source?.fileName,
    ].some(value => normalizeText(value).includes(normalized));
""",
    """        panel.source?.fileName,
        panel.isSuperseded ? 'superseded history' : 'current report',
        panel.relationships.map(item => `${item.type} ${item.relatedReportId}`).join(' '),
        panel.supersededByReportIds.join(' '),
    ].some(value => normalizeText(value).includes(normalized));
""",
)

# ---------------------------------------------------------------------------
# Results workspace: make report lineage and historical values visible
# ---------------------------------------------------------------------------
replace_once(
    "features/personal-health-record/components/ResultsModule.tsx",
    """type WorkspaceView = 'overview' | 'panels' | 'trends' | 'other';
""",
    """type WorkspaceView = 'overview' | 'panels' | 'trends' | 'other' | 'history';
""",
)

replace_once(
    "features/personal-health-record/components/ResultsModule.tsx",
    """                        {result.flagged && (
                            <StatusBadge tone="warning">Source flag</StatusBadge>
                        )}
""",
    """                        {result.flagged && (
                            <StatusBadge tone="warning">Source flag</StatusBadge>
                        )}
                        {result.isSuperseded && (
                            <StatusBadge tone="warning">Superseded history</StatusBadge>
                        )}
                        {result.lineage && (
                            <StatusBadge tone="info">
                                {result.lineage.relationship} prior result
                            </StatusBadge>
                        )}
""",
)

replace_once(
    "features/personal-health-record/components/ResultsModule.tsx",
    """                    {result.normalizationWarning && (
                        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] leading-relaxed text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                            Normalization warning: {result.normalizationWarning}
                        </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
""",
    """                    {result.normalizationWarning && (
                        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] leading-relaxed text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                            Normalization warning: {result.normalizationWarning}
                        </p>
                    )}

                    {result.lineage && (
                        <p className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-2 text-[10px] leading-relaxed text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
                            This result {result.lineage.relationship} observation {result.lineage.predecessorObservationId}. The prior value remains preserved in history.
                        </p>
                    )}
                    {result.isSuperseded && (
                        <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[10px] leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                            Superseded by {result.supersededByObservationIds.join(', ')}. This value is excluded from current trends but remains source-reviewable.
                        </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
""",
)

replace_once(
    "features/personal-health-record/components/ResultsModule.tsx",
    """                        <StatusBadge tone={panel.clinicalDateLabel === 'Clinical date unknown'
                            ? 'warning'
                            : 'neutral'}>
                            {panel.clinicalDateLabel}
                        </StatusBadge>
""",
    """                        <StatusBadge tone={panel.clinicalDateLabel === 'Clinical date unknown'
                            ? 'warning'
                            : 'neutral'}>
                            {panel.clinicalDateLabel}
                        </StatusBadge>
                        {panel.isSuperseded && (
                            <StatusBadge tone="warning">Superseded report</StatusBadge>
                        )}
""",
)

replace_once(
    "features/personal-health-record/components/ResultsModule.tsx",
    """                {panel.missingMemberIds.length > 0 && (
                    <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200">
                        Missing or non-confirmed report members: {panel.missingMemberIds.join(', ')}
                    </p>
                )}

                <div className="mt-4 grid gap-3 xl:grid-cols-2">
""",
    """                {panel.missingMemberIds.length > 0 && (
                    <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200">
                        Missing or non-confirmed report members: {panel.missingMemberIds.join(', ')}
                    </p>
                )}

                {(panel.relationships.length > 0 || panel.isSuperseded) && (
                    <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-100">
                        <p className="font-bold">Report version history</p>
                        {panel.relationships.map(relationship => (
                            <p key={relationship.id} className="mt-1 text-[10px] leading-relaxed">
                                This report {relationship.type} report {relationship.relatedReportId}. Reason: {relationship.reason}
                            </p>
                        ))}
                        {panel.isSuperseded && (
                            <p className="mt-1 text-[10px] leading-relaxed">
                                Superseded by report {panel.supersededByReportIds.join(', ')}. The complete original report remains available below.
                            </p>
                        )}
                    </div>
                )}

                <div className="mt-4 grid gap-3 xl:grid-cols-2">
""",
)

replace_once(
    "features/personal-health-record/components/ResultsModule.tsx",
    """    const unlinkedResults = filterResults(intelligence.unlinkedResults);
    const trendSeries = intelligence.trendSeries.filter(series =>
""",
    """    const unlinkedResults = filterResults(intelligence.unlinkedResults);
    const supersededResults = filterResults(intelligence.supersededResults);
    const currentPanels = panels.filter(panel => !panel.isSuperseded);
    const historicalPanels = panels.filter(panel => panel.isSuperseded);
    const trendSeries = intelligence.trendSeries.filter(series =>
""",
)

replace_once(
    "features/personal-health-record/components/ResultsModule.tsx",
    """    const showPanels = view === 'overview' || view === 'panels';
    const showTrends = view === 'overview' || view === 'trends';
    const showOther = view === 'overview' || view === 'other';
""",
    """    const showPanels = view === 'overview' || view === 'panels';
    const showTrends = view === 'overview' || view === 'trends';
    const showOther = view === 'overview' || view === 'other';
    const showHistory = view === 'overview' || view === 'history';
""",
)

replace_once(
    "features/personal-health-record/components/ResultsModule.tsx",
    """                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
""",
    """                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
""",
)

replace_once(
    "features/personal-health-record/components/ResultsModule.tsx",
    """                        <MetricCard
                            label="Source flags"
                            value={intelligence.flaggedCount}
                            helper="recorded interpretations, not diagnoses"
                            warning={intelligence.flaggedCount > 0}
                        />
""",
    """                        <MetricCard
                            label="Source flags"
                            value={intelligence.flaggedCount}
                            helper="recorded interpretations, not diagnoses"
                            warning={intelligence.flaggedCount > 0}
                        />
                        <MetricCard
                            label="Version history"
                            value={intelligence.historicalReportCount + intelligence.supersededResults.length}
                            helper={`${intelligence.lineageCount} reviewed relationship${intelligence.lineageCount === 1 ? '' : 's'}`}
                        />
""",
)

replace_once(
    "features/personal-health-record/components/ResultsModule.tsx",
    """                                ['trends', 'Trends'],
                                ['other', 'Other values'],
""",
    """                                ['trends', 'Trends'],
                                ['other', 'Other values'],
                                ['history', 'Version history'],
""",
)

replace_once(
    "features/personal-health-record/components/ResultsModule.tsx",
    """                        {panels.length > 0 ? (
                            <div className="space-y-3">
                                {panels.map(panel => (
""",
    """                        {currentPanels.length > 0 ? (
                            <div className="space-y-3">
                                {currentPanels.map(panel => (
""",
)

history_section = r'''
                {showHistory && (
                    <section className="space-y-4" aria-labelledby="diagnostic-history-heading">
                        <div>
                            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-slate-400">
                                Immutable source history
                            </p>
                            <h2
                                id="diagnostic-history-heading"
                                className="mt-1 text-lg font-bold text-slate-950 dark:text-white"
                            >
                                Corrected, amended, and superseded versions
                            </h2>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Prior reports and result values are never overwritten. Superseded results are excluded from current trends while their original source, provenance, and values remain reviewable here.
                            </p>
                        </div>

                        {historicalPanels.length > 0 && (
                            <div className="space-y-3">
                                {historicalPanels.map(panel => (
                                    <PanelCard
                                        key={panel.id}
                                        record={record}
                                        panel={panel}
                                        onOpenSource={setSource}
                                    />
                                ))}
                            </div>
                        )}

                        {supersededResults.length > 0 && (
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                    Superseded result values
                                </h3>
                                <div className="mt-2 grid gap-3 xl:grid-cols-2">
                                    {supersededResults.map(result => (
                                        <ResultCard
                                            key={result.id}
                                            record={record}
                                            result={result}
                                            onOpenSource={setSource}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {historicalPanels.length === 0 && supersededResults.length === 0 && (
                            <EmptyState
                                title="No superseded diagnostic versions"
                                description="Corrected or amended report relationships will appear here after explicit source review."
                            />
                        )}
                    </section>
                )}
'''
replace_once(
    "features/personal-health-record/components/ResultsModule.tsx",
    """                {showOther && (
                    <section className="space-y-5" aria-labelledby="diagnostic-other-heading">
""",
    """                {showOther && (
                    <section className="space-y-5" aria-labelledby="diagnostic-other-heading">
""",
)
replace_once(
    "features/personal-health-record/components/ResultsModule.tsx",
    """                )}
            </div>

            {source && (
""",
    """                )}

""" + history_section + """            </div>

            {source && (
""",
)

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------
write(
    "tests/diagnosticReportConflicts.test.ts",
    r'''import { beforeEach, describe, expect, it } from 'vitest';
import {
    parseClinicalRecordResource,
    type DocumentReferenceRecord,
    useClinicalRecordStore,
} from '../features/clinical-record';
import {
    analyzeDiagnosticReportConflicts,
    buildAndCommitReviewedDiagnosticReport,
    buildDiagnosticResultsIntelligence,
    buildReviewedDiagnosticReportBundle,
    validateConflictAwareDiagnosticReportBundle,
    type ReviewedDiagnosticReportDraft,
} from '../features/diagnostic-reports';

const NOW = '2026-08-01T08:00:00.000Z';
const PATIENT_ID = 'patient-phase4-conflicts';

const document = (id: string, fileName: string): DocumentReferenceRecord =>
    parseClinicalRecordResource({
        id,
        patientId: PATIENT_ID,
        resourceType: 'DocumentReference',
        verificationStatus: 'confirmed',
        recordedAt: NOW,
        provenance: {
            source: { kind: 'manual', description: 'Synthetic diagnostic source' },
            createdAt: NOW,
            updatedAt: NOW,
            confirmation: {
                reviewedAt: NOW,
                reviewedBy: 'tester',
                reason: 'Synthetic source fixture',
            },
        },
        amendments: [],
        status: 'current',
        storageId: `storage-${id}`,
        fileName,
        mimeType: 'application/pdf',
        uploadedAt: NOW,
        relatedResources: [],
    }) as DocumentReferenceRecord;

const ids = (prefix: string) => (
    resourceType: string,
    localId: string,
): string => `${prefix}-${resourceType.toLowerCase()}-${localId}`;

const draft = ({
    documentId,
    value,
    accession = 'ACC-CONFLICT-001',
    status = 'final',
    conflictResolution,
}: {
    documentId: string;
    value: string;
    accession?: string;
    status?: ReviewedDiagnosticReportDraft['status'];
    conflictResolution?: ReviewedDiagnosticReportDraft['conflictResolution'];
}): ReviewedDiagnosticReportDraft => ({
    patientId: PATIENT_ID,
    reportTitle: 'Complete blood count',
    status,
    categoryTexts: ['Laboratory'],
    effectiveDate: '2026-07-31',
    issuedAt: '2026-07-31T10:00:00.000Z',
    performer: ['Synthetic laboratory'],
    accessionIdentifier: { value: accession },
    specimens: [{
        localId: 'blood',
        status: 'available',
        typeText: 'Venous blood',
        collectedDate: '2026-07-31',
    }],
    results: [{
        localId: 'hemoglobin',
        testName: 'Hemoglobin',
        loincCode: '718-7',
        status: status === 'corrected' ? 'corrected' : status === 'amended' ? 'amended' : 'final',
        categoryTexts: ['Laboratory'],
        valueText: value,
        unitText: 'g/dL',
        referenceRangeText: '12.0 - 16.0',
        clinicalDate: '2026-07-31',
        specimenLocalId: 'blood',
        source: { pageNumber: 1, excerpt: `Hemoglobin ${value} g/dL` },
    }],
    source: {
        documentId,
        fileName: `${documentId}.pdf`,
        pageNumber: 1,
    },
    verificationStatus: 'confirmed',
    reviewedAt: NOW,
    reviewedBy: 'tester',
    ...(conflictResolution ? { conflictResolution } : {}),
});

describe('Phase 4 corrected report lineage and conflict resolution', () => {
    beforeEach(() => {
        useClinicalRecordStore.setState({ records: {} });
        const actions = useClinicalRecordStore.getState().actions;
        actions.initializePatientRecord({
            patientId: PATIENT_ID,
            displayName: 'Synthetic Conflict Patient',
            now: NOW,
        });
        actions.addResource(document('source-1', 'original-report.pdf'));
        actions.addResource(document('source-2', 'duplicate-report.pdf'));
        actions.addResource(document('source-3', 'corrected-report.pdf'));
        actions.addResource(document('source-4', 'similar-distinct-report.pdf'));
    });

    it('blocks an unresolved cross-source exact duplicate and skips it after review', () => {
        const first = buildAndCommitReviewedDiagnosticReport(
            draft({ documentId: 'source-1', value: '13.2' }),
            { now: NOW, committedAt: NOW, actor: 'tester', idFactory: ids('v1') },
        );
        expect(first.commit.ok).toBe(true);

        const record = useClinicalRecordStore.getState().actions
            .getPatientRecord(PATIENT_ID)!;
        const duplicateDraft = draft({ documentId: 'source-2', value: '13.2' });
        const duplicateBundle = buildReviewedDiagnosticReportBundle(
            duplicateDraft,
            { now: NOW, actor: 'tester', idFactory: ids('dup'), record },
        );
        const analysis = analyzeDiagnosticReportConflicts(record, duplicateBundle);
        const validation = validateConflictAwareDiagnosticReportBundle({
            bundle: duplicateBundle,
            record,
        });

        expect(analysis.blockingCandidates[0]).toMatchObject({
            reportId: first.commit.reportId,
            kind: 'exact-duplicate',
            blocking: true,
        });
        expect(validation.valid).toBe(false);
        expect(validation.issues.some(issue =>
            issue.code === 'duplicate-report-content')).toBe(true);

        const resolved = buildAndCommitReviewedDiagnosticReport(
            draft({
                documentId: 'source-2',
                value: '13.2',
                conflictResolution: {
                    relatedReportId: first.commit.reportId!,
                    decision: 'duplicate',
                    reason: 'Both source documents contain the same accession and result value.',
                },
            }),
            { now: NOW, committedAt: NOW, actor: 'tester', idFactory: ids('dup') },
        );
        const unchanged = useClinicalRecordStore.getState().actions
            .getPatientRecord(PATIENT_ID)!;

        expect(resolved.commit).toMatchObject({
            ok: true,
            status: 'resolved-duplicate',
            duplicateOf: first.commit.reportId,
            createdResourceIds: [],
        });
        expect(unchanged.resources.diagnosticReports).toHaveLength(1);
        expect(unchanged.resources.observations).toHaveLength(1);
    });

    it('creates a corrected version with observation lineage and preserves prior values', () => {
        const first = buildAndCommitReviewedDiagnosticReport(
            draft({ documentId: 'source-1', value: '13.2' }),
            { now: NOW, committedAt: NOW, actor: 'tester', idFactory: ids('v1') },
        );
        const corrected = buildAndCommitReviewedDiagnosticReport(
            draft({
                documentId: 'source-3',
                value: '12.8',
                status: 'corrected',
                conflictResolution: {
                    relatedReportId: first.commit.reportId!,
                    decision: 'corrects',
                    reason: 'The laboratory issued a corrected hemoglobin value.',
                },
            }),
            { now: NOW, committedAt: NOW, actor: 'tester', idFactory: ids('v2') },
        );
        const record = useClinicalRecordStore.getState().actions
            .getPatientRecord(PATIENT_ID)!;
        const originalReport = record.resources.diagnosticReports.find(item =>
            item.id === first.commit.reportId)!;
        const correctedReport = record.resources.diagnosticReports.find(item =>
            item.id === corrected.commit.reportId)!;
        const originalObservation = record.resources.observations.find(item =>
            item.id === originalReport.resultIds[0])!;
        const correctedObservation = record.resources.observations.find(item =>
            item.id === correctedReport.resultIds[0])!;

        expect(corrected.commit.status).toBe('created');
        expect(correctedReport.relationships).toEqual([
            expect.objectContaining({
                type: 'corrects',
                relatedReportId: originalReport.id,
            }),
        ]);
        expect(correctedObservation.lineage).toMatchObject({
            relationship: 'corrects',
            predecessorObservationId: originalObservation.id,
        });
        expect(originalObservation.value).toMatchObject({
            type: 'quantity',
            quantity: { original: { value: 13.2 } },
        });
        expect(correctedObservation.value).toMatchObject({
            type: 'quantity',
            quantity: { original: { value: 12.8 } },
        });

        const intelligence = buildDiagnosticResultsIntelligence(record);
        expect(intelligence.supersededResults.map(item => item.id))
            .toContain(originalObservation.id);
        expect(intelligence.panels.find(item => item.id === originalReport.id))
            .toMatchObject({ isSuperseded: true });
        expect(intelligence.panels.find(item => item.id === correctedReport.id))
            .toMatchObject({ isSuperseded: false });
        expect(intelligence.trendSeries.flatMap(series =>
            series.points.map(point => point.observationId)))
            .not.toContain(originalObservation.id);
        expect(intelligence.trendExclusions).toContainEqual(
            expect.objectContaining({
                observationId: originalObservation.id,
                reason: 'superseded-result',
            }),
        );
    });

    it('keeps a same-day similar report advisory when no strong event identifier matches', () => {
        const first = buildAndCommitReviewedDiagnosticReport(
            draft({ documentId: 'source-1', value: '13.2', accession: 'ACC-A' }),
            { now: NOW, committedAt: NOW, actor: 'tester', idFactory: ids('v1') },
        );
        expect(first.commit.ok).toBe(true);

        const secondDraft = draft({
            documentId: 'source-4',
            value: '12.1',
            accession: 'ACC-B',
        });
        const record = useClinicalRecordStore.getState().actions
            .getPatientRecord(PATIENT_ID)!;
        const bundle = buildReviewedDiagnosticReportBundle(secondDraft, {
            now: NOW,
            actor: 'tester',
            idFactory: ids('distinct'),
            record,
        });
        const analysis = analyzeDiagnosticReportConflicts(record, bundle);
        const committed = buildAndCommitReviewedDiagnosticReport(secondDraft, {
            now: NOW,
            committedAt: NOW,
            actor: 'tester',
            idFactory: ids('distinct'),
        });

        expect(analysis.candidates[0]).toMatchObject({
            kind: 'possible-duplicate',
            blocking: false,
        });
        expect(analysis.requiresResolution).toBe(false);
        expect(committed.commit.status).toBe('created');
    });
});
''',
)

write(
    "tests/diagnosticReportConflictWorkspace.test.ts",
    r'''import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relativePath: string): string =>
    readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('Phase 4 conflict and version-history workspace contracts', () => {
    it('requires an explicit duplicate or corrected-report decision and reason', () => {
        const review = source(
            '../features/diagnostic-reports/components/DiagnosticReportReviewWorkspace.tsx',
        );

        expect(review).toContain('Potential duplicate or corrected report');
        expect(review).toContain('Decision required');
        expect(review).toContain('Duplicate — do not save another copy');
        expect(review).toContain('Corrects the selected report');
        expect(review).toContain('Keep both as distinct reports');
        expect(review).toContain('Conflict-resolution reason');
        expect(review).toContain('validateConflictAwareDiagnosticReportBundle');
    });

    it('keeps superseded reports and values visible outside current trends', () => {
        const results = source(
            '../features/personal-health-record/components/ResultsModule.tsx',
        );
        const intelligence = source(
            '../features/diagnostic-reports/resultIntelligence.ts',
        );

        expect(results).toContain('Version history');
        expect(results).toContain('Superseded result values');
        expect(results).toContain('Prior reports and result values are never overwritten');
        expect(intelligence).toContain("'superseded-result'");
        expect(intelligence).toContain('observationSuccessors');
        expect(intelligence).toContain('reportSuccessors');
    });
});
''',
)

# ---------------------------------------------------------------------------
# Architecture and final Phase 4 acceptance documentation
# ---------------------------------------------------------------------------
write(
    "docs/architecture/PHASE_4_CORRECTIONS_DUPLICATES_CONFLICTS.md",
    r'''# Phase 4 Slice 4 — Corrections, duplicates, and conflicts

## Decision boundary

MediBrief never overwrites a reviewed diagnostic report or result when a later source corrects, amends, or replaces it. The later graph is stored as a new `DiagnosticReport` and new `Observation` resources. Explicit relationships point backward to the prior report and result versions.

```text
prior DiagnosticReport  ← corrects / amends / replaces — new DiagnosticReport
prior Observation       ← superseded by lineage          — new Observation
```

Reverse “superseded by” views are derived from the new resources. Historical source values therefore remain immutable and independently reviewable.

## Duplicate and conflict classes

The detector compares only reviewed structured evidence and reports why a match was raised:

- **Exact duplicate** — strong source/accession identity or same clinical event evidence with identical structured results. Confirmation is blocked until the reviewer chooses “duplicate”; no new clinical resource is written.
- **Same-event conflict** — shared source/accession identity with differing result content. Confirmation is blocked until the reviewer records `corrects`, `amends`, `replaces`, or an explicit distinct-report decision.
- **Possible duplicate** — same reviewed title/date with meaningful result overlap but no strong event identifier. This is advisory because two legitimate reports may share those characteristics.

No fuzzy title match alone can delete or merge data.

## Reviewed resolution

A resolution records:

- the selected related report;
- one explicit decision;
- a required human reason;
- the reviewer and timestamp through report relationship metadata and audit events.

Status and relationship must agree: `amends` requires an amended report, while `corrects` requires a corrected report.

## Result lineage

For corrected, amended, and replacement reports, member results are paired deterministically by confirmed LOINC identity or exact reviewed name plus specimen context. Matched new observations point to one predecessor observation. Unmatched rows remain legitimate additions; prior rows omitted from the new report remain preserved in the older report.

A predecessor cannot be superseded by multiple observations in the same version.

## Trends and presentation

Superseded results:

- remain visible with original values, provenance, and source preview;
- appear in the Version history workspace;
- are excluded from current numeric trends with the explicit reason `superseded-result`.

Current report panels are shown separately from superseded report panels. The UI never hides history by mutating old records to entered-in-error.

## Atomicity

For a created version, the new report, observations, specimens, document link, relationship metadata, and result lineage are validated before one patient-record replacement. Validation failure writes nothing.

A reviewed duplicate resolution also writes no clinical resource and returns `resolved-duplicate` so the audit trail can distinguish an intentional skip from a failed save.

## Accepted limitations

- Matching is conservative and local to one patient record.
- Identifier extraction still relies partly on preserved accession tags and source provenance until dedicated identifier fields are introduced.
- Result pairing does not claim method equivalence.
- Possible-duplicate warnings are advisory to avoid collapsing legitimate same-day reports.
- No report is deleted automatically.
''',
)

write(
    "docs/PHASE_4_ACCEPTANCE.md",
    r'''# Phase 4 acceptance — Laboratory and diagnostic report pipeline

Phase 4 is accepted when all four slices pass the repository validation pipeline.

## Accepted capabilities

1. Source-linked `DocumentReference → DiagnosticReport → Observation / Specimen` graph.
2. Report-level human review with original document preview, edits, exclusions, amendment evidence, and atomic confirmation.
3. Explicit panel membership, source-preserving normalization, result-family presentation, and conservative trends.
4. Corrected/amended/replacement lineage, cross-source duplicate detection, reviewed conflict resolution, immutable superseded history, and duplicate-without-write handling.

## Safety invariants

- Original source values are never overwritten by normalized values.
- Unknown clinical dates remain unknown.
- Extraction output cannot bypass human review.
- Comparator, qualitative, narrative, absent, uncertain, incompatible, and superseded results are not converted into misleading numeric trend points.
- Exact duplicates create no second clinical graph.
- Corrections create new versions; prior reports and observations remain source-reviewable.
- Invalid graphs and unresolved blocking conflicts write nothing.

## Validation evidence

The acceptance run must include:

- Python OpenMed bridge and evaluation tests;
- TypeScript type-check;
- all Vitest suites, including diagnostic conflict and workspace contracts;
- production Vite build.

Bundle-size, dependency-maintenance, mixed-import, and runtime stylesheet warnings remain separate performance/dependency workstreams and do not weaken the clinical correctness boundary above.
''',
)

print("Phase 4 Slice 4 patch applied successfully.")
