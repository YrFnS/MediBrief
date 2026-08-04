import { v4 as uuidv4 } from 'uuid';
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
        kind = 'possible-duplicate';
        score = 85;
        blocking = false;
        recommendedDecision = 'distinct';
        evidence.push(
            'No shared source document or accession identifier was found, so identical same-day content remains advisory.',
        );
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
