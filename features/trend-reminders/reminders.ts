import { v4 as uuidv4 } from 'uuid';
import { createUnknownClinicalDate } from '../clinical-record/factories';
import { parseClinicalRecordResource } from '../clinical-record/schemas';
import type {
    AppointmentRecord,
    CarePlanRecord,
    ClinicalDate,
    ClinicalPeriod,
    ClinicalRecordResource,
    ClinicalTaskRecord,
    MedicationRecord,
    PatientClinicalRecord,
    SourceDocumentReference,
} from '../clinical-record/types';
import type {
    ExplicitReminderItem,
    ExplicitReminderSourceType,
    ExplicitReminderState,
    ExplicitReminderViewModel,
    ReminderFollowUpTaskInput,
    ReminderFollowUpTaskResult,
} from './types';

const DAY_MS = 86_400_000;
const CLOSED_TASK_STATUSES = new Set<ClinicalTaskRecord['status']>([
    'completed',
]);
const CANCELLED_TASK_STATUSES = new Set<ClinicalTaskRecord['status']>([
    'cancelled',
    'failed',
    'entered-in-error',
]);

interface DateDescriptor {
    hasDateField: boolean;
    exactDate?: string;
    dateLabel: string;
    precision: ClinicalDate['precision'];
}

const normalizeText = (value?: string): string => (value || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ');

const evidenceIdFor = (resource: ClinicalRecordResource): string =>
    `MB:${resource.resourceType}:${resource.id.replace(/[^A-Za-z0-9._:-]/g, '_')}`;

const patientApplicable = (resource: ClinicalRecordResource): boolean => {
    if (resource.verificationStatus !== 'confirmed') return false;
    if ('status' in resource && resource.status === 'entered-in-error') {
        return false;
    }
    const assertion = resource.assertion;
    if (!assertion) return true;
    if (assertion.polarity === 'negated') return false;
    if (assertion.temporality === 'hypothetical') return false;
    return assertion.experiencer !== 'family'
        && assertion.experiencer !== 'other';
};

const sourceDocumentFor = (
    resource: ClinicalRecordResource,
): SourceDocumentReference | undefined => resource.provenance.source.document;

const sourceLabelFor = (resource: ClinicalRecordResource): string => {
    const source = resource.provenance.source;
    if (source.document) {
        const file = source.document.fileName || source.document.documentId;
        return source.document.pageNumber
            ? `${file}, page ${source.document.pageNumber}`
            : file;
    }
    if (normalizeText(source.description)) return normalizeText(source.description);
    if (source.externalSystem || source.externalId) {
        return [source.externalSystem, source.externalId]
            .filter(Boolean)
            .join(' · ');
    }
    return source.kind.replace(/-/g, ' ');
};

const validExactDay = (value?: string | null): value is string => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = Date.parse(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed)
        && new Date(parsed).toISOString().slice(0, 10) === value;
};

const descriptorFromClinicalDate = (
    date?: ClinicalDate,
): DateDescriptor => {
    if (!date) {
        return {
            hasDateField: false,
            dateLabel: 'Unscheduled — no explicit date recorded',
            precision: 'unknown',
        };
    }
    if (!date.value || date.precision === 'unknown') {
        return {
            hasDateField: true,
            dateLabel: date.sourceText
                ? `Clinical date unknown — source text: ${date.sourceText}`
                : 'Clinical date unknown',
            precision: 'unknown',
        };
    }
    if (date.precision !== 'day' || !validExactDay(date.value)) {
        return {
            hasDateField: true,
            dateLabel: `${date.value} (${date.precision} precision; not scheduled to an exact day)`,
            precision: date.precision,
        };
    }
    return {
        hasDateField: true,
        exactDate: date.value,
        dateLabel: date.value,
        precision: 'day',
    };
};

const descriptorFromPeriod = (
    period?: ClinicalPeriod,
    preference: 'start' | 'end' = 'start',
): DateDescriptor => {
    if (!period) return descriptorFromClinicalDate(undefined);
    const preferred = preference === 'end' ? period.end : period.start;
    const fallback = preference === 'end' ? period.start : period.end;
    const chosen = preferred || fallback;
    if (!chosen) {
        return {
            hasDateField: true,
            dateLabel: 'Clinical date unknown',
            precision: 'unknown',
        };
    }
    return descriptorFromClinicalDate(chosen);
};

const descriptorFromDateTime = (value?: string): DateDescriptor => {
    if (!value) return descriptorFromClinicalDate(undefined);
    const day = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (!validExactDay(day)) {
        return {
            hasDateField: true,
            dateLabel: 'Clinical date unknown',
            precision: 'unknown',
        };
    }
    return {
        hasDateField: true,
        exactDate: day,
        dateLabel: value,
        precision: 'day',
    };
};

const utcDayStart = (date: Date): number => Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
);

const stateFromExactDate = (
    exactDate: string,
    referenceDate: Date,
): ExplicitReminderState => {
    const target = Date.parse(`${exactDate}T00:00:00.000Z`);
    const today = utcDayStart(referenceDate);
    if (target < today) return 'overdue';
    if (target === today) return 'due-today';
    if (target <= today + (7 * DAY_MS)) return 'upcoming';
    return 'later';
};

const stateForOpenDate = (
    descriptor: DateDescriptor,
    referenceDate: Date,
): ExplicitReminderState => {
    if (descriptor.exactDate) {
        return stateFromExactDate(descriptor.exactDate, referenceDate);
    }
    return descriptor.hasDateField ? 'unknown-date' : 'unscheduled';
};

const stateLabel = (state: ExplicitReminderState): string => {
    switch (state) {
        case 'overdue': return 'Recorded date passed';
        case 'due-today': return 'Due today';
        case 'upcoming': return 'Upcoming within 7 days';
        case 'later': return 'Scheduled later';
        case 'completed': return 'Recorded completed';
        case 'cancelled': return 'Recorded cancelled / closed';
        case 'unknown-date': return 'Date unknown or imprecise';
        case 'unscheduled': return 'Unscheduled';
    }
};

const timingMeaning = (state: ExplicitReminderState): string => {
    switch (state) {
        case 'overdue':
            return 'The recorded reminder date has passed, but completion is not confirmed by this derived view.';
        case 'due-today':
            return 'The explicit source date is today in the local UTC-day comparison.';
        case 'upcoming':
            return 'The explicit source date is within the next seven days.';
        case 'later':
            return 'The explicit source date is more than seven days away.';
        case 'completed':
            return 'The source record itself is recorded as completed or fulfilled.';
        case 'cancelled':
            return 'The source record itself is cancelled, failed, stopped, not taken, revoked, or entered in error.';
        case 'unknown-date':
            return 'A source date field exists, but it is unknown or not precise enough for an exact-day reminder.';
        case 'unscheduled':
            return 'No explicit due, appointment, plan-boundary, medication end, or future start date is recorded.';
    }
};

const sortTimestampFor = (
    state: ExplicitReminderState,
    exactDate?: string,
): number => {
    const stateOrder: Record<ExplicitReminderState, number> = {
        overdue: 0,
        'due-today': 1,
        upcoming: 2,
        later: 3,
        'unknown-date': 4,
        unscheduled: 5,
        completed: 6,
        cancelled: 7,
    };
    const date = exactDate
        ? Date.parse(`${exactDate}T00:00:00.000Z`)
        : Number.MAX_SAFE_INTEGER;
    return (stateOrder[state] * 10_000_000_000_000) + date;
};

const followUpTaskMap = (
    record: PatientClinicalRecord,
): Map<string, string> => {
    const map = new Map<string, string>();
    record.resources.tasks
        .filter(task => patientApplicable(task))
        .filter(task => task.tags?.includes('explicit-reminder-follow-up'))
        .forEach(task => task.relatedResources.forEach(reference => {
            if (!reference.resourceType) return;
            map.set(`${reference.resourceType}:${reference.id}`, task.id);
        }));
    return map;
};

const finalizeReminder = ({
    resource,
    sourceType,
    title,
    description,
    state,
    descriptor,
    sourceStatus,
    actionBoundary,
    relatedResourceIds,
    warnings,
    followUpTaskId,
    canCreate,
}: {
    resource: ClinicalRecordResource;
    sourceType: ExplicitReminderSourceType;
    title: string;
    description: string;
    state: ExplicitReminderState;
    descriptor: DateDescriptor;
    sourceStatus: string;
    actionBoundary: string;
    relatedResourceIds?: string[];
    warnings?: string[];
    followUpTaskId?: string;
    canCreate: boolean;
}): ExplicitReminderItem => {
    const sourceLabel = sourceLabelFor(resource);
    const searchText = [
        title,
        description,
        state,
        stateLabel(state),
        descriptor.dateLabel,
        resource.resourceType,
        resource.id,
        sourceType,
        sourceStatus,
        sourceLabel,
        actionBoundary,
        ...(warnings || []),
    ].join(' ').toLocaleLowerCase();
    return {
        id: `reminder:${resource.resourceType}:${resource.id}`,
        sourceType,
        resourceType: resource.resourceType,
        resourceId: resource.id,
        evidenceId: evidenceIdFor(resource),
        title,
        description,
        sourceStatus,
        state,
        stateLabel: stateLabel(state),
        dateLabel: descriptor.dateLabel,
        datePrecision: descriptor.precision,
        ...(descriptor.exactDate ? { exactDate: descriptor.exactDate } : {}),
        timingMeaning: timingMeaning(state),
        actionBoundary,
        sourceLabel,
        ...(sourceDocumentFor(resource)
            ? { sourceDocument: sourceDocumentFor(resource) }
            : {}),
        relatedResourceIds: relatedResourceIds || [],
        warnings: warnings || [],
        canCreateFollowUpTask:
            canCreate && !followUpTaskId && !['completed', 'cancelled'].includes(state),
        ...(followUpTaskId ? { existingFollowUpTaskId: followUpTaskId } : {}),
        sortTimestamp: sortTimestampFor(state, descriptor.exactDate),
        searchText,
    };
};

const appointmentReminder = (
    appointment: AppointmentRecord,
    referenceDate: Date,
    followUps: Map<string, string>,
): ExplicitReminderItem => {
    let descriptor = descriptorFromDateTime(appointment.start);
    if (!descriptor.hasDateField && appointment.requestedPeriod?.length) {
        descriptor = descriptorFromPeriod(appointment.requestedPeriod[0], 'start');
    }
    const state: ExplicitReminderState = appointment.status === 'fulfilled'
        ? 'completed'
        : ['cancelled', 'no-show', 'entered-in-error'].includes(appointment.status)
            ? 'cancelled'
            : stateForOpenDate(descriptor, referenceDate);
    const title = appointment.title || 'Appointment record';
    const meaning = appointment.status === 'proposed'
        ? 'Proposed appointment — not booked.'
        : appointment.status === 'pending'
            ? 'Pending appointment — booking not confirmed.'
            : appointment.status === 'booked'
                ? 'Recorded as booked; MediBrief does not contact the clinic or independently confirm availability.'
                : appointment.status === 'arrived'
                    ? 'Recorded as arrived; fulfillment is not implied.'
                    : `Recorded appointment status: ${appointment.status.replace(/-/g, ' ')}.`;
    return finalizeReminder({
        resource: appointment,
        sourceType: 'appointment',
        title,
        description: [
            appointment.description,
            appointment.location ? `Location: ${appointment.location}` : '',
            meaning,
        ].filter(Boolean).join(' '),
        state,
        descriptor,
        sourceStatus: appointment.status,
        actionBoundary:
            'This reminder does not book, cancel, contact, or notify a clinic and does not prove that care occurred.',
        relatedResourceIds: appointment.encounterId
            ? [appointment.encounterId]
            : [],
        followUpTaskId: followUps.get(`Appointment:${appointment.id}`),
        canCreate: true,
    });
};

const taskReminder = (
    task: ClinicalTaskRecord,
    referenceDate: Date,
): ExplicitReminderItem => {
    const descriptor = task.due
        ? ('precision' in task.due
            ? descriptorFromClinicalDate(task.due)
            : descriptorFromPeriod(task.due, 'end'))
        : descriptorFromClinicalDate(undefined);
    const state: ExplicitReminderState = CLOSED_TASK_STATUSES.has(task.status)
        ? 'completed'
        : CANCELLED_TASK_STATUSES.has(task.status)
            ? 'cancelled'
            : stateForOpenDate(descriptor, referenceDate);
    const sourceType: ExplicitReminderSourceType = task.tags?.includes('advisory-follow-up')
        || Boolean(task.provenance.source.externalId)
        ? 'validated-advisory'
        : 'task';
    const actionBoundary = task.intent === 'proposal'
        ? 'This is a local proposal task, not an order or proof that the action occurred.'
        : task.intent === 'plan'
            ? 'This is a recorded plan; completion and external execution are not confirmed.'
            : 'This record carries order intent, but MediBrief does not confirm transmission, execution, or completion.';
    return finalizeReminder({
        resource: task,
        sourceType,
        title: task.title,
        description: [task.description, task.note].filter(Boolean).join(' '),
        state,
        descriptor,
        sourceStatus: task.status,
        actionBoundary,
        relatedResourceIds: task.relatedResources.map(reference => reference.id),
        canCreate: false,
    });
};

const carePlanReminder = (
    carePlan: CarePlanRecord,
    referenceDate: Date,
    followUps: Map<string, string>,
): ExplicitReminderItem => {
    const descriptor = descriptorFromPeriod(carePlan.period, 'end');
    const state: ExplicitReminderState = carePlan.status === 'completed'
        ? 'completed'
        : ['revoked', 'entered-in-error'].includes(carePlan.status)
            ? 'cancelled'
            : stateForOpenDate(descriptor, referenceDate);
    const boundary = carePlan.intent === 'proposal'
        ? 'The care plan is proposed and is not an active order or completed care action.'
        : carePlan.intent === 'option'
            ? 'The care plan is recorded as an option and is not selected or executed by implication.'
            : 'The care-plan period is recorded evidence; it does not prove that every activity was accepted or completed.';
    return finalizeReminder({
        resource: carePlan,
        sourceType: 'care-plan',
        title: `Care plan period review: ${carePlan.title}`,
        description: [carePlan.description, carePlan.note].filter(Boolean).join(' '),
        state,
        descriptor,
        sourceStatus: carePlan.status,
        actionBoundary: boundary,
        relatedResourceIds: [
            ...carePlan.addressesConditionIds,
            ...carePlan.activityTaskIds,
            ...(carePlan.encounterId ? [carePlan.encounterId] : []),
        ],
        followUpTaskId: followUps.get(`CarePlan:${carePlan.id}`),
        canCreate: true,
    });
};

const medicationReminder = (
    medication: MedicationRecord,
    referenceDate: Date,
    followUps: Map<string, string>,
): ExplicitReminderItem => {
    const today = utcDayStart(referenceDate);
    const endDescriptor = descriptorFromClinicalDate(medication.end);
    const startDescriptor = descriptorFromClinicalDate(medication.start);
    const futureStart = startDescriptor.exactDate
        ? Date.parse(`${startDescriptor.exactDate}T00:00:00.000Z`) >= today
        : false;
    const descriptor = medication.end
        ? endDescriptor
        : futureStart
            ? startDescriptor
            : medication.start && startDescriptor.precision !== 'day'
                ? startDescriptor
                : descriptorFromClinicalDate(undefined);
    const state: ExplicitReminderState = medication.status === 'completed'
        ? 'completed'
        : ['stopped', 'not-taken', 'entered-in-error'].includes(medication.status)
            ? 'cancelled'
            : stateForOpenDate(descriptor, referenceDate);
    const warnings: string[] = [];
    if (!medication.end && medication.start && !futureStart) {
        warnings.push(
            'A historical medication start date is preserved as context but is not treated as a future reminder date.',
        );
    }
    if (medication.dosageInstructions.length === 0) {
        warnings.push('Medication directions are not recorded.');
    }
    return finalizeReminder({
        resource: medication,
        sourceType: 'medication',
        title: `Medication date review: ${medication.medication.text}`,
        description: [
            `Record kind: ${medication.kind}.`,
            `Recorded status: ${medication.status}.`,
            medication.dosageInstructions.map(item => item.text).filter(Boolean).join(' | '),
        ].filter(Boolean).join(' '),
        state,
        descriptor,
        sourceStatus: medication.status,
        actionBoundary:
            'This date review is not an instruction to start, stop, hold, resume, or change medication and is not a regimen-safety determination.',
        relatedResourceIds: medication.encounterId
            ? [medication.encounterId]
            : [],
        warnings,
        followUpTaskId: followUps.get(`Medication:${medication.id}`),
        canCreate: true,
    });
};

const emptyCounts = (): Record<ExplicitReminderState, number> => ({
    overdue: 0,
    'due-today': 0,
    upcoming: 0,
    later: 0,
    completed: 0,
    cancelled: 0,
    'unknown-date': 0,
    unscheduled: 0,
});

export const buildExplicitReminderViewModel = (
    record: PatientClinicalRecord,
    options: {
        referenceDate?: Date;
        search?: string;
        state?: ExplicitReminderState | 'all';
    } = {},
): ExplicitReminderViewModel => {
    const referenceDate = options.referenceDate || new Date();
    const followUps = followUpTaskMap(record);
    const reminders: ExplicitReminderItem[] = [
        ...record.resources.appointments
            .filter(patientApplicable)
            .map(resource => appointmentReminder(resource, referenceDate, followUps)),
        ...record.resources.tasks
            .filter(patientApplicable)
            .map(resource => taskReminder(resource, referenceDate)),
        ...record.resources.carePlans
            .filter(patientApplicable)
            .map(resource => carePlanReminder(resource, referenceDate, followUps)),
        ...record.resources.medications
            .filter(patientApplicable)
            .map(resource => medicationReminder(resource, referenceDate, followUps)),
    ];
    const counts = emptyCounts();
    reminders.forEach(reminder => {
        counts[reminder.state] += 1;
    });
    const query = normalizeText(options.search).toLocaleLowerCase();
    const stateFilter = options.state || 'all';
    const items = reminders
        .filter(item => stateFilter === 'all' || item.state === stateFilter)
        .filter(item => !query || item.searchText.includes(query))
        .sort((left, right) => {
            if (left.sortTimestamp !== right.sortTimestamp) {
                return left.sortTimestamp - right.sortTimestamp;
            }
            return left.title.localeCompare(right.title);
        });
    const candidateCount = [
        ...record.resources.appointments,
        ...record.resources.tasks,
        ...record.resources.carePlans,
        ...record.resources.medications,
    ].filter(resource => resource.verificationStatus === 'candidate').length;

    return {
        items,
        counts,
        totalCount: reminders.length,
        openCount: reminders.filter(item => ![
            'completed',
            'cancelled',
        ].includes(item.state)).length,
        closedCount: reminders.filter(item => [
            'completed',
            'cancelled',
        ].includes(item.state)).length,
        candidateCount,
        actionableCount: reminders.filter(item => [
            'overdue',
            'due-today',
            'upcoming',
        ].includes(item.state)).length,
    };
};

export const explicitReminderMatchesSearch = (
    reminder: ExplicitReminderItem,
    query: string,
): boolean => !normalizeText(query)
    || reminder.searchText.includes(normalizeText(query).toLocaleLowerCase());

export const createReminderFollowUpTaskRecord = ({
    patientId,
    reminder,
    reason,
    createdAt = new Date().toISOString(),
    createdBy,
}: ReminderFollowUpTaskInput): ReminderFollowUpTaskResult => {
    const cleanReason = normalizeText(reason);
    if (!cleanReason) {
        throw new Error('Creating a reminder follow-up task requires a review reason.');
    }
    if (!reminder.canCreateFollowUpTask) {
        throw new Error('This reminder cannot create another follow-up task.');
    }

    const mayCopyExactDate = Boolean(
        reminder.exactDate
        && ['due-today', 'upcoming', 'later'].includes(reminder.state),
    );
    const due = mayCopyExactDate
        ? {
            value: reminder.exactDate!,
            precision: 'day' as const,
            sourceText: reminder.exactDate!,
        }
        : createUnknownClinicalDate();
    const warnings: string[] = [];
    if (!mayCopyExactDate) {
        warnings.push(
            'The follow-up task due date remains unknown because no future exact source date was safe to copy.',
        );
    }

    const task = parseClinicalRecordResource({
        id: uuidv4(),
        patientId,
        resourceType: 'ClinicalTask',
        verificationStatus: 'confirmed',
        recordedAt: createdAt,
        effective: due,
        provenance: {
            source: {
                kind: 'manual',
                description:
                    'Created after an explicit user action in the record-derived reminders workspace.',
            },
            createdAt,
            updatedAt: createdAt,
            ...(createdBy ? { createdBy, updatedBy: createdBy } : {}),
            confirmation: {
                reviewedAt: createdAt,
                ...(createdBy ? { reviewedBy: createdBy } : {}),
                reason: cleanReason,
            },
        },
        amendments: [],
        tags: [
            'explicit-reminder-follow-up',
            'review-proposal',
            'not-an-order',
            `source-${reminder.sourceType}`,
        ],
        status: 'requested',
        intent: 'proposal',
        priority: 'routine',
        code: { text: 'Review recorded reminder evidence' },
        title: `Review: ${reminder.title}`,
        description: [
            reminder.description,
            `Source reminder state: ${reminder.stateLabel}.`,
            `Source date: ${reminder.dateLabel}.`,
            `Review reason: ${cleanReason}.`,
        ].filter(Boolean).join('\n'),
        due,
        relatedResources: [{
            resourceType: reminder.resourceType,
            id: reminder.resourceId,
            display: reminder.title,
        }],
        note: [
            'This is a local proposal task created by explicit user action.',
            'It does not send a notification or book anything. It is not an order, prescription, treatment instruction, or proof that any external action occurred.',
            reminder.actionBoundary,
        ].join(' '),
    }) as ClinicalTaskRecord;

    return { task, warnings };
};
