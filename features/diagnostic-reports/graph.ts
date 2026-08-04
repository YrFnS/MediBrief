import { v4 as uuidv4 } from 'uuid';
import {
    createUnknownClinicalDate,
    parseClinicalRecordResource,
    parsePatientClinicalRecord,
} from '../clinical-record';
import type {
    ClinicalAmendment,
    ClinicalDate,
    ClinicalPeriod,
    ClinicalProvenance,
    ClinicalRecordResource,
    DiagnosticReportRecord,
    ObservationRecord,
    ObservationValue,
    PatientClinicalRecord,
    RecordSource,
    SourceDocumentReference,
    SpecimenRecord,
} from '../clinical-record';
import { parseDiagnosticReportDraft } from './schemas';
import type {
    DiagnosticReportCandidateGraph,
    DiagnosticReportDraft,
    DiagnosticReportGraphIssue,
    DiagnosticReportGraphReviewInput,
    DiagnosticReportGraphSummary,
    DiagnosticReferenceRangeDraft,
    DiagnosticResultDraft,
    DiagnosticResultValueDraft,
    DiagnosticSpecimenDraft,
} from './types';

export const DIAGNOSTIC_REPORT_GRAPH_TAG_PREFIX =
    'diagnostic-report-graph:';

const INTAKE_EXTERNAL_SYSTEM = 'medibrief:diagnostic-report-intake-v1';

const stableHash = (value: string): string => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
};

export const diagnosticReportGraphId = (
    patientId: string,
    documentId: string,
    draftId: string,
): string => `drg-${stableHash(`${patientId}|${documentId}|${draftId}`)}`;

export const diagnosticReportGraphTag = (graphId: string): string =>
    `${DIAGNOSTIC_REPORT_GRAPH_TAG_PREFIX}${graphId}`;

const graphIdFromTags = (tags?: string[]): string | undefined =>
    tags?.find(tag => tag.startsWith(DIAGNOSTIC_REPORT_GRAPH_TAG_PREFIX))
        ?.slice(DIAGNOSTIC_REPORT_GRAPH_TAG_PREFIX.length);

const resourceId = (
    kind: 'report' | 'observation' | 'specimen',
    graphId: string,
    localId: string,
): string => `${kind}-${stableHash(`${graphId}|${localId}`)}`;

const defaultSourceReference = (
    draft: DiagnosticReportDraft,
): SourceDocumentReference => ({
    documentId: draft.documentId,
    ...(draft.fileName ? { fileName: draft.fileName } : {}),
});

const sourceReference = (
    draft: DiagnosticReportDraft,
    source?: SourceDocumentReference,
): SourceDocumentReference => source
    || draft.reportSource
    || defaultSourceReference(draft);

const recordSource = ({
    draft,
    graphId,
    scope,
    source,
}: {
    draft: DiagnosticReportDraft;
    graphId: string;
    scope: string;
    source?: SourceDocumentReference;
}): RecordSource => ({
    kind: draft.extraction ? 'document-extraction' : 'manual',
    document: sourceReference(draft, source),
    externalSystem: INTAKE_EXTERNAL_SYSTEM,
    externalId: `${graphId}:${scope}`,
    description: draft.extraction
        ? 'Candidate created from a report-level document extraction draft.'
        : 'Candidate transcribed by the user from a local diagnostic report.',
});

const provenanceFor = ({
    draft,
    graphId,
    scope,
    source,
    now,
}: {
    draft: DiagnosticReportDraft;
    graphId: string;
    scope: string;
    source?: SourceDocumentReference;
    now: string;
}): ClinicalProvenance => ({
    source: recordSource({ draft, graphId, scope, source }),
    createdAt: now,
    updatedAt: now,
    ...(draft.extraction
        ? {
            extraction: {
                engine: draft.extraction.engine,
                ...(draft.extraction.model
                    ? { model: draft.extraction.model }
                    : {}),
                ...(draft.extraction.engineVersion
                    ? { engineVersion: draft.extraction.engineVersion }
                    : {}),
                ...(draft.extraction.confidence !== undefined
                    ? { confidence: draft.extraction.confidence }
                    : {}),
                extractedAt: draft.extraction.extractedAt,
            },
        }
        : { createdBy: 'USER' }),
});

const commonTags = (graphId: string): string[] => [
    diagnosticReportGraphTag(graphId),
    'diagnostic-report-intake',
    'needs-review',
];

const mappedValue = (value: DiagnosticResultValueDraft): ObservationValue => {
    switch (value.type) {
        case 'quantity':
            return {
                type: 'quantity',
                quantity: {
                    original: {
                        value: value.value,
                        ...(value.unit ? { unit: value.unit } : {}),
                        ...(value.comparator
                            ? { comparator: value.comparator }
                            : {}),
                    },
                    ...(value.normalized
                        ? { normalized: value.normalized }
                        : {}),
                    ...(value.normalizationWarning
                        ? { normalizationWarning: value.normalizationWarning }
                        : {}),
                },
            };
        case 'string':
            return { type: 'string', text: value.text };
        case 'boolean':
            return { type: 'boolean', value: value.value };
        case 'integer':
            return { type: 'integer', value: value.value };
        case 'codeable-concept':
            return { type: 'codeable-concept', concept: value.concept };
    }
};

const resultSourceText = (value: DiagnosticResultValueDraft): string => {
    switch (value.type) {
        case 'quantity': return value.rawText;
        case 'string': return value.text;
        case 'boolean': return value.sourceText || String(value.value);
        case 'integer': return value.sourceText || String(value.value);
        case 'codeable-concept': return value.sourceText || value.concept.text;
    }
};

const rangeSourceText = (
    ranges: DiagnosticReferenceRangeDraft[],
): string[] => ranges
    .map(range => range.sourceText || range.text)
    .filter((value): value is string => Boolean(value));

const combinedNote = (
    result: DiagnosticResultDraft,
): string | undefined => {
    const lines = [
        result.note?.trim(),
        `Original source result: ${resultSourceText(result.value)}`,
        ...rangeSourceText(result.referenceRanges)
            .map(value => `Reference range source: ${value}`),
    ].filter((value): value is string => Boolean(value));
    return lines.length > 0 ? lines.join('\n') : undefined;
};

const mappedRanges = (
    ranges: DiagnosticReferenceRangeDraft[],
): ObservationRecord['referenceRanges'] => ranges.map(range => ({
    ...(range.low ? { low: range.low } : {}),
    ...(range.high ? { high: range.high } : {}),
    ...(range.text ? { text: range.text } : {}),
    ...(range.appliesTo ? { appliesTo: range.appliesTo } : {}),
}));

const effectiveOrUnknown = (
    effective: ClinicalDate | ClinicalPeriod | undefined,
    reason: string,
): ClinicalDate | ClinicalPeriod => effective
    || createUnknownClinicalDate(reason);

const specimenRecord = ({
    draft,
    specimen,
    graphId,
    now,
}: {
    draft: DiagnosticReportDraft;
    specimen: DiagnosticSpecimenDraft;
    graphId: string;
    now: string;
}): SpecimenRecord => parseClinicalRecordResource({
    id: resourceId('specimen', graphId, specimen.localId),
    patientId: draft.patientId,
    resourceType: 'Specimen',
    verificationStatus: 'candidate',
    recordedAt: now,
    effective: effectiveOrUnknown(
        specimen.collectedAt,
        'The specimen collection date is unknown.',
    ),
    provenance: provenanceFor({
        draft,
        graphId,
        scope: `specimen:${specimen.localId}`,
        source: specimen.source,
        now,
    }),
    amendments: [],
    tags: commonTags(graphId),
    status: specimen.status,
    ...(specimen.type ? { type: specimen.type } : {}),
    ...(specimen.collectedAt ? { collectedAt: specimen.collectedAt } : {}),
    ...(specimen.receivedAt ? { receivedAt: specimen.receivedAt } : {}),
    ...(specimen.bodySite ? { bodySite: specimen.bodySite } : {}),
    ...(specimen.collectionMethod
        ? { collectionMethod: specimen.collectionMethod }
        : {}),
    ...(specimen.note ? { note: specimen.note } : {}),
}) as SpecimenRecord;

const observationRecord = ({
    draft,
    result,
    graphId,
    reportId,
    specimenIds,
    now,
}: {
    draft: DiagnosticReportDraft;
    result: DiagnosticResultDraft;
    graphId: string;
    reportId: string;
    specimenIds: Map<string, string>;
    now: string;
}): ObservationRecord => parseClinicalRecordResource({
    id: resourceId('observation', graphId, result.localId),
    patientId: draft.patientId,
    resourceType: 'Observation',
    verificationStatus: 'candidate',
    recordedAt: now,
    effective: effectiveOrUnknown(
        result.effective,
        'The result clinical date is unknown.',
    ),
    assertion: {
        polarity: 'unknown',
        certainty: 'unknown',
        temporality: 'unknown',
        experiencer: 'unknown',
    },
    provenance: provenanceFor({
        draft,
        graphId,
        scope: `result:${result.localId}`,
        source: result.source,
        now,
    }),
    amendments: [],
    tags: commonTags(graphId),
    status: result.status,
    ...(result.category ? { category: result.category } : {}),
    code: result.code,
    value: mappedValue(result.value),
    ...(result.interpretation
        ? { interpretation: result.interpretation }
        : {}),
    referenceRanges: mappedRanges(result.referenceRanges),
    ...(result.specimenLocalId
        ? { specimenId: specimenIds.get(result.specimenLocalId) }
        : {}),
    ...(draft.encounterId ? { encounterId: draft.encounterId } : {}),
    diagnosticReportId: reportId,
    ...(result.issuedAt ? { issuedAt: result.issuedAt } : {}),
    ...(result.performer ? { performer: result.performer } : {}),
    ...(combinedNote(result) ? { note: combinedNote(result) } : {}),
}) as ObservationRecord;

export const buildDiagnosticReportCandidateGraph = (
    input: DiagnosticReportDraft,
    now: string = new Date().toISOString(),
): DiagnosticReportCandidateGraph => {
    const draft = parseDiagnosticReportDraft(input);
    const graphId = diagnosticReportGraphId(
        draft.patientId,
        draft.documentId,
        draft.draftId,
    );
    const reportId = resourceId('report', graphId, draft.draftId);
    const specimens = draft.specimens.map(specimen => specimenRecord({
        draft,
        specimen,
        graphId,
        now,
    }));
    const specimenIds = new Map(
        draft.specimens.map((specimen, index) => [
            specimen.localId,
            specimens[index].id,
        ]),
    );
    const observations = draft.results.map(result => observationRecord({
        draft,
        result,
        graphId,
        reportId,
        specimenIds,
        now,
    }));

    const report = parseClinicalRecordResource({
        id: reportId,
        patientId: draft.patientId,
        resourceType: 'DiagnosticReport',
        verificationStatus: 'candidate',
        recordedAt: now,
        effective: effectiveOrUnknown(
            draft.effectivePeriod,
            'The diagnostic report clinical period is unknown.',
        ),
        provenance: provenanceFor({
            draft,
            graphId,
            scope: 'report',
            source: draft.reportSource,
            now,
        }),
        amendments: [],
        tags: commonTags(graphId),
        status: draft.status,
        code: draft.code,
        ...(draft.category ? { category: draft.category } : {}),
        ...(draft.effectivePeriod
            ? { effectivePeriod: draft.effectivePeriod }
            : {}),
        ...(draft.issuedAt ? { issuedAt: draft.issuedAt } : {}),
        resultIds: observations.map(observation => observation.id),
        specimenIds: specimens.map(specimen => specimen.id),
        documentIds: [draft.documentId],
        ...(draft.conclusion ? { conclusion: draft.conclusion } : {}),
        ...(draft.conclusionCodes
            ? { conclusionCodes: draft.conclusionCodes }
            : {}),
        ...(draft.encounterId ? { encounterId: draft.encounterId } : {}),
        ...(draft.performer ? { performer: draft.performer } : {}),
    }) as DiagnosticReportRecord;

    return {
        graphId,
        draftId: draft.draftId,
        patientId: draft.patientId,
        documentId: draft.documentId,
        report,
        observations,
        specimens,
    };
};

const allResources = (
    graph: DiagnosticReportCandidateGraph,
): ClinicalRecordResource[] => [
    graph.report,
    ...graph.observations,
    ...graph.specimens,
];

const resourceMap = (record: PatientClinicalRecord): Map<string, ClinicalRecordResource> =>
    new Map<ClinicalRecordResource['id'], ClinicalRecordResource>([
        [record.profile.id, record.profile],
        ...record.resources.encounters.map(resource => [resource.id, resource] as const),
        ...record.resources.conditions.map(resource => [resource.id, resource] as const),
        ...record.resources.allergies.map(resource => [resource.id, resource] as const),
        ...record.resources.medications.map(resource => [resource.id, resource] as const),
        ...record.resources.observations.map(resource => [resource.id, resource] as const),
        ...record.resources.diagnosticReports.map(resource => [resource.id, resource] as const),
        ...record.resources.specimens.map(resource => [resource.id, resource] as const),
        ...record.resources.procedures.map(resource => [resource.id, resource] as const),
        ...record.resources.immunizations.map(resource => [resource.id, resource] as const),
        ...record.resources.appointments.map(resource => [resource.id, resource] as const),
        ...record.resources.tasks.map(resource => [resource.id, resource] as const),
        ...record.resources.carePlans.map(resource => [resource.id, resource] as const),
        ...record.resources.documents.map(resource => [resource.id, resource] as const),
        ...record.resources.notes.map(resource => [resource.id, resource] as const),
    ]);

export const validateDiagnosticReportCandidateGraph = (
    record: PatientClinicalRecord,
    graph: DiagnosticReportCandidateGraph,
    options: { allowExistingGraph?: boolean } = {},
): DiagnosticReportGraphIssue[] => {
    const issues: DiagnosticReportGraphIssue[] = [];
    if (record.patientId !== graph.patientId) {
        issues.push({
            path: 'patientId',
            message: 'Report graph patient does not match the target record.',
        });
    }

    const graphTag = diagnosticReportGraphTag(graph.graphId);
    const graphResources = allResources(graph);
    const ids = graphResources.map(resource => resource.id);
    if (new Set(ids).size !== ids.length) {
        issues.push({
            path: 'resources',
            message: 'Report graph resource IDs must be unique.',
        });
    }

    graphResources.forEach((resource, index) => {
        if (resource.patientId !== graph.patientId) {
            issues.push({
                path: `resources.${index}.patientId`,
                message: 'Every graph resource must belong to the same patient.',
            });
        }
        if (resource.verificationStatus !== 'candidate') {
            issues.push({
                path: `resources.${index}.verificationStatus`,
                message: 'A new or edited report graph must contain candidates only.',
            });
        }
        if (!resource.tags?.includes(graphTag)) {
            issues.push({
                path: `resources.${index}.tags`,
                message: 'Every graph resource must carry the report graph tag.',
            });
        }
        if (
            resource.provenance.source.document?.documentId
            !== graph.documentId
        ) {
            issues.push({
                path: `resources.${index}.provenance.source.document`,
                message: 'Every graph resource must retain the report source document.',
            });
        }
    });

    const observationIds = graph.observations.map(resource => resource.id);
    const specimenIds = graph.specimens.map(resource => resource.id);
    if (JSON.stringify(graph.report.resultIds) !== JSON.stringify(observationIds)) {
        issues.push({
            path: 'report.resultIds',
            message: 'Report result IDs must match the graph observations in order.',
        });
    }
    if (JSON.stringify(graph.report.specimenIds) !== JSON.stringify(specimenIds)) {
        issues.push({
            path: 'report.specimenIds',
            message: 'Report specimen IDs must match the graph specimens in order.',
        });
    }
    if (!graph.report.documentIds.includes(graph.documentId)) {
        issues.push({
            path: 'report.documentIds',
            message: 'The report must link to its source document.',
        });
    }

    const specimenSet = new Set(specimenIds);
    graph.observations.forEach((observation, index) => {
        if (observation.diagnosticReportId !== graph.report.id) {
            issues.push({
                path: `observations.${index}.diagnosticReportId`,
                message: 'Observation must link to the graph report.',
            });
        }
        if (observation.specimenId && !specimenSet.has(observation.specimenId)) {
            issues.push({
                path: `observations.${index}.specimenId`,
                message: 'Observation links to a specimen outside the graph.',
            });
        }
    });

    const document = record.resources.documents.find(resource =>
        resource.id === graph.documentId,
    );
    if (!document || document.verificationStatus !== 'confirmed') {
        issues.push({
            path: 'documentId',
            message: 'The report source document must exist as a confirmed local document.',
        });
    }

    if (graph.report.encounterId) {
        const encounter = record.resources.encounters.find(resource =>
            resource.id === graph.report.encounterId
            && resource.verificationStatus === 'confirmed',
        );
        if (!encounter) {
            issues.push({
                path: 'report.encounterId',
                message: 'Linked encounter must exist as a confirmed patient record.',
            });
        }
    }

    const existing = resourceMap(record);
    graphResources.forEach((resource, index) => {
        const current = existing.get(resource.id);
        if (!current) return;
        const belongsToGraph = current.tags?.includes(graphTag);
        if (!options.allowExistingGraph || !belongsToGraph) {
            issues.push({
                path: `resources.${index}.id`,
                message: 'A graph resource ID conflicts with an existing clinical resource.',
            });
        }
    });

    return issues;
};

const appendGraph = (
    record: PatientClinicalRecord,
    graph: DiagnosticReportCandidateGraph,
    now: string,
): PatientClinicalRecord => parsePatientClinicalRecord({
    ...record,
    resources: {
        ...record.resources,
        observations: [...record.resources.observations, ...graph.observations],
        diagnosticReports: [
            ...record.resources.diagnosticReports,
            graph.report,
        ],
        specimens: [...record.resources.specimens, ...graph.specimens],
    },
    updatedAt: now,
});

const replaceGraph = (
    record: PatientClinicalRecord,
    graph: DiagnosticReportCandidateGraph,
    now: string,
): PatientClinicalRecord => {
    const tag = diagnosticReportGraphTag(graph.graphId);
    const removeGraph = <T extends ClinicalRecordResource>(resources: T[]): T[] =>
        resources.filter(resource => !resource.tags?.includes(tag));
    return parsePatientClinicalRecord({
        ...record,
        resources: {
            ...record.resources,
            observations: [
                ...removeGraph(record.resources.observations),
                ...graph.observations,
            ],
            diagnosticReports: [
                ...removeGraph(record.resources.diagnosticReports),
                graph.report,
            ],
            specimens: [
                ...removeGraph(record.resources.specimens),
                ...graph.specimens,
            ],
        },
        updatedAt: now,
    });
};

export const insertDiagnosticReportCandidateGraph = (
    record: PatientClinicalRecord,
    graph: DiagnosticReportCandidateGraph,
    now: string = new Date().toISOString(),
): {
    record?: PatientClinicalRecord;
    duplicate: boolean;
    issues: DiagnosticReportGraphIssue[];
} => {
    const existing = findDiagnosticReportGraph(record, graph.graphId);
    if (existing) return { duplicate: true, issues: [] };
    const issues = validateDiagnosticReportCandidateGraph(record, graph);
    if (issues.length > 0) return { duplicate: false, issues };
    return {
        record: appendGraph(record, graph, now),
        duplicate: false,
        issues: [],
    };
};

export const updateDiagnosticReportCandidateGraph = (
    record: PatientClinicalRecord,
    graph: DiagnosticReportCandidateGraph,
    now: string = new Date().toISOString(),
): {
    record?: PatientClinicalRecord;
    issues: DiagnosticReportGraphIssue[];
} => {
    const existing = findDiagnosticReportGraph(record, graph.graphId);
    if (!existing) {
        return {
            issues: [{
                path: 'graphId',
                message: 'The report graph does not exist.',
            }],
        };
    }
    const existingResources = [
        existing.report,
        ...existing.observations,
        ...existing.specimens,
    ];
    if (existingResources.some(resource =>
        resource.verificationStatus !== 'candidate')) {
        return {
            issues: [{
                path: 'verificationStatus',
                message: 'Only an entirely candidate report graph can be edited.',
            }],
        };
    }
    const issues = validateDiagnosticReportCandidateGraph(record, graph, {
        allowExistingGraph: true,
    });
    if (issues.length > 0) return { issues };
    return { record: replaceGraph(record, graph, now), issues: [] };
};

const transitionResource = <T extends ClinicalRecordResource>(
    resource: T,
    target: 'confirmed' | 'rejected',
    review: DiagnosticReportGraphReviewInput,
    reviewedAt: string,
): T => {
    const reason = review.reason?.trim();
    const amendment: ClinicalAmendment = {
        id: uuidv4(),
        amendedAt: reviewedAt,
        ...(review.reviewedBy ? { amendedBy: review.reviewedBy } : {}),
        ...(reason ? { reason } : {}),
        changedFields: ['verificationStatus'],
        previousValues: {
            verificationStatus: resource.verificationStatus,
        },
    };
    const baseProvenance = {
        ...resource.provenance,
        updatedAt: reviewedAt,
        ...(review.reviewedBy
            ? { updatedBy: review.reviewedBy }
            : {}),
    };
    const reviewMetadata = {
        reviewedAt,
        ...(review.reviewedBy ? { reviewedBy: review.reviewedBy } : {}),
        ...(reason ? { reason } : {}),
    };
    const provenance = target === 'confirmed'
        ? (() => {
            const { rejection: _rejection, ...withoutRejection } = baseProvenance;
            return { ...withoutRejection, confirmation: reviewMetadata };
        })()
        : (() => {
            const { confirmation: _confirmation, ...withoutConfirmation } = baseProvenance;
            return { ...withoutConfirmation, rejection: reviewMetadata };
        })();

    return parseClinicalRecordResource({
        ...resource,
        verificationStatus: target,
        provenance,
        amendments: [...resource.amendments, amendment],
        tags: resource.tags?.filter(tag => tag !== 'needs-review'),
    }) as T;
};

const transitionGraph = (
    record: PatientClinicalRecord,
    graphId: string,
    target: 'confirmed' | 'rejected',
    review: DiagnosticReportGraphReviewInput,
): {
    record?: PatientClinicalRecord;
    unchanged: boolean;
    issues: DiagnosticReportGraphIssue[];
} => {
    const graph = findDiagnosticReportGraph(record, graphId);
    if (!graph) {
        return {
            unchanged: false,
            issues: [{ path: 'graphId', message: 'Report graph was not found.' }],
        };
    }
    if (target === 'rejected' && !review.reason?.trim()) {
        return {
            unchanged: false,
            issues: [{
                path: 'reason',
                message: 'A report-level rejection reason is required.',
            }],
        };
    }

    const resources = [graph.report, ...graph.observations, ...graph.specimens];
    if (resources.every(resource => resource.verificationStatus === target)) {
        return { record, unchanged: true, issues: [] };
    }
    if (resources.some(resource => resource.verificationStatus !== 'candidate')) {
        return {
            unchanged: false,
            issues: [{
                path: 'verificationStatus',
                message: 'The report graph has a mixed review state and cannot transition atomically.',
            }],
        };
    }

    const reviewedAt = review.reviewedAt || new Date().toISOString();
    const transitionedReport = transitionResource(
        graph.report,
        target,
        review,
        reviewedAt,
    ) as DiagnosticReportRecord;
    const transitionedObservations = graph.observations.map(resource =>
        transitionResource(resource, target, review, reviewedAt)) as ObservationRecord[];
    const transitionedSpecimens = graph.specimens.map(resource =>
        transitionResource(resource, target, review, reviewedAt)) as SpecimenRecord[];
    const reportIds = new Set([transitionedReport.id]);
    const observationIds = new Set(
        transitionedObservations.map(resource => resource.id),
    );
    const specimenIds = new Set(
        transitionedSpecimens.map(resource => resource.id),
    );

    const next = parsePatientClinicalRecord({
        ...record,
        resources: {
            ...record.resources,
            diagnosticReports: record.resources.diagnosticReports.map(resource =>
                reportIds.has(resource.id) ? transitionedReport : resource,
            ),
            observations: record.resources.observations.map(resource => {
                const index = transitionedObservations.findIndex(item =>
                    item.id === resource.id);
                return observationIds.has(resource.id)
                    ? transitionedObservations[index]
                    : resource;
            }),
            specimens: record.resources.specimens.map(resource => {
                const index = transitionedSpecimens.findIndex(item =>
                    item.id === resource.id);
                return specimenIds.has(resource.id)
                    ? transitionedSpecimens[index]
                    : resource;
            }),
        },
        updatedAt: reviewedAt,
    });

    return { record: next, unchanged: false, issues: [] };
};

export const confirmDiagnosticReportGraph = (
    record: PatientClinicalRecord,
    graphId: string,
    review: DiagnosticReportGraphReviewInput = {},
) => transitionGraph(record, graphId, 'confirmed', review);

export const rejectDiagnosticReportGraph = (
    record: PatientClinicalRecord,
    graphId: string,
    review: DiagnosticReportGraphReviewInput,
) => transitionGraph(record, graphId, 'rejected', review);

export const findDiagnosticReportGraph = (
    record: PatientClinicalRecord,
    graphId: string,
): DiagnosticReportGraphSummary | undefined => {
    const tag = diagnosticReportGraphTag(graphId);
    const report = record.resources.diagnosticReports.find(resource =>
        resource.tags?.includes(tag));
    if (!report) return undefined;
    const observationById = new Map(
        record.resources.observations.map(resource => [resource.id, resource]),
    );
    const specimenById = new Map(
        record.resources.specimens.map(resource => [resource.id, resource]),
    );
    return {
        graphId,
        draftId: report.provenance.source.externalId?.split(':').at(-1)
            || graphId,
        report,
        observations: report.resultIds
            .map(id => observationById.get(id))
            .filter((resource): resource is ObservationRecord => Boolean(resource)),
        specimens: report.specimenIds
            .map(id => specimenById.get(id))
            .filter((resource): resource is SpecimenRecord => Boolean(resource)),
        source: report.provenance.source.document,
    };
};

export const listDiagnosticReportGraphs = (
    record: PatientClinicalRecord,
    verificationStatus?: ClinicalRecordResource['verificationStatus'],
): DiagnosticReportGraphSummary[] => record.resources.diagnosticReports
    .filter(report => verificationStatus === undefined
        || report.verificationStatus === verificationStatus)
    .map(report => graphIdFromTags(report.tags))
    .filter((graphId): graphId is string => Boolean(graphId))
    .map(graphId => findDiagnosticReportGraph(record, graphId))
    .filter((graph): graph is DiagnosticReportGraphSummary => Boolean(graph));
