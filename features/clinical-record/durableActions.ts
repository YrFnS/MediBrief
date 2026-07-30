import { v4 as uuidv4 } from 'uuid';
import { createUnknownClinicalDate } from './factories';
import { parseClinicalRecordResource } from './schemas';
import type {
    AppointmentRecord,
    ClinicalDate,
    ClinicalNoteRecord,
    ClinicalNoteSection,
    ClinicalTaskPriority,
    ClinicalTaskRecord,
} from './types';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

const cleanText = (value: unknown): string =>
    typeof value === 'string' ? value.trim() : '';

const validDateOnly = (value: string): boolean => {
    if (!DATE_ONLY_PATTERN.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return parsed.getUTCFullYear() === year
        && parsed.getUTCMonth() === month - 1
        && parsed.getUTCDate() === day;
};

const requestedClinicalDate = (value: string): ClinicalDate => {
    if (!value) return createUnknownClinicalDate();
    if (!validDateOnly(value)) return createUnknownClinicalDate(value);
    return {
        value,
        precision: 'day',
        sourceText: value,
    };
};

const combineLocalDateAndTime = (
    date: string,
    time: string,
): string | undefined => {
    if (!validDateOnly(date) || !TIME_PATTERN.test(time)) return undefined;
    const local = new Date(`${date}T${time.length === 5 ? `${time}:00` : time}`);
    return Number.isNaN(local.getTime()) ? undefined : local.toISOString();
};

export interface ProposedAppointmentInput {
    patientId: string;
    date?: unknown;
    time?: unknown;
    notes?: unknown;
    title?: string;
    createdAt?: string;
    createdBy?: string;
}

export interface ProposedAppointmentResult {
    record: AppointmentRecord;
    warnings: string[];
}

/**
 * Persists the fact that the user requested an appointment proposal.
 * The record deliberately remains `status: proposed`; it never claims that an
 * external clinic accepted or booked the appointment.
 */
export const createProposedAppointmentRecord = ({
    patientId,
    date,
    time,
    notes,
    title = 'Appointment request',
    createdAt = new Date().toISOString(),
    createdBy,
}: ProposedAppointmentInput): ProposedAppointmentResult => {
    const requestedDateText = cleanText(date);
    const requestedTimeText = cleanText(time);
    const noteText = cleanText(notes);
    const clinicalDate = requestedClinicalDate(requestedDateText);
    const start = combineLocalDateAndTime(
        requestedDateText,
        requestedTimeText,
    );
    const warnings: string[] = [];

    if (requestedDateText && !validDateOnly(requestedDateText)) {
        warnings.push(
            `The requested date “${requestedDateText}” could not be normalized and remains unknown.`,
        );
    }
    if (requestedTimeText && !TIME_PATTERN.test(requestedTimeText)) {
        warnings.push(
            `The requested time “${requestedTimeText}” could not be normalized.`,
        );
    }
    if (!requestedDateText) {
        warnings.push('No requested appointment date was supplied.');
    }
    if (!requestedTimeText) {
        warnings.push('No requested appointment time was supplied.');
    }

    const detailLines = [
        noteText,
        requestedDateText ? `Requested date: ${requestedDateText}` : '',
        requestedTimeText ? `Requested time: ${requestedTimeText}` : '',
        ...warnings,
        'This is a local appointment proposal, not confirmation from a clinic or scheduling system.',
    ].filter(Boolean);

    const record = parseClinicalRecordResource({
        id: uuidv4(),
        patientId,
        resourceType: 'Appointment',
        verificationStatus: 'confirmed',
        recordedAt: createdAt,
        effective: clinicalDate,
        provenance: {
            source: {
                kind: 'ai-suggestion',
                description: 'Created from a user-invoked appointment scheduling request in MediBrief.',
            },
            createdAt,
            updatedAt: createdAt,
            ...(createdBy ? { createdBy, updatedBy: createdBy } : {}),
            confirmation: {
                reviewedAt: createdAt,
                ...(createdBy ? { reviewedBy: createdBy } : {}),
                reason: 'The user requested that this appointment proposal be saved. Booking remains unconfirmed.',
            },
        },
        amendments: [],
        tags: ['appointment-request', 'not-booked'],
        status: 'proposed',
        title,
        description: 'Local appointment request awaiting confirmation by the relevant provider or clinic.',
        ...(start ? { start } : {}),
        requestedPeriod: [{ start: clinicalDate }],
        participants: [{
            name: 'Patient',
            status: 'needs-action',
        }],
        note: detailLines.join('\n'),
    }) as AppointmentRecord;

    return { record, warnings };
};

export interface AdvisoryTaskInput {
    patientId: string;
    advisoryTitle: string;
    actionLabel: string;
    details?: string;
    sourceRuleId?: string;
    priority?: ClinicalTaskPriority;
    createdAt?: string;
    createdBy?: string;
}

/**
 * Converts a reviewed advisory suggestion into a durable follow-up task. The
 * task uses `intent: proposal`, so it cannot be confused with a medication,
 * test, referral, or treatment order.
 */
export const createAdvisoryTaskRecord = ({
    patientId,
    advisoryTitle,
    actionLabel,
    details,
    sourceRuleId,
    priority = 'routine',
    createdAt = new Date().toISOString(),
    createdBy,
}: AdvisoryTaskInput): ClinicalTaskRecord => parseClinicalRecordResource({
    id: uuidv4(),
    patientId,
    resourceType: 'ClinicalTask',
    verificationStatus: 'confirmed',
    recordedAt: createdAt,
    provenance: {
        source: {
            kind: 'ai-suggestion',
            description: 'Created after the user chose to save a follow-up task from a clinical advisory.',
            ...(sourceRuleId ? { externalId: sourceRuleId } : {}),
        },
        createdAt,
        updatedAt: createdAt,
        ...(createdBy ? { createdBy, updatedBy: createdBy } : {}),
        confirmation: {
            reviewedAt: createdAt,
            ...(createdBy ? { reviewedBy: createdBy } : {}),
            reason: 'The user created a follow-up task. No clinical order or completed intervention was recorded.',
        },
    },
    amendments: [],
    tags: ['advisory-follow-up', 'not-an-order'],
    status: 'requested',
    intent: 'proposal',
    priority,
    title: `Follow-up: ${actionLabel}`,
    description: [
        advisoryTitle,
        cleanText(details),
    ].filter(Boolean).join('\n'),
    relatedResources: [],
    note: 'This task records a follow-up reminder only. It is not an order and does not indicate that any action was performed.',
}) as ClinicalTaskRecord;

export interface SoapNoteInput {
    patientId: string;
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    transcript?: string[];
    authoredAt?: string;
    author?: string;
}

const soapSections = ({
    subjective,
    objective,
    assessment,
    plan,
    transcript = [],
}: Pick<
    SoapNoteInput,
    'subjective' | 'objective' | 'assessment' | 'plan' | 'transcript'
>): ClinicalNoteSection[] => {
    const sections: ClinicalNoteSection[] = [
        { title: 'Subjective', text: cleanText(subjective) },
        { title: 'Objective', text: cleanText(objective) },
        { title: 'Assessment', text: cleanText(assessment) },
        { title: 'Plan', text: cleanText(plan) },
    ].filter(section => section.text.length > 0);

    const transcriptText = transcript
        .map(cleanText)
        .filter(Boolean)
        .join('\n');
    if (transcriptText) {
        sections.push({
            title: 'Source transcript',
            text: transcriptText,
        });
    }
    return sections;
};

/**
 * Creates a durable reviewed SOAP note. The provenance states that the initial
 * structure was AI-assisted while the confirmation records the user's explicit
 * save action.
 */
export const createReviewedSoapNoteRecord = ({
    patientId,
    subjective,
    objective,
    assessment,
    plan,
    transcript = [],
    authoredAt = new Date().toISOString(),
    author,
}: SoapNoteInput): ClinicalNoteRecord => {
    const sections = soapSections({
        subjective,
        objective,
        assessment,
        plan,
        transcript,
    });
    if (sections.length === 0) {
        throw new Error('A clinical note requires at least one non-empty section.');
    }

    return parseClinicalRecordResource({
        id: uuidv4(),
        patientId,
        resourceType: 'ClinicalNote',
        verificationStatus: 'confirmed',
        recordedAt: authoredAt,
        provenance: {
            source: {
                kind: 'ai-suggestion',
                description: 'SOAP note drafted with the local ambient-scribe workflow and explicitly saved by the user.',
            },
            createdAt: authoredAt,
            updatedAt: authoredAt,
            ...(author ? { createdBy: author, updatedBy: author } : {}),
            confirmation: {
                reviewedAt: authoredAt,
                ...(author ? { reviewedBy: author } : {}),
                reason: 'The user reviewed the visible note fields and saved the note to the patient record.',
            },
        },
        amendments: [],
        tags: ['ambient-scribe', 'human-saved'],
        status: 'final',
        noteType: 'soap',
        title: 'SOAP note',
        authoredAt,
        ...(author ? { author } : {}),
        sections,
        sourceDocumentIds: [],
    }) as ClinicalNoteRecord;
};
