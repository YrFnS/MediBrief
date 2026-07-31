import {
    findResourceInRecord,
    selectCandidateResources,
    selectConfirmedResources,
} from '../clinical-record';
import type {
    ClinicalDate,
    ClinicalPeriod,
    ClinicalRecordResource,
    ClinicalReference,
    ClinicalResourceType,
    ClinicalNoteRecord,
    DocumentReferenceRecord,
    EncounterRecord,
    ImmunizationRecord,
    PatientClinicalRecord,
    PatientClinicalResource,
    ProcedureRecord,
} from '../clinical-record';
import type {
    ClinicalHistoryScope,
    ClinicalNotesModuleViewModel,
    DeviceRelatedRecordView,
    DocumentModuleItem,
    DocumentsModuleViewModel,
    EncounterModuleItem,
    EncounterModuleViewModel,
    ImmunizationModuleItem,
    ImmunizationModuleViewModel,
    LinkedRecordView,
    ProcedureModuleItem,
    ProcedureModuleViewModel,
} from './coreModuleTypes';
import { buildResourceProvenanceView } from './coreModuleViewModels';
import {
    formatClinicalDate,
    formatDateTime,
    humanizeToken,
} from './viewModels';

const normalizeText = (value?: string): string =>
    (value || '').trim().replace(/\s+/g, ' ');

const lower = (value?: string): string => normalizeText(value).toLowerCase();

const unique = (values: string[]): string[] => [
    ...new Set(values.map(normalizeText).filter(Boolean)),
].sort((left, right) => left.localeCompare(right));

const matchesSearch = (searchText: string, search?: string): boolean => {
    const query = lower(search);
    return !query || searchText.includes(query);
};

const validTimestamp = (value: number): number | null =>
    Number.isNaN(value) ? null : value;

const clinicalDateStart = (date?: ClinicalDate): number | null => {
    if (!date?.value || date.precision === 'unknown') return null;
    if (date.precision === 'year') {
        return validTimestamp(Date.parse(`${date.value}-01-01T00:00:00.000Z`));
    }
    if (date.precision === 'month') {
        return validTimestamp(Date.parse(`${date.value}-01T00:00:00.000Z`));
    }
    return validTimestamp(Date.parse(`${date.value}T00:00:00.000Z`));
};

const recordedTimestamp = (resource: ClinicalRecordResource): number =>
    validTimestamp(Date.parse(resource.recordedAt)) || 0;

const dateLikeView = (
    value: ClinicalDate | ClinicalPeriod | undefined,
    fallback: ClinicalRecordResource,
): {
    known: boolean;
    label: string;
    startLabel: string;
    endLabel: string;
    sortTimestamp: number;
} => {
    if (!value) {
        return {
            known: false,
            label: 'Clinical date unknown',
            startLabel: 'Unknown',
            endLabel: 'Unknown',
            sortTimestamp: recordedTimestamp(fallback),
        };
    }

    if ('precision' in value) {
        const timestamp = clinicalDateStart(value);
        if (timestamp === null) {
            return {
                known: false,
                label: 'Clinical date unknown',
                startLabel: 'Unknown',
                endLabel: 'Unknown',
                sortTimestamp: recordedTimestamp(fallback),
            };
        }
        const label = formatClinicalDate(value);
        return {
            known: true,
            label,
            startLabel: label,
            endLabel: label,
            sortTimestamp: timestamp,
        };
    }

    const startTimestamp = clinicalDateStart(value.start);
    const endTimestamp = clinicalDateStart(value.end);
    const known = startTimestamp !== null || endTimestamp !== null;
    if (!known) {
        return {
            known: false,
            label: 'Clinical date unknown',
            startLabel: 'Unknown',
            endLabel: 'Unknown',
            sortTimestamp: recordedTimestamp(fallback),
        };
    }

    const startLabel = value.start ? formatClinicalDate(value.start) : 'Unknown';
    const endLabel = value.end ? formatClinicalDate(value.end) : 'Ongoing / unknown';
    return {
        known: true,
        label: startLabel === endLabel
            ? startLabel
            : `${startLabel} — ${endLabel}`,
        startLabel,
        endLabel,
        sortTimestamp: startTimestamp ?? endTimestamp ?? recordedTimestamp(fallback),
    };
};

const conceptTexts = (values?: Array<{ text: string }>): string[] =>
    unique((values || []).map(value => value.text));

const quantityLabel = (quantity?: {
    original: {
        value: number;
        unit?: string;
        comparator?: '<' | '<=' | '>=' | '>';
    };
    normalized?: {
        value: number;
        unit?: string;
        comparator?: '<' | '<=' | '>=' | '>';
    };
}): { original?: string; normalized?: string } => {
    if (!quantity) return {};
    const format = (value: {
        value: number;
        unit?: string;
        comparator?: string;
    }): string => `${value.comparator || ''}${value.value}${value.unit ? ` ${value.unit}` : ''}`;
    return {
        original: format(quantity.original),
        ...(quantity.normalized
            ? { normalized: format(quantity.normalized) }
            : {}),
    };
};

const resourceDisplayLabel = (resource: ClinicalRecordResource): string => {
    switch (resource.resourceType) {
        case 'PatientProfile':
            return resource.displayName;
        case 'Encounter':
            return resource.type?.text || humanizeToken(resource.encounterClass);
        case 'Condition':
            return resource.code.text;
        case 'AllergyIntolerance':
            return resource.substance.text;
        case 'Medication':
            return resource.medication.text;
        case 'Observation':
            return resource.code.text;
        case 'DiagnosticReport':
            return resource.code.text;
        case 'Specimen':
            return resource.type?.text || 'Specimen';
        case 'Procedure':
            return resource.code.text;
        case 'Immunization':
            return resource.vaccineCode.text;
        case 'Appointment':
            return resource.title || 'Appointment';
        case 'ClinicalTask':
            return resource.title;
        case 'CarePlan':
            return resource.title;
        case 'DocumentReference':
            return resource.title || resource.fileName;
        case 'ClinicalNote':
            return resource.title;
    }
};

const resourceDateLabel = (resource: ClinicalRecordResource): string | undefined => {
    switch (resource.resourceType) {
        case 'Encounter':
            return dateLikeView(resource.period, resource).label;
        case 'Condition':
            return resource.onset ? formatClinicalDate(resource.onset) : undefined;
        case 'AllergyIntolerance':
            return resource.lastOccurrence
                ? formatClinicalDate(resource.lastOccurrence)
                : undefined;
        case 'Medication':
            return resource.start ? formatClinicalDate(resource.start) : undefined;
        case 'Observation':
            return dateLikeView(resource.effective, resource).label;
        case 'DiagnosticReport':
            return dateLikeView(resource.effectivePeriod || resource.effective, resource).label;
        case 'Specimen':
            return resource.collectedAt
                ? formatClinicalDate(resource.collectedAt)
                : undefined;
        case 'Procedure':
            return dateLikeView(resource.performed || resource.effective, resource).label;
        case 'Immunization':
            return resource.occurrence
                ? formatClinicalDate(resource.occurrence)
                : undefined;
        case 'Appointment':
            return resource.start ? formatDateTime(resource.start) : undefined;
        case 'ClinicalTask':
            return dateLikeView(resource.due, resource).label;
        case 'CarePlan':
            return dateLikeView(resource.period, resource).label;
        case 'DocumentReference':
            return resource.authoredOn
                ? formatClinicalDate(resource.authoredOn)
                : undefined;
        case 'ClinicalNote':
            return formatDateTime(resource.authoredAt);
        case 'PatientProfile':
            return resource.dateOfBirth
                ? formatClinicalDate(resource.dateOfBirth)
                : undefined;
    }
};

const linkedView = (
    record: PatientClinicalRecord,
    resourceType: ClinicalResourceType,
    id: string,
    fallbackLabel?: string,
): LinkedRecordView => {
    const resource = findResourceInRecord(record, resourceType, id);
    if (!resource) {
        return {
            id,
            resourceType,
            label: fallbackLabel || `Missing ${resourceType} reference`,
            missing: true,
        };
    }
    return {
        id,
        resourceType,
        label: resourceDisplayLabel(resource),
        ...(resourceDateLabel(resource)
            ? { dateLabel: resourceDateLabel(resource) }
            : {}),
    };
};

const linkedReferenceView = (
    record: PatientClinicalRecord,
    reference: ClinicalReference,
): LinkedRecordView => {
    if (!reference.resourceType) {
        return {
            id: reference.id,
            resourceType: 'Unknown',
            label: reference.display || 'Unspecified related record',
            missing: true,
        };
    }
    return linkedView(
        record,
        reference.resourceType,
        reference.id,
        reference.display,
    );
};

const encounterIsCurrent = (encounter: EncounterRecord): boolean => [
    'planned',
    'in-progress',
    'unknown',
].includes(encounter.status);

const encounterItem = (
    record: PatientClinicalRecord,
    encounter: EncounterRecord,
    confirmed: PatientClinicalResource[],
): EncounterModuleItem => {
    const period = dateLikeView(encounter.period || encounter.effective, encounter);
    const reasons = conceptTexts(encounter.reason);
    const participants = encounter.participants.map(participant => ({
        ...(participant.role?.text ? { role: participant.role.text } : {}),
        ...(participant.person ? { person: participant.person } : {}),
        ...(participant.organization
            ? { organization: participant.organization }
            : {}),
    }));
    const linkedNotes = confirmed
        .filter((resource): resource is ClinicalNoteRecord =>
            resource.resourceType === 'ClinicalNote'
            && resource.encounterId === encounter.id)
        .map(note => linkedView(record, 'ClinicalNote', note.id));
    const linkedProcedures = confirmed
        .filter((resource): resource is ProcedureRecord =>
            resource.resourceType === 'Procedure'
            && resource.encounterId === encounter.id)
        .map(procedure => linkedView(record, 'Procedure', procedure.id));
    const linkedReports = confirmed
        .filter(resource =>
            resource.resourceType === 'DiagnosticReport'
            && resource.encounterId === encounter.id)
        .map(report => linkedView(record, 'DiagnosticReport', report.id));
    const linkedDocuments = confirmed
        .filter((resource): resource is DocumentReferenceRecord =>
            resource.resourceType === 'DocumentReference'
            && resource.relatedResources.some(reference =>
                reference.resourceType === 'Encounter'
                && reference.id === encounter.id))
        .map(document => linkedView(record, 'DocumentReference', document.id));
    const title = encounter.type?.text
        || `${humanizeToken(encounter.encounterClass)} encounter`;
    const searchText = [
        title,
        encounter.status,
        encounter.encounterClass,
        period.label,
        ...reasons,
        ...participants.flatMap(participant => [
            participant.role,
            participant.person,
            participant.organization,
        ]),
        encounter.location,
        encounter.serviceProvider,
        ...linkedNotes.map(item => item.label),
        ...linkedProcedures.map(item => item.label),
        ...linkedReports.map(item => item.label),
        ...linkedDocuments.map(item => item.label),
        buildResourceProvenanceView(encounter).sourceLabel,
        ...(encounter.tags || []),
    ].filter(Boolean).join(' ').toLowerCase();

    return {
        id: encounter.id,
        title,
        status: encounter.status,
        statusLabel: humanizeToken(encounter.status),
        encounterClass: encounter.encounterClass,
        encounterClassLabel: humanizeToken(encounter.encounterClass),
        current: encounterIsCurrent(encounter),
        periodLabel: period.label,
        startLabel: period.startLabel,
        endLabel: period.endLabel,
        knownClinicalDate: period.known,
        reasons,
        participants,
        ...(encounter.location ? { location: encounter.location } : {}),
        ...(encounter.serviceProvider
            ? { serviceProvider: encounter.serviceProvider }
            : {}),
        linkedNotes,
        linkedProcedures,
        linkedReports,
        linkedDocuments,
        provenance: buildResourceProvenanceView(encounter),
        searchText,
        sortTimestamp: period.sortTimestamp,
    };
};

export const buildEncounterModuleViewModel = (
    record: PatientClinicalRecord,
    options: {
        search?: string;
        scope?: ClinicalHistoryScope;
        status?: string;
        encounterClass?: string;
    } = {},
): EncounterModuleViewModel => {
    const confirmed = selectConfirmedResources(record);
    const allItems = confirmed
        .filter((resource): resource is EncounterRecord =>
            resource.resourceType === 'Encounter')
        .map(encounter => encounterItem(record, encounter, confirmed));
    const scope = options.scope || 'all';
    const status = options.status || 'all';
    const encounterClass = options.encounterClass || 'all';
    const items = allItems
        .filter(item => scope === 'all'
            || (scope === 'current' ? item.current : !item.current))
        .filter(item => status === 'all' || item.status === status)
        .filter(item => encounterClass === 'all'
            || item.encounterClass === encounterClass)
        .filter(item => matchesSearch(item.searchText, options.search))
        .sort((left, right) => {
            if (left.current !== right.current) return left.current ? -1 : 1;
            if (left.knownClinicalDate !== right.knownClinicalDate) {
                return left.knownClinicalDate ? -1 : 1;
            }
            if (left.sortTimestamp !== right.sortTimestamp) {
                return right.sortTimestamp - left.sortTimestamp;
            }
            return left.title.localeCompare(right.title);
        });

    return {
        items,
        totalConfirmed: allItems.length,
        currentCount: allItems.filter(item => item.current).length,
        historicalCount: allItems.filter(item => !item.current).length,
        candidateCount: selectCandidateResources(record).filter(resource =>
            resource.resourceType === 'Encounter').length,
        statusOptions: unique(allItems.map(item => item.status)),
        classOptions: unique(allItems.map(item => item.encounterClass)),
    };
};

const noteItem = (
    record: PatientClinicalRecord,
    note: ClinicalNoteRecord,
): ClinicalNotesModuleViewModel['items'][number] => {
    const encounter = note.encounterId
        ? linkedView(record, 'Encounter', note.encounterId)
        : undefined;
    const sections = note.sections.map(section => ({
        title: section.title,
        ...(section.code?.text ? { code: section.code.text } : {}),
        text: section.text,
    }));
    const searchText = [
        note.title,
        note.status,
        note.noteType,
        note.author,
        encounter?.label,
        ...sections.flatMap(section => [section.title, section.code, section.text]),
        ...note.sourceDocumentIds,
        note.transcriptDocumentId,
        note.amendsNoteId,
        buildResourceProvenanceView(note).sourceLabel,
        ...(note.tags || []),
    ].filter(Boolean).join(' ').toLowerCase();

    return {
        id: note.id,
        title: note.title,
        status: note.status,
        statusLabel: humanizeToken(note.status),
        noteType: note.noteType,
        noteTypeLabel: humanizeToken(note.noteType),
        authoredLabel: formatDateTime(note.authoredAt),
        ...(note.author ? { author: note.author } : {}),
        ...(encounter ? { encounter } : {}),
        sections,
        sourceDocumentIds: note.sourceDocumentIds,
        ...(note.transcriptDocumentId
            ? { transcriptDocumentId: note.transcriptDocumentId }
            : {}),
        ...(note.amendsNoteId ? { amendsNoteId: note.amendsNoteId } : {}),
        provenance: buildResourceProvenanceView(note),
        searchText,
        sortTimestamp: validTimestamp(Date.parse(note.authoredAt))
            || recordedTimestamp(note),
    };
};

export const buildClinicalNotesModuleViewModel = (
    record: PatientClinicalRecord,
    options: {
        search?: string;
        status?: string;
        noteType?: string;
    } = {},
): ClinicalNotesModuleViewModel => {
    const allItems = selectConfirmedResources(record)
        .filter((resource): resource is ClinicalNoteRecord =>
            resource.resourceType === 'ClinicalNote')
        .map(note => noteItem(record, note));
    const status = options.status || 'all';
    const noteType = options.noteType || 'all';
    const items = allItems
        .filter(item => status === 'all' || item.status === status)
        .filter(item => noteType === 'all' || item.noteType === noteType)
        .filter(item => matchesSearch(item.searchText, options.search))
        .sort((left, right) => {
            if (left.sortTimestamp !== right.sortTimestamp) {
                return right.sortTimestamp - left.sortTimestamp;
            }
            return left.title.localeCompare(right.title);
        });

    return {
        items,
        totalConfirmed: allItems.length,
        draftCount: allItems.filter(item => item.status === 'draft').length,
        finalCount: allItems.filter(item => item.status === 'final').length,
        amendedCount: allItems.filter(item => item.status === 'amended').length,
        candidateCount: selectCandidateResources(record).filter(resource =>
            resource.resourceType === 'ClinicalNote').length,
        statusOptions: unique(allItems.map(item => item.status)),
        typeOptions: unique(allItems.map(item => item.noteType)),
    };
};

const DEVICE_TERMS = [
    'device',
    'implant',
    'implanted',
    'pacemaker',
    'defibrillator',
    'stent',
    'prosthesis',
    'prosthetic',
    'catheter',
    'port',
    'graft',
    'mesh',
    'plate',
    'screw',
    'clip',
    'pump',
    'sensor',
    'monitor',
    'iud',
    'cochlear',
];

const matchedDeviceTerms = (values: Array<string | undefined>): string[] => {
    const haystack = values.filter(Boolean).join(' ').toLowerCase();
    return DEVICE_TERMS.filter(term => haystack.includes(term));
};

const documentDeviceTerms = (document: DocumentReferenceRecord): string[] =>
    matchedDeviceTerms([
        document.title,
        document.fileName,
        document.documentType?.text,
        document.description,
        ...(document.tags || []),
    ]);

const procedureIsCurrent = (procedure: ProcedureRecord): boolean => [
    'preparation',
    'in-progress',
    'on-hold',
    'unknown',
].includes(procedure.status);

const procedureItem = (
    record: PatientClinicalRecord,
    procedure: ProcedureRecord,
    confirmedDocuments: DocumentReferenceRecord[],
): ProcedureModuleItem => {
    const performed = dateLikeView(
        procedure.performed || procedure.effective,
        procedure,
    );
    const bodySites = conceptTexts(procedure.bodySite);
    const reasons = conceptTexts(procedure.reason);
    const complications = conceptTexts(procedure.complications);
    const encounter = procedure.encounterId
        ? linkedView(record, 'Encounter', procedure.encounterId)
        : undefined;
    const linkedReports = (procedure.reportIds || []).map(id =>
        linkedView(record, 'DiagnosticReport', id));
    const linkedDocuments = confirmedDocuments
        .filter(document => document.relatedResources.some(reference =>
            reference.resourceType === 'Procedure'
            && reference.id === procedure.id))
        .map(document => linkedView(record, 'DocumentReference', document.id));
    const deviceTerms = matchedDeviceTerms([
        procedure.code.text,
        procedure.outcome?.text,
        ...bodySites,
        ...reasons,
        ...complications,
        procedure.note,
        ...(procedure.tags || []),
        ...linkedDocuments.map(document => document.label),
    ]);
    const searchText = [
        procedure.code.text,
        procedure.status,
        performed.label,
        ...bodySites,
        ...reasons,
        procedure.outcome?.text,
        ...complications,
        ...(procedure.performer || []),
        encounter?.label,
        ...linkedReports.map(item => item.label),
        ...linkedDocuments.map(item => item.label),
        procedure.note,
        ...deviceTerms,
        buildResourceProvenanceView(procedure).sourceLabel,
        ...(procedure.tags || []),
    ].filter(Boolean).join(' ').toLowerCase();

    return {
        id: procedure.id,
        name: procedure.code.text,
        status: procedure.status,
        statusLabel: humanizeToken(procedure.status),
        current: procedureIsCurrent(procedure),
        performedLabel: performed.label,
        knownClinicalDate: performed.known,
        bodySites,
        reasons,
        ...(procedure.outcome?.text ? { outcome: procedure.outcome.text } : {}),
        complications,
        performers: procedure.performer || [],
        ...(encounter ? { encounter } : {}),
        linkedReports,
        linkedDocuments,
        ...(procedure.note ? { note: procedure.note } : {}),
        deviceRelated: deviceTerms.length > 0,
        matchedDeviceTerms: deviceTerms,
        provenance: buildResourceProvenanceView(procedure),
        searchText,
        sortTimestamp: performed.sortTimestamp,
    };
};

const deviceRelatedDocumentView = (
    document: DocumentReferenceRecord,
): DeviceRelatedRecordView | null => {
    const terms = documentDeviceTerms(document);
    if (terms.length === 0) return null;
    const authored = dateLikeView(document.authoredOn, document);
    return {
        id: document.id,
        sourceType: 'document',
        label: document.title || document.fileName,
        ...(document.description ? { detail: document.description } : {}),
        dateLabel: authored.label,
        knownClinicalDate: authored.known,
        matchedTerms: terms,
        provenance: buildResourceProvenanceView(document),
    };
};

export const buildProcedureModuleViewModel = (
    record: PatientClinicalRecord,
    options: {
        search?: string;
        scope?: ClinicalHistoryScope;
        status?: string;
        deviceRelatedOnly?: boolean;
    } = {},
): ProcedureModuleViewModel => {
    const confirmed = selectConfirmedResources(record);
    const documents = confirmed.filter(
        (resource): resource is DocumentReferenceRecord =>
            resource.resourceType === 'DocumentReference',
    );
    const allItems = confirmed
        .filter((resource): resource is ProcedureRecord =>
            resource.resourceType === 'Procedure')
        .map(procedure => procedureItem(record, procedure, documents));
    const scope = options.scope || 'all';
    const status = options.status || 'all';
    const items = allItems
        .filter(item => scope === 'all'
            || (scope === 'current' ? item.current : !item.current))
        .filter(item => status === 'all' || item.status === status)
        .filter(item => !options.deviceRelatedOnly || item.deviceRelated)
        .filter(item => matchesSearch(item.searchText, options.search))
        .sort((left, right) => {
            if (left.current !== right.current) return left.current ? -1 : 1;
            if (left.knownClinicalDate !== right.knownClinicalDate) {
                return left.knownClinicalDate ? -1 : 1;
            }
            if (left.sortTimestamp !== right.sortTimestamp) {
                return right.sortTimestamp - left.sortTimestamp;
            }
            return left.name.localeCompare(right.name);
        });
    const procedureDeviceRecords: DeviceRelatedRecordView[] = allItems
        .filter(item => item.deviceRelated)
        .map(item => ({
            id: item.id,
            sourceType: 'procedure',
            label: item.name,
            ...(item.note ? { detail: item.note } : {}),
            dateLabel: item.performedLabel,
            knownClinicalDate: item.knownClinicalDate,
            matchedTerms: item.matchedDeviceTerms,
            provenance: item.provenance,
        }));
    const documentDeviceRecords = documents
        .map(deviceRelatedDocumentView)
        .filter((item): item is DeviceRelatedRecordView => item !== null);
    const deviceRelatedRecords = [...procedureDeviceRecords, ...documentDeviceRecords]
        .sort((left, right) => {
            if (left.knownClinicalDate !== right.knownClinicalDate) {
                return left.knownClinicalDate ? -1 : 1;
            }
            return left.label.localeCompare(right.label);
        });

    return {
        items,
        deviceRelatedRecords,
        totalConfirmed: allItems.length,
        currentCount: allItems.filter(item => item.current).length,
        historicalCount: allItems.filter(item => !item.current).length,
        deviceRelatedCount: deviceRelatedRecords.length,
        candidateCount: selectCandidateResources(record).filter(resource =>
            resource.resourceType === 'Procedure').length,
        statusOptions: unique(allItems.map(item => item.status)),
    };
};

const immunizationItem = (
    immunization: ImmunizationRecord,
): ImmunizationModuleItem => {
    const occurrence = dateLikeView(
        immunization.occurrence || immunization.effective,
        immunization,
    );
    const dose = quantityLabel(immunization.doseQuantity);
    const reasons = conceptTexts(immunization.reason);
    const provenance = buildResourceProvenanceView(immunization);
    const searchText = [
        immunization.vaccineCode.text,
        immunization.status,
        occurrence.label,
        immunization.lotNumber,
        immunization.manufacturer,
        dose.original,
        dose.normalized,
        immunization.site?.text,
        immunization.route?.text,
        ...reasons,
        immunization.performer,
        immunization.note,
        provenance.sourceLabel,
        ...provenance.tags,
    ].filter(Boolean).join(' ').toLowerCase();

    return {
        id: immunization.id,
        vaccine: immunization.vaccineCode.text,
        status: immunization.status,
        statusLabel: humanizeToken(immunization.status),
        occurrenceLabel: occurrence.label,
        knownClinicalDate: occurrence.known,
        ...(immunization.lotNumber
            ? { lotNumber: immunization.lotNumber }
            : {}),
        ...(immunization.manufacturer
            ? { manufacturer: immunization.manufacturer }
            : {}),
        ...(dose.original ? { dose: dose.original } : {}),
        ...(dose.normalized && dose.normalized !== dose.original
            ? { normalizedDose: dose.normalized }
            : {}),
        ...(immunization.site?.text ? { site: immunization.site.text } : {}),
        ...(immunization.route?.text ? { route: immunization.route.text } : {}),
        reasons,
        ...(immunization.performer
            ? { performer: immunization.performer }
            : {}),
        ...(immunization.note ? { note: immunization.note } : {}),
        provenance,
        searchText,
        sortTimestamp: occurrence.sortTimestamp,
    };
};

export const buildImmunizationModuleViewModel = (
    record: PatientClinicalRecord,
    options: {
        search?: string;
        status?: string;
    } = {},
): ImmunizationModuleViewModel => {
    const allItems = selectConfirmedResources(record)
        .filter((resource): resource is ImmunizationRecord =>
            resource.resourceType === 'Immunization')
        .map(immunizationItem);
    const status = options.status || 'all';
    const items = allItems
        .filter(item => status === 'all' || item.status === status)
        .filter(item => matchesSearch(item.searchText, options.search))
        .sort((left, right) => {
            if (left.knownClinicalDate !== right.knownClinicalDate) {
                return left.knownClinicalDate ? -1 : 1;
            }
            if (left.sortTimestamp !== right.sortTimestamp) {
                return right.sortTimestamp - left.sortTimestamp;
            }
            return left.vaccine.localeCompare(right.vaccine);
        });

    return {
        items,
        totalConfirmed: allItems.length,
        completedCount: allItems.filter(item => item.status === 'completed').length,
        notDoneCount: allItems.filter(item => item.status === 'not-done').length,
        unknownDateCount: allItems.filter(item => !item.knownClinicalDate).length,
        candidateCount: selectCandidateResources(record).filter(resource =>
            resource.resourceType === 'Immunization').length,
        statusOptions: unique(allItems.map(item => item.status)),
    };
};

const mimeFamily = (mimeType: string): string => {
    const normalized = lower(mimeType);
    if (normalized === 'application/pdf') return 'PDF';
    if (normalized.startsWith('image/')) return 'Image';
    if (normalized.startsWith('text/') || normalized === 'application/json') {
        return 'Text';
    }
    if (normalized.includes('dicom')) return 'DICOM';
    return 'Other';
};

const documentItem = (
    record: PatientClinicalRecord,
    document: DocumentReferenceRecord,
): DocumentModuleItem => {
    const authored = dateLikeView(document.authoredOn, document);
    const relatedResources = document.relatedResources.map(reference =>
        linkedReferenceView(record, reference));
    const provenance = buildResourceProvenanceView(document);
    const family = mimeFamily(document.mimeType);
    const title = document.title || document.fileName;
    const searchText = [
        title,
        document.fileName,
        document.status,
        document.documentType?.text,
        authored.label,
        document.uploadedAt,
        document.mimeType,
        family,
        document.pageCount?.toString(),
        document.hash,
        document.description,
        ...relatedResources.flatMap(resource => [
            resource.resourceType,
            resource.label,
            resource.detail,
            resource.dateLabel,
        ]),
        provenance.sourceLabel,
        ...provenance.tags,
    ].filter(Boolean).join(' ').toLowerCase();

    return {
        id: document.id,
        title,
        fileName: document.fileName,
        status: document.status,
        statusLabel: humanizeToken(document.status),
        ...(document.documentType?.text
            ? { documentType: document.documentType.text }
            : {}),
        authoredLabel: authored.label,
        knownClinicalDate: authored.known,
        uploadedLabel: formatDateTime(document.uploadedAt),
        mimeType: document.mimeType,
        mimeFamily: family,
        ...(document.pageCount ? { pageCount: document.pageCount } : {}),
        ...(document.hash ? { hash: document.hash } : {}),
        ...(document.description ? { description: document.description } : {}),
        relatedResources,
        previewSource: {
            documentId: document.id,
            fileName: document.fileName,
        },
        provenance,
        searchText,
        sortTimestamp: authored.sortTimestamp,
    };
};

export const buildDocumentsModuleViewModel = (
    record: PatientClinicalRecord,
    options: {
        search?: string;
        status?: string;
        mimeFamily?: string;
        documentType?: string;
    } = {},
): DocumentsModuleViewModel => {
    const allItems = selectConfirmedResources(record)
        .filter((resource): resource is DocumentReferenceRecord =>
            resource.resourceType === 'DocumentReference')
        .map(document => documentItem(record, document));
    const status = options.status || 'all';
    const family = options.mimeFamily || 'all';
    const documentType = options.documentType || 'all';
    const items = allItems
        .filter(item => status === 'all' || item.status === status)
        .filter(item => family === 'all' || item.mimeFamily === family)
        .filter(item => documentType === 'all'
            || item.documentType === documentType)
        .filter(item => matchesSearch(item.searchText, options.search))
        .sort((left, right) => {
            if (left.status !== right.status) {
                if (left.status === 'current') return -1;
                if (right.status === 'current') return 1;
            }
            if (left.knownClinicalDate !== right.knownClinicalDate) {
                return left.knownClinicalDate ? -1 : 1;
            }
            if (left.sortTimestamp !== right.sortTimestamp) {
                return right.sortTimestamp - left.sortTimestamp;
            }
            return left.title.localeCompare(right.title);
        });

    return {
        items,
        totalConfirmed: allItems.length,
        currentCount: allItems.filter(item => item.status === 'current').length,
        supersededCount: allItems.filter(item =>
            item.status === 'superseded').length,
        candidateCount: selectCandidateResources(record).filter(resource =>
            resource.resourceType === 'DocumentReference').length,
        mimeFamilyOptions: unique(allItems.map(item => item.mimeFamily)),
        documentTypeOptions: unique(allItems
            .map(item => item.documentType)
            .filter((value): value is string => Boolean(value))),
    };
};
