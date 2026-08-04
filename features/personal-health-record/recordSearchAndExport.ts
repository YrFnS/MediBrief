import {
    flattenPatientResources,
    getResourceDateBounds,
    selectConfirmedResources,
} from '../clinical-record';
import type {
    ClinicalRecordResource,
    ClinicalResourceType,
    PatientClinicalRecord,
    SourceDocumentReference,
} from '../clinical-record';
import {
    managedResourceLabel,
    summarizeManagedResource,
} from './manualRecordManagement';
import { humanizeToken } from './viewModels';

export type RecordSearchVerificationFilter =
    | 'all'
    | ClinicalRecordResource['verificationStatus'];

export type RecordSearchDateFilter = 'all' | 'dated' | 'undated';

export interface RecordSearchOptions {
    query?: string;
    resourceType?: 'all' | ClinicalResourceType;
    verificationStatus?: RecordSearchVerificationFilter;
    dateState?: RecordSearchDateFilter;
}

export interface RecordSearchItem {
    id: string;
    resourceType: ClinicalResourceType;
    resourceTypeLabel: string;
    label: string;
    statusLabel: string;
    verificationStatus: ClinicalRecordResource['verificationStatus'];
    clinicalDateLabel: string;
    knownClinicalDate: boolean;
    sourceLabel: string;
    recordedLabel: string;
    amendmentCount: number;
    tags: string[];
    detailLines: string[];
    sourceDocument?: SourceDocumentReference;
    searchText: string;
    sortTimestamp: number;
    score: number;
    resource: ClinicalRecordResource;
}

export interface RecordSearchViewModel {
    items: RecordSearchItem[];
    totalIndexed: number;
    availableResourceTypes: ClinicalResourceType[];
    countsByVerification: Record<
        ClinicalRecordResource['verificationStatus'],
        number
    >;
}

export interface CompletePatientSummaryResource {
    id: string;
    resourceType: ClinicalResourceType;
    label: string;
    statusLabel: string;
    clinicalDateLabel: string;
    knownClinicalDate: boolean;
    sourceLabel: string;
    recordedAt: string;
    updatedAt: string;
    amendmentCount: number;
    tags: string[];
    resource: ClinicalRecordResource;
}

export interface CompletePatientSummarySection {
    resourceType: Exclude<ClinicalResourceType, 'PatientProfile'>;
    label: string;
    count: number;
    resources: CompletePatientSummaryResource[];
}

export interface CompletePatientSummaryExport {
    format: 'medibrief-complete-patient-summary';
    version: 1;
    generatedAt: string;
    patientId: string;
    recordUpdatedAt: string;
    scope: {
        verification: 'confirmed';
        patientApplicableOnly: true;
        candidatesIncluded: false;
        rejectedIncluded: false;
        enteredInErrorIncluded: false;
    };
    patientProfile: ClinicalRecordResource;
    confirmedResourceCount: number;
    excludedHistoryCounts: {
        candidate: number;
        rejected: number;
        enteredInError: number;
    };
    sectionCounts: Partial<Record<ClinicalResourceType, number>>;
    limitations: string[];
    sections: CompletePatientSummarySection[];
}

const RESOURCE_ORDER: Array<Exclude<ClinicalResourceType, 'PatientProfile'>> = [
    'AllergyIntolerance',
    'Medication',
    'Condition',
    'Observation',
    'DiagnosticReport',
    'Specimen',
    'Encounter',
    'Procedure',
    'Immunization',
    'Appointment',
    'ClinicalTask',
    'CarePlan',
    'ClinicalNote',
    'DocumentReference',
];

const RESOURCE_SECTION_LABELS: Record<
    Exclude<ClinicalResourceType, 'PatientProfile'>,
    string
> = {
    AllergyIntolerance: 'Allergies and intolerances',
    Medication: 'Medications',
    Condition: 'Conditions',
    Observation: 'Observations and results',
    DiagnosticReport: 'Diagnostic reports',
    Specimen: 'Specimens',
    Encounter: 'Visits and encounters',
    Procedure: 'Procedures',
    Immunization: 'Immunizations',
    Appointment: 'Appointments',
    ClinicalTask: 'Tasks and reminders',
    CarePlan: 'Care plans',
    ClinicalNote: 'Clinical notes',
    DocumentReference: 'Documents',
};

const DETAIL_EXCLUDED_KEYS = new Set([
    'id',
    'patientId',
    'resourceType',
    'verificationStatus',
    'recordedAt',
    'provenance',
    'amendments',
    'assertion',
    'tags',
]);

const normalize = (value: string): string =>
    value.trim().toLowerCase().replace(/\s+/g, ' ');

const validTimestamp = (value: string): number => {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const humanizePath = (path: string): string => {
    const last = path.split('.').filter(Boolean).at(-1) || path;
    return humanizeToken(
        last
            .replace(/\[(\d+)\]/g, ' $1')
            .replace(/([a-z0-9])([A-Z])/g, '$1 $2'),
    );
};

const primitiveText = (value: unknown): string | null => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return null;
};

const collectPrimitivePairs = (
    value: unknown,
    options: {
        path?: string;
        excludeKeys?: Set<string>;
        maxPairs?: number;
    } = {},
    output: Array<{ path: string; value: string }> = [],
): Array<{ path: string; value: string }> => {
    if (output.length >= (options.maxPairs || Number.POSITIVE_INFINITY)) {
        return output;
    }

    const direct = primitiveText(value);
    if (direct !== null) {
        output.push({ path: options.path || 'value', value: direct });
        return output;
    }

    if (Array.isArray(value)) {
        value.forEach((entry, index) => {
            collectPrimitivePairs(entry, {
                ...options,
                path: `${options.path || 'items'}[${index + 1}]`,
            }, output);
        });
        return output;
    }

    if (!value || typeof value !== 'object') return output;

    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
        if (options.excludeKeys?.has(key)) return;
        collectPrimitivePairs(entry, {
            ...options,
            path: options.path ? `${options.path}.${key}` : key,
        }, output);
    });
    return output;
};

const uniqueDetailLines = (resource: ClinicalRecordResource): string[] => {
    const pairs = collectPrimitivePairs(resource, {
        excludeKeys: DETAIL_EXCLUDED_KEYS,
        maxPairs: 24,
    });
    const seen = new Set<string>();
    const lines: string[] = [];

    for (const pair of pairs) {
        const compactValue = pair.value.length > 180
            ? `${pair.value.slice(0, 177)}…`
            : pair.value;
        const line = `${humanizePath(pair.path)}: ${compactValue}`;
        const key = normalize(line);
        if (seen.has(key)) continue;
        seen.add(key);
        lines.push(line);
        if (lines.length >= 8) break;
    }
    return lines;
};

const completeSearchText = (resource: ClinicalRecordResource): string => {
    const primitives = collectPrimitivePairs(resource, { maxPairs: 600 })
        .map(item => item.value);
    const summary = summarizeManagedResource(resource);
    return normalize([
        resource.resourceType,
        managedResourceLabel(resource),
        summary.statusLabel,
        summary.verificationStatus,
        summary.clinicalDateLabel,
        summary.sourceLabel,
        ...summary.resource.tags || [],
        ...primitives,
    ].join(' '));
};

const searchScore = (
    item: Omit<RecordSearchItem, 'score'>,
    query: string,
    tokens: string[],
): number => {
    if (!query) return 0;
    const label = normalize(item.label);
    const type = normalize(item.resourceTypeLabel);
    let score = 0;

    if (label === query) score += 200;
    else if (label.startsWith(query)) score += 120;
    else if (label.includes(query)) score += 80;

    if (type === query) score += 70;
    else if (type.includes(query)) score += 35;

    for (const token of tokens) {
        if (label.includes(token)) score += 25;
        if (type.includes(token)) score += 12;
        if (normalize(item.statusLabel).includes(token)) score += 8;
        if (item.searchText.includes(token)) score += 3;
    }
    return score;
};

const toSearchItem = (resource: ClinicalRecordResource): RecordSearchItem => {
    const summary = summarizeManagedResource(resource);
    const bounds = getResourceDateBounds(resource);
    const base: Omit<RecordSearchItem, 'score'> = {
        id: resource.id,
        resourceType: resource.resourceType,
        resourceTypeLabel: humanizeToken(resource.resourceType),
        label: summary.label,
        statusLabel: summary.statusLabel,
        verificationStatus: resource.verificationStatus,
        clinicalDateLabel: summary.clinicalDateLabel,
        knownClinicalDate: summary.knownClinicalDate,
        sourceLabel: summary.sourceLabel,
        recordedLabel: summary.recordedLabel,
        amendmentCount: resource.amendments.length,
        tags: [...(resource.tags || [])],
        detailLines: uniqueDetailLines(resource),
        ...(resource.provenance.source.document
            ? { sourceDocument: resource.provenance.source.document }
            : {}),
        searchText: completeSearchText(resource),
        sortTimestamp:
            bounds.start
            ?? validTimestamp(resource.provenance.updatedAt)
            ?? validTimestamp(resource.recordedAt),
        resource,
    };
    return { ...base, score: 0 };
};

export const buildRecordSearchIndex = (
    record: PatientClinicalRecord,
): RecordSearchItem[] => flattenPatientResources(record, true).map(toSearchItem);

export const searchPatientRecord = (
    record: PatientClinicalRecord,
    options: RecordSearchOptions = {},
): RecordSearchViewModel => {
    const query = normalize(options.query || '');
    const tokens = query.split(' ').filter(Boolean);
    const resourceType = options.resourceType || 'all';
    const verificationStatus = options.verificationStatus || 'confirmed';
    const dateState = options.dateState || 'all';
    const indexed = buildRecordSearchIndex(record);

    const items = indexed
        .filter(item => resourceType === 'all' || item.resourceType === resourceType)
        .filter(item => verificationStatus === 'all'
            || item.verificationStatus === verificationStatus)
        .filter(item => dateState === 'all'
            || (dateState === 'dated'
                ? item.knownClinicalDate
                : !item.knownClinicalDate))
        .filter(item => tokens.every(token => item.searchText.includes(token)))
        .map(item => ({
            ...item,
            score: searchScore(item, query, tokens),
        }))
        .sort((left, right) => {
            if (left.score !== right.score) return right.score - left.score;
            if (left.knownClinicalDate !== right.knownClinicalDate) {
                return left.knownClinicalDate ? -1 : 1;
            }
            if (left.sortTimestamp !== right.sortTimestamp) {
                return right.sortTimestamp - left.sortTimestamp;
            }
            const type = left.resourceType.localeCompare(right.resourceType);
            if (type !== 0) return type;
            return left.label.localeCompare(right.label);
        });

    const countsByVerification: Record<
        ClinicalRecordResource['verificationStatus'],
        number
    > = {
        candidate: 0,
        confirmed: 0,
        rejected: 0,
        'entered-in-error': 0,
    };
    indexed.forEach(item => {
        countsByVerification[item.verificationStatus] += 1;
    });

    return {
        items,
        totalIndexed: indexed.length,
        availableResourceTypes: [
            ...new Set(indexed.map(item => item.resourceType)),
        ].sort((left, right) => left.localeCompare(right)),
        countsByVerification,
    };
};

const toSummaryResource = (
    resource: ClinicalRecordResource,
): CompletePatientSummaryResource => {
    const summary = summarizeManagedResource(resource);
    return {
        id: resource.id,
        resourceType: resource.resourceType,
        label: summary.label,
        statusLabel: summary.statusLabel,
        clinicalDateLabel: summary.clinicalDateLabel,
        knownClinicalDate: summary.knownClinicalDate,
        sourceLabel: summary.sourceLabel,
        recordedAt: resource.recordedAt,
        updatedAt: resource.provenance.updatedAt,
        amendmentCount: resource.amendments.length,
        tags: [...(resource.tags || [])],
        resource,
    };
};

export const buildCompletePatientSummary = (
    record: PatientClinicalRecord,
    generatedAt = new Date().toISOString(),
): CompletePatientSummaryExport => {
    const confirmed = selectConfirmedResources(record).map(toSummaryResource);
    const allHistory = flattenPatientResources(record, false);
    const sectionCounts: Partial<Record<ClinicalResourceType, number>> = {
        PatientProfile: 1,
    };

    const sections = RESOURCE_ORDER.map(resourceType => {
        const resources = confirmed
            .filter(item => item.resourceType === resourceType)
            .sort((left, right) => {
                if (left.knownClinicalDate !== right.knownClinicalDate) {
                    return left.knownClinicalDate ? -1 : 1;
                }
                const leftBounds = getResourceDateBounds(left.resource);
                const rightBounds = getResourceDateBounds(right.resource);
                const leftTime = leftBounds.start ?? validTimestamp(left.updatedAt);
                const rightTime = rightBounds.start ?? validTimestamp(right.updatedAt);
                if (leftTime !== rightTime) return rightTime - leftTime;
                return left.label.localeCompare(right.label);
            });
        sectionCounts[resourceType] = resources.length;
        return {
            resourceType,
            label: RESOURCE_SECTION_LABELS[resourceType],
            count: resources.length,
            resources,
        };
    });

    return {
        format: 'medibrief-complete-patient-summary',
        version: 1,
        generatedAt,
        patientId: record.patientId,
        recordUpdatedAt: record.updatedAt,
        scope: {
            verification: 'confirmed',
            patientApplicableOnly: true,
            candidatesIncluded: false,
            rejectedIncluded: false,
            enteredInErrorIncluded: false,
        },
        patientProfile: record.profile,
        confirmedResourceCount: confirmed.length,
        excludedHistoryCounts: {
            candidate: allHistory.filter(item =>
                item.verificationStatus === 'candidate').length,
            rejected: allHistory.filter(item =>
                item.verificationStatus === 'rejected').length,
            enteredInError: allHistory.filter(item =>
                item.verificationStatus === 'entered-in-error').length,
        },
        sectionCounts,
        limitations: [
            'This export contains locally confirmed, patient-applicable structured records only.',
            'Pending candidates, rejected assertions, and entered-in-error resources are excluded from the clinical summary but remain preserved in record history and backups.',
            'An empty section means that no confirmed resource is stored locally; it does not prove that the patient has no history in that domain.',
            'Unknown clinical dates remain unknown. Storage, review, import, and upload timestamps are not substituted as event dates.',
            'Appointment, task, and care-plan states reproduce the confirmed local record and do not independently verify external booking, order transmission, or completed care.',
            'MediBrief is a local personal record and may be incomplete compared with records held by clinicians, laboratories, pharmacies, or other organizations.',
        ],
        sections,
    };
};

const escapeHtml = (value: unknown): string => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const safeJson = (value: unknown): string =>
    escapeHtml(JSON.stringify(value, null, 2));

export const completeSummaryFileStem = (
    summary: CompletePatientSummaryExport,
): string => {
    const patientName = summary.patientProfile.resourceType === 'PatientProfile'
        ? summary.patientProfile.displayName
        : summary.patientId;
    const safeName = patientName
        .normalize('NFKD')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
        || 'patient';
    return `medibrief-${safeName}-complete-summary`;
};

export const createCompletePatientSummaryJson = (
    summary: CompletePatientSummaryExport,
): string => JSON.stringify(summary, null, 2);

export const createCompletePatientSummaryHtml = (
    summary: CompletePatientSummaryExport,
): string => {
    const profileName = summary.patientProfile.resourceType === 'PatientProfile'
        ? summary.patientProfile.displayName
        : summary.patientId;
    const sectionHtml = summary.sections.map(section => {
        const resources = section.resources.length === 0
            ? '<p class="empty">No confirmed resource is stored in this section. This does not prove absence.</p>'
            : section.resources.map(item => `
<article class="resource">
    <header>
        <div>
            <h3>${escapeHtml(item.label)}</h3>
            <p>${escapeHtml(item.resourceType)} · ${escapeHtml(item.statusLabel)}</p>
        </div>
        <span class="date">${escapeHtml(item.clinicalDateLabel)}</span>
    </header>
    <dl>
        <div><dt>Source</dt><dd>${escapeHtml(item.sourceLabel)}</dd></div>
        <div><dt>Recorded</dt><dd>${escapeHtml(item.recordedAt)}</dd></div>
        <div><dt>Updated</dt><dd>${escapeHtml(item.updatedAt)}</dd></div>
        <div><dt>Amendments</dt><dd>${item.amendmentCount}</dd></div>
    </dl>
    ${item.tags.length > 0
        ? `<p class="tags">Tags: ${item.tags.map(escapeHtml).join(', ')}</p>`
        : ''}
    <h4>Structured record</h4>
    <pre>${safeJson(item.resource)}</pre>
</article>`).join('');
        return `
<section class="section">
    <h2>${escapeHtml(section.label)} <span>${section.count}</span></h2>
    ${resources}
</section>`;
    }).join('');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Complete patient summary — ${escapeHtml(profileName)}</title>
<style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f8fafc; color: #0f172a; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.5; }
    main { max-width: 1100px; margin: 0 auto; padding: 28px; }
    .hero { border: 2px solid #0f172a; background: #fff; padding: 22px; border-radius: 14px; }
    h1 { margin: 0; font-size: 26px; }
    h2 { margin: 0 0 12px; font-size: 17px; }
    h2 span { color: #64748b; font-size: 12px; }
    h3 { margin: 0; font-size: 14px; }
    h4 { margin: 14px 0 6px; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; }
    p { margin: 5px 0 0; }
    .meta { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 16px; }
    .meta div, .resource dl div { border: 1px solid #e2e8f0; border-radius: 8px; background: #fff; padding: 9px; }
    dt { color: #64748b; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; }
    dd { margin: 3px 0 0; font-weight: 700; overflow-wrap: anywhere; }
    .limitations { margin-top: 14px; border: 1px solid #f59e0b; background: #fffbeb; border-radius: 10px; padding: 14px; }
    .limitations ul { margin: 8px 0 0; padding-left: 18px; }
    .section { margin-top: 18px; }
    .resource { break-inside: avoid; margin-top: 10px; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff; padding: 14px; }
    .resource header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .resource header p { color: #64748b; }
    .date { flex: 0 0 auto; border-radius: 999px; background: #e2e8f0; padding: 4px 8px; font-size: 10px; font-weight: 700; }
    .resource dl { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; margin: 12px 0 0; }
    .tags { color: #475569; font-size: 10px; }
    pre { margin: 0; max-width: 100%; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; border-radius: 8px; background: #0f172a; color: #e2e8f0; padding: 12px; font: 10px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; }
    .empty { border: 1px dashed #cbd5e1; border-radius: 10px; background: #fff; padding: 12px; color: #64748b; }
    @media (max-width: 720px) {
        main { padding: 14px; }
        .meta, .resource dl { grid-template-columns: 1fr; }
        .resource header { flex-direction: column; }
    }
    @media print {
        body { background: #fff; }
        main { max-width: none; padding: 0; }
        .hero, .resource { box-shadow: none; }
        pre { color: #0f172a; background: #f8fafc; border: 1px solid #cbd5e1; }
    }
</style>
</head>
<body>
<main>
    <section class="hero">
        <p>MediBrief complete confirmed-record summary</p>
        <h1>${escapeHtml(profileName)}</h1>
        <div class="meta">
            <div><dt>Patient ID</dt><dd>${escapeHtml(summary.patientId)}</dd></div>
            <div><dt>Record updated</dt><dd>${escapeHtml(summary.recordUpdatedAt)}</dd></div>
            <div><dt>Export generated</dt><dd>${escapeHtml(summary.generatedAt)}</dd></div>
            <div><dt>Confirmed resources</dt><dd>${summary.confirmedResourceCount}</dd></div>
            <div><dt>Pending candidates excluded</dt><dd>${summary.excludedHistoryCounts.candidate}</dd></div>
            <div><dt>Error history excluded</dt><dd>${summary.excludedHistoryCounts.enteredInError}</dd></div>
        </div>
        <h4>Patient profile</h4>
        <pre>${safeJson(summary.patientProfile)}</pre>
    </section>
    <section class="limitations">
        <strong>Scope and limitations</strong>
        <ul>${summary.limitations.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
    </section>
    ${sectionHtml}
</main>
</body>
</html>`;
};
