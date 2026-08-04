import { v4 as uuidv4 } from 'uuid';
import {
    createClinicalProvenance,
    createRecordSource,
    createUnknownClinicalDate,
    findResourceInRecord,
    flattenPatientResources,
    getResourceDateBounds,
    parseClinicalRecordResource,
} from '../clinical-record';
import type {
    ClinicalDate,
    ClinicalPeriod,
    ClinicalRecordResource,
    ClinicalReference,
    ClinicalResourceType,
    PatientClinicalRecord,
    PatientClinicalResource,
} from '../clinical-record';
import { formatClinicalDate, formatDateTime, humanizeToken } from './viewModels';

export type ManagedManualResourceType =
    | 'Encounter'
    | 'Condition'
    | 'AllergyIntolerance'
    | 'Medication'
    | 'Observation'
    | 'DiagnosticReport'
    | 'Specimen'
    | 'Procedure'
    | 'Immunization'
    | 'Appointment'
    | 'ClinicalTask'
    | 'CarePlan'
    | 'ClinicalNote';

export const MANAGED_MANUAL_RESOURCE_OPTIONS: Array<{
    value: ManagedManualResourceType;
    label: string;
    description: string;
}> = [
    { value: 'Condition', label: 'Condition', description: 'Problem or diagnosis record' },
    { value: 'AllergyIntolerance', label: 'Allergy or intolerance', description: 'Substance, status, and reaction context' },
    { value: 'Medication', label: 'Medication', description: 'Current or historical medication record' },
    { value: 'Observation', label: 'Observation or result', description: 'Vital, laboratory, or qualitative result' },
    { value: 'DiagnosticReport', label: 'Diagnostic report', description: 'Report-level result grouping and conclusion' },
    { value: 'Specimen', label: 'Specimen', description: 'Collected sample and source details' },
    { value: 'Encounter', label: 'Visit or encounter', description: 'Care setting, participants, and period' },
    { value: 'Procedure', label: 'Procedure', description: 'Intervention, outcome, and related care' },
    { value: 'Immunization', label: 'Immunization', description: 'Vaccine administration or not-done record' },
    { value: 'Appointment', label: 'Appointment', description: 'Proposed, pending, booked, or historical appointment' },
    { value: 'ClinicalTask', label: 'Task or reminder', description: 'Local follow-up task with intent and due state' },
    { value: 'CarePlan', label: 'Care plan', description: 'Plan, proposal, option, or recorded order intent' },
    { value: 'ClinicalNote', label: 'Clinical note', description: 'Durable structured note independent of chat' },
];

export type ManualEditorMode = 'create' | 'amend';
export type ManualFormValue = string | boolean;
export type ManualFormValues = Record<string, ManualFormValue>;

export interface ManualFieldOption {
    value: string;
    label: string;
}

export interface ManualFieldDefinition {
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'select' | 'checkbox' | 'number' | 'date' | 'datetime-local';
    required?: boolean;
    placeholder?: string;
    helper?: string;
    defaultValue?: ManualFormValue;
    options?: ManualFieldOption[];
    wide?: boolean;
}

export interface ManualRecordIssue {
    field: string;
    message: string;
}

export interface ManualResourceBuildResult {
    ok: boolean;
    issues: ManualRecordIssue[];
    resource?: PatientClinicalResource;
}

export interface ManualAmendmentBuildResult {
    ok: boolean;
    issues: ManualRecordIssue[];
    updates?: Record<string, unknown>;
    preview?: PatientClinicalResource;
}

export interface ManagedResourceSummary {
    id: string;
    resourceType: ClinicalResourceType;
    label: string;
    statusLabel: string;
    verificationStatus: ClinicalRecordResource['verificationStatus'];
    clinicalDateLabel: string;
    knownClinicalDate: boolean;
    sourceLabel: string;
    recordedLabel: string;
    amendmentCount: number;
    searchText: string;
    resource: ClinicalRecordResource;
}

const text = (value: ManualFormValue | undefined): string =>
    typeof value === 'string' ? value.trim() : '';

const checked = (value: ManualFormValue | undefined): boolean => value === true;

const csv = (value: ManualFormValue | undefined): string[] =>
    text(value).split(',').map(item => item.trim()).filter(Boolean);

const concepts = (value: ManualFormValue | undefined): Array<{ text: string }> =>
    csv(value).map(item => ({ text: item }));

const options = (values: string[]): ManualFieldOption[] =>
    values.map(value => ({ value, label: humanizeToken(value) }));

const field = (
    key: string,
    label: string,
    type: ManualFieldDefinition['type'] = 'text',
    extra: Omit<ManualFieldDefinition, 'key' | 'label' | 'type'> = {},
): ManualFieldDefinition => ({ key, label, type, ...extra });

const encounterChoices = (record?: PatientClinicalRecord): ManualFieldOption[] => [
    { value: '', label: 'No linked encounter' },
    ...(record?.resources.encounters
        .filter(item => item.verificationStatus === 'confirmed')
        .map(item => ({
            value: item.id,
            label: item.type?.text || `${humanizeToken(item.encounterClass)} encounter`,
        })) || []),
];

const noteChoices = (record?: PatientClinicalRecord): ManualFieldOption[] => [
    { value: '', label: 'Does not amend another note' },
    ...(record?.resources.notes
        .filter(item => item.verificationStatus === 'confirmed')
        .map(item => ({ value: item.id, label: item.title })) || []),
];

const encounterField = (record?: PatientClinicalRecord): ManualFieldDefinition =>
    field('encounterId', 'Linked encounter', 'select', {
        defaultValue: '',
        options: encounterChoices(record),
        helper: 'Optional. The selected encounter must exist in this patient record.',
    });

export const getManualFieldDefinitions = (
    resourceType: ManagedManualResourceType,
    record?: PatientClinicalRecord,
    mode: ManualEditorMode = 'create',
): ManualFieldDefinition[] => {
    const dateHelp = 'Use YYYY-MM-DD, YYYY-MM, or YYYY. Leave blank when unknown; the current date is never substituted.';
    switch (resourceType) {
        case 'Condition':
            return [
                field('title', 'Condition', 'text', { required: true, wide: true }),
                field('status', 'Clinical status', 'select', { required: true, defaultValue: 'active', options: options(['active', 'inactive', 'resolved', 'remission', 'unknown']) }),
                field('severity', 'Severity'),
                field('onset', 'Onset date', 'text', { helper: dateHelp }),
                field('abatement', 'Resolution date', 'text', { helper: dateHelp }),
                field('bodySites', 'Body sites', 'text', { placeholder: 'Comma-separated' }),
                encounterField(record),
                field('note', 'Clinical note', 'textarea', { wide: true }),
            ];
        case 'AllergyIntolerance':
            return [
                field('title', 'Substance', 'text', { required: true, wide: true }),
                field('status', 'Clinical status', 'select', { required: true, defaultValue: 'active', options: options(['active', 'inactive', 'resolved', 'unknown']) }),
                field('criticality', 'Criticality', 'select', { required: true, defaultValue: 'unable-to-assess', options: options(['low', 'high', 'unable-to-assess']) }),
                field('categories', 'Categories', 'text', { defaultValue: 'other', helper: 'Comma-separated: food, medication, environment, biologic, or other.' }),
                ...(mode === 'create' ? [
                    field('reaction', 'Reaction manifestation'),
                    field('reactionSeverity', 'Reaction severity', 'select', { defaultValue: 'unknown', options: options(['mild', 'moderate', 'severe', 'unknown']) }),
                    field('reactionOnset', 'Reaction onset', 'text', { helper: dateHelp }),
                    field('exposureRoute', 'Exposure route'),
                ] : []),
                field('lastOccurrence', 'Last occurrence', 'text', { helper: dateHelp }),
                field('note', 'Clinical note', 'textarea', {
                    wide: true,
                    helper: mode === 'amend'
                        ? 'Existing reaction structure is preserved. Use entered-in-error plus a replacement record when reaction details themselves are wrong.'
                        : undefined,
                }),
            ];
        case 'Medication':
            return [
                field('title', 'Medication', 'text', { required: true, wide: true }),
                field('kind', 'Record kind', 'select', { required: true, defaultValue: 'statement', options: options(['statement', 'request', 'administration']) }),
                field('status', 'Status', 'select', { required: true, defaultValue: 'active', options: options(['active', 'completed', 'stopped', 'on-hold', 'not-taken', 'unknown']) }),
                ...(mode === 'create' ? [
                    field('dosageText', 'Dosage instructions', 'text', { wide: true }),
                    field('doseValue', 'Dose value', 'number'),
                    field('doseUnit', 'Dose unit'),
                    field('route', 'Route'),
                    field('frequency', 'Frequency'),
                    field('timing', 'Timing'),
                    field('asNeeded', 'As needed (PRN)', 'checkbox', { defaultValue: false }),
                ] : []),
                field('reason', 'Reason or indication', 'text', { placeholder: 'Comma-separated' }),
                field('start', 'Start date', 'text', { helper: dateHelp }),
                field('end', 'End date', 'text', { helper: dateHelp }),
                field('prescriber', 'Prescriber'),
                encounterField(record),
                field('note', 'Clinical note', 'textarea', {
                    wide: true,
                    helper: mode === 'amend' ? 'Existing dosage instructions are preserved by this compact correction form.' : undefined,
                }),
            ];
        case 'Observation':
            return [
                field('title', 'Observation or test', 'text', { required: true, wide: true }),
                field('status', 'Status', 'select', { required: true, defaultValue: 'final', options: options(['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'unknown']) }),
                field('category', 'Category'),
                field('valueType', 'Value type', 'select', { required: true, defaultValue: 'quantity', options: options(['quantity', 'string', 'boolean', 'integer', 'codeable-concept']) }),
                field('value', 'Original source value', 'text', { required: true }),
                field('unit', 'Original unit', 'text', { helper: 'Used for quantity values. The source value and unit are preserved.' }),
                field('comparator', 'Comparator', 'select', { defaultValue: '', options: [{ value: '', label: 'None' }, ...['<', '<=', '>=', '>'].map(value => ({ value, label: value }))] }),
                field('interpretation', 'Interpretation'),
                field('referenceRange', 'Reference range text'),
                field('effectiveDate', 'Clinical date', 'text', { helper: dateHelp }),
                field('performer', 'Performer or laboratory', 'text', { placeholder: 'Comma-separated' }),
                encounterField(record),
                field('note', 'Clinical note', 'textarea', { wide: true }),
            ];
        case 'DiagnosticReport':
            return [
                field('title', 'Report name', 'text', { required: true, wide: true }),
                field('status', 'Status', 'select', { required: true, defaultValue: 'final', options: options(['registered', 'partial', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'unknown']) }),
                field('category', 'Categories', 'text', { placeholder: 'Comma-separated' }),
                field('start', 'Report period start', 'text', { helper: dateHelp }),
                field('end', 'Report period end', 'text', { helper: dateHelp }),
                field('issuedAt', 'Issued at', 'datetime-local', { helper: 'Issue time remains separate from the clinical report period.' }),
                field('resultIds', 'Observation IDs', 'text', { placeholder: 'Comma-separated existing IDs' }),
                field('specimenIds', 'Specimen IDs', 'text', { placeholder: 'Comma-separated existing IDs' }),
                field('documentIds', 'Document IDs', 'text', { placeholder: 'Comma-separated existing IDs' }),
                field('conclusion', 'Conclusion', 'textarea', { wide: true }),
                field('performer', 'Performer', 'text', { placeholder: 'Comma-separated' }),
                encounterField(record),
            ];
        case 'Specimen':
            return [
                field('title', 'Specimen type', 'text', { required: true, wide: true }),
                field('status', 'Status', 'select', { required: true, defaultValue: 'available', options: options(['available', 'unavailable', 'unsatisfactory', 'unknown']) }),
                field('collectedAt', 'Collected date', 'text', { helper: dateHelp }),
                field('receivedAt', 'Received date', 'text', { helper: dateHelp }),
                field('bodySite', 'Body site'),
                field('collectionMethod', 'Collection method'),
                field('note', 'Clinical note', 'textarea', { wide: true }),
            ];
        case 'Encounter':
            return [
                field('title', 'Visit type', 'text', { required: true, wide: true }),
                field('status', 'Status', 'select', { required: true, defaultValue: 'finished', options: options(['planned', 'in-progress', 'finished', 'cancelled', 'unknown']) }),
                field('encounterClass', 'Encounter class', 'select', { required: true, defaultValue: 'ambulatory', options: options(['ambulatory', 'inpatient', 'emergency', 'virtual', 'home', 'other']) }),
                field('start', 'Start date', 'text', { helper: dateHelp }),
                field('end', 'End date', 'text', { helper: dateHelp }),
                field('reason', 'Reasons', 'text', { placeholder: 'Comma-separated' }),
                field('participant', 'Participant'),
                field('participantRole', 'Participant role'),
                field('location', 'Location'),
                field('serviceProvider', 'Service provider'),
            ];
        case 'Procedure':
            return [
                field('title', 'Procedure', 'text', { required: true, wide: true }),
                field('status', 'Status', 'select', { required: true, defaultValue: 'completed', options: options(['preparation', 'in-progress', 'not-done', 'on-hold', 'stopped', 'completed', 'unknown']) }),
                field('start', 'Performed date or start', 'text', { helper: dateHelp }),
                field('end', 'End date', 'text', { helper: dateHelp }),
                field('bodySites', 'Body sites', 'text', { placeholder: 'Comma-separated' }),
                field('reason', 'Reasons', 'text', { placeholder: 'Comma-separated' }),
                field('outcome', 'Outcome'),
                field('complications', 'Complications', 'text', { placeholder: 'Comma-separated' }),
                field('performer', 'Performers', 'text', { placeholder: 'Comma-separated' }),
                encounterField(record),
                field('reportIds', 'Diagnostic report IDs', 'text', { placeholder: 'Comma-separated existing IDs' }),
                field('note', 'Clinical note', 'textarea', { wide: true }),
            ];
        case 'Immunization':
            return [
                field('title', 'Vaccine', 'text', { required: true, wide: true }),
                field('status', 'Status', 'select', { required: true, defaultValue: 'completed', options: options(['completed', 'not-done', 'unknown']) }),
                field('occurrence', 'Occurrence date', 'text', { helper: dateHelp }),
                field('manufacturer', 'Manufacturer'),
                field('lotNumber', 'Lot number'),
                field('doseValue', 'Dose value', 'number'),
                field('doseUnit', 'Dose unit'),
                field('route', 'Route'),
                field('site', 'Administration site'),
                field('reason', 'Reason', 'text', { placeholder: 'Comma-separated' }),
                field('performer', 'Performer'),
                field('note', 'Clinical note', 'textarea', { wide: true }),
            ];
        case 'Appointment':
            return [
                field('title', 'Appointment title', 'text', { required: true, wide: true }),
                field('status', 'Status', 'select', { required: true, defaultValue: 'proposed', options: options(['proposed', 'pending', 'booked', 'arrived', 'fulfilled', 'cancelled', 'no-show', 'unknown']) }),
                field('startDateTime', 'Start date and time', 'datetime-local', { helper: 'A date does not imply a booking; status controls booking meaning.' }),
                field('endDateTime', 'End date and time', 'datetime-local'),
                field('requestedDate', 'Requested date', 'text', { helper: dateHelp }),
                field('reason', 'Reasons', 'text', { placeholder: 'Comma-separated' }),
                field('participant', 'Participant'),
                field('participantRole', 'Participant role'),
                field('participantStatus', 'Participation status', 'select', { defaultValue: 'needs-action', options: options(['accepted', 'declined', 'tentative', 'needs-action']) }),
                field('location', 'Location'),
                encounterField(record),
                field('description', 'Description', 'textarea', { wide: true }),
                field('note', 'Clinical note', 'textarea', { wide: true }),
            ];
        case 'ClinicalTask':
            return [
                field('title', 'Task title', 'text', { required: true, wide: true }),
                field('status', 'Status', 'select', { required: true, defaultValue: 'requested', options: options(['draft', 'requested', 'received', 'accepted', 'in-progress', 'completed', 'cancelled', 'failed']) }),
                field('intent', 'Intent', 'select', { required: true, defaultValue: 'proposal', options: options(['proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order']), helper: 'Intent is recorded exactly and never proves external execution.' }),
                field('priority', 'Priority', 'select', { required: true, defaultValue: 'routine', options: options(['routine', 'urgent', 'asap', 'stat']) }),
                field('code', 'Task code or category'),
                field('start', 'Due start', 'text', { helper: dateHelp }),
                field('end', 'Due end', 'text', { helper: dateHelp }),
                field('owner', 'Owner'),
                ...(mode === 'create' ? [
                    field('relatedResourceType', 'Related record type', 'select', { defaultValue: '', options: [{ value: '', label: 'No related record' }, ...options(['Condition', 'Appointment', 'Encounter', 'Medication', 'Observation', 'Procedure', 'CarePlan', 'ClinicalNote', 'DocumentReference'])] }),
                    field('relatedResourceId', 'Related record ID', 'text', { helper: 'Both type and ID are required when linking a record.' }),
                ] : []),
                field('completedAt', 'Completed at', 'datetime-local'),
                field('description', 'Description', 'textarea', { wide: true }),
                field('note', 'Clinical note', 'textarea', { wide: true, helper: mode === 'amend' ? 'Existing related-record links are preserved.' : undefined }),
            ];
        case 'CarePlan':
            return [
                field('title', 'Care plan title', 'text', { required: true, wide: true }),
                field('status', 'Status', 'select', { required: true, defaultValue: 'draft', options: options(['draft', 'active', 'on-hold', 'revoked', 'completed', 'unknown']) }),
                field('intent', 'Intent', 'select', { required: true, defaultValue: 'plan', options: options(['proposal', 'plan', 'order', 'option']), helper: 'Plan or order intent does not prove that care was performed.' }),
                field('start', 'Plan start', 'text', { helper: dateHelp }),
                field('end', 'Plan end', 'text', { helper: dateHelp }),
                field('conditionIds', 'Addressed condition IDs', 'text', { placeholder: 'Comma-separated existing IDs' }),
                field('taskIds', 'Activity task IDs', 'text', { placeholder: 'Comma-separated existing IDs' }),
                encounterField(record),
                field('description', 'Description', 'textarea', { wide: true }),
                field('note', 'Clinical note', 'textarea', { wide: true }),
            ];
        case 'ClinicalNote':
            return [
                field('title', 'Note title', 'text', { required: true, wide: true }),
                field('status', 'Status', 'select', { required: true, defaultValue: 'final', options: options(['draft', 'final', 'amended']) }),
                field('noteType', 'Note type', 'select', { required: true, defaultValue: 'patient-note', options: options(['soap', 'visit-note', 'discharge-summary', 'progress-note', 'patient-note', 'other']) }),
                field('authoredAt', 'Authored at', 'datetime-local', { helper: 'Leave blank to use the current time because the note is being authored now.' }),
                field('author', 'Author'),
                encounterField(record),
                ...(mode === 'create' ? [
                    field('sectionTitle', 'Section title', 'text', { required: true, defaultValue: 'Note' }),
                    field('sectionText', 'Section content', 'textarea', { required: true, wide: true }),
                    field('sourceDocumentIds', 'Source document IDs', 'text', { placeholder: 'Comma-separated existing IDs' }),
                    field('transcriptDocumentId', 'Transcript document ID'),
                ] : []),
                field('amendsNoteId', 'Amended note ID', 'select', { defaultValue: '', options: noteChoices(record) }),
                ...(mode === 'amend' ? [
                    field('preservedSections', 'Section content', 'textarea', {
                        wide: true,
                        helper: 'Structured sections are preserved. Mark the note entered in error and create a replacement when section content is wrong.',
                    }),
                ] : []),
            ];
    }
};

export const createInitialManualFormValues = (
    resourceType: ManagedManualResourceType,
    record?: PatientClinicalRecord,
    mode: ManualEditorMode = 'create',
): ManualFormValues => {
    const values: ManualFormValues = {};
    getManualFieldDefinitions(resourceType, record, mode).forEach(definition => {
        values[definition.key] = definition.defaultValue
            ?? (definition.type === 'checkbox' ? false : '');
    });
    return values;
};

const addIssue = (
    issues: ManualRecordIssue[],
    fieldName: string,
    message: string,
): void => {
    issues.push({ field: fieldName, message });
};

const required = (
    values: ManualFormValues,
    key: string,
    label: string,
    issues: ManualRecordIssue[],
): string => {
    const value = text(values[key]);
    if (!value) addIssue(issues, key, `${label} is required.`);
    return value;
};

const dateValue = (
    raw: ManualFormValue | undefined,
    key: string,
    issues: ManualRecordIssue[],
    unknownWhenBlank = false,
): ClinicalDate | undefined => {
    const value = text(raw);
    if (!value) {
        return unknownWhenBlank
            ? createUnknownClinicalDate('Not entered during manual record entry')
            : undefined;
    }
    let precision: ClinicalDate['precision'];
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) precision = 'day';
    else if (/^\d{4}-\d{2}$/.test(value)) precision = 'month';
    else if (/^\d{4}$/.test(value)) precision = 'year';
    else {
        addIssue(issues, key, 'Use YYYY-MM-DD, YYYY-MM, or YYYY. Leave blank when unknown.');
        return undefined;
    }
    if (precision === 'month') {
        const month = Number(value.slice(5, 7));
        if (month < 1 || month > 12) {
            addIssue(issues, key, 'The month must be between 01 and 12.');
            return undefined;
        }
    }
    if (precision === 'day') {
        const parsed = Date.parse(`${value}T00:00:00.000Z`);
        if (Number.isNaN(parsed) || new Date(parsed).toISOString().slice(0, 10) !== value) {
            addIssue(issues, key, 'Enter a valid calendar date.');
            return undefined;
        }
    }
    return { value, precision, sourceText: value };
};

const dateTimeValue = (
    raw: ManualFormValue | undefined,
    key: string,
    issues: ManualRecordIssue[],
    fallback?: string,
): string | undefined => {
    const value = text(raw);
    if (!value) return fallback;
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
        addIssue(issues, key, 'Enter a valid date and time.');
        return undefined;
    }
    return new Date(parsed).toISOString();
};

const numericValue = (
    raw: ManualFormValue | undefined,
    key: string,
    issues: ManualRecordIssue[],
    isRequired = false,
): number | undefined => {
    const value = text(raw);
    if (!value) {
        if (isRequired) addIssue(issues, key, 'A numeric value is required.');
        return undefined;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        addIssue(issues, key, 'Enter a valid finite number.');
        return undefined;
    }
    return parsed;
};

const periodValue = (
    values: ManualFormValues,
    issues: ManualRecordIssue[],
    unknownWhenBlank = true,
): ClinicalPeriod => {
    const start = dateValue(
        values.start,
        'start',
        issues,
        unknownWhenBlank && !text(values.end),
    );
    const end = dateValue(values.end, 'end', issues);
    return {
        ...(start ? { start } : {}),
        ...(end ? { end } : {}),
    };
};

const optionalText = (
    values: ManualFormValues,
    key: string,
): string | undefined => text(values[key]) || undefined;

const resourceFields = (
    resourceType: ManagedManualResourceType,
    values: ManualFormValues,
    issues: ManualRecordIssue[],
    mode: ManualEditorMode,
    now: string,
): Record<string, unknown> => {
    const title = required(values, 'title', 'The primary record name', issues);
    const status = text(values.status);
    switch (resourceType) {
        case 'Condition': {
            const onset = dateValue(values.onset, 'onset', issues);
            const abatement = dateValue(values.abatement, 'abatement', issues);
            return {
                code: { text: title },
                clinicalStatus: status || 'active',
                severity: optionalText(values, 'severity') ? { text: optionalText(values, 'severity')! } : undefined,
                onset,
                abatement,
                bodySite: concepts(values.bodySites),
                encounterId: optionalText(values, 'encounterId'),
                note: optionalText(values, 'note'),
            };
        }
        case 'AllergyIntolerance': {
            const allowed = new Set(['food', 'medication', 'environment', 'biologic', 'other']);
            const categories = csv(values.categories).map(item => item.toLowerCase());
            categories.forEach(category => {
                if (!allowed.has(category)) addIssue(issues, 'categories', `Unsupported allergy category: ${category}.`);
            });
            const reactionText = optionalText(values, 'reaction');
            const reactionOnset = dateValue(values.reactionOnset, 'reactionOnset', issues);
            return {
                substance: { text: title },
                clinicalStatus: status || 'active',
                criticality: optionalText(values, 'criticality') || 'unable-to-assess',
                categories: categories.length > 0 ? categories : ['other'],
                ...(mode === 'create'
                    ? {
                        reactions: reactionText
                            ? [{
                                manifestation: [{ text: reactionText }],
                                severity: optionalText(values, 'reactionSeverity') || 'unknown',
                                ...(reactionOnset ? { onset: reactionOnset } : {}),
                                ...(optionalText(values, 'exposureRoute')
                                    ? { exposureRoute: { text: optionalText(values, 'exposureRoute')! } }
                                    : {}),
                            }]
                            : [],
                    }
                    : {}),
                lastOccurrence: dateValue(values.lastOccurrence, 'lastOccurrence', issues),
                note: optionalText(values, 'note'),
            };
        }
        case 'Medication': {
            const dose = numericValue(values.doseValue, 'doseValue', issues);
            const dosageText = optionalText(values, 'dosageText');
            return {
                kind: optionalText(values, 'kind') || 'statement',
                medication: { text: title },
                status: status || 'active',
                ...(mode === 'create'
                    ? {
                        dosageInstructions: dosageText || dose !== undefined
                            ? [{
                                text: dosageText || 'Dose recorded without full instruction text',
                                ...(dose !== undefined
                                    ? { dose: { original: { value: dose, ...(optionalText(values, 'doseUnit') ? { unit: optionalText(values, 'doseUnit') } : {}) } } }
                                    : {}),
                                ...(optionalText(values, 'route') ? { route: { text: optionalText(values, 'route')! } } : {}),
                                ...(optionalText(values, 'frequency') ? { frequency: optionalText(values, 'frequency') } : {}),
                                ...(optionalText(values, 'timing') ? { timingText: optionalText(values, 'timing') } : {}),
                                ...(checked(values.asNeeded) ? { asNeeded: true } : {}),
                            }]
                            : [],
                    }
                    : {}),
                reason: concepts(values.reason),
                start: dateValue(values.start, 'start', issues),
                end: dateValue(values.end, 'end', issues),
                prescriber: optionalText(values, 'prescriber'),
                encounterId: optionalText(values, 'encounterId'),
                note: optionalText(values, 'note'),
            };
        }
        case 'Observation': {
            const valueType = optionalText(values, 'valueType') || 'quantity';
            const raw = required(values, 'value', 'The original source value', issues);
            let observationValue: Record<string, unknown> | undefined;
            if (valueType === 'quantity') {
                const parsed = numericValue(values.value, 'value', issues, true);
                if (parsed !== undefined) {
                    observationValue = {
                        type: 'quantity',
                        quantity: {
                            original: {
                                value: parsed,
                                ...(optionalText(values, 'unit') ? { unit: optionalText(values, 'unit') } : {}),
                                ...(optionalText(values, 'comparator') ? { comparator: optionalText(values, 'comparator') } : {}),
                            },
                        },
                    };
                }
            } else if (valueType === 'integer') {
                const parsed = numericValue(values.value, 'value', issues, true);
                if (parsed !== undefined && !Number.isInteger(parsed)) addIssue(issues, 'value', 'Integer observations require a whole number.');
                else if (parsed !== undefined) observationValue = { type: 'integer', value: parsed };
            } else if (valueType === 'boolean') {
                const normalized = raw.toLowerCase();
                if (!['true', 'false', 'yes', 'no', '1', '0'].includes(normalized)) {
                    addIssue(issues, 'value', 'Boolean observations accept true, false, yes, no, 1, or 0.');
                } else {
                    observationValue = { type: 'boolean', value: ['true', 'yes', '1'].includes(normalized) };
                }
            } else if (valueType === 'codeable-concept') {
                observationValue = { type: 'codeable-concept', concept: { text: raw } };
            } else {
                observationValue = { type: 'string', text: raw };
            }
            return {
                status: status || 'final',
                category: concepts(values.category),
                code: { text: title },
                ...(observationValue ? { value: observationValue } : {}),
                interpretation: concepts(values.interpretation),
                referenceRanges: optionalText(values, 'referenceRange')
                    ? [{ text: optionalText(values, 'referenceRange')! }]
                    : [],
                effective: dateValue(values.effectiveDate, 'effectiveDate', issues, true),
                performer: csv(values.performer),
                encounterId: optionalText(values, 'encounterId'),
                note: optionalText(values, 'note'),
            };
        }
        case 'DiagnosticReport':
            return {
                status: status || 'final',
                code: { text: title },
                category: concepts(values.category),
                effectivePeriod: periodValue(values, issues, true),
                issuedAt: dateTimeValue(values.issuedAt, 'issuedAt', issues),
                resultIds: csv(values.resultIds),
                specimenIds: csv(values.specimenIds),
                documentIds: csv(values.documentIds),
                conclusion: optionalText(values, 'conclusion'),
                encounterId: optionalText(values, 'encounterId'),
                performer: csv(values.performer),
            };
        case 'Specimen':
            return {
                status: status || 'available',
                type: { text: title },
                collectedAt: dateValue(values.collectedAt, 'collectedAt', issues, true),
                receivedAt: dateValue(values.receivedAt, 'receivedAt', issues),
                bodySite: optionalText(values, 'bodySite') ? { text: optionalText(values, 'bodySite')! } : undefined,
                collectionMethod: optionalText(values, 'collectionMethod') ? { text: optionalText(values, 'collectionMethod')! } : undefined,
                note: optionalText(values, 'note'),
            };
        case 'Encounter': {
            const participant = optionalText(values, 'participant');
            return {
                status: status || 'finished',
                encounterClass: optionalText(values, 'encounterClass') || 'ambulatory',
                type: { text: title },
                period: periodValue(values, issues, true),
                reason: concepts(values.reason),
                participants: participant
                    ? [{ person: participant, ...(optionalText(values, 'participantRole') ? { role: { text: optionalText(values, 'participantRole')! } } : {}) }]
                    : [],
                location: optionalText(values, 'location'),
                serviceProvider: optionalText(values, 'serviceProvider'),
            };
        }
        case 'Procedure': {
            const period = periodValue(values, issues, true);
            const performed: ClinicalDate | ClinicalPeriod | undefined = period.end
                || (period.start && period.start.precision !== 'unknown')
                ? period
                : period.start;
            return {
                status: status || 'completed',
                code: { text: title },
                performed,
                bodySite: concepts(values.bodySites),
                reason: concepts(values.reason),
                outcome: optionalText(values, 'outcome') ? { text: optionalText(values, 'outcome')! } : undefined,
                complications: concepts(values.complications),
                performer: csv(values.performer),
                encounterId: optionalText(values, 'encounterId'),
                reportIds: csv(values.reportIds),
                note: optionalText(values, 'note'),
            };
        }
        case 'Immunization': {
            const dose = numericValue(values.doseValue, 'doseValue', issues);
            return {
                status: status || 'completed',
                vaccineCode: { text: title },
                occurrence: dateValue(values.occurrence, 'occurrence', issues, true),
                manufacturer: optionalText(values, 'manufacturer'),
                lotNumber: optionalText(values, 'lotNumber'),
                doseQuantity: dose !== undefined
                    ? { original: { value: dose, ...(optionalText(values, 'doseUnit') ? { unit: optionalText(values, 'doseUnit') } : {}) } }
                    : undefined,
                route: optionalText(values, 'route') ? { text: optionalText(values, 'route')! } : undefined,
                site: optionalText(values, 'site') ? { text: optionalText(values, 'site')! } : undefined,
                reason: concepts(values.reason),
                performer: optionalText(values, 'performer'),
                note: optionalText(values, 'note'),
            };
        }
        case 'Appointment': {
            const start = dateTimeValue(values.startDateTime, 'startDateTime', issues);
            const end = dateTimeValue(values.endDateTime, 'endDateTime', issues);
            if (start && end && Date.parse(end) < Date.parse(start)) addIssue(issues, 'endDateTime', 'The appointment end cannot be before its start.');
            const requested = dateValue(values.requestedDate, 'requestedDate', issues, !start);
            const participant = optionalText(values, 'participant');
            return {
                status: status || 'proposed',
                title,
                description: optionalText(values, 'description'),
                start,
                end,
                requestedPeriod: requested ? [{ start: requested }] : [],
                reason: concepts(values.reason),
                participants: participant
                    ? [{
                        name: participant,
                        ...(optionalText(values, 'participantRole') ? { role: { text: optionalText(values, 'participantRole')! } } : {}),
                        ...(optionalText(values, 'participantStatus') ? { status: optionalText(values, 'participantStatus') } : {}),
                    }]
                    : [],
                location: optionalText(values, 'location'),
                encounterId: optionalText(values, 'encounterId'),
                note: optionalText(values, 'note'),
            };
        }
        case 'ClinicalTask': {
            const relatedType = optionalText(values, 'relatedResourceType');
            const relatedId = optionalText(values, 'relatedResourceId');
            if (mode === 'create' && Boolean(relatedType) !== Boolean(relatedId)) {
                addIssue(issues, 'relatedResourceId', 'Both a related record type and ID are required.');
            }
            return {
                status: status || 'requested',
                intent: optionalText(values, 'intent') || 'proposal',
                priority: optionalText(values, 'priority') || 'routine',
                code: optionalText(values, 'code') ? { text: optionalText(values, 'code')! } : undefined,
                title,
                description: optionalText(values, 'description'),
                due: periodValue(values, issues, true),
                owner: optionalText(values, 'owner'),
                ...(mode === 'create'
                    ? { relatedResources: relatedType && relatedId ? [{ resourceType: relatedType, id: relatedId }] : [] }
                    : {}),
                completedAt: dateTimeValue(values.completedAt, 'completedAt', issues),
                note: optionalText(values, 'note'),
            };
        }
        case 'CarePlan':
            return {
                status: status || 'draft',
                intent: optionalText(values, 'intent') || 'plan',
                title,
                description: optionalText(values, 'description'),
                period: periodValue(values, issues, true),
                addressesConditionIds: csv(values.conditionIds),
                activityTaskIds: csv(values.taskIds),
                encounterId: optionalText(values, 'encounterId'),
                note: optionalText(values, 'note'),
            };
        case 'ClinicalNote':
            return {
                status: status || 'final',
                noteType: optionalText(values, 'noteType') || 'patient-note',
                title,
                authoredAt: dateTimeValue(values.authoredAt, 'authoredAt', issues, now),
                author: optionalText(values, 'author'),
                encounterId: optionalText(values, 'encounterId'),
                ...(mode === 'create'
                    ? {
                        sections: [{
                            title: required(values, 'sectionTitle', 'A section title', issues),
                            text: required(values, 'sectionText', 'Section content', issues),
                        }],
                        sourceDocumentIds: csv(values.sourceDocumentIds),
                        transcriptDocumentId: optionalText(values, 'transcriptDocumentId'),
                    }
                    : {}),
                amendsNoteId: optionalText(values, 'amendsNoteId'),
            };
    }
};

const schemaIssues = (error: unknown): ManualRecordIssue[] => {
    if (!error || typeof error !== 'object' || !('issues' in error)) {
        return [{ field: 'record', message: error instanceof Error ? error.message : 'The record could not be validated.' }];
    }
    const raw = (error as { issues?: Array<{ path?: Array<string | number>; message?: string }> }).issues || [];
    return raw.map(item => ({
        field: item.path?.join('.') || 'record',
        message: item.message || 'Invalid clinical record value.',
    }));
};

const relationship = (
    issues: ManualRecordIssue[],
    record: PatientClinicalRecord,
    resourceType: ClinicalResourceType,
    id: string | undefined,
    fieldName: string,
): void => {
    if (!id) return;
    const linked = findResourceInRecord(record, resourceType, id);
    if (!linked) {
        addIssue(issues, fieldName, `The referenced ${resourceType} record ${id} does not exist for this patient.`);
        return;
    }
    if (linked.verificationStatus === 'rejected' || linked.verificationStatus === 'entered-in-error') {
        addIssue(issues, fieldName, `The referenced ${resourceType} record ${id} is not an active confirmed relationship target.`);
    }
};

const relationshipReference = (
    issues: ManualRecordIssue[],
    record: PatientClinicalRecord,
    reference: ClinicalReference,
    fieldName: string,
): void => {
    if (!reference.resourceType) {
        addIssue(issues, fieldName, 'A related record type is required.');
        return;
    }
    relationship(issues, record, reference.resourceType, reference.id, fieldName);
};

export const validateManualResourceRelationships = (
    record: PatientClinicalRecord,
    resource: PatientClinicalResource,
): ManualRecordIssue[] => {
    const issues: ManualRecordIssue[] = [];
    switch (resource.resourceType) {
        case 'Encounter':
        case 'AllergyIntolerance':
        case 'Specimen':
        case 'Immunization':
            break;
        case 'Condition':
        case 'Medication':
        case 'Appointment':
            relationship(issues, record, 'Encounter', resource.encounterId, 'encounterId');
            break;
        case 'Observation':
            relationship(issues, record, 'Encounter', resource.encounterId, 'encounterId');
            relationship(issues, record, 'Specimen', resource.specimenId, 'specimenId');
            relationship(issues, record, 'DiagnosticReport', resource.diagnosticReportId, 'diagnosticReportId');
            break;
        case 'Procedure':
            relationship(issues, record, 'Encounter', resource.encounterId, 'encounterId');
            (resource.reportIds || []).forEach(id => relationship(issues, record, 'DiagnosticReport', id, 'reportIds'));
            break;
        case 'DiagnosticReport':
            relationship(issues, record, 'Encounter', resource.encounterId, 'encounterId');
            resource.resultIds.forEach(id => relationship(issues, record, 'Observation', id, 'resultIds'));
            resource.specimenIds.forEach(id => relationship(issues, record, 'Specimen', id, 'specimenIds'));
            resource.documentIds.forEach(id => relationship(issues, record, 'DocumentReference', id, 'documentIds'));
            break;
        case 'ClinicalTask':
            resource.relatedResources.forEach(reference => relationshipReference(issues, record, reference, 'relatedResources'));
            break;
        case 'CarePlan':
            resource.addressesConditionIds.forEach(id => relationship(issues, record, 'Condition', id, 'conditionIds'));
            resource.activityTaskIds.forEach(id => relationship(issues, record, 'ClinicalTask', id, 'taskIds'));
            relationship(issues, record, 'Encounter', resource.encounterId, 'encounterId');
            break;
        case 'DocumentReference':
            resource.relatedResources.forEach(reference => relationshipReference(issues, record, reference, 'relatedResources'));
            break;
        case 'ClinicalNote':
            relationship(issues, record, 'Encounter', resource.encounterId, 'encounterId');
            resource.sourceDocumentIds.forEach(id => relationship(issues, record, 'DocumentReference', id, 'sourceDocumentIds'));
            relationship(issues, record, 'DocumentReference', resource.transcriptDocumentId, 'transcriptDocumentId');
            relationship(issues, record, 'ClinicalNote', resource.amendsNoteId, 'amendsNoteId');
            if (resource.amendsNoteId === resource.id) addIssue(issues, 'amendsNoteId', 'A clinical note cannot amend itself.');
            break;
    }
    return issues;
};

const manualBase = (
    patientId: string,
    resourceType: ManagedManualResourceType,
    now: string,
    actor: string,
): Record<string, unknown> => ({
    id: uuidv4(),
    patientId,
    resourceType,
    verificationStatus: 'confirmed',
    recordedAt: now,
    assertion: {
        polarity: 'affirmed',
        certainty: 'certain',
        temporality: 'current',
        experiencer: 'patient',
    },
    provenance: {
        ...createClinicalProvenance({
            source: createRecordSource({
                kind: 'manual',
                description: 'Manually entered in the MediBrief record-management workspace',
            }),
            now,
            actor,
        }),
        confirmation: {
            reviewedAt: now,
            reviewedBy: actor,
            reason: 'Manually entered and explicitly confirmed by the user',
        },
    },
    amendments: [],
    tags: ['manual-entry'],
});

export const buildManualClinicalResource = ({
    record,
    resourceType,
    values,
    now = new Date().toISOString(),
    actor = 'Local user',
}: {
    record: PatientClinicalRecord;
    resourceType: ManagedManualResourceType;
    values: ManualFormValues;
    now?: string;
    actor?: string;
}): ManualResourceBuildResult => {
    const issues: ManualRecordIssue[] = [];
    const fields = resourceFields(resourceType, values, issues, 'create', now);
    if (issues.length > 0) return { ok: false, issues };
    try {
        const parsed = parseClinicalRecordResource({
            ...manualBase(record.patientId, resourceType, now, actor),
            ...fields,
        });
        if (parsed.resourceType === 'PatientProfile') {
            return { ok: false, issues: [{ field: 'resourceType', message: 'Patient profiles use the dedicated profile workflow.' }] };
        }
        const relationshipIssues = validateManualResourceRelationships(record, parsed);
        return relationshipIssues.length > 0
            ? { ok: false, issues: relationshipIssues }
            : { ok: true, issues: [], resource: parsed };
    } catch (error) {
        return { ok: false, issues: schemaIssues(error) };
    }
};

export const buildManualClinicalAmendment = ({
    record,
    resource,
    values,
    now = new Date().toISOString(),
}: {
    record: PatientClinicalRecord;
    resource: PatientClinicalResource;
    values: ManualFormValues;
    now?: string;
}): ManualAmendmentBuildResult => {
    if (!isManagedManualResourceType(resource.resourceType)) {
        return { ok: false, issues: [{ field: 'resourceType', message: `${resource.resourceType} is not editable in the guided correction form.` }] };
    }
    if (resource.verificationStatus !== 'confirmed') {
        return { ok: false, issues: [{ field: 'verificationStatus', message: 'Only confirmed records can be corrected here. Candidates use the review queue, while rejected or erroneous history is protected.' }] };
    }
    const issues: ManualRecordIssue[] = [];
    const updates = resourceFields(resource.resourceType, values, issues, 'amend', now);
    if (issues.length > 0) return { ok: false, issues };
    try {
        const preview = parseClinicalRecordResource({ ...resource, ...updates });
        if (preview.resourceType === 'PatientProfile') {
            return { ok: false, issues: [{ field: 'resourceType', message: 'Patient profiles use the dedicated profile workflow.' }] };
        }
        const relationshipIssues = validateManualResourceRelationships(record, preview);
        return relationshipIssues.length > 0
            ? { ok: false, issues: relationshipIssues }
            : { ok: true, issues: [], updates, preview };
    } catch (error) {
        return { ok: false, issues: schemaIssues(error) };
    }
};

const clinicalText = (date?: ClinicalDate): string => date?.value || '';
const asPeriod = (value?: ClinicalDate | ClinicalPeriod): ClinicalPeriod | undefined =>
    value && !('precision' in value) ? value : undefined;
const periodStart = (period?: ClinicalPeriod): string => clinicalText(period?.start);
const periodEnd = (period?: ClinicalPeriod): string => clinicalText(period?.end);
const conceptText = (values?: Array<{ text: string }>): string =>
    (values || []).map(value => value.text).join(', ');

const localDateTime = (value?: string): string => {
    if (!value) return '';
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return '';
    const date = new Date(parsed);
    return new Date(parsed - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export const manualFormValuesFromResource = (
    resource: PatientClinicalResource,
): ManualFormValues => {
    switch (resource.resourceType) {
        case 'Condition':
            return { title: resource.code.text, status: resource.clinicalStatus, severity: resource.severity?.text || '', onset: clinicalText(resource.onset), abatement: clinicalText(resource.abatement), bodySites: conceptText(resource.bodySite), encounterId: resource.encounterId || '', note: resource.note || '' };
        case 'AllergyIntolerance':
            return { title: resource.substance.text, status: resource.clinicalStatus, criticality: resource.criticality, categories: resource.categories.join(', '), lastOccurrence: clinicalText(resource.lastOccurrence), note: resource.note || '' };
        case 'Medication':
            return { title: resource.medication.text, kind: resource.kind, status: resource.status, reason: conceptText(resource.reason), start: clinicalText(resource.start), end: clinicalText(resource.end), prescriber: resource.prescriber || '', encounterId: resource.encounterId || '', note: resource.note || '' };
        case 'Observation': {
            let valueType = resource.value?.type || 'string';
            let value = '';
            let unit = '';
            let comparator = '';
            if (resource.value?.type === 'quantity') {
                value = String(resource.value.quantity.original.value);
                unit = resource.value.quantity.original.unit || '';
                comparator = resource.value.quantity.original.comparator || '';
            } else if (resource.value?.type === 'string') value = resource.value.text;
            else if (resource.value?.type === 'boolean') value = resource.value.value ? 'true' : 'false';
            else if (resource.value?.type === 'integer') value = String(resource.value.value);
            else if (resource.value?.type === 'codeable-concept') value = resource.value.concept.text;
            const effectiveDate = resource.effective && 'precision' in resource.effective
                ? resource.effective.value || ''
                : '';
            return { title: resource.code.text, status: resource.status, category: conceptText(resource.category), valueType, value, unit, comparator, interpretation: conceptText(resource.interpretation), referenceRange: resource.referenceRanges.map(item => item.text).filter(Boolean).join('; '), effectiveDate, performer: (resource.performer || []).join(', '), encounterId: resource.encounterId || '', note: resource.note || '' };
        }
        case 'DiagnosticReport':
            return { title: resource.code.text, status: resource.status, category: conceptText(resource.category), start: periodStart(resource.effectivePeriod), end: periodEnd(resource.effectivePeriod), issuedAt: localDateTime(resource.issuedAt), resultIds: resource.resultIds.join(', '), specimenIds: resource.specimenIds.join(', '), documentIds: resource.documentIds.join(', '), conclusion: resource.conclusion || '', performer: (resource.performer || []).join(', '), encounterId: resource.encounterId || '' };
        case 'Specimen':
            return { title: resource.type?.text || 'Specimen', status: resource.status, collectedAt: clinicalText(resource.collectedAt), receivedAt: clinicalText(resource.receivedAt), bodySite: resource.bodySite?.text || '', collectionMethod: resource.collectionMethod?.text || '', note: resource.note || '' };
        case 'Encounter':
            return { title: resource.type?.text || humanizeToken(resource.encounterClass), status: resource.status, encounterClass: resource.encounterClass, start: periodStart(resource.period), end: periodEnd(resource.period), reason: conceptText(resource.reason), participant: resource.participants[0]?.person || resource.participants[0]?.organization || '', participantRole: resource.participants[0]?.role?.text || '', location: resource.location || '', serviceProvider: resource.serviceProvider || '' };
        case 'Procedure': {
            const performedPeriod = asPeriod(resource.performed);
            const start = resource.performed && 'precision' in resource.performed
                ? clinicalText(resource.performed)
                : periodStart(performedPeriod);
            return { title: resource.code.text, status: resource.status, start, end: periodEnd(performedPeriod), bodySites: conceptText(resource.bodySite), reason: conceptText(resource.reason), outcome: resource.outcome?.text || '', complications: conceptText(resource.complications), performer: (resource.performer || []).join(', '), encounterId: resource.encounterId || '', reportIds: (resource.reportIds || []).join(', '), note: resource.note || '' };
        }
        case 'Immunization':
            return { title: resource.vaccineCode.text, status: resource.status, occurrence: clinicalText(resource.occurrence), manufacturer: resource.manufacturer || '', lotNumber: resource.lotNumber || '', doseValue: resource.doseQuantity ? String(resource.doseQuantity.original.value) : '', doseUnit: resource.doseQuantity?.original.unit || '', route: resource.route?.text || '', site: resource.site?.text || '', reason: conceptText(resource.reason), performer: resource.performer || '', note: resource.note || '' };
        case 'Appointment':
            return { title: resource.title || 'Appointment', status: resource.status, startDateTime: localDateTime(resource.start), endDateTime: localDateTime(resource.end), requestedDate: resource.requestedPeriod?.[0]?.start?.value || '', reason: conceptText(resource.reason), participant: resource.participants[0]?.name || '', participantRole: resource.participants[0]?.role?.text || '', participantStatus: resource.participants[0]?.status || 'needs-action', location: resource.location || '', encounterId: resource.encounterId || '', description: resource.description || '', note: resource.note || '' };
        case 'ClinicalTask': {
            const duePeriod = asPeriod(resource.due);
            const start = resource.due && 'precision' in resource.due
                ? clinicalText(resource.due)
                : periodStart(duePeriod);
            return { title: resource.title, status: resource.status, intent: resource.intent, priority: resource.priority, code: resource.code?.text || '', start, end: periodEnd(duePeriod), owner: resource.owner || '', completedAt: localDateTime(resource.completedAt), description: resource.description || '', note: resource.note || '' };
        }
        case 'CarePlan':
            return { title: resource.title, status: resource.status, intent: resource.intent, start: periodStart(resource.period), end: periodEnd(resource.period), conditionIds: resource.addressesConditionIds.join(', '), taskIds: resource.activityTaskIds.join(', '), encounterId: resource.encounterId || '', description: resource.description || '', note: resource.note || '' };
        case 'ClinicalNote':
            return { title: resource.title, status: resource.status, noteType: resource.noteType, authoredAt: localDateTime(resource.authoredAt), author: resource.author || '', encounterId: resource.encounterId || '', amendsNoteId: resource.amendsNoteId || '', preservedSections: resource.sections.map(section => `${section.title}\n${section.text}`).join('\n\n') };
        case 'DocumentReference':
            return {};
    }
};

export const isManagedManualResourceType = (
    value: ClinicalResourceType,
): value is ManagedManualResourceType =>
    MANAGED_MANUAL_RESOURCE_OPTIONS.some(item => item.value === value);

export const managedResourceLabel = (resource: ClinicalRecordResource): string => {
    switch (resource.resourceType) {
        case 'PatientProfile': return resource.displayName;
        case 'Encounter': return resource.type?.text || `${humanizeToken(resource.encounterClass)} encounter`;
        case 'Condition': return resource.code.text;
        case 'AllergyIntolerance': return resource.substance.text;
        case 'Medication': return resource.medication.text;
        case 'Observation': return resource.code.text;
        case 'DiagnosticReport': return resource.code.text;
        case 'Specimen': return resource.type?.text || 'Specimen';
        case 'Procedure': return resource.code.text;
        case 'Immunization': return resource.vaccineCode.text;
        case 'Appointment': return resource.title || 'Appointment';
        case 'ClinicalTask': return resource.title;
        case 'CarePlan': return resource.title;
        case 'DocumentReference': return resource.title || resource.fileName;
        case 'ClinicalNote': return resource.title;
    }
};

const managedStatus = (resource: ClinicalRecordResource): string => {
    switch (resource.resourceType) {
        case 'PatientProfile': return 'profile';
        case 'Condition': return resource.clinicalStatus;
        case 'AllergyIntolerance': return resource.clinicalStatus;
        case 'Medication': return resource.status;
        default: return resource.status;
    }
};

const sourceLabel = (resource: ClinicalRecordResource): string => {
    const source = resource.provenance.source;
    const kind = humanizeToken(source.kind);
    if (source.document?.fileName) return `${kind}: ${source.document.fileName}`;
    if (source.externalSystem) return `${kind}: ${source.externalSystem}`;
    if (source.description) return `${kind}: ${source.description}`;
    return kind;
};

export const summarizeManagedResource = (
    resource: ClinicalRecordResource,
): ManagedResourceSummary => {
    const bounds = getResourceDateBounds(resource);
    const knownClinicalDate = !bounds.usesRecordedAtFallback;
    const clinicalDateLabel = knownClinicalDate
        ? bounds.clinicalDate
            ? formatClinicalDate(bounds.clinicalDate)
            : bounds.dateTime
                ? formatDateTime(bounds.dateTime)
                : 'Clinical date unknown'
        : 'Clinical date unknown';
    const label = managedResourceLabel(resource);
    const statusLabel = humanizeToken(managedStatus(resource));
    const source = sourceLabel(resource);
    return {
        id: resource.id,
        resourceType: resource.resourceType,
        label,
        statusLabel,
        verificationStatus: resource.verificationStatus,
        clinicalDateLabel,
        knownClinicalDate,
        sourceLabel: source,
        recordedLabel: formatDateTime(resource.recordedAt),
        amendmentCount: resource.amendments.length,
        searchText: [resource.resourceType, label, statusLabel, resource.verificationStatus, clinicalDateLabel, source, ...(resource.tags || [])].join(' ').toLowerCase(),
        resource,
    };
};

const validTime = (value: string): number => {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

export const listManagedResourceSummaries = (
    record: PatientClinicalRecord,
    includeProfile = false,
): ManagedResourceSummary[] =>
    flattenPatientResources(record, includeProfile)
        .map(summarizeManagedResource)
        .sort((left, right) => {
            if (left.knownClinicalDate !== right.knownClinicalDate) return left.knownClinicalDate ? -1 : 1;
            const leftTime = getResourceDateBounds(left.resource).start ?? validTime(left.resource.recordedAt);
            const rightTime = getResourceDateBounds(right.resource).start ?? validTime(right.resource.recordedAt);
            if (leftTime !== rightTime) return rightTime - leftTime;
            return left.label.localeCompare(right.label);
        });
