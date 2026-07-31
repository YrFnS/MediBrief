import { v4 as uuidv4 } from 'uuid';
import {
    createUnknownClinicalDate,
    parseClinicalRecordResource,
    parsePatientClinicalRecord,
    type ClinicalAmendment,
    type ClinicalCodeableConcept,
    type ClinicalRecordResource,
    type DiagnosticReportRecord,
    type DocumentReferenceRecord,
    type ObservationRecord,
    type PatientClinicalRecord,
    type RecordSource,
    type SourceDocumentReference,
    type SpecimenRecord,
    useClinicalRecordStore,
} from '../clinical-record';
import { parseReviewedDiagnosticReportDraft } from './schemas';
import type {
    DiagnosticBundleCommitResult,
    DiagnosticGraphValidationIssue,
    DiagnosticGraphValidationResult,
    DiagnosticParsingWarning,
    DiagnosticReportBundle,
    ReviewedDiagnosticIdentifier,
    ReviewedDiagnosticReportDraft,
    ReviewedDiagnosticSource,
} from './types';
import {
    diagnosticInterpretationConcept,
    observationStatusForReport,
    parseDiagnosticClinicalDate,
    parseDiagnosticIssuedAt,
    parseDiagnosticObservationValue,
    parseDiagnosticReferenceRange,
} from './valueParsing';

const REPORT_SOURCE_SYSTEM = 'medibrief:reviewed-diagnostic-report';
const LOINC_SYSTEM = 'http://loinc.org';

export interface BuildDiagnosticReportBundleOptions {
    now?: string;
    actor?: string;
    idFactory?: (resourceType: string, localId: string) => string;
}

const defaultIdFactory = (): string => uuidv4();
const clean = (value?: string | null): string => (value || '').trim();
const normalize = (value?: string | null): string => clean(value)
    .toLowerCase()
    .replace(/\s+/g, ' ');

const uniqueStrings = (values: Array<string | undefined>): string[] => [
    ...new Set(values.map(value => clean(value)).filter(Boolean)),
];

const concepts = (
    values: string[] | undefined,
    fallback?: string,
): ClinicalCodeableConcept[] => {
    const texts = uniqueStrings([...(values || []), fallback]);
    return texts.map(text => ({ text }));
};

const identifierText = (
    identifier: ReviewedDiagnosticIdentifier,
): string => [
    identifier.type,
    identifier.system,
    identifier.value,
].filter(Boolean).join(': ');

const sourceDocument = (
    reportSource: ReviewedDiagnosticSource,
    override?: Partial<Omit<ReviewedDiagnosticSource, 'documentId'>>,
): SourceDocumentReference => ({
    documentId: reportSource.documentId,
    ...(override?.fileName || reportSource.fileName
        ? { fileName: override?.fileName || reportSource.fileName }
        : {}),
    ...(override?.pageNumber || reportSource.pageNumber
        ? { pageNumber: override?.pageNumber || reportSource.pageNumber }
        : {}),
    ...(override?.section || reportSource.section
        ? { section: override?.section || reportSource.section }
        : {}),
    ...(override?.startOffset !== undefined
        || reportSource.startOffset !== undefined
        ? {
            startOffset: override?.startOffset
                ?? reportSource.startOffset,
        }
        : {}),
    ...(override?.endOffset !== undefined
        || reportSource.endOffset !== undefined
        ? {
            endOffset: override?.endOffset
                ?? reportSource.endOffset,
        }
        : {}),
    ...(override?.excerpt || reportSource.excerpt
        ? { excerpt: override?.excerpt || reportSource.excerpt }
        : {}),
});

const reviewedSource = ({
    draft,
    document,
    description,
}: {
    draft: ReviewedDiagnosticReportDraft;
    document: SourceDocumentReference;
    description: string;
}): RecordSource => ({
    kind: 'document-extraction',
    document,
    externalSystem: REPORT_SOURCE_SYSTEM,
    externalId: draft.accessionIdentifier?.value
        || draft.identifiers?.[0]?.value
        || `${document.documentId}:${normalize(draft.reportTitle)}`,
    description,
});

const provenance = ({
    source,
    verificationStatus,
    now,
    actor,
    reviewedAt,
}: {
    source: RecordSource;
    verificationStatus: 'candidate' | 'confirmed';
    now: string;
    actor?: string;
    reviewedAt?: string;
}) => ({
    source,
    createdAt: now,
    updatedAt: reviewedAt || now,
    ...(actor ? { createdBy: actor, updatedBy: actor } : {}),
    ...(verificationStatus === 'confirmed'
        ? {
            confirmation: {
                reviewedAt: reviewedAt || now,
                ...(actor ? { reviewedBy: actor } : {}),
                reason:
                    'The report metadata and included result rows were explicitly reviewed before saving.',
            },
        }
        : {}),
});

const warningForResult = (
    warnings: DiagnosticParsingWarning[],
    resultLocalId: string,
): DiagnosticParsingWarning[] => warnings.map(warning => ({
    ...warning,
    resultLocalId,
}));

const warningForSpecimen = (
    warnings: DiagnosticParsingWarning[],
    specimenLocalId: string,
): DiagnosticParsingWarning[] => warnings.map(warning => ({
    ...warning,
    specimenLocalId,
}));

const noteLines = (values: Array<string | undefined>): string | undefined => {
    const lines = uniqueStrings(values);
    return lines.length > 0 ? lines.join('\n') : undefined;
};

const reportIdentityDescription = (
    draft: ReviewedDiagnosticReportDraft,
): string => {
    const identifiers = [
        ...(draft.accessionIdentifier
            ? [`Accession: ${identifierText(draft.accessionIdentifier)}`]
            : []),
        ...((draft.identifiers || []).map(identifier =>
            `Identifier: ${identifierText(identifier)}`)),
    ];
    return [
        `Reviewed diagnostic report: ${draft.reportTitle}`,
        ...identifiers,
    ].join(' · ');
};

export const buildDiagnosticReportBundle = (
    input: ReviewedDiagnosticReportDraft,
    options: BuildDiagnosticReportBundleOptions = {},
): DiagnosticReportBundle => {
    const draft = parseReviewedDiagnosticReportDraft(input);
    const now = options.now || new Date().toISOString();
    const actor = options.actor || draft.reviewedBy;
    const reviewedAt = draft.reviewedAt || now;
    const verificationStatus = draft.verificationStatus || 'candidate';
    const makeId = options.idFactory || defaultIdFactory;
    const reportId = makeId('DiagnosticReport', 'report');
    const warnings: DiagnosticParsingWarning[] = [];

    const reportDate = parseDiagnosticClinicalDate(
        draft.effectiveDate,
        'effectiveDate',
    );
    warnings.push(...reportDate.warnings);
    const reportIssued = parseDiagnosticIssuedAt(draft.issuedAt, 'issuedAt');
    warnings.push(...reportIssued.warnings);

    if (
        draft.accessionIdentifier
        || (draft.identifiers && draft.identifiers.length > 0)
    ) {
        warnings.push({
            code: 'identifier-preserved-in-provenance',
            field: 'identifiers',
            message:
                'Report identifiers were preserved in source provenance because the current core DiagnosticReport contract has no dedicated identifier fields yet.',
        });
    }

    const specimenIds = new Map<string, string>();
    (draft.specimens || []).forEach(specimen => {
        specimenIds.set(
            specimen.localId,
            makeId('Specimen', specimen.localId),
        );
    });

    const reportDocument = sourceDocument(draft.source);
    const reportSource = reviewedSource({
        draft,
        document: reportDocument,
        description: reportIdentityDescription(draft),
    });

    const specimens: SpecimenRecord[] = (draft.specimens || []).map(specimen => {
        const collected = parseDiagnosticClinicalDate(
            specimen.collectedDate,
            'collectedDate',
        );
        const received = parseDiagnosticClinicalDate(
            specimen.receivedDate,
            'receivedDate',
        );
        warnings.push(...warningForSpecimen(
            [...collected.warnings, ...received.warnings],
            specimen.localId,
        ));
        if (specimen.identifiers?.length) {
            warnings.push({
                code: 'identifier-preserved-in-provenance',
                field: 'specimen.identifiers',
                specimenLocalId: specimen.localId,
                message:
                    'Specimen identifiers were preserved in the specimen note because the current core Specimen contract has no dedicated identifier fields yet.',
            });
        }
        const specimenNote = noteLines([
            specimen.note,
            specimen.collector
                ? `Collector: ${specimen.collector}`
                : undefined,
            ...(specimen.identifiers || []).map(identifier =>
                `Identifier: ${identifierText(identifier)}`),
        ]);
        const resource = {
            id: specimenIds.get(specimen.localId)!,
            patientId: draft.patientId,
            resourceType: 'Specimen' as const,
            verificationStatus,
            recordedAt: now,
            effective: collected.date,
            provenance: provenance({
                source: reportSource,
                verificationStatus,
                now,
                actor,
                reviewedAt,
            }),
            amendments: [],
            tags: ['diagnostic-report-specimen', 'reviewed-report-draft'],
            status: specimen.status || 'unknown',
            ...(specimen.typeText
                ? { type: { text: specimen.typeText } }
                : {}),
            collectedAt: collected.date,
            receivedAt: received.date,
            ...(specimen.bodySiteText
                ? { bodySite: { text: specimen.bodySiteText } }
                : {}),
            ...(specimen.collectionMethodText
                ? {
                    collectionMethod: {
                        text: specimen.collectionMethodText,
                    },
                }
                : {}),
            ...(specimenNote ? { note: specimenNote } : {}),
        };
        return parseClinicalRecordResource(resource) as SpecimenRecord;
    });

    const observations: ObservationRecord[] = draft.results.map(result => {
        const value = parseDiagnosticObservationValue({
            valueText: result.valueText,
            unitText: result.unitText,
            absentReasonText: result.absentReasonText,
        });
        const range = parseDiagnosticReferenceRange(
            result.referenceRangeText,
            result.unitText,
        );
        const resultDate = parseDiagnosticClinicalDate(
            result.clinicalDate ?? draft.effectiveDate,
            'clinicalDate',
        );
        const issued = parseDiagnosticIssuedAt(
            result.issuedAt ?? draft.issuedAt,
            'issuedAt',
        );
        const mappedStatus = observationStatusForReport(
            result.status || draft.status || 'unknown',
        );
        const resultWarnings = [
            ...value.warnings,
            ...range.warnings,
            ...resultDate.warnings,
            ...issued.warnings,
            ...(mappedStatus.warning ? [mappedStatus.warning] : []),
        ];
        warnings.push(...warningForResult(resultWarnings, result.localId));

        const specimenId = result.specimenLocalId
            ? specimenIds.get(result.specimenLocalId)
            : undefined;
        if (result.specimenLocalId && !specimenId) {
            warnings.push({
                code: 'unknown-specimen-reference',
                resultLocalId: result.localId,
                specimenLocalId: result.specimenLocalId,
                message:
                    `Result ${result.localId} referenced an unknown specimen and was left unlinked.`,
            });
        }

        const interpretation = diagnosticInterpretationConcept(
            result.interpretationText,
        );
        const resultDocument = sourceDocument(draft.source, result.source);
        const unmodeledDetails = noteLines([
            result.note,
            value.absentReason
                ? `Data absent reason: ${value.absentReason}`
                : undefined,
            result.methodText
                ? `Method: ${result.methodText}`
                : undefined,
            result.bodySiteText
                ? `Body site: ${result.bodySiteText}`
                : undefined,
            issued.warnings.length > 0 && result.issuedAt
                ? `Source issued date-time: ${result.issuedAt}`
                : undefined,
        ]);
        const code: ClinicalCodeableConcept = {
            text: result.testName,
            ...(result.loincCode
                ? {
                    coding: [{
                        system: LOINC_SYSTEM,
                        code: result.loincCode,
                        display: result.testName,
                    }],
                }
                : {}),
        };
        const resource = {
            id: makeId('Observation', result.localId),
            patientId: draft.patientId,
            resourceType: 'Observation' as const,
            verificationStatus,
            recordedAt: now,
            effective: resultDate.date,
            provenance: provenance({
                source: reviewedSource({
                    draft,
                    document: resultDocument,
                    description:
                        `Reviewed result "${result.testName}" from ${draft.reportTitle}.`,
                }),
                verificationStatus,
                now,
                actor,
                reviewedAt,
            }),
            amendments: [],
            tags: [
                'laboratory',
                'diagnostic-report-result',
                'reviewed-report-draft',
                ...(value.kind === 'absent' ? ['data-absent'] : []),
            ],
            status: mappedStatus.status,
            category: concepts(result.categoryTexts, 'Laboratory'),
            code,
            ...(value.value ? { value: value.value } : {}),
            ...(interpretation ? { interpretation: [interpretation] } : {}),
            referenceRanges: range.ranges,
            ...(specimenId ? { specimenId } : {}),
            diagnosticReportId: reportId,
            ...(issued.value ? { issuedAt: issued.value } : {}),
            performer: uniqueStrings([
                ...(result.performer || []),
                ...(draft.performer || []),
            ]),
            ...(unmodeledDetails ? { note: unmodeledDetails } : {}),
        };
        return parseClinicalRecordResource(resource) as ObservationRecord;
    });

    const report: DiagnosticReportRecord = parseClinicalRecordResource({
        id: reportId,
        patientId: draft.patientId,
        resourceType: 'DiagnosticReport',
        verificationStatus,
        recordedAt: now,
        effective: reportDate.date,
        provenance: provenance({
            source: reportSource,
            verificationStatus,
            now,
            actor,
            reviewedAt,
        }),
        amendments: [],
        tags: [
            'diagnostic-report',
            'reviewed-report-draft',
            ...(draft.accessionIdentifier
                ? [`accession:${draft.accessionIdentifier.value}`]
                : []),
        ],
        status: draft.status || 'unknown',
        code: { text: draft.reportTitle },
        category: concepts(draft.categoryTexts, 'Laboratory'),
        effectivePeriod: {
            start: reportDate.date,
            end: reportDate.date,
        },
        ...(reportIssued.value ? { issuedAt: reportIssued.value } : {}),
        resultIds: observations.map(observation => observation.id),
        specimenIds: specimens.map(specimen => specimen.id),
        documentIds: [draft.source.documentId],
        ...(draft.conclusion ? { conclusion: draft.conclusion } : {}),
        performer: uniqueStrings(draft.performer || []),
    }) as DiagnosticReportRecord;

    return {
        report,
        specimens,
        observations,
        resources: [...specimens, ...observations, report],
        warnings,
    };
};

const sameSet = (left: string[], right: string[]): boolean => {
    if (left.length !== right.length) return false;
    const expected = new Set(left);
    return right.every(value => expected.has(value));
};

const existingResources = (
    record: PatientClinicalRecord,
): ClinicalRecordResource[] => [
    record.profile,
    ...record.resources.encounters,
    ...record.resources.conditions,
    ...record.resources.allergies,
    ...record.resources.medications,
    ...record.resources.observations,
    ...record.resources.diagnosticReports,
    ...record.resources.specimens,
    ...record.resources.procedures,
    ...record.resources.immunizations,
    ...record.resources.appointments,
    ...record.resources.tasks,
    ...record.resources.carePlans,
    ...record.resources.documents,
    ...record.resources.notes,
];

const equivalentReport = (
    record: PatientClinicalRecord,
    report: DiagnosticReportRecord,
): DiagnosticReportRecord | undefined => record.resources.diagnosticReports.find(
    existing => {
        const source = existing.provenance.source;
        const targetSource = report.provenance.source;
        if (
            source.externalSystem === targetSource.externalSystem
            && source.externalId
            && source.externalId === targetSource.externalId
        ) {
            return true;
        }
        return source.document?.documentId
            === targetSource.document?.documentId
            && normalize(existing.code.text) === normalize(report.code.text)
            && JSON.stringify(existing.effective)
                === JSON.stringify(report.effective);
    },
);

export const validateDiagnosticReportBundleGraph = (
    bundle: DiagnosticReportBundle,
    record?: PatientClinicalRecord,
): DiagnosticGraphValidationResult => {
    const issues: DiagnosticGraphValidationIssue[] = [];
    if (bundle.resources.length === 0) {
        issues.push({
            code: 'empty-bundle',
            message: 'The diagnostic bundle contains no resources.',
        });
        return { valid: false, issues };
    }

    const reports = bundle.resources.filter(resource =>
        resource.resourceType === 'DiagnosticReport');
    if (reports.length === 0) {
        issues.push({
            code: 'missing-report',
            message: 'The diagnostic bundle requires one DiagnosticReport.',
        });
    } else if (reports.length > 1) {
        issues.push({
            code: 'multiple-reports',
            message: 'The diagnostic bundle may contain only one DiagnosticReport.',
        });
    }

    const patientIds = new Set(bundle.resources.map(resource => resource.patientId));
    if (patientIds.size !== 1 || !patientIds.has(bundle.report.patientId)) {
        issues.push({
            code: 'patient-mismatch',
            message: 'Every diagnostic resource must belong to the same patient.',
        });
    }

    const ids = bundle.resources.map(resource => resource.id);
    if (new Set(ids).size !== ids.length) {
        issues.push({
            code: 'duplicate-resource-id',
            message: 'Resource IDs inside the diagnostic bundle must be unique.',
        });
    }

    const observationIds = bundle.observations.map(observation => observation.id);
    const specimenIds = bundle.specimens.map(specimen => specimen.id);
    if (!sameSet(bundle.report.resultIds, observationIds)) {
        bundle.report.resultIds.forEach(id => {
            if (!observationIds.includes(id)) {
                issues.push({
                    code: 'missing-result',
                    resourceId: id,
                    message: `The report references missing result ${id}.`,
                });
            }
        });
        observationIds.forEach(id => {
            if (!bundle.report.resultIds.includes(id)) {
                issues.push({
                    code: 'unexpected-result',
                    resourceId: id,
                    message: `Observation ${id} is not included in report.resultIds.`,
                });
            }
        });
    }
    if (!sameSet(bundle.report.specimenIds, specimenIds)) {
        bundle.report.specimenIds.forEach(id => {
            if (!specimenIds.includes(id)) {
                issues.push({
                    code: 'missing-specimen',
                    resourceId: id,
                    message: `The report references missing specimen ${id}.`,
                });
            }
        });
    }

    bundle.observations.forEach(observation => {
        if (observation.diagnosticReportId !== bundle.report.id) {
            issues.push({
                code: 'observation-report-mismatch',
                resourceId: observation.id,
                message:
                    `Observation ${observation.id} does not point back to report ${bundle.report.id}.`,
            });
        }
        if (
            observation.specimenId
            && !specimenIds.includes(observation.specimenId)
        ) {
            issues.push({
                code: 'observation-specimen-mismatch',
                resourceId: observation.id,
                message:
                    `Observation ${observation.id} references specimen ${observation.specimenId}, which is not in the bundle.`,
            });
        }
    });

    if (record) {
        if (record.patientId !== bundle.report.patientId) {
            issues.push({
                code: 'patient-mismatch',
                message: 'The diagnostic bundle patient does not match the target record.',
            });
        }
        const existingIds = new Set(existingResources(record).map(resource =>
            resource.id));
        bundle.resources.forEach(resource => {
            if (existingIds.has(resource.id)) {
                issues.push({
                    code: 'resource-id-conflict',
                    resourceId: resource.id,
                    message:
                        `Resource ID ${resource.id} already exists in the patient record.`,
                });
            }
        });
        const sourceDocumentId = bundle.report.documentIds[0];
        const sourceDocument = record.resources.documents.find(document =>
            document.id === sourceDocumentId);
        if (!sourceDocument) {
            issues.push({
                code: 'missing-source-document',
                resourceId: sourceDocumentId,
                message:
                    `The source document ${sourceDocumentId} is not present in the patient record.`,
            });
        } else if (sourceDocument.patientId !== bundle.report.patientId) {
            issues.push({
                code: 'source-document-patient-mismatch',
                resourceId: sourceDocument.id,
                message: 'The source document belongs to another patient.',
            });
        }
        const duplicate = equivalentReport(record, bundle.report);
        if (duplicate) {
            issues.push({
                code: 'duplicate-report-source',
                resourceId: duplicate.id,
                message:
                    `An equivalent report from the same source already exists as ${duplicate.id}.`,
            });
        }
    }

    return { valid: issues.length === 0, issues };
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
    const next = [
        ...previous,
        {
            resourceType: 'DiagnosticReport' as const,
            id: report.id,
            display: report.code.text,
        },
    ];
    const amendment: ClinicalAmendment = {
        id: uuidv4(),
        amendedAt: now,
        ...(actor ? { amendedBy: actor } : {}),
        reason: 'Linked a reviewed diagnostic report to its source document.',
        changedFields: ['relatedResources'],
        previousValues: { relatedResources: previous },
    };
    return parseClinicalRecordResource({
        ...document,
        relatedResources: next,
        provenance: {
            ...document.provenance,
            updatedAt: now,
            ...(actor ? { updatedBy: actor } : {}),
        },
        amendments: [...document.amendments, amendment],
    }) as DocumentReferenceRecord;
};

export const commitDiagnosticReportBundle = (
    bundle: DiagnosticReportBundle,
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

    const duplicate = equivalentReport(record, bundle.report);
    if (duplicate) {
        return {
            ok: false,
            status: 'duplicate',
            reportId: bundle.report.id,
            createdResourceIds: [],
            duplicateOf: duplicate.id,
            issues: [],
            message:
                'An equivalent report from the same source already exists.',
        };
    }

    const validation = validateDiagnosticReportBundleGraph(bundle, record);
    if (!validation.valid) {
        const conflict = validation.issues.some(issue =>
            issue.code === 'resource-id-conflict');
        return {
            ok: false,
            status: conflict ? 'conflict' : 'invalid-graph',
            reportId: bundle.report.id,
            createdResourceIds: [],
            issues: validation.issues,
            message: 'The diagnostic graph failed validation and was not saved.',
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
                specimens: [
                    ...record.resources.specimens,
                    ...bundle.specimens,
                ],
                observations: [
                    ...record.resources.observations,
                    ...bundle.observations,
                ],
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
            message:
                `Saved one report, ${bundle.observations.length} result(s), and ${bundle.specimens.length} specimen(s) atomically.`,
        };
    } catch (error) {
        return {
            ok: false,
            status: 'invalid-graph',
            reportId: bundle.report.id,
            createdResourceIds: [],
            issues: [{
                code: 'missing-report',
                message: error instanceof Error
                    ? error.message
                    : 'The clinical record rejected the diagnostic graph.',
            }],
            message:
                'The diagnostic graph was rejected before any resource was saved.',
        };
    }
};

export const buildAndCommitDiagnosticReport = (
    draft: ReviewedDiagnosticReportDraft,
    options: BuildDiagnosticReportBundleOptions & {
        committedAt?: string;
    } = {},
): {
    bundle: DiagnosticReportBundle;
    commit: DiagnosticBundleCommitResult;
} => {
    const bundle = buildDiagnosticReportBundle(draft, options);
    return {
        bundle,
        commit: commitDiagnosticReportBundle(bundle, {
            actor: options.actor || draft.reviewedBy,
            committedAt: options.committedAt || options.now,
        }),
    };
};

export const unknownDiagnosticDate = (
    sourceText?: string,
) => createUnknownClinicalDate(sourceText);
