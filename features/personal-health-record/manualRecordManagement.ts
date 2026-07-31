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
    ClinicalAssertionContext,
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

const trim = (value: ManualFormValue | undefined): string =>
    typeof value === 'string' ? value.trim() : '';

const bool = (value: ManualFormValue | undefined): boolean => value === true;

const splitList = (value: ManualFormValue | undefined): string[] =>
    trim(value)
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);

const conceptList = (value: ManualFormValue | undefined): Array<{ text: string }> =>
    splitList(value).map(text => ({ text }));

const option = (value: string): ManualFieldOption => ({
    value,
    label: humanizeToken(value),
});

const encounterOptions = (record?: PatientClinicalRecord): ManualFieldOption[] => [
    { value: '', label: 'No linked encounter' },
    ...(record?.resources.encounters
        .filter(item => item.verificationStatus === 'confirmed')
        .map(item => ({
            value: item.id,
            label: item.type?.text || `${humanizeToken(item.encounterClass)} encounter`,
        })) || []),
];

const relationshipOptions = (
    record: PatientClinicalRecord | undefined,
    resourceType: ClinicalResourceType,
    emptyLabel: string,
): ManualFieldOption[] => [
    { value: '', label: emptyLabel },
    ...(record
        ? flattenPatientResources(record)
            .filter(resource =>
                resource.resourceType === resourceType
                && resource.verificationStatus === 'confirmed')
            .map(resource => ({
                value: resource.id,
                label: managedResourceLabel(resource),
            }))
        : []),
];

const commonStatus = (values: string[]): ManualFieldOption[] => values.map(option);

export const getManualFieldDefinitions = (
    resourceType: ManagedManualResourceType,
    record?: PatientClinicalRecord,
    mode: ManualEditorMode = 'create',
): ManualFieldDefinition[] => {
    const encounterField: ManualFieldDefinition = {
        key: 'encounterId',
        label: 'Linked encounter',
        type: 'select',
        defaultValue: '',
        options: encounterOptions(record),
        helper: 'Optional. The selected encounter must exist in this patient record.',
    };

    switch (resourceType) {
        case 'Condition':
            return [
                { key: 'title', label: 'Condition', type: 'text', required: true, wide: true },
                { key: 'status', label: 'Clinical status', type: 'select', required: true, defaultValue: 'active', options: commonStatus(['active', 'inactive', 'resolved', 'remission', 'unknown']) },
                { key: 'severity', label: 'Severity', type: 'text', placeholder: 'Optional source wording' },
                { key: 'onset', label: 'Onset date', type: 'text', placeholder: 'YYYY-MM-DD, YYYY-MM, or YYYY', helper: 'Leave blank when unknown; the current date is never substituted.' },
                { key: 'abatement', label: 'Resolution date', type: 'text', placeholder: 'YYYY-MM-DD, YYYY-MM, or YYYY' },
                { key: 'bodySites', label: 'Body sites', type: 'text', placeholder: 'Comma-separated' },
                encounterField,
                { key: 'note', label: 'Clinical note', type: 'textarea', wide: true },
            ];
        case 'AllergyIntolerance':
            return [
                { key: 'title', label: 'Substance', type: 'text', required: true, wide: true },
                { key: 'status', label: 'Clinical status', type: 'select', required: true, defaultValue: 'active', options: commonStatus(['active', 'inactive', 'resolved', 'unknown']) },
                { key: 'criticality', label: 'Criticality', type: 'select', required: true, defaultValue: 'unable-to-assess', options: commonStatus(['low', 'high', 'unable-to-assess']) },
                { key: 'categories', label: 'Categories', type: 'text', defaultValue: 'other', placeholder: 'food, medication, environment, biologic, other', helper: 'Comma-separated supported categories.' },
                ...(mode === 'create' ? [
                    { key: 'reaction', label: 'Reaction manifestation', type: 'text', placeholder: 'Optional' } as ManualFieldDefinition,
                    { key: 'reactionSeverity', label: 'Reaction severity', type: 'select', defaultValue: 'unknown', options: commonStatus(['mild', 'moderate', 'severe', 'unknown']) } as ManualFieldDefinition,
                    { key: 'reactionOnset', label: 'Reaction onset', type: 'text', placeholder: 'YYYY-MM-DD, YYYY-MM, or YYYY' } as ManualFieldDefinition,
                    { key: 'exposureRoute', label: 'Exposure route', type: 'text' } as ManualFieldDefinition,
                ] : []),
                { key: 'lastOccurrence', label: 'Last occurrence', type: 'text', placeholder: 'YYYY-MM-DD, YYYY-MM, or YYYY' },
                { key: 'note', label: 'Clinical note', type: 'textarea', wide: true, helper: mode === 'amend' ? 'Existing multi-reaction detail is preserved. Use entered-in-error plus a replacement record when the reaction structure itself is wrong.' : undefined },
            ];
        case 'Medication':
            return [
                { key: 'title', label: 'Medication', type: 'text', required: true, wide: true },
                { key: 'kind', label: 'Record kind', type: 'select', required: true, defaultValue: 'statement', options: commonStatus(['statement', 'request', 'administration']) },
                { key: 'status', label: 'Status', type: 'select', required: true, defaultValue: 'active', options: commonStatus(['active', 'completed', 'stopped', 'on-hold', 'not-taken', 'unknown']) },
                ...(mode === 'create' ? [
                    { key: 'dosageText', label: 'Dosage instructions', type: 'text', placeholder: 'As written in the source', wide: true } as ManualFieldDefinition,
                    { key: 'doseValue', label: 'Dose value', type: 'number' } as ManualFieldDefinition,
                    { key: 'doseUnit', label: 'Dose unit', type: 'text' } as ManualFieldDefinition,
                    { key: 'route', label: 'Route', type: 'text' } as ManualFieldDefinition,
                    { key: 'frequency', label: 'Frequency', type: 'text' } as ManualFieldDefinition,
                    { key: 'timing', label: 'Timing', type: 'text' } as ManualFieldDefinition,
                    { key: 'asNeeded', label: 'As needed (PRN)', type: 'checkbox', defaultValue: false } as ManualFieldDefinition,
                ] : []),
                { key: 'reason', label: 'Reason or indication', type: 'text', placeholder: 'Comma-separated' },
                { key: 'start', label: 'Start date', type: 'text', placeholder: 'YYYY-MM-DD, YYYY-MM, or YYYY' },
                { key: 'end', label: 'End date', type: 'text', placeholder: 'YYYY-MM-DD, YYYY-MM, or YYYY' },
                { key: 'prescriber', label: 'Prescriber', type: 'text' },
                encounterField,
                { key: 'note', label: 'Clinical note', type: 'textarea', wide: true, helper: mode === 'amend' ? 'Existing dosage instructions are preserved by this correction form.' : undefined },
            ];
        case 'Observation':
            return [
                { key: 'title', label: 'Observation or test', type: 'text', required: true, wide: true },
                { key: 'status', label: 'Status', type: 'select', required: true, defaultValue: 'final', options: commonStatus(['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'unknown']) },
                { key: 'category', label: 'Category', type: 'text', placeholder: 'Laboratory, vital signs, survey…' },
                { key: 'valueType', label: 'Value type', type: 'select', required: true, defaultValue: 'quantity', options: commonStatus(['quantity', 'string', 'boolean', 'integer', 'codeable-concept']) },
                { key: 'value', label: 'Original source value', type: 'text', required: true },
                { key: 'unit', label: 'Original unit', type: 'text', helper: 'Used for quantity values. The source unit is preserved.' },
                { key: 'comparator', label: 'Comparator', type: 'select', defaultValue: '', options: [{ value: '', label: 'None' }, ...['<', '<=', '>=', '>'].map(value => ({ value, label: value }))] },
                { key: 'interpretation', label: 'Interpretation', type: 'text', placeholder: 'High, low, positive…' },
                { key: 'referenceRange', label: 'Reference range text', type: 'text' },
                { key: 'effectiveDate', label: 'Clinical date', type: 'text', placeholder: 'YYYY-MM-DD, YYYY-MM, or YYYY', helper: 'Leave blank when unknown. Issue or storage time will not be substituted.' },
                { key: 'performer', label: 'Performer or laboratory', type: 'text', placeholder: 'Comma-separated' },
                encounterField,
                { key: 'note', label: 'Clinical note', type: 'textarea', wide: true },
            ];
        case 'DiagnosticReport':
            return [
                { key: 'title', label: 'Report name', type: 'text', required: true, wide: true },
                { key: 'status', label: 'Status', type: 'select', required: true, defaultValue: 'final', options: commonStatus(['registered', 'partial', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'unknown']) },
                { key: 'category', label: 'Categories', type: 'text', placeholder: 'Comma-separated' },
                { key: 'start', label: 'Report period start', type: 'text', placeholder: 'YYYY-MM-DD, YYYY-MM, or YYYY' },
                { key: 'end', label: 'Report period end', type: 'text', placeholder: 'YYYY-MM-DD, YYYY-MM, or YYYY' },
                { key: 'issuedAt', label: 'Issued at', type: 'datetime-local', helper: 'Issue time remains separate from the clinical report period.' },
                { key: 'resultIds', label: 'Observation IDs', type: 'text', placeholder: 'Comma-separated existing Observation IDs' },
                { key: 'specimenIds', label: 'Specimen IDs', type: 'text', placeholder: 'Comma-separated existing Specimen IDs' },
                { key: 'documentIds', label: 'Document IDs', type: 'text', placeholder: 'Comma-separated existing DocumentReference IDs' },
                { key: 'conclusion', label: 'Conclusion', type: 'textarea', wide: true },
                { key: 'performer', label: 'Performer', type: 'text', placeholder: 'Comma-separated' },
                encounterField,
            ];
        case 'Specimen':
            return [
                { key: 'title', label: 'Specimen type', type: 'text', required: true, wide: true },
                { key: 'status', label: 'Status', type: 'select', required: true, defaultValue: 'available', options: commonStatus(['available', 'unavailable', 'unsatisfactory', 'unknown']) },
                { key: 'collectedAt', label: 'Collected date', type: 'text', placeholder: 'YYYY-MM-DD, YYYY-MM, or YYYY', helper: 'Leave blank when unknown.' },
                { key: 'receivedAt', label: 'Received date', type: 'text', placeholder: 'YYYY-MM-DD, YYYY-MM, or YYYY' },
                { key: 'bodySite', label: 'Body site', type: 'text' },
                { key: 'collectionMethod', label: 'Collection method', type: 'text' },
                { key: 'note', label: 'Clinical note', type: 'textarea', wide: true },
            ];
        case 'Encounter':
            return [
                { key: 'title', label: 'Visit type', type: 'text', required: true, wide: true },
                { key: 'status', label: 'Status', type: 'select', required: true, defaultValue: 'finished', options: commonStatus(['planned', 'in-progress', 'finished', 'cancelled', 'unknown']) },
                { key: 'encounterClass', label: 'Encounter class', type: 'select', required: true, defaultValue: 'ambulatory', options: commonStatus(['ambulatory', 'inpatient', 'emergency', 'virtual', 'home', 'other']) },
                { key: 'start', label: 'Start date', type: 'text', placeholder: 'YYYY-MM-DD, YYYY-MM, or YYYY', helper: 'Leave blank when the encounter date is unknown.' },
                { key: 'end', label: 'End date', type: 'text', placeholder: 'YYYY-MM-DD, YYYY-MM, or YYYY' },
                { key: 'reason', label: 'Reasons', type: 'text', placeholder: 'Comma-separated' },
                { key: 'participant', label: 'Participant', type: 'text', placeholder: 'Clinician or organization' },
                { key: 'participantRole', label: 'Participant role', type: 'text' },
                { key: 'location', label: 'Location', type: 'text' },
                { key: 'serviceProvider', label: 'Service provider', type: 'text' },
            ];
        case 'Procedure':
            return [
                { key: 'title', label: 'Procedure', type: 'text', required: true, wide: true },
                { key: 'status', label: 'Status', type: 'select', required: true, defaultValue: 'completed', options: commonStatus(['preparation', 'in-progress', 'not-done', 'on-hold', 'stopped', 'completed', 'unknown']) },
                { key: 'start', label: 'Performed date or start', type: 'text', placeholder: 'YYYY-MM-DD, YYYY-MM, or YYYY', helper: 'Leave blank when unknown.' },
                { key: 'end', label: 'End date', type: 'text', placeholder: 'YYYY-MM-DD, YYYY-MM, or YYYY' },
                { key: 'bodySites', label: 'Body sites', type: 'text', placeholder: 'Comma-separated' },
                { key: 'reason', label: 'Reasons', type: 'text', placeholder: 'Comma-separated' },
                { key: 'outcome', label: 'Outcome', type: 'text' },
                { key: 'complications', label: 'Complications', type: 'text', placeholder: 'Comma-separated' },
                { key: 'performer', label: 'Performers', type: 'text', placeholder: 'Comma-separated' },
                encounterField,
                { key: 'reportIds', label: 'Diagnostic report IDs', type: 'text', placeholder: 'Comma-separated existing IDs' },
                { key: 'note', label: 'Clinical note', type: 'textarea', wide: true },
            ];
        case 'Immunization':
            return [
                { key: 'title', label: 'Vaccine', type: 'text', required: true, wide: true },
                { key: 'status', label: 'Status', type: 'select', required: true, defaultValue: 'completed', options: commonStatus(['completed', 'not-done', 'unknown']) },
                { key: 'occurrence', label: 'Occurrence date', type: 'text', placeholder: 'YYYY-MM-DD, YYYY-MM, or YYYY', helper: 'Leave blank when unknown.' },
                { key: 'manufacturer', label: 'Manufacturer', type: 'text' },
                { key: 'lotNumber', label: 'Lot number', type: 'text' },
                { key: 'doseValue', label: 'Dose value', type: 'number' },
                { key: 'doseUnit', label: 'Dose unit', type: 'text' },
                { key: 'route', label: 'Route', type: 'text' },
                { key: 'site', label: 'Administration site', type: 'text' },
                { key: 'reason', label: 'Reason', type: 'text', placeholder: 'Comma-separated' },
                { key: 'performer', label: 'Performer', type: 'text' },
                { key: 'note', label: 'Clinical note', type: 'textarea', wide: true },
            ];
        case 'Appointment':
            return [
                { key: 'title', label: 'Appointment title', type: 'text', required: true, wide: true },
                { key: 'status', label: 'Status', type: 'select', required: true, defaultValue: 'proposed', options: commonStatus(['proposed', 'pending', 'booked', 'arrived', 'fulfilled', 'cancelled', 'no-show', 'unknown']) },
                { key: 'startDateTime', label: 'Start date and time', type: 'datetime-local', helper: 'A date does not imply a booking; status controls the booking meaning.' },
                { key: 'endDateTime', label: 'End date and time', type: 'datetime-local' },
                { key: 'requestedDate', label: 'Requested date', type: 'text', placeholder: 'YYYY-MM-DD, YYYY-MM, or YYYY', helper: 'Used when no exact start time is known.' },
                { key: 'reason', label: 'Reasons', type: 'text', placeholder: 'Comma-separated' },
                { key: 'participant', label: 'Participant', type: 'text', placeholder: 'Clinician, clinic, or patient' },
                { key: 'participantRole', label: 'Participant role', type: 'text' },
                { key: 'participantStatus', label: 'Participation status', type: 'select', defaultValue: 'needs-action', options: commonStatus(['accepted', 'declined', 'tentative', 'needs-action']) },
                { key: 'location', label: 'Location', type: 'text' },
                encounterField,
                { key: 'description', label: 'Description', type: 'textarea', wide: true },
                { key: 'note', label: 'Clinical note', type: 'textarea', wide: true },
            ];
        case 'ClinicalTask':
            return [
                { key: 'title', label: 'Task title', type: 'text', required: true, wide: true },
                { key: 'status', label: 'Status', type: 'select', required: true, defaultValue: 'requested', options: commonStatus(['draft', 'requested', 'received', 'accepted', 'in-progress', 'completed', 'cancelled', 'failed']) },
                { key: 'intent', label: 'Intent', type: 'select', required: true, defaultValue: 'proposal', options: commonStatus(['proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order']), helper: 'Intent is recorded exactly and never proves external execution.' },
                { key: 'priority', label: 'Priority', type: 'select', required: true, defaultValue: 'routine', options: commonStatus(['routine', 'urgent', 'asap', 'stat']) },
                { key: 'code', label: 'Task code or category', type: 'text' },
                { key: 'start', label: 'Due start', type: 'text', placeholder: 'YYYY-MM-DD, YYYY-MM, or YYYY', helper: 'Leave blank when the due date is unknown.' },
                { key: 'end', label: 'Due end', type: 'text', placeholder: 'YYYY-MM-DD, YYYY-MM, or YYYY' },
                { key: 'owner', label: 'Owner', type: 'text' },
                ...(mode === 'create' ? [
                    { key: 'relatedResourceType', label: 'Related record type', type: 'select', defaultValue: '', options: [{ value: '', label: 'No related record' }, ...['Condition', 'Appointment', 'Encounter', 'Medication', 'Observation', 'Procedure', 'CarePlan', 'ClinicalNote', 'DocumentReference'].map(option)] } as ManualFieldDefinition,
                    { key: 'relatedResourceId', label: 'Related record ID', type: 'text', helper: 'Both type and ID are required when linking a record.' } as ManualFieldDefinition,
                ] : []),
                { key: 'completedAt', label: 'Completed at', type: 'datetime-local' },
                { key: 'description', label: 'Description', type: 'textarea', wide: true },
                { key: 'note', label: 'Clinical note', type: 'textarea', wide: true, helper: mode === 'amend' ? 'Existing related-record links are preserved by this correction form.' : undefined },
            ];
        case 'CarePlan':
            return [
                { key: 'title', label: 'Care plan title', type: 'text', required: true, wide: true },
                { key: 'status', label: 'Status', type: 'select', required: true, defaultValue: 'draft', options: commonStatus(['draft', 'active', 'on-hold', 'revoked', 'completed', 'unknown']) },
                { key: 'intent', label: 'Intent', type: 'select', required: true, defaultValue: 'plan', options: commonStatus(['proposal', 'plan', 'order', 'option']), helper: 'Plan or order intent does not prove that care was performed.' },
                { key: 'start', label: 'Plan start', type: 'text', placeholder: 'YYYY-MM-DD, YYYY-MM, or YYYY', helper: 'Leave blank when unknown.' },
                { key: 'end', label: 'Plan end', type: 'text', placeholder: 'YYYY-MM-DD, YYYY-MM, or YYYY' },
                { key: 'conditionIds', label: 'Addressed condition IDs', type: 'text', placeholder: 'Comma-separated existing Condition IDs' },
                { key: 'taskIds', label: 'Activity task IDs', type: 'text', placeholder: 'Comma-separated existing ClinicalTask IDs' },
                { ...encounterField, options: relationshipOptions(record, 'Encounter', 'No linked encounter') },
                { key: 'description', label: 'Description', type: 'textarea', wide: true },
                { key: 'note', label: 'Clinical note', type: 'textarea', wide: true },
            ];
        case 'ClinicalNote':
            return [
                { key: 'title', label: 'Note title', type: 'text', required: true, wide: true },
                { key: 'status', label: 'Status', type: 'select', required: true, defaultValue: 'final', options: commonStatus(['draft', 'final', 'amended']) },
                { key: 'noteType', label: 'Note type', type: 'select', required: true, defaultValue: 'patient-note', options: commonStatus(['soap', 'visit-note', 'discharge-summary', 'progress-note', 'patient-note', 'other']) },
                { key: 'authoredAt', label: 'Authored at', type: 'datetime-local', helper: 'Leave blank to use the current time because the note is being authored now.' },
                { key: 'author', label: 'Author', type: 'text' },
                { ...encounterField, options: relationshipOptions(record, 'Encounter', 'No linked encounter') },
                ...(mode === 'create' ? [
                    { key: 'sectionTitle', label: 'Section title', type: 'text', required: true, defaultValue: 'Note' } as ManualFieldDefinition,
                    { key: 'sectionText', label: 'Section content', type: 'textarea', required: true, wide: true } as ManualFieldDefinition,
                    { key: 'sourceDocumentIds', label: 'Source document IDs', type: 'text', placeholder: 'Comma-separated existing DocumentReference IDs' } as ManualFieldDefinition,
                    { key: 'transcriptDocumentId', label: 'Transcript document ID', type: 'text' } as ManualFieldDefinition,
                ] : []),
                { key: 'amendsNoteId', label: 'Amended note ID', type: 'select', defaultValue: '', options: relationshipOptions(record, 'ClinicalNote', 'Does not amend another note') },
                ...(mode === 'amend' ? [{ key: 'preservedSections', label: 'Section content', type: 'textarea', defaultValue: '', helper: 'Structured sections are preserved and are not edited by this compact correction form. Mark the note entered in error and create a replacement when section content is wrong.', wide: true } as ManualFieldDefinition] : []),
            ];
    }
};

export const createInitialManualFormValues = (
    resourceType: ManagedManualResourceType,
    record?: PatientClinicalRecord,
    mode: ManualEditorMode = 'create',
): ManualFormValues => {
    const values: ManualFormValues = {};
    getManualFieldDefinitions(resourceType, record, mode).forEach(field => {
        values[field.key] = field.defaultValue
            ?? (field.type === 'checkbox' ? false : '');
    });
    return values;
};

const issue = (
    issues: ManualRecordIssue[],
    field: string,
    message: string,
): void => {
    issues.push({ field, message });
};

const requiredText = (
    values: ManualFormValues,
    key: string,
    label: string,
    issues: ManualRecordIssue[],
): string => {
    const value = trim(values[key]);
    if (!value) issue(issues, key, `${label} is required.`);
    return value;
};

const parseClinicalDateInput = (
    raw: ManualFormValue | undefined,
    field: string,
    issues: ManualRecordIssue[],
    unknownWhenBlank = false,
): ClinicalDate | undefined => {
    const value = trim(raw);
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
        issue(issues, field, 'Use YYYY-MM-DD, YYYY-MM, or YYYY. Leave blank when unknown.');
        return undefined;
    }

    if (precision === 'month') {
        const month = Number(value.slice(5, 7));
        if (month < 1 || month > 12) {
            issue(issues, field, 'The month must be between 01 and 12.');
            return undefined;
        }
    }
    if (precision === 'day') {
        const timestamp = Date.parse(`${value}T00:00:00.000Z`);
        if (Number.isNaN(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== value) {
            issue(issues, field, 'Enter a valid calendar date.');
            return undefined;
        }
    }

    return { value, precision, sourceText: value };
};

const parseDateTimeInput = (
    raw: ManualFormValue | undefined,
    field: string,
    issues: ManualRecordIssue[],
    nowWhenBlank?: string,
): string | undefined => {
    const value = trim(raw);
    if (!value) return nowWhenBlank;
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) {
        issue(issues, field, 'Enter a valid date and time.');
        return undefined;
    }
    return new Date(timestamp).toISOString();
};

const parseFiniteNumber = (
    raw: ManualFormValue | undefined,
    field: string,
    issues: ManualRecordIssue[],
    required = false,
): number | undefined => {
    const value = trim(raw);
    if (!value) {
        if (required) issue(issues, field, 'A numeric value is required.');
        return undefined;
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        issue(issues, field, 'Enter a valid finite number.');
        return undefined;
    }
    return parsed;
};

const clinicalPeriod = (
    values: ManualFormValues,
    startKey: string,
    endKey: string,
    issues: ManualRecordIssue[],
    unknownWhenBlank = true,
): ClinicalPeriod => {
    const start = parseClinicalDateInput(
        values[startKey],
        startKey,
        issues,
        unknownWhenBlank && !trim(values[endKey]),
    );
    const end = parseClinicalDateInput(values[endKey], endKey, issues);
    return {
        ...(start ? { start } : {}),
        ...(end ? { end } : {}),
    };
};

const historyTemporality = (
    resourceType: ManagedManualResourceType,
    status: string,
): ClinicalAssertionContext['temporality'] => {
    if (
        ['resolved', 'inactive', 'completed', 'stopped', 'not-taken', 'finished', 'cancelled', 'fulfilled', 'no-show', 'not-done', 'failed', 'revoked'].includes(status)
    ) return 'historical';
    if (resourceType === 'ClinicalNote') return 'current';
    return 'current';
};

const buildResourceFields = (
    resourceType: ManagedManualResourceType,
    values: ManualFormValues,
    issues: ManualRecordIssue[],
    mode: ManualEditorMode,
    now: string,
): Record<string, unknown> => {
    const title = requiredText(values, 'title', 'The primary record name', issues);
    const status = trim(values.status);
    const optional = (key: string): string | undefined => trim(values[key]) || undefined;

    switch (resourceType) {
        case 'Condition':
            return {
                code: { text: title },
                clinicalStatus: status || 'active',
                ...(optional('severity') ? { severity: { text: optional('severity')! } } : { severity: undefined }),
                ...(parseClinicalDateInput(values.onset, 'onset', issues) ? { onset: parseClinicalDateInput(values.onset, 'onset', issues)! } : { onset: undefined }),
                ...(parseClinicalDateInput(values.abatement, 'abatement', issues) ? { abatement: parseClinicalDateInput(values.abatement, 'abatement', issues)! } : { abatement: undefined }),
                bodySite: conceptList(values.bodySites),
                ...(optional('encounterId') ? { encounterId: optional('encounterId') } : { encounterId: undefined }),
                ...(optional('note') ? { note: optional('note') } : { note: undefined }),
            };
        case 'AllergyIntolerance': {
            const supportedCategories = new Set(['food', 'medication', 'environment', 'biologic', 'other']);
            const categories = splitList(values.categories).map(item => item.toLowerCase());
            categories.forEach(category => {
                if (!supportedCategories.has(category)) {
                    issue(issues, 'categories', `Unsupported allergy category: ${category}.`);
                }
            });
            const reaction = optional('reaction');
            const reactions = mode === 'create' && reaction
                ? [{
                    manifestation: [{ text: reaction }],
                    severity: optional('reactionSeverity') || 'unknown',
                    ...(parseClinicalDateInput(values.reactionOnset, 'reactionOnset', issues)
                        ? { onset: parseClinicalDateInput(values.reactionOnset, 'reactionOnset', issues)! }
                        : {}),
                    ...(optional('exposureRoute')
                        ? { exposureRoute: { text: optional('exposureRoute')! } }
                        : {}),
                }]
                : undefined;
            return {
                substance: { text: title },
                clinicalStatus: status || 'active',
                criticality: optional('criticality') || 'unable-to-assess',
                categories: categories.length > 0 ? categories : ['other'],
                ...(reactions ? { reactions } : {}),
                ...(parseClinicalDateInput(values.lastOccurrence, 'lastOccurrence', issues)
                    ? { lastOccurrence: parseClinicalDateInput(values.lastOccurrence, 'lastOccurrence', issues)! }
                    : { lastOccurrence: undefined }),
                ...(optional('note') ? { note: optional('note') } : { note: undefined }),
            };
        }
        case 'Medication': {
            const dosageText = optional('dosageText');
            const doseValue = parseFiniteNumber(values.doseValue, 'doseValue', issues);
            const dosageInstructions = mode === 'create' && (dosageText || doseValue !== undefined)
                ? [{
                    text: dosageText || 'Dose recorded without full instruction text',
                    ...(doseValue !== undefined
                        ? {
                            dose: {
                                original: {
                                    value: doseValue,
                                    ...(optional('doseUnit') ? { unit: optional('doseUnit') } : {}),
                                },
                            },
                        }
                        : {}),
                    ...(optional('route') ? { route: { text: optional('route')! } } : {}),
                    ...(optional('frequency') ? { frequency: optional('frequency') } : {}),
                    ...(optional('timing') ? { timingText: optional('timing') } : {}),
                    ...(bool(values.asNeeded) ? { asNeeded: true } : {}),
                }]
                : undefined;
            return {
                kind: optional('kind') || 'statement',
                medication: { text: title },
                status: status || 'active',
                ...(dosageInstructions ? { dosageInstructions } : {}),
                reason: conceptList(values.reason),
                ...(parseClinicalDateInput(values.start, 'start', issues)
                    ? { start: parseClinicalDateInput(values.start, 'start', issues)! }
                    : { start: undefined }),
                ...(parseClinicalDateInput(values.end, 'end', issues)
                    ? { end: parseClinicalDateInput(values.end, 'end', issues)! }
                    : { end: undefined }),
                ...(optional('prescriber') ? { prescriber: optional('prescriber') } : { prescriber: undefined }),
                ...(optional('encounterId') ? { encounterId: optional('encounterId') } : { encounterId: undefined }),
                ...(optional('note') ? { note: optional('note') } : { note: undefined }),
            };
        }
        case 'Observation': {
            const valueType = optional('valueType') || 'quantity';
            const rawValue = requiredText(values, 'value', 'The original source value', issues);
            let value: Record<string, unknown> | undefined;
            if (valueType === 'quantity') {
                const numeric = parseFiniteNumber(values.value, 'value', issues, true);
                if (numeric !== undefined) {
                    value = {
                        type: 'quantity',
                        quantity: {
                            original: {
                                value: numeric,
                                ...(optional('unit') ? { unit: optional('unit') } : {}),
                                ...(optional('comparator') ? { comparator: optional('comparator') } : {}),
                            },
                        },
                    };
                }
            } else if (valueType === 'integer') {
                const numeric = parseFiniteNumber(values.value, 'value', issues, true);
                if (numeric !== undefined && !Number.isInteger(numeric)) {
                    issue(issues, 'value', 'Integer observations require a whole number.');
                } else if (numeric !== undefined) {
                    value = { type: 'integer', value: numeric };
                }
            } else if (valueType === 'boolean') {
                const normalized = rawValue.toLowerCase();
                if (!['true', 'false', 'yes', 'no', '1', '0'].includes(normalized)) {
                    issue(issues, 'value', 'Boolean observations accept true, false, yes, no, 1, or 0.');
                } else {
                    value = { type: 'boolean', value: ['true', 'yes', '1'].includes(normalized) };
                }
            } else if (valueType === 'codeable-concept') {
                value = { type: 'codeable-concept', concept: { text: rawValue } };
            } else {
                value = { type: 'string', text: rawValue };
            }
            const effectiveDate = parseClinicalDateInput(
                values.effectiveDate,
                'effectiveDate',
                issues,
                true,
            );
            return {
                status: status || 'final',
                category: conceptList(values.category),
                code: { text: title },
                ...(value ? { value } : {}),
                interpretation: conceptList(values.interpretation),
                referenceRanges: optional('referenceRange')
                    ? [{ text: optional('referenceRange')! }]
                    : [],
                ...(effectiveDate ? { effective: effectiveDate } : {}),
                ...(optional('encounterId') ? { encounterId: optional('encounterId') } : { encounterId: undefined }),
                performer: splitList(values.performer),
                ...(optional('note') ? { note: optional('note') } : { note: undefined }),
            };
        }
        case 'DiagnosticReport':
            return {
                status: status || 'final',
                code: { text: title },
                category: conceptList(values.category),
                effectivePeriod: clinicalPeriod(values, 'start', 'end', issues, true),
                ...(parseDateTimeInput(values.issuedAt, 'issuedAt', issues)
                    ? { issuedAt: parseDateTimeInput(values.issuedAt, 'issuedAt', issues)! }
                    : { issuedAt: undefined }),
                resultIds: splitList(values.resultIds),
                specimenIds: splitList(values.specimenIds),
                documentIds: splitList(values.documentIds),
                ...(optional('conclusion') ? { conclusion: optional('conclusion') } : { conclusion: undefined }),
                ...(optional('encounterId') ? { encounterId: optional('encounterId') } : { encounterId: undefined }),
                performer: splitList(values.performer),
            };
        case 'Specimen':
            return {
                status: status || 'available',
                type: { text: title },
                ...(parseClinicalDateInput(values.collectedAt, 'collectedAt', issues, true)
                    ? { collectedAt: parseClinicalDateInput(values.collectedAt, 'collectedAt', issues, true)! }
                    : {}),
                ...(parseClinicalDateInput(values.receivedAt, 'receivedAt', issues)
                    ? { receivedAt: parseClinicalDateInput(values.receivedAt, 'receivedAt', issues)! }
                    : { receivedAt: undefined }),
                ...(optional('bodySite') ? { bodySite: { text: optional('bodySite')! } } : { bodySite: undefined }),
                ...(optional('collectionMethod') ? { collectionMethod: { text: optional('collectionMethod')! } } : { collectionMethod: undefined }),
                ...(optional('note') ? { note: optional('note') } : { note: undefined }),
            };
        case 'Encounter': {
            const participant = optional('participant');
            return {
                status: status || 'finished',
                encounterClass: optional('encounterClass') || 'ambulatory',
                type: { text: title },
                period: clinicalPeriod(values, 'start', 'end', issues, true),
                reason: conceptList(values.reason),
                participants: participant
                    ? [{
                        person: participant,
                        ...(optional('participantRole') ? { role: { text: optional('participantRole')! } } : {}),
                    }]
                    : [],
                ...(optional('location') ? { location: optional('location') } : { location: undefined }),
                ...(optional('serviceProvider') ? { serviceProvider: optional('serviceProvider') } : { serviceProvider: undefined }),
            };
        }
        case 'Procedure': {
            const period = clinicalPeriod(values, 'start', 'end', issues, true);
            const performed = period.end || (period.start && period.start.precision !== 'unknown')
                ? period
                : period.start;
            return {
                status: status || 'completed',
                code: { text: title },
                ...(performed ? { performed } : {}),
                bodySite: conceptList(values.bodySites),
                reason: conceptList(values.reason),
                ...(optional('outcome') ? { outcome: { text: optional('outcome')! } } : { outcome: undefined }),
                complications: conceptList(values.complications),
                performer: splitList(values.performer),
                ...(optional('encounterId') ? { encounterId: optional('encounterId') } : { encounterId: undefined }),
                reportIds: splitList(values.reportIds),
                ...(optional('note') ? { note: optional('note') } : { note: undefined }),
            };
        }
        case 'Immunization': {
            const doseValue = parseFiniteNumber(values.doseValue, 'doseValue', issues);
            return {
                status: status || 'completed',
                vaccineCode: { text: title },
                occurrence: parseClinicalDateInput(values.occurrence, 'occurrence', issues, true),
                ...(optional('lotNumber') ? { lotNumber: optional('lotNumber') } : { lotNumber: undefined }),
                ...(optional('manufacturer') ? { manufacturer: optional('manufacturer') } : { manufacturer: undefined }),
                ...(doseValue !== undefined
                    ? {
                        doseQuantity: {
                            original: {
                                value: doseValue,
                                ...(optional('doseUnit') ? { unit: optional('doseUnit') } : {}),
                            },
                        },
                    }
                    : { doseQuantity: undefined }),
                ...(optional('site') ? { site: { text: optional('site')! } } : { site: undefined }),
                ...(optional('route') ? { route: { text: optional('route')! } } : { route: undefined }),
                reason: conceptList(values.reason),
                ...(optional('performer') ? { performer: optional('performer') } : { performer: undefined }),
                ...(optional('note') ? { note: optional('note') } : { note: undefined }),
            };
        }
        case 'Appointment': {
            const startDateTime = parseDateTimeInput(values.startDateTime, 'startDateTime', issues);
            const endDateTime = parseDateTimeInput(values.endDateTime, 'endDateTime', issues);
            if (startDateTime && endDateTime && Date.parse(endDateTime) < Date.parse(startDateTime)) {
                issue(issues, 'endDateTime', 'The appointment end cannot be before its start.');
            }
            const requestedDate = parseClinicalDateInput(
                values.requestedDate,
                'requestedDate',
                issues,
                !startDateTime,
            );
            const participant = optional('participant');
            return {
                status: status || 'proposed',
                title,
                ...(optional('description') ? { description: optional('description') } : { description: undefined }),
                ...(startDateTime ? { start: startDateTime } : { start: undefined }),
                ...(endDateTime ? { end: endDateTime } : { end: undefined }),
                requestedPeriod: requestedDate ? [{ start: requestedDate }] : [],
                reason: conceptList(values.reason),
                participants: participant
                    ? [{
                        name: participant,
                        ...(optional('participantRole') ? { role: { text: optional('participantRole')! } } : {}),
                        ...(optional('participantStatus') ? { status: optional('participantStatus') } : {}),
                    }]
                    : [],
                ...(optional('location') ? { location: optional('location') } : { location: undefined }),
                ...(optional('encounterId') ? { encounterId: optional('encounterId') } : { encounterId: undefined }),
                ...(optional('note') ? { note: optional('note') } : { note: undefined }),
            };
        }
        case 'ClinicalTask': {
            const relatedType = optional('relatedResourceType');
            const relatedId = optional('relatedResourceId');
            if (mode === 'create' && Boolean(relatedType) !== Boolean(relatedId)) {
                issue(issues, 'relatedResourceId', 'Both a related record type and ID are required.');
            }
            return {
                status: status || 'requested',
                intent: optional('intent') || 'proposal',
                priority: optional('priority') || 'routine',
                ...(optional('code') ? { code: { text: optional('code')! } } : { code: undefined }),
                title,
                ...(optional('description') ? { description: optional('description') } : { description: undefined }),
                due: clinicalPeriod(values, 'start', 'end', issues, true),
                ...(optional('owner') ? { owner: optional('owner') } : { owner: undefined }),
                ...(mode === 'create'
                    ? {
                        relatedResources: relatedType && relatedId
                            ? [{ resourceType: relatedType, id: relatedId }]
                            : [],
                    }
                    : {}),
                ...(parseDateTimeInput(values.completedAt, 'completedAt', issues)
                    ? { completedAt: parseDateTimeInput(values.completedAt, 'completedAt', issues)! }
                    : { completedAt: undefined }),
                ...(optional('note') ? { note: optional('note') } : { note: undefined }),
            };
        }
        case 'CarePlan':
            return {
                status: status || 'draft',
                intent: optional('intent') || 'plan',
                title,
                ...(optional('description') ? { description: optional('description') } : { description: undefined }),
                period: clinicalPeriod(values, 'start', 'end', issues, true),
                addressesConditionIds: splitList(values.conditionIds),
                activityTaskIds: splitList(values.taskIds),
                ...(optional('encounterId') ? { encounterId: optional('encounterId') } : { encounterId: undefined }),
                ...(optional('note') ? { note: optional('note') } : { note: undefined }),
            };
        case 'ClinicalNote': {
            const authoredAt = parseDateTimeInput(values.authoredAt, 'authoredAt', issues, now);
            const sectionTitle = mode === 'create'
                ? requiredText(values, 'sectionTitle', 'A section title', issues)
                : '';
            const sectionText = mode === 'create'
                ? requiredText(values, 'sectionText', 'Section content', issues)
                : '';
            return {
                status: status || 'final',
                noteType: optional('noteType') || 'patient-note',
                title,
                authoredAt,
                ...(optional('author') ? { author: optional('author') } : { author: undefined }),
                ...(optional('encounterId') ? { encounterId: optional('encounterId') } : { encounterId: undefined }),
                ...(mode === 'create'
                    ? {
                        sections: [{ title: sectionTitle, text: sectionText }],
                        sourceDocumentIds: splitList(values.sourceDocumentIds),
                        ...(optional('transcriptDocumentId')
                            ? { transcriptDocumentId: optional('transcriptDocumentId') }
                            : {}),
                    }
                    : {}),
                ...(optional('amendsNoteId') ? { amendsNoteId: optional('amendsNoteId') } : { amendsNoteId: undefined }),
            };
        }
    }
};

const zodIssues = (error: unknown): ManualRecordIssue[] => {
    if (!error || typeof error !== 'object' || !('issues' in error)) {
        return [{ field: 'record', message: error instanceof Error ? error.message : 'The record could not be validated.' }];
    }
    const rawIssues = (error as { issues?: Array<{ path?: Array<string | number>; message?: string }> }).issues || [];
    return rawIssues.map(item => ({
        field: item.path?.join('.') || 'record',
        message: item.message || 'Invalid clinical record value.',
    }));
};

const relationshipIssue = (
    issues: ManualRecordIssue[],
    record: PatientClinicalRecord,
    resourceType: ClinicalResourceType,
    id: string | undefined,
    field: string,
): void => {
    if (!id) return;
    const linked = findResourceInRecord(record, resourceType, id);
    if (!linked) {
        issue(issues, field, `The referenced ${resourceType} record ${id} does not exist for this patient.`);
        return;
    }
    if (linked.verificationStatus === 'rejected' || linked.verificationStatus === 'entered-in-error') {
        issue(issues, field, `The referenced ${resourceType} record ${id} is not an active confirmed relationship target.`);
    }
};

const validateReference = (
    issues: ManualRecordIssue[],
    record: PatientClinicalRecord,
    reference: ClinicalReference,
    field: string,
): void => {
    if (!reference.resourceType) {
        issue(issues, field, 'A related record type is required.');
        return;
    }
    relationshipIssue(issues, record, reference.resourceType, reference.id, field);
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
        case 'Observation':
        case 'Procedure':
        case 'Appointment':
            relationshipIssue(issues, record, 'Encounter', resource.encounterId, 'encounterId');
            if (resource.resourceType === 'Observation') {
                relationshipIssue(issues, record, 'Specimen', resource.specimenId, 'specimenId');
                relationshipIssue(issues, record, 'DiagnosticReport', resource.diagnosticReportId, 'diagnosticReportId');
            }
            if (resource.resourceType === 'Procedure') {
                (resource.reportIds || []).forEach(id =>
                    relationshipIssue(issues, record, 'DiagnosticReport', id, 'reportIds'));
            }
            break;
        case 'DiagnosticReport':
            relationshipIssue(issues, record, 'Encounter', resource.encounterId, 'encounterId');
            resource.resultIds.forEach(id =>
                relationshipIssue(issues, record, 'Observation', id, 'resultIds'));
            resource.specimenIds.forEach(id =>
                relationshipIssue(issues, record, 'Specimen', id, 'specimenIds'));
            resource.documentIds.forEach(id =>
                relationshipIssue(issues, record, 'DocumentReference', id, 'documentIds'));
            break;
        case 'ClinicalTask':
            resource.relatedResources.forEach(reference =>
                validateReference(issues, record, reference, 'relatedResources'));
            break;
        case 'CarePlan':
            resource.addressesConditionIds.forEach(id =>
                relationshipIssue(issues, record, 'Condition', id, 'conditionIds'));
            resource.activityTaskIds.forEach(id =>
                relationshipIssue(issues, record, 'ClinicalTask', id, 'taskIds'));
            relationshipIssue(issues, record, 'Encounter', resource.encounterId, 'encounterId');
            break;
        case 'DocumentReference':
            resource.relatedResources.forEach(reference =>
                validateReference(issues, record, reference, 'relatedResources'));
            break;
        case 'ClinicalNote':
            relationshipIssue(issues, record, 'Encounter', resource.encounterId, 'encounterId');
            resource.sourceDocumentIds.forEach(id =>
                relationshipIssue(issues, record, 'DocumentReference', id, 'sourceDocumentIds'));
            relationshipIssue(issues, record, 'DocumentReference', resource.transcriptDocumentId, 'transcriptDocumentId');
            relationshipIssue(issues, record, 'ClinicalNote', resource.amendsNoteId, 'amendsNoteId');
            if (resource.amendsNoteId === resource.id) {
                issue(issues, 'amendsNoteId', 'A clinical note cannot amend itself.');
            }
            break;
    }
    return issues;
};

const createManualBase = (
    patientId: string,
    resourceType: ManagedManualResourceType,
    status: string,
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
        temporality: historyTemporality(resourceType, status),
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
    const fields = buildResourceFields(resourceType, values, issues, 'create', now);
    if (issues.length > 0) return { ok: false, issues };

    try {
        const parsed = parseClinicalRecordResource({
            ...createManualBase(
                record.patientId,
                resourceType,
                trim(values.status),
                now,
                actor,
            ),
            ...fields,
        });
        if (parsed.resourceType === 'PatientProfile') {
            return {
                ok: false,
                issues: [{ field: 'resourceType', message: 'Patient profiles use the dedicated profile workflow.' }],
            };
        }
        const relationshipIssues = validateManualResourceRelationships(record, parsed);
        if (relationshipIssues.length > 0) {
            return { ok: false, issues: relationshipIssues };
        }
        return { ok: true, issues: [], resource: parsed };
    } catch (error) {
        return { ok: false, issues: zodIssues(error) };
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
        return {
            ok: false,
            issues: [{ field: 'resourceType', message: `${resource.resourceType} is not editable in the guided correction form.` }],
        };
    }
    if (resource.verificationStatus !== 'confirmed') {
        return {
            ok: false,
            issues: [{ field: 'verificationStatus', message: 'Only confirmed records can be corrected here. Candidates use the review queue, while rejected or erroneous history is protected.' }],
        };
    }

    const issues: ManualRecordIssue[] = [];
    const updates = buildResourceFields(resource.resourceType, values, issues, 'amend', now);
    if (issues.length > 0) return { ok: false, issues };

    try {
        const preview = parseClinicalRecordResource({
            ...resource,
            ...updates,
        });
        if (preview.resourceType === 'PatientProfile') {
            return { ok: false, issues: [{ field: 'resourceType', message: 'Patient profiles use the dedicated profile workflow.' }] };
        }
        const relationshipIssues = validateManualResourceRelationships(record, preview);
        if (relationshipIssues.length > 0) {
            return { ok: false, issues: relationshipIssues };
        }
        return { ok: true, issues: [], updates, preview };
    } catch (error) {
        return { ok: false, issues: zodIssues(error) };
    }
};

const clinicalDateValue = (date?: ClinicalDate): string => date?.value || '';
const periodStart = (period?: ClinicalPeriod): string => clinicalDateValue(period?.start);
const periodEnd = (period?: ClinicalPeriod): string => clinicalDateValue(period?.end);
const conceptTexts = (values?: Array<{ text: string }>): string =>
    (values || []).map(item => item.text).join(', ');

const datetimeLocalValue = (value?: string): string => {
    if (!value) return '';
    const timestamp = Date.parse(value);
    if (Number.isNaN(timestamp)) return '';
    const date = new Date(timestamp);
    const offset = date.getTimezoneOffset() * 60_000;
    return new Date(timestamp - offset).toISOString().slice(0, 16);
};

export const manualFormValuesFromResource = (
    resource: PatientClinicalResource,
): ManualFormValues => {
    switch (resource.resourceType) {
        case 'Condition':
            return {
                title: resource.code.text,
                status: resource.clinicalStatus,
                severity: resource.severity?.text || '',
                onset: clinicalDateValue(resource.onset),
                abatement: clinicalDateValue(resource.abatement),
                bodySites: conceptTexts(resource.bodySite),
                encounterId: resource.encounterId || '',
                note: resource.note || '',
            };
        case 'AllergyIntolerance':
            return {
                title: resource.substance.text,
                status: resource.clinicalStatus,
                criticality: resource.criticality,
                categories: resource.categories.join(', '),
                lastOccurrence: clinicalDateValue(resource.lastOccurrence),
                note: resource.note || '',
            };
        case 'Medication':
            return {
                title: resource.medication.text,
                kind: resource.kind,
                status: resource.status,
                reason: conceptTexts(resource.reason),
                start: clinicalDateValue(resource.start),
                end: clinicalDateValue(resource.end),
                prescriber: resource.prescriber || '',
                encounterId: resource.encounterId || '',
                note: resource.note || '',
            };
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
            const effective = resource.effective && 'precision' in resource.effective
                ? resource.effective.value || ''
                : '';
            return {
                title: resource.code.text,
                status: resource.status,
                category: conceptTexts(resource.category),
                valueType,
                value,
                unit,
                comparator,
                interpretation: conceptTexts(resource.interpretation),
                referenceRange: resource.referenceRanges.map(item => item.text).filter(Boolean).join('; '),
                effectiveDate: effective,
                performer: (resource.performer || []).join(', '),
                encounterId: resource.encounterId || '',
                note: resource.note || '',
            };
        }
        case 'DiagnosticReport':
            return {
                title: resource.code.text,
                status: resource.status,
                category: conceptTexts(resource.category),
                start: periodStart(resource.effectivePeriod),
                end: periodEnd(resource.effectivePeriod),
                issuedAt: datetimeLocalValue(resource.issuedAt),
                resultIds: resource.resultIds.join(', '),
                specimenIds: resource.specimenIds.join(', '),
                documentIds: resource.documentIds.join(', '),
                conclusion: resource.conclusion || '',
                performer: (resource.performer || []).join(', '),
                encounterId: resource.encounterId || '',
            };
        case 'Specimen':
            return {
                title: resource.type?.text || 'Specimen',
                status: resource.status,
                collectedAt: clinicalDateValue(resource.collectedAt),
                receivedAt: clinicalDateValue(resource.receivedAt),
                bodySite: resource.bodySite?.text || '',
                collectionMethod: resource.collectionMethod?.text || '',
                note: resource.note || '',
            };
        case 'Encounter':
            return {
                title: resource.type?.text || humanizeToken(resource.encounterClass),
                status: resource.status,
                encounterClass: resource.encounterClass,
                start: periodStart(resource.period),
                end: periodEnd(resource.period),
                reason: conceptTexts(resource.reason),
                participant: resource.participants[0]?.person || resource.participants[0]?.organization || '',
                participantRole: resource.participants[0]?.role?.text || '',
                location: resource.location || '',
                serviceProvider: resource.serviceProvider || '',
            };
        case 'Procedure': {
            const performed = resource.performed;
            const start = performed && 'precision' in performed
                ? clinicalDateValue(performed)
                : periodStart(performed);
            const end = performed && !('precision' in performed)
                ? periodEnd(performed)
                : '';
            return {
                title: resource.code.text,
                status: resource.status,
                start,
                end,
                bodySites: conceptTexts(resource.bodySite),
                reason: conceptTexts(resource.reason),
                outcome: resource.outcome?.text || '',
                complications: conceptTexts(resource.complications),
                performer: (resource.performer || []).join(', '),
                encounterId: resource.encounterId || '',
                reportIds: (resource.reportIds || []).join(', '),
                note: resource.note || '',
            };
        }
        case 'Immunization':
            return {
                title: resource.vaccineCode.text,
                status: resource.status,
                occurrence: clinicalDateValue(resource.occurrence),
                manufacturer: resource.manufacturer || '',
                lotNumber: resource.lotNumber || '',
                doseValue: resource.doseQuantity ? String(resource.doseQuantity.original.value) : '',
                doseUnit: resource.doseQuantity?.original.unit || '',
                route: resource.route?.text || '',
                site: resource.site?.text || '',
                reason: conceptTexts(resource.reason),
                performer: resource.performer || '',
                note: resource.note || '',
            };
        case 'Appointment':
            return {
                title: resource.title || 'Appointment',
                status: resource.status,
                startDateTime: datetimeLocalValue(resource.start),
                endDateTime: datetimeLocalValue(resource.end),
                requestedDate: resource.requestedPeriod?.[0]?.start?.value || '',
                reason: conceptTexts(resource.reason),
                participant: resource.participants[0]?.name || '',
                participantRole: resource.participants[0]?.role?.text || '',
                participantStatus: resource.participants[0]?.status || 'needs-action',
                location: resource.location || '',
                encounterId: resource.encounterId || '',
                description: resource.description || '',
                note: resource.note || '',
            };
        case 'ClinicalTask': {
            const due = resource.due;
            return {
                title: resource.title,
                status: resource.status,
                intent: resource.intent,
                priority: resource.priority,
                code: resource.code?.text || '',
                start: due && 'precision' in due ? clinicalDateValue(due) : periodStart(due),
                end: due && !('precision' in due) ? periodEnd(due) : '',
                owner: resource.owner || '',
                completedAt: datetimeLocalValue(resource.completedAt),
                description: resource.description || '',
                note: resource.note || '',
            };
        }
        case 'CarePlan':
            return {
                title: resource.title,
                status: resource.status,
                intent: resource.intent,
                start: periodStart(resource.period),
                end: periodEnd(resource.period),
                conditionIds: resource.addressesConditionIds.join(', '),
                taskIds: resource.activityTaskIds.join(', '),
                encounterId: resource.encounterId || '',
                description: resource.description || '',
                note: resource.note || '',
            };
        case 'ClinicalNote':
            return {
                title: resource.title,
                status: resource.status,
                noteType: resource.noteType,
                authoredAt: datetimeLocalValue(resource.authoredAt),
                author: resource.author || '',
                encounterId: resource.encounterId || '',
                amendsNoteId: resource.amendsNoteId || '',
                preservedSections: resource.sections.map(section => `${section.title}\n${section.text}`).join('\n\n'),
            };
        case 'DocumentReference':
            return {};
    }
};

export const isManagedManualResourceType = (
    value: ClinicalResourceType,
): value is ManagedManualResourceType =>
    MANAGED_MANUAL_RESOURCE_OPTIONS.some(optionItem => optionItem.value === value);

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

export const managedResourceStatus = (resource: ClinicalRecordResource): string => {
    switch (resource.resourceType) {
        case 'PatientProfile': return 'profile';
        case 'Condition': return resource.clinicalStatus;
        case 'AllergyIntolerance': return resource.clinicalStatus;
        case 'Medication': return resource.status;
        case 'Encounter':
        case 'Observation':
        case 'DiagnosticReport':
        case 'Specimen':
        case 'Procedure':
        case 'Immunization':
        case 'Appointment':
        case 'ClinicalTask':
        case 'CarePlan':
        case 'DocumentReference':
        case 'ClinicalNote':
            return resource.status;
    }
};

const sourceLabel = (resource: ClinicalRecordResource): string => {
    const source = resource.provenance.source;
    const kind = humanizeToken(source.kind);
    return source.document?.fileName
        ? `${kind}: ${source.document.fileName}`
        : source.externalSystem
            ? `${kind}: ${source.externalSystem}`
            : source.description
                ? `${kind}: ${source.description}`
                : kind;
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
    const statusLabel = humanizeToken(managedResourceStatus(resource));
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
        searchText: [
            resource.resourceType,
            label,
            statusLabel,
            resource.verificationStatus,
            clinicalDateLabel,
            source,
            ...(resource.tags || []),
        ].join(' ').toLowerCase(),
        resource,
    };
};

export const listManagedResourceSummaries = (
    record: PatientClinicalRecord,
    includeProfile = false,
): ManagedResourceSummary[] =>
    flattenPatientResources(record, includeProfile)
        .map(summarizeManagedResource)
        .sort((left, right) => {
            if (left.knownClinicalDate !== right.knownClinicalDate) {
                return left.knownClinicalDate ? -1 : 1;
            }
            const leftTime = getResourceDateBounds(left.resource).start
                ?? Date.parse(left.resource.recordedAt)
                ?? 0;
            const rightTime = getResourceDateBounds(right.resource).start
                ?? Date.parse(right.resource.recordedAt)
                ?? 0;
            if (leftTime !== rightTime) return rightTime - leftTime;
            return left.label.localeCompare(right.label);
        });
