import { v4 as uuidv4 } from 'uuid';
import {
    createClinicalProvenance,
    createRecordSource,
    findDuplicateCandidate,
    flattenPatientResources,
    getResourceCollectionKey,
    parseClinicalRecordResource,
    parsePatientClinicalRecord,
    type ClinicalReference,
    type DocumentReferenceRecord,
    type PatientClinicalRecord,
    type PatientClinicalResource,
} from '../clinical-record';
import {
    ENCRYPTED_SOURCE_STORAGE_PREFIX,
    sha256Hex,
    type EncryptedSourceInput,
} from '../../services/encryptedSourceStorage';
import {
    IPS_CANONICAL_BASE,
    IPS_VERSION,
} from './ipsConstants';
import {
    parseIpsImport,
    type IpsImportPreview,
    type IpsPatientImportPreview,
} from './ipsImport';
import type {
    FhirDocumentBundle,
    FhirR4Resource,
} from './ipsTypes';

export const MAX_PRESERVED_IPS_SOURCE_BYTES = 2 * 1024 * 1024;

const SUPPORTED_CANDIDATE_TYPES = new Set([
    'Condition',
    'AllergyIntolerance',
    'MedicationStatement',
    'MedicationRequest',
    'Procedure',
    'Immunization',
    'Observation',
    'DiagnosticReport',
    'Specimen',
]);

const PATIENT_REFERENCE_FIELD: Record<string, string> = {
    Condition: 'subject',
    AllergyIntolerance: 'patient',
    MedicationStatement: 'subject',
    MedicationRequest: 'subject',
    Procedure: 'subject',
    Immunization: 'patient',
    Observation: 'subject',
    DiagnosticReport: 'subject',
    Specimen: 'subject',
};

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const values = (value: unknown): unknown[] =>
    Array.isArray(value) ? value : [];

const text = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim()
        ? value.trim()
        : undefined;

const deepClone = <T>(value: T): T =>
    JSON.parse(JSON.stringify(value)) as T;

type BundleEntry = FhirDocumentBundle['entry'][number];

interface BundleEntryIndex {
    byFullUrl: Map<string, BundleEntry[]>;
    byTypeId: Map<string, BundleEntry[]>;
}

interface ReferenceResolution {
    entry?: BundleEntry;
    ambiguous?: boolean;
    contained?: boolean;
}

export interface IpsImportSafetyIssue {
    severity: 'error' | 'warning';
    code: string;
    path: string;
    message: string;
}

export interface IpsImportGraphEvidence {
    compositionFullUrl: string;
    patientFullUrl: string;
    reachableEntryCount: number;
    sourceEntryCount: number;
    droppedEntryCount: number;
    droppedSupportedResourceTypes: Record<string, number>;
}

export interface IpsIdentityComparison {
    status: 'matched' | 'mismatch' | 'insufficient';
    matches: string[];
    mismatches: string[];
    notes: string[];
    sourceDisplayName: string;
    targetDisplayName: string;
}

export interface AtomicIpsImportPreview extends IpsImportPreview {
    importId: string;
    targetPatientId: string;
    targetRecordUpdatedAt: string;
    sourceDocumentId: string;
    source?: EncryptedSourceInput;
    graph?: IpsImportGraphEvidence;
    identity?: IpsIdentityComparison;
    safetyIssues: IpsImportSafetyIssue[];
    commitReady: boolean;
}

export interface PrepareAtomicIpsImportOptions {
    input: string | unknown;
    targetRecord: PatientClinicalRecord;
    importedAt?: string;
    fileName?: string;
    mimeType?: string;
}

export interface IpsImportIdentityAcknowledgement {
    confirmed: boolean;
    targetPatientId: string;
    sourceSha256: string;
    acknowledgedAt: string;
}

export type AtomicIpsImportCommitStatus =
    | 'committed'
    | 'duplicate-source'
    | 'invalid-preview'
    | 'identity-not-acknowledged'
    | 'record-changed'
    | 'conflict';

export interface AtomicIpsImportCommitResult {
    ok: boolean;
    status: AtomicIpsImportCommitStatus;
    record?: PatientClinicalRecord;
    sourceDocument?: DocumentReferenceRecord;
    createdCandidates: number;
    duplicateCandidates: number;
    duplicateSourceDocumentId?: string;
    message: string;
}

const createIssue = (
    issues: IpsImportSafetyIssue[],
    severity: IpsImportSafetyIssue['severity'],
    code: string,
    path: string,
    message: string,
): void => {
    issues.push({ severity, code, path, message });
};

const addIndexValue = (
    map: Map<string, BundleEntry[]>,
    key: string | undefined,
    entry: BundleEntry,
): void => {
    if (!key) return;
    map.set(key, [...(map.get(key) || []), entry]);
};

const stripHistory = (value: string): string =>
    value.replace(/\/_history\/[^/?#]+(?=$|[?#])/, '');

const typeIdKey = (
    resourceType: string | undefined,
    id: string | undefined,
): string | undefined =>
    resourceType && id ? `${resourceType}/${id}` : undefined;

const typeIdFromReference = (reference: string): string | undefined => {
    const normalized = stripHistory(reference).replace(/[?#].*$/, '');
    const relative = normalized.match(/^([A-Z][A-Za-z0-9]+)\/([^/]+)$/);
    if (relative) return `${relative[1]}/${relative[2]}`;

    try {
        const parsed = new URL(normalized);
        const segments = parsed.pathname.split('/').filter(Boolean);
        if (segments.length < 2) return undefined;
        return `${segments[segments.length - 2]}/${segments[segments.length - 1]}`;
    } catch {
        return undefined;
    }
};

const buildEntryIndex = (bundle: FhirDocumentBundle): BundleEntryIndex => {
    const index: BundleEntryIndex = {
        byFullUrl: new Map(),
        byTypeId: new Map(),
    };
    bundle.entry.forEach(entry => {
        addIndexValue(index.byFullUrl, entry.fullUrl, entry);
        addIndexValue(
            index.byTypeId,
            typeIdKey(entry.resource.resourceType, entry.resource.id),
            entry,
        );
    });
    return index;
};

const resolveReference = (
    index: BundleEntryIndex,
    reference: string,
): ReferenceResolution => {
    if (reference.startsWith('#')) return { contained: true };

    const matches = new Set<BundleEntry>();
    const exact = index.byFullUrl.get(reference) || [];
    exact.forEach(entry => matches.add(entry));

    const historyStripped = stripHistory(reference);
    if (historyStripped !== reference) {
        (index.byFullUrl.get(historyStripped) || [])
            .forEach(entry => matches.add(entry));
    }

    const typeId = typeIdFromReference(reference);
    if (typeId) {
        (index.byTypeId.get(typeId) || [])
            .forEach(entry => matches.add(entry));
    }

    if (matches.size === 1) {
        return { entry: [...matches][0] };
    }
    if (matches.size > 1) return { ambiguous: true };
    return {};
};

const referenceValue = (value: unknown): string | undefined =>
    isObject(value) ? text(value.reference) : undefined;

const collectReferences = (
    value: unknown,
    path = 'resource',
): Array<{ reference: string; path: string }> => {
    const references: Array<{ reference: string; path: string }> = [];
    const visit = (current: unknown, currentPath: string): void => {
        if (Array.isArray(current)) {
            current.forEach((entry, index) =>
                visit(entry, `${currentPath}[${index}]`));
            return;
        }
        if (!isObject(current)) return;

        if (typeof current.reference === 'string'
            && current.reference.trim()) {
            references.push({
                reference: current.reference.trim(),
                path: `${currentPath}.reference`,
            });
        }
        Object.entries(current).forEach(([key, entry]) => {
            if (key === 'reference') return;
            visit(entry, `${currentPath}.${key}`);
        });
    };
    visit(value, path);
    return references;
};

const patientPreview = (
    resource: FhirR4Resource,
    fullUrl: string,
): IpsPatientImportPreview => {
    const patient = resource as Record<string, unknown>;
    const name = values(patient.name).find(isObject);
    const given = isObject(name)
        ? values(name.given)
            .map(text)
            .filter((item): item is string => Boolean(item))
        : [];
    const displayName = isObject(name)
        ? text(name.text)
            || [...given, text(name.family)].filter(Boolean).join(' ')
            || 'Unnamed IPS patient'
        : 'Unnamed IPS patient';

    return {
        sourceFullUrl: fullUrl,
        displayName,
        ...(text(patient.birthDate)
            ? { birthDate: text(patient.birthDate) }
            : {}),
        ...(text(patient.gender)
            ? { gender: text(patient.gender) }
            : {}),
        identifiers: values(patient.identifier).flatMap(identifier => {
            if (!isObject(identifier) || !text(identifier.value)) return [];
            return [{
                ...(text(identifier.system)
                    ? { system: text(identifier.system) }
                    : {}),
                value: text(identifier.value)!,
            }];
        }),
    };
};

const buildReachableGraph = (
    bundle: FhirDocumentBundle,
    issues: IpsImportSafetyIssue[],
): {
    entries: BundleEntry[];
    composition?: BundleEntry;
    patient?: BundleEntry;
    evidence?: IpsImportGraphEvidence;
} => {
    const index = buildEntryIndex(bundle);
    const composition = bundle.entry[0];
    if (!composition || composition.resource.resourceType !== 'Composition') {
        createIssue(
            issues,
            'error',
            'composition-root',
            'Bundle.entry[0]',
            'A FHIR document import requires the first Bundle entry to be the Composition.',
        );
        return { entries: [] };
    }

    const reached = new Set<string>();
    const queue: BundleEntry[] = [composition];
    while (queue.length > 0) {
        const current = queue.shift()!;
        if (reached.has(current.fullUrl)) continue;
        reached.add(current.fullUrl);

        collectReferences(
            current.resource,
            `${current.resource.resourceType}/${current.resource.id || current.fullUrl}`,
        ).forEach(reference => {
            const resolution = resolveReference(index, reference.reference);
            if (resolution.contained) return;
            if (resolution.ambiguous) {
                createIssue(
                    issues,
                    'error',
                    'ambiguous-reference',
                    reference.path,
                    `Reference ${reference.reference} matches more than one Bundle entry.`,
                );
                return;
            }
            if (!resolution.entry) {
                createIssue(
                    issues,
                    current.resource.resourceType === 'Composition'
                        ? 'error'
                        : 'warning',
                    'unresolved-document-reference',
                    reference.path,
                    `Reference ${reference.reference} could not be resolved inside the received document Bundle.`,
                );
                return;
            }
            if (!reached.has(resolution.entry.fullUrl)) {
                queue.push(resolution.entry);
            }
        });
    }

    const reachedEntries = bundle.entry.filter(entry =>
        reached.has(entry.fullUrl));
    const compositionValue = composition.resource as Record<string, unknown>;
    const subjectReference = referenceValue(compositionValue.subject);
    if (!subjectReference) {
        createIssue(
            issues,
            'error',
            'composition-subject-missing',
            'Composition.subject',
            'The received Composition does not identify its patient subject.',
        );
        return { entries: reachedEntries, composition };
    }

    const subjectResolution = resolveReference(index, subjectReference);
    const patient = subjectResolution.entry;
    if (
        subjectResolution.ambiguous
        || !patient
        || patient.resource.resourceType !== 'Patient'
    ) {
        createIssue(
            issues,
            'error',
            'composition-subject-unresolved',
            'Composition.subject.reference',
            'The Composition subject must resolve to exactly one Patient entry in the received Bundle.',
        );
        return { entries: reachedEntries, composition };
    }

    reachedEntries.forEach(entry => {
        const field = PATIENT_REFERENCE_FIELD[entry.resource.resourceType];
        if (!field) return;
        const resource = entry.resource as Record<string, unknown>;
        const patientReference = referenceValue(resource[field]);
        if (!patientReference) {
            createIssue(
                issues,
                entry.resource.resourceType === 'Specimen'
                    ? 'warning'
                    : 'error',
                'patient-reference-missing',
                `${entry.fullUrl}.${field}`,
                `${entry.resource.resourceType} does not declare the patient reference required to establish import ownership.`,
            );
            return;
        }

        const resolution = resolveReference(index, patientReference);
        if (
            resolution.ambiguous
            || !resolution.entry
            || resolution.entry.fullUrl !== patient.fullUrl
        ) {
            createIssue(
                issues,
                'error',
                'cross-patient-reference',
                `${entry.fullUrl}.${field}.reference`,
                `${entry.resource.resourceType} does not resolve to the Composition patient and cannot be imported safely.`,
            );
        }
    });

    const droppedSupportedResourceTypes: Record<string, number> = {};
    bundle.entry.forEach(entry => {
        if (
            reached.has(entry.fullUrl)
            || !SUPPORTED_CANDIDATE_TYPES.has(entry.resource.resourceType)
        ) return;
        droppedSupportedResourceTypes[entry.resource.resourceType] =
            (droppedSupportedResourceTypes[entry.resource.resourceType] || 0)
            + 1;
    });

    return {
        entries: reachedEntries,
        composition,
        patient,
        evidence: {
            compositionFullUrl: composition.fullUrl,
            patientFullUrl: patient.fullUrl,
            reachableEntryCount: reachedEntries.length,
            sourceEntryCount: bundle.entry.length,
            droppedEntryCount: bundle.entry.length - reachedEntries.length,
            droppedSupportedResourceTypes,
        },
    };
};

const normalizeMedicationReferences = (
    bundle: FhirDocumentBundle,
    issues: IpsImportSafetyIssue[],
): FhirDocumentBundle => {
    const normalized = deepClone(bundle);
    const index = buildEntryIndex(normalized);

    normalized.entry.forEach(entry => {
        if (!['MedicationStatement', 'MedicationRequest']
            .includes(entry.resource.resourceType)) return;
        const resource = entry.resource as Record<string, unknown>;
        if (isObject(resource.medicationCodeableConcept)) return;

        const medicationReference = referenceValue(
            resource.medicationReference,
        );
        if (!medicationReference) {
            createIssue(
                issues,
                'error',
                'medication-missing',
                `${entry.fullUrl}.medication[x]`,
                `${entry.resource.resourceType} has no importable medicationCodeableConcept or medicationReference.`,
            );
            return;
        }

        const resolution = resolveReference(index, medicationReference);
        const medication = resolution.entry?.resource;
        const medicationCode = medication
            && medication.resourceType === 'Medication'
            ? (medication as Record<string, unknown>).code
            : undefined;
        if (
            resolution.ambiguous
            || !medication
            || medication.resourceType !== 'Medication'
            || !isObject(medicationCode)
        ) {
            createIssue(
                issues,
                'error',
                'medication-reference-unresolved',
                `${entry.fullUrl}.medicationReference.reference`,
                'Referenced Medication content could not be resolved to a coded Medication entry.',
            );
            return;
        }
        resource.medicationCodeableConcept = deepClone(medicationCode);
    });

    return normalized;
};

const candidateFullUrl = (
    candidate: PatientClinicalResource,
): string | undefined => candidate.provenance.source.externalId;

const resolveCandidateIds = (
    source: unknown,
    index: BundleEntryIndex,
    candidateIdByFullUrl: Map<string, string>,
): string[] => values(source).flatMap(reference => {
    const raw = referenceValue(reference);
    if (!raw) return [];
    const entry = resolveReference(index, raw).entry;
    const candidateId = entry
        ? candidateIdByFullUrl.get(entry.fullUrl)
        : undefined;
    return candidateId ? [candidateId] : [];
});

const augmentCandidateRelationships = (
    candidates: PatientClinicalResource[],
    bundle: FhirDocumentBundle,
): PatientClinicalResource[] => {
    const index = buildEntryIndex(bundle);
    const sourceEntryByFullUrl = new Map(
        bundle.entry.map(entry => [entry.fullUrl, entry]),
    );
    const candidateIdByFullUrl = new Map(
        candidates.flatMap(candidate => {
            const fullUrl = candidateFullUrl(candidate);
            return fullUrl ? [[fullUrl, candidate.id] as const] : [];
        }),
    );

    const augmented = candidates.map(candidate => {
        const fullUrl = candidateFullUrl(candidate);
        const sourceEntry = fullUrl
            ? sourceEntryByFullUrl.get(fullUrl)
            : undefined;
        if (!sourceEntry) return candidate;
        const source = sourceEntry.resource as Record<string, unknown>;

        if (candidate.resourceType === 'Procedure') {
            return parseClinicalRecordResource({
                ...candidate,
                reportIds: resolveCandidateIds(
                    source.report,
                    index,
                    candidateIdByFullUrl,
                ),
            }) as PatientClinicalResource;
        }
        return candidate;
    });

    const byId = new Map(augmented.map(candidate => [
        candidate.id,
        candidate,
    ]));
    augmented.forEach(candidate => {
        if (candidate.resourceType !== 'DiagnosticReport') return;
        candidate.resultIds.forEach(resultId => {
            const result = byId.get(resultId);
            if (!result || result.resourceType !== 'Observation') return;
            byId.set(resultId, parseClinicalRecordResource({
                ...result,
                diagnosticReportId: candidate.id,
            }) as PatientClinicalResource);
        });
    });

    return augmented.map(candidate => byId.get(candidate.id) || candidate);
};

const normalizeIdentityText = (value: string | undefined): string =>
    (value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .replace(/\s+/g, ' ');

const compareIdentity = (
    source: IpsPatientImportPreview,
    target: PatientClinicalRecord,
): IpsIdentityComparison => {
    const matches: string[] = [];
    const mismatches: string[] = [];
    const notes: string[] = [];

    const sourceName = normalizeIdentityText(source.displayName);
    const targetName = normalizeIdentityText(target.profile.displayName);
    if (sourceName && targetName) {
        if (sourceName === targetName) matches.push('Display name matches.');
        else mismatches.push('Display name differs.');
    }

    const targetBirthDate = target.profile.dateOfBirth?.value || undefined;
    if (source.birthDate && targetBirthDate) {
        if (source.birthDate === targetBirthDate) {
            matches.push('Date of birth matches.');
        } else {
            mismatches.push('Date of birth differs.');
        }
    } else {
        notes.push('Date of birth could not be compared completely.');
    }

    const sourceIdentifiers = new Set(source.identifiers.map(identifier =>
        `${normalizeIdentityText(identifier.system)}|${normalizeIdentityText(identifier.value)}`));
    const targetIdentifiers = new Set(target.profile.identifiers.map(identifier =>
        `${normalizeIdentityText(identifier.system)}|${normalizeIdentityText(identifier.value)}`));
    const exactIdentifierMatch = [...sourceIdentifiers].some(identifier =>
        targetIdentifiers.has(identifier));
    if (exactIdentifierMatch) {
        matches.push('At least one identifier matches exactly.');
    } else if (sourceIdentifiers.size > 0 && targetIdentifiers.size > 0) {
        const sourceBySystem = new Map<string, Set<string>>();
        source.identifiers.forEach(identifier => {
            const system = normalizeIdentityText(identifier.system);
            if (!system) return;
            sourceBySystem.set(system, new Set([
                ...(sourceBySystem.get(system) || []),
                normalizeIdentityText(identifier.value),
            ]));
        });
        const conflictingSystem = target.profile.identifiers.some(identifier => {
            const system = normalizeIdentityText(identifier.system);
            const sourceValues = sourceBySystem.get(system);
            return Boolean(
                system
                && sourceValues
                && !sourceValues.has(normalizeIdentityText(identifier.value)),
            );
        });
        if (conflictingSystem) {
            mismatches.push(
                'An identifier system is shared but its identifier value differs.',
            );
        } else {
            notes.push('No exact identifier match was available.');
        }
    } else {
        notes.push('Identifiers could not be compared completely.');
    }

    const strongMatch = exactIdentifierMatch
        || (
            sourceName === targetName
            && Boolean(source.birthDate)
            && source.birthDate === targetBirthDate
        );
    return {
        status: mismatches.length > 0
            ? 'mismatch'
            : strongMatch
                ? 'matched'
                : 'insufficient',
        matches,
        mismatches,
        notes,
        sourceDisplayName: source.displayName,
        targetDisplayName: target.profile.displayName,
    };
};

const sourceText = (input: string | unknown): string =>
    typeof input === 'string' ? input : JSON.stringify(input);

const uniqueTags = (tags: string[]): string[] => [...new Set(tags)];

export const prepareAtomicIpsImport = async ({
    input,
    targetRecord,
    importedAt = new Date().toISOString(),
    fileName = 'received-international-patient-summary.json',
    mimeType = 'application/fhir+json',
}: PrepareAtomicIpsImportOptions): Promise<AtomicIpsImportPreview> => {
    const rawSource = sourceText(input);
    const byteLength = new TextEncoder().encode(rawSource).byteLength;
    const importId = uuidv4();
    const sourceDocumentId = uuidv4();
    const base = parseIpsImport(
        input,
        targetRecord.patientId,
        importedAt,
    );
    const safetyIssues: IpsImportSafetyIssue[] = [];

    if (byteLength > MAX_PRESERVED_IPS_SOURCE_BYTES) {
        createIssue(
            safetyIssues,
            'error',
            'source-size-limit',
            'source',
            `The received IPS is ${byteLength} bytes; the protected import limit is ${MAX_PRESERVED_IPS_SOURCE_BYTES} bytes.`,
        );
    }
    if (!base.validation.valid || !base.bundle) {
        return {
            ...base,
            importId,
            targetPatientId: targetRecord.patientId,
            targetRecordUpdatedAt: targetRecord.updatedAt,
            sourceDocumentId,
            safetyIssues,
            commitReady: false,
        };
    }

    const graph = buildReachableGraph(base.bundle, safetyIssues);
    const reachableBundle: FhirDocumentBundle = {
        ...deepClone(base.bundle),
        entry: deepClone(graph.entries),
    };
    const normalizedBundle = normalizeMedicationReferences(
        reachableBundle,
        safetyIssues,
    );
    const mapped = safetyIssues.some(issue => issue.severity === 'error')
        ? {
            ...base,
            bundle: normalizedBundle,
            candidates: [],
        }
        : parseIpsImport(
            normalizedBundle,
            targetRecord.patientId,
            importedAt,
        );

    const sourcePatient = graph.patient
        ? patientPreview(graph.patient.resource, graph.patient.fullUrl)
        : undefined;
    let candidates = augmentCandidateRelationships(
        mapped.candidates,
        normalizedBundle,
    );
    candidates = candidates.map(candidate =>
        parseClinicalRecordResource({
            ...candidate,
            provenance: {
                ...candidate.provenance,
                source: {
                    ...candidate.provenance.source,
                    document: {
                        documentId: sourceDocumentId,
                        fileName,
                    },
                    description:
                        `Candidate mapped from the preserved FHIR R4 IPS ${IPS_VERSION} source document.`,
                },
            },
            tags: uniqueTags([
                ...(candidate.tags || []),
                'source-preserved',
                `ips-import:${importId}`,
            ]),
        }) as PatientClinicalResource,
    );

    const source = byteLength <= MAX_PRESERVED_IPS_SOURCE_BYTES
        ? {
            id: `${ENCRYPTED_SOURCE_STORAGE_PREFIX}${targetRecord.patientId}:${importId}`,
            text: rawSource,
            fileName: fileName.trim()
                || 'received-international-patient-summary.json',
            mimeType,
            sha256: await sha256Hex(rawSource),
            byteLength,
            storedAt: importedAt,
        }
        : undefined;
    const identity = sourcePatient
        ? compareIdentity(sourcePatient, targetRecord)
        : undefined;
    const hasErrors = safetyIssues.some(issue =>
        issue.severity === 'error');

    return {
        ...mapped,
        bundle: normalizedBundle,
        ...(sourcePatient ? { patient: sourcePatient } : {}),
        candidates,
        importId,
        targetPatientId: targetRecord.patientId,
        targetRecordUpdatedAt: targetRecord.updatedAt,
        sourceDocumentId,
        ...(source ? { source } : {}),
        ...(graph.evidence ? { graph: graph.evidence } : {}),
        ...(identity ? { identity } : {}),
        safetyIssues,
        commitReady: Boolean(
            mapped.validation.valid
            && source
            && graph.evidence
            && identity
            && candidates.length > 0
            && !hasErrors,
        ),
        warnings: [
            ...mapped.warnings,
            ...safetyIssues
                .filter(issue => issue.severity === 'warning')
                .map(issue => issue.message),
        ],
        limitations: [
            ...mapped.limitations,
            'Only the Composition-reachable document graph is eligible for candidate mapping; unrelated Bundle entries remain preserved in the encrypted original source.',
            'Every supported patient-scoped resource must resolve to the Composition patient before the transaction can be committed.',
            'The exact received UTF-8 source is stored separately under the local vault key and linked from every created candidate.',
            'Identity comparison is evidence for human review and never automatically proves that two patient records represent the same person.',
        ],
    };
};

const remapReferenceId = (
    value: string | undefined,
    idMap: Map<string, string>,
): string | undefined => value ? idMap.get(value) || value : undefined;

const remapReferences = (
    candidate: PatientClinicalResource,
    idMap: Map<string, string>,
): PatientClinicalResource => {
    switch (candidate.resourceType) {
        case 'Observation':
            return parseClinicalRecordResource({
                ...candidate,
                ...(candidate.specimenId
                    ? { specimenId: remapReferenceId(candidate.specimenId, idMap) }
                    : {}),
                ...(candidate.diagnosticReportId
                    ? {
                        diagnosticReportId: remapReferenceId(
                            candidate.diagnosticReportId,
                            idMap,
                        ),
                    }
                    : {}),
            }) as PatientClinicalResource;
        case 'DiagnosticReport':
            return parseClinicalRecordResource({
                ...candidate,
                resultIds: candidate.resultIds.map(id =>
                    remapReferenceId(id, idMap)!),
                specimenIds: candidate.specimenIds.map(id =>
                    remapReferenceId(id, idMap)!),
                documentIds: candidate.documentIds.map(id =>
                    remapReferenceId(id, idMap)!),
            }) as PatientClinicalResource;
        case 'Procedure':
            return parseClinicalRecordResource({
                ...candidate,
                ...(candidate.reportIds
                    ? {
                        reportIds: candidate.reportIds.map(id =>
                            remapReferenceId(id, idMap)!),
                    }
                    : {}),
            }) as PatientClinicalResource;
        default:
            return candidate;
    }
};

const dependencyPriority = (
    candidate: PatientClinicalResource,
): number => ({
    Specimen: 0,
    Observation: 1,
    DiagnosticReport: 2,
    Procedure: 3,
}[candidate.resourceType] ?? 4);

const buildSourceDocument = ({
    preview,
    identityAcknowledgement,
    linkedResources,
    createdCandidates,
    duplicateCandidates,
}: {
    preview: AtomicIpsImportPreview;
    identityAcknowledgement: IpsImportIdentityAcknowledgement;
    linkedResources: ClinicalReference[];
    createdCandidates: number;
    duplicateCandidates: number;
}): DocumentReferenceRecord => {
    const source = preview.source!;
    const receipt = {
        schemaVersion: 'medibrief-fhir-ips-import-receipt-1',
        importId: preview.importId,
        importedAt: source.storedAt,
        sourceSha256: source.sha256,
        sourceByteLength: source.byteLength,
        targetPatientId: preview.targetPatientId,
        targetRecordUpdatedAtAtPreview: preview.targetRecordUpdatedAt,
        compositionFullUrl: preview.graph?.compositionFullUrl,
        sourcePatientFullUrl: preview.graph?.patientFullUrl,
        identityStatus: preview.identity?.status,
        identityAcknowledgedAt:
            identityAcknowledgement.acknowledgedAt,
        reachableEntryCount: preview.graph?.reachableEntryCount,
        sourceEntryCount: preview.graph?.sourceEntryCount,
        createdCandidates,
        duplicateCandidates,
        candidateResourceIds: linkedResources.map(reference => reference.id),
    };

    return parseClinicalRecordResource({
        id: preview.sourceDocumentId,
        patientId: preview.targetPatientId,
        resourceType: 'DocumentReference',
        verificationStatus: 'candidate',
        recordedAt: source.storedAt,
        provenance: createClinicalProvenance({
            source: createRecordSource({
                kind: 'import',
                externalSystem: IPS_CANONICAL_BASE,
                externalId: preview.graph?.compositionFullUrl
                    || preview.importId,
                description:
                    'Exact received FHIR R4 International Patient Summary source preserved under the local vault key.',
            }),
            now: source.storedAt,
            actor: 'user',
        }),
        amendments: [],
        tags: [
            'fhir-r4',
            'ips-2.0.1',
            'fhir-r4-ips-source',
            'source-preserved',
            'identity-reviewed',
            `ips-import:${preview.importId}`,
        ],
        status: 'current',
        storageId: source.id,
        fileName: source.fileName,
        mimeType: source.mimeType,
        title: `Received IPS source — ${preview.patient?.displayName || 'patient identity pending'}`,
        documentType: {
            text: 'Patient summary document',
            coding: [{
                system: 'http://loinc.org',
                code: '60591-5',
                display: 'Patient summary Document',
            }],
        },
        uploadedAt: source.storedAt,
        hash: `sha256:${source.sha256}`,
        description: JSON.stringify(receipt),
        relatedResources: linkedResources,
    }) as DocumentReferenceRecord;
};

export const commitAtomicIpsImport = ({
    currentRecord,
    preview,
    identityAcknowledgement,
}: {
    currentRecord: PatientClinicalRecord;
    preview: AtomicIpsImportPreview;
    identityAcknowledgement: IpsImportIdentityAcknowledgement;
}): AtomicIpsImportCommitResult => {
    const emptyResult = {
        createdCandidates: 0,
        duplicateCandidates: 0,
    };
    if (!preview.commitReady || !preview.source || !preview.graph) {
        return {
            ok: false,
            status: 'invalid-preview',
            ...emptyResult,
            message:
                'The IPS preview has unresolved safety findings and cannot be committed.',
        };
    }
    if (
        !identityAcknowledgement.confirmed
        || identityAcknowledgement.targetPatientId
            !== currentRecord.patientId
        || identityAcknowledgement.sourceSha256
            !== preview.source.sha256
    ) {
        return {
            ok: false,
            status: 'identity-not-acknowledged',
            ...emptyResult,
            message:
                'Patient identity comparison must be acknowledged for this exact source before import.',
        };
    }
    if (
        preview.targetPatientId !== currentRecord.patientId
        || preview.targetRecordUpdatedAt !== currentRecord.updatedAt
    ) {
        return {
            ok: false,
            status: 'record-changed',
            ...emptyResult,
            message:
                'The selected patient record changed after preview. Re-open the source and review identity again.',
        };
    }

    const duplicateSource = currentRecord.resources.documents.find(document =>
        document.hash === `sha256:${preview.source!.sha256}`
        && document.tags?.includes('fhir-r4-ips-source'));
    if (duplicateSource) {
        return {
            ok: true,
            status: 'duplicate-source',
            ...emptyResult,
            duplicateSourceDocumentId: duplicateSource.id,
            message:
                'This exact IPS source is already preserved for the selected patient; no record was changed.',
        };
    }

    const existingResources = flattenPatientResources(
        currentRecord,
    ) as PatientClinicalResource[];
    const existingIds = new Set(existingResources.map(resource => resource.id));
    if (
        existingIds.has(preview.sourceDocumentId)
        || preview.candidates.some(candidate =>
            existingIds.has(candidate.id))
    ) {
        return {
            ok: false,
            status: 'conflict',
            ...emptyResult,
            message:
                'The staged import contains an ID that already exists in the patient record.',
        };
    }
    if (new Set(preview.candidates.map(candidate => candidate.id)).size
        !== preview.candidates.length) {
        return {
            ok: false,
            status: 'conflict',
            ...emptyResult,
            message: 'The staged import contains duplicate candidate IDs.',
        };
    }

    const idMap = new Map<string, string>();
    const staged: PatientClinicalResource[] = [];
    let duplicateCandidates = 0;
    const ordered = [...preview.candidates].sort((left, right) =>
        dependencyPriority(left) - dependencyPriority(right));

    for (const rawCandidate of ordered) {
        if (
            rawCandidate.patientId !== currentRecord.patientId
            || rawCandidate.verificationStatus !== 'candidate'
        ) {
            return {
                ok: false,
                status: 'conflict',
                ...emptyResult,
                message:
                    'Every imported clinical resource must remain an unconfirmed candidate for the selected patient.',
            };
        }
        const candidate = remapReferences(
            parseClinicalRecordResource(rawCandidate) as PatientClinicalResource,
            idMap,
        );
        const duplicate = findDuplicateCandidate(
            [...existingResources, ...staged],
            candidate,
        );
        if (duplicate) {
            idMap.set(candidate.id, duplicate.id);
            duplicateCandidates += 1;
        } else {
            idMap.set(candidate.id, candidate.id);
            staged.push(candidate);
        }
    }

    const remappedStaged = staged.map(candidate =>
        remapReferences(candidate, idMap));
    const linkedById = new Map<string, ClinicalReference>();
    preview.candidates.forEach(candidate => {
        const resourceId = idMap.get(candidate.id) || candidate.id;
        linkedById.set(resourceId, {
            resourceType: candidate.resourceType,
            id: resourceId,
        });
    });
    const linkedResources = [...linkedById.values()];
    const sourceDocument = buildSourceDocument({
        preview,
        identityAcknowledgement,
        linkedResources,
        createdCandidates: remappedStaged.length,
        duplicateCandidates,
    });

    const resources = deepClone(currentRecord.resources);
    remappedStaged.forEach(candidate => {
        const key = getResourceCollectionKey(candidate.resourceType);
        (resources[key] as PatientClinicalResource[]).push(candidate);
    });
    resources.documents.push(sourceDocument);

    let record: PatientClinicalRecord;
    try {
        record = parsePatientClinicalRecord({
            ...currentRecord,
            resources,
            updatedAt: preview.source.storedAt,
        });
    } catch {
        return {
            ok: false,
            status: 'conflict',
            ...emptyResult,
            message:
                'The complete import transaction failed clinical-record validation; no record should be replaced.',
        };
    }

    return {
        ok: true,
        status: 'committed',
        record,
        sourceDocument,
        createdCandidates: remappedStaged.length,
        duplicateCandidates,
        message:
            'The complete source-preserving candidate graph is ready for one atomic record replacement.',
    };
};
