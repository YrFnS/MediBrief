import {
    findResourceInRecord,
    selectCandidateResources,
    selectConfirmedResources,
} from '../clinical-record';
import type {
    AppointmentRecord,
    CarePlanRecord,
    ClinicalDate,
    ClinicalPeriod,
    ClinicalRecordResource,
    ClinicalResourceType,
    ClinicalTaskRecord,
    PatientClinicalRecord,
} from '../clinical-record';
import type {
    LinkedRecordView,
} from './coreModuleTypes';
import type {
    AppointmentModuleItem,
    AppointmentsModuleViewModel,
    AppointmentTimingFilter,
    CarePlanModuleItem,
    CarePlansModuleViewModel,
    ClinicalTaskModuleItem,
    ClinicalTasksModuleViewModel,
    TaskReminderFilter,
} from './planningModuleTypes';
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

const recordedTimestamp = (resource: ClinicalRecordResource): number =>
    validTimestamp(Date.parse(resource.recordedAt)) || 0;

const clinicalDateBounds = (
    date?: ClinicalDate,
): { start: number; end: number } | null => {
    if (!date?.value || date.precision === 'unknown') return null;

    if (date.precision === 'year') {
        const start = Date.parse(`${date.value}-01-01T00:00:00.000Z`);
        const end = Date.parse(`${date.value}-12-31T23:59:59.999Z`);
        return Number.isNaN(start) || Number.isNaN(end)
            ? null
            : { start, end };
    }

    if (date.precision === 'month') {
        const [year, month] = date.value.split('-').map(Number);
        const start = Date.UTC(year, month - 1, 1, 0, 0, 0, 0);
        const end = Date.UTC(year, month, 0, 23, 59, 59, 999);
        return Number.isNaN(start) || Number.isNaN(end)
            ? null
            : { start, end };
    }

    const start = Date.parse(`${date.value}T00:00:00.000Z`);
    const end = Date.parse(`${date.value}T23:59:59.999Z`);
    return Number.isNaN(start) || Number.isNaN(end)
        ? null
        : { start, end };
};

interface DateLikeView {
    known: boolean;
    label: string;
    startLabel: string;
    endLabel: string;
    startTimestamp: number | null;
    endTimestamp: number | null;
    sortTimestamp: number;
}

const dateLikeView = (
    value: ClinicalDate | ClinicalPeriod | undefined,
    fallback: ClinicalRecordResource,
): DateLikeView => {
    if (!value) {
        return {
            known: false,
            label: 'Clinical date unknown',
            startLabel: 'Unknown',
            endLabel: 'Unknown',
            startTimestamp: null,
            endTimestamp: null,
            sortTimestamp: recordedTimestamp(fallback),
        };
    }

    if ('precision' in value) {
        const bounds = clinicalDateBounds(value);
        if (!bounds) {
            return {
                known: false,
                label: 'Clinical date unknown',
                startLabel: 'Unknown',
                endLabel: 'Unknown',
                startTimestamp: null,
                endTimestamp: null,
                sortTimestamp: recordedTimestamp(fallback),
            };
        }
        const label = formatClinicalDate(value);
        return {
            known: true,
            label,
            startLabel: label,
            endLabel: label,
            startTimestamp: bounds.start,
            endTimestamp: bounds.end,
            sortTimestamp: bounds.start,
        };
    }

    const startBounds = clinicalDateBounds(value.start);
    const endBounds = clinicalDateBounds(value.end);
    if (!startBounds && !endBounds) {
        return {
            known: false,
            label: 'Clinical date unknown',
            startLabel: 'Unknown',
            endLabel: 'Unknown',
            startTimestamp: null,
            endTimestamp: null,
            sortTimestamp: recordedTimestamp(fallback),
        };
    }

    const startLabel = value.start
        ? formatClinicalDate(value.start)
        : 'Unknown';
    const endLabel = value.end
        ? formatClinicalDate(value.end)
        : 'Ongoing / unknown';
    const startTimestamp = startBounds?.start ?? endBounds?.start ?? null;
    const endTimestamp = endBounds?.end ?? startBounds?.end ?? null;

    return {
        known: true,
        label: startLabel === endLabel
            ? startLabel
            : `${startLabel} — ${endLabel}`,
        startLabel,
        endLabel,
        startTimestamp,
        endTimestamp,
        sortTimestamp: startTimestamp ?? recordedTimestamp(fallback),
    };
};

const dateTimeTimestamp = (value?: string): number | null => {
    if (!value) return null;
    return validTimestamp(Date.parse(value));
};

const resourceLabel = (resource: ClinicalRecordResource): string => {
    switch (resource.resourceType) {
        case 'PatientProfile':
            return resource.displayName;
        case 'Encounter':
            return resource.type?.text
                || `${humanizeToken(resource.encounterClass)} encounter`;
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
        label: resourceLabel(resource),
    };
};

const conceptTexts = (values?: Array<{ text: string }>): string[] =>
    unique((values || []).map(value => value.text));

const appointmentIsCurrent = (appointment: AppointmentRecord): boolean => [
    'proposed',
    'pending',
    'booked',
    'arrived',
    'unknown',
].includes(appointment.status);

const appointmentBookingMeaning = (status: AppointmentRecord['status']): string => {
    switch (status) {
        case 'proposed':
            return 'Proposed — not booked';
        case 'pending':
            return 'Pending — booking not confirmed';
        case 'booked':
            return 'Recorded as booked';
        case 'arrived':
            return 'Recorded as arrived';
        case 'fulfilled':
            return 'Recorded as fulfilled';
        case 'cancelled':
            return 'Recorded as cancelled';
        case 'no-show':
            return 'Recorded as no-show';
        case 'entered-in-error':
            return 'Recorded as entered in error';
        case 'unknown':
            return 'Booking state unknown';
    }
};

const appointmentItem = (
    record: PatientClinicalRecord,
    appointment: AppointmentRecord,
    referenceDate: Date,
): AppointmentModuleItem => {
    const startTimestamp = dateTimeTimestamp(appointment.start);
    const endTimestamp = dateTimeTimestamp(appointment.end);
    const requestedViews = (appointment.requestedPeriod || []).map(period =>
        dateLikeView(period, appointment));
    const knownRequested = requestedViews.filter(view => view.known);
    const requestedStart = knownRequested
        .map(view => view.startTimestamp)
        .filter((value): value is number => value !== null)
        .sort((left, right) => left - right)[0] ?? null;
    const requestedEnd = knownRequested
        .map(view => view.endTimestamp)
        .filter((value): value is number => value !== null)
        .sort((left, right) => left - right)[0] ?? null;
    const bestStart = startTimestamp ?? requestedStart;
    const bestEnd = endTimestamp ?? requestedEnd ?? bestStart;
    const knownClinicalDate = bestStart !== null;
    const timing: AppointmentModuleItem['timing'] = !knownClinicalDate
        ? 'unknown'
        : (bestEnd ?? bestStart!) < referenceDate.getTime()
            ? 'past'
            : 'upcoming';
    const timingLabel = timing === 'upcoming'
        ? 'Upcoming requested time'
        : timing === 'past'
            ? 'Requested time has passed'
            : 'Requested time unknown';
    const reasons = conceptTexts(appointment.reason);
    const participants = appointment.participants.map(participant => ({
        name: participant.name,
        ...(participant.role?.text ? { role: participant.role.text } : {}),
        ...(participant.status
            ? {
                status: participant.status,
                statusLabel: humanizeToken(participant.status),
            }
            : {}),
    }));
    const encounter = appointment.encounterId
        ? linkedView(record, 'Encounter', appointment.encounterId)
        : undefined;
    const title = appointment.title || 'Appointment request';
    const startLabel = startTimestamp !== null
        ? formatDateTime(appointment.start)
        : knownRequested[0]?.startLabel || 'Clinical date unknown';
    const endLabel = endTimestamp !== null
        ? formatDateTime(appointment.end)
        : knownRequested[0]?.endLabel || 'Unknown';
    const requestedPeriodLabels = requestedViews.map(view => view.label);
    const provenance = buildResourceProvenanceView(appointment);
    const bookingMeaning = appointmentBookingMeaning(appointment.status);
    const searchText = [
        title,
        appointment.status,
        bookingMeaning,
        timing,
        startLabel,
        endLabel,
        ...requestedPeriodLabels,
        ...reasons,
        ...participants.flatMap(participant => [
            participant.name,
            participant.role,
            participant.status,
        ]),
        appointment.description,
        appointment.location,
        encounter?.label,
        appointment.note,
        provenance.sourceLabel,
        ...provenance.tags,
    ].filter(Boolean).join(' ').toLowerCase();

    return {
        id: appointment.id,
        title,
        status: appointment.status,
        statusLabel: humanizeToken(appointment.status),
        current: appointmentIsCurrent(appointment),
        bookingMeaning,
        timing,
        timingLabel,
        startLabel,
        endLabel,
        requestedPeriodLabels,
        knownClinicalDate,
        reasons,
        participants,
        ...(appointment.location ? { location: appointment.location } : {}),
        ...(encounter ? { encounter } : {}),
        ...(appointment.note ? { note: appointment.note } : {}),
        provenance,
        searchText,
        sortTimestamp: bestStart ?? recordedTimestamp(appointment),
    };
};

export const buildAppointmentsModuleViewModel = (
    record: PatientClinicalRecord,
    options: {
        search?: string;
        scope?: 'current' | 'history' | 'all';
        status?: string;
        timing?: AppointmentTimingFilter;
        referenceDate?: Date;
    } = {},
): AppointmentsModuleViewModel => {
    const referenceDate = options.referenceDate || new Date();
    const allItems = selectConfirmedResources(record)
        .filter((resource): resource is AppointmentRecord =>
            resource.resourceType === 'Appointment')
        .map(appointment => appointmentItem(record, appointment, referenceDate));
    const scope = options.scope || 'current';
    const status = options.status || 'all';
    const timing = options.timing || 'all';
    const items = allItems
        .filter(item => scope === 'all'
            || (scope === 'current' ? item.current : !item.current))
        .filter(item => status === 'all' || item.status === status)
        .filter(item => timing === 'all' || item.timing === timing)
        .filter(item => matchesSearch(item.searchText, options.search))
        .sort((left, right) => {
            if (left.current !== right.current) return left.current ? -1 : 1;
            if (left.knownClinicalDate !== right.knownClinicalDate) {
                return left.knownClinicalDate ? -1 : 1;
            }
            if (left.current && left.sortTimestamp !== right.sortTimestamp) {
                return left.sortTimestamp - right.sortTimestamp;
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
        proposedCount: allItems.filter(item => item.status === 'proposed').length,
        bookedCount: allItems.filter(item => item.status === 'booked').length,
        unknownDateCount: allItems.filter(item => !item.knownClinicalDate).length,
        candidateCount: selectCandidateResources(record).filter(resource =>
            resource.resourceType === 'Appointment').length,
        statusOptions: unique(allItems.map(item => item.status)),
    };
};

const taskIsCurrent = (task: ClinicalTaskRecord): boolean => [
    'draft',
    'requested',
    'received',
    'accepted',
    'in-progress',
].includes(task.status);

const taskIntentMeaning = (intent: ClinicalTaskRecord['intent']): string => {
    switch (intent) {
        case 'proposal':
            return 'Proposal only — not an order';
        case 'plan':
            return 'Planned activity — completion not confirmed';
        case 'order':
        case 'original-order':
        case 'reflex-order':
        case 'filler-order':
            return 'Recorded order intent — external execution not confirmed';
    }
};

const utcDayBounds = (referenceDate: Date): { start: number; end: number } => ({
    start: Date.UTC(
        referenceDate.getUTCFullYear(),
        referenceDate.getUTCMonth(),
        referenceDate.getUTCDate(),
        0,
        0,
        0,
        0,
    ),
    end: Date.UTC(
        referenceDate.getUTCFullYear(),
        referenceDate.getUTCMonth(),
        referenceDate.getUTCDate(),
        23,
        59,
        59,
        999,
    ),
});

const taskReminderState = (
    task: ClinicalTaskRecord,
    due: DateLikeView,
    referenceDate: Date,
): ClinicalTaskModuleItem['reminderState'] => {
    if (!taskIsCurrent(task)) return 'closed';
    if (!due.known || due.startTimestamp === null || due.endTimestamp === null) {
        return 'no-date';
    }

    const today = utcDayBounds(referenceDate);
    if (due.endTimestamp < today.start) return 'overdue';
    if (due.startTimestamp <= today.end) return 'due-today';
    if (due.startTimestamp <= today.end + (7 * 24 * 60 * 60 * 1000)) {
        return 'upcoming';
    }
    return 'later';
};

const reminderLabel = (
    state: ClinicalTaskModuleItem['reminderState'],
): string => {
    switch (state) {
        case 'overdue':
            return 'Overdue local reminder';
        case 'due-today':
            return 'Due today';
        case 'upcoming':
            return 'Due within 7 days';
        case 'later':
            return 'Future due date';
        case 'no-date':
            return 'Due date unknown';
        case 'closed':
            return 'Closed task';
    }
};

const taskItem = (
    record: PatientClinicalRecord,
    task: ClinicalTaskRecord,
    referenceDate: Date,
): ClinicalTaskModuleItem => {
    const due = dateLikeView(task.due || task.effective, task);
    const state = taskReminderState(task, due, referenceDate);
    const relatedResources = task.relatedResources.map(reference =>
        reference.resourceType
            ? linkedView(
                record,
                reference.resourceType,
                reference.id,
                reference.display,
            )
            : {
                id: reference.id,
                resourceType: 'Unknown',
                label: reference.display || 'Unspecified related record',
                missing: true,
            });
    const provenance = buildResourceProvenanceView(task);
    const intentMeaning = taskIntentMeaning(task.intent);
    const searchText = [
        task.title,
        task.status,
        task.intent,
        intentMeaning,
        task.priority,
        task.code?.text,
        task.description,
        due.label,
        state,
        reminderLabel(state),
        task.owner,
        ...relatedResources.flatMap(resource => [
            resource.resourceType,
            resource.label,
        ]),
        task.completedAt,
        task.note,
        provenance.sourceLabel,
        ...provenance.tags,
    ].filter(Boolean).join(' ').toLowerCase();

    return {
        id: task.id,
        title: task.title,
        status: task.status,
        statusLabel: humanizeToken(task.status),
        current: taskIsCurrent(task),
        intent: task.intent,
        intentLabel: humanizeToken(task.intent),
        intentMeaning,
        priority: task.priority,
        priorityLabel: humanizeToken(task.priority),
        ...(task.code?.text ? { code: task.code.text } : {}),
        ...(task.description ? { description: task.description } : {}),
        dueLabel: due.label,
        knownDueDate: due.known,
        reminderState: state,
        reminderLabel: reminderLabel(state),
        ...(task.owner ? { owner: task.owner } : {}),
        relatedResources,
        ...(task.completedAt
            ? { completedAtLabel: formatDateTime(task.completedAt) }
            : {}),
        ...(task.note ? { note: task.note } : {}),
        provenance,
        searchText,
        sortTimestamp: due.sortTimestamp,
    };
};

const REMINDER_SORT: Record<ClinicalTaskModuleItem['reminderState'], number> = {
    overdue: 0,
    'due-today': 1,
    upcoming: 2,
    later: 3,
    'no-date': 4,
    closed: 5,
};

export const buildClinicalTasksModuleViewModel = (
    record: PatientClinicalRecord,
    options: {
        search?: string;
        scope?: 'current' | 'history' | 'all';
        status?: string;
        intent?: string;
        priority?: string;
        reminder?: TaskReminderFilter;
        referenceDate?: Date;
    } = {},
): ClinicalTasksModuleViewModel => {
    const referenceDate = options.referenceDate || new Date();
    const allItems = selectConfirmedResources(record)
        .filter((resource): resource is ClinicalTaskRecord =>
            resource.resourceType === 'ClinicalTask')
        .map(task => taskItem(record, task, referenceDate));
    const scope = options.scope || 'current';
    const status = options.status || 'all';
    const intent = options.intent || 'all';
    const priority = options.priority || 'all';
    const reminder = options.reminder || 'all';
    const items = allItems
        .filter(item => scope === 'all'
            || (scope === 'current' ? item.current : !item.current))
        .filter(item => status === 'all' || item.status === status)
        .filter(item => intent === 'all' || item.intent === intent)
        .filter(item => priority === 'all' || item.priority === priority)
        .filter(item => reminder === 'all' || item.reminderState === reminder)
        .filter(item => matchesSearch(item.searchText, options.search))
        .sort((left, right) => {
            const reminderComparison = REMINDER_SORT[left.reminderState]
                - REMINDER_SORT[right.reminderState];
            if (reminderComparison !== 0) return reminderComparison;
            if (left.knownDueDate !== right.knownDueDate) {
                return left.knownDueDate ? -1 : 1;
            }
            if (left.current && left.sortTimestamp !== right.sortTimestamp) {
                return left.sortTimestamp - right.sortTimestamp;
            }
            if (left.sortTimestamp !== right.sortTimestamp) {
                return right.sortTimestamp - left.sortTimestamp;
            }
            return left.title.localeCompare(right.title);
        });

    return {
        items,
        totalConfirmed: allItems.length,
        openCount: allItems.filter(item => item.current).length,
        historicalCount: allItems.filter(item => !item.current).length,
        overdueCount: allItems.filter(item =>
            item.reminderState === 'overdue').length,
        dueSoonCount: allItems.filter(item =>
            item.reminderState === 'due-today'
            || item.reminderState === 'upcoming').length,
        noDateOpenCount: allItems.filter(item =>
            item.reminderState === 'no-date').length,
        candidateCount: selectCandidateResources(record).filter(resource =>
            resource.resourceType === 'ClinicalTask').length,
        statusOptions: unique(allItems.map(item => item.status)),
        intentOptions: unique(allItems.map(item => item.intent)),
        priorityOptions: unique(allItems.map(item => item.priority)),
    };
};

const carePlanIsCurrent = (carePlan: CarePlanRecord): boolean => [
    'draft',
    'active',
    'on-hold',
    'unknown',
].includes(carePlan.status);

const carePlanIntentMeaning = (intent: CarePlanRecord['intent']): string => {
    switch (intent) {
        case 'proposal':
            return 'Proposed care plan — not yet an active plan';
        case 'plan':
            return 'Recorded plan — activities may still be pending';
        case 'order':
            return 'Recorded order intent — external execution not confirmed';
        case 'option':
            return 'Care option — not selected or executed by implication';
    }
};

const carePlanItem = (
    record: PatientClinicalRecord,
    carePlan: CarePlanRecord,
): CarePlanModuleItem => {
    const period = dateLikeView(carePlan.period || carePlan.effective, carePlan);
    const addressedConditions = carePlan.addressesConditionIds.map(id =>
        linkedView(record, 'Condition', id));
    const activityTasks = carePlan.activityTaskIds.map(id =>
        linkedView(record, 'ClinicalTask', id));
    const encounter = carePlan.encounterId
        ? linkedView(record, 'Encounter', carePlan.encounterId)
        : undefined;
    const provenance = buildResourceProvenanceView(carePlan);
    const intentMeaning = carePlanIntentMeaning(carePlan.intent);
    const searchText = [
        carePlan.title,
        carePlan.status,
        carePlan.intent,
        intentMeaning,
        carePlan.description,
        period.label,
        ...addressedConditions.map(condition => condition.label),
        ...activityTasks.map(task => task.label),
        encounter?.label,
        carePlan.note,
        provenance.sourceLabel,
        ...provenance.tags,
    ].filter(Boolean).join(' ').toLowerCase();

    return {
        id: carePlan.id,
        title: carePlan.title,
        status: carePlan.status,
        statusLabel: humanizeToken(carePlan.status),
        current: carePlanIsCurrent(carePlan),
        intent: carePlan.intent,
        intentLabel: humanizeToken(carePlan.intent),
        intentMeaning,
        ...(carePlan.description ? { description: carePlan.description } : {}),
        periodLabel: period.label,
        knownClinicalDate: period.known,
        addressedConditions,
        activityTasks,
        ...(encounter ? { encounter } : {}),
        ...(carePlan.note ? { note: carePlan.note } : {}),
        provenance,
        searchText,
        sortTimestamp: period.sortTimestamp,
    };
};

export const buildCarePlansModuleViewModel = (
    record: PatientClinicalRecord,
    options: {
        search?: string;
        scope?: 'current' | 'history' | 'all';
        status?: string;
        intent?: string;
    } = {},
): CarePlansModuleViewModel => {
    const allItems = selectConfirmedResources(record)
        .filter((resource): resource is CarePlanRecord =>
            resource.resourceType === 'CarePlan')
        .map(carePlan => carePlanItem(record, carePlan));
    const scope = options.scope || 'current';
    const status = options.status || 'all';
    const intent = options.intent || 'all';
    const items = allItems
        .filter(item => scope === 'all'
            || (scope === 'current' ? item.current : !item.current))
        .filter(item => status === 'all' || item.status === status)
        .filter(item => intent === 'all' || item.intent === intent)
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
        activeCount: allItems.filter(item => item.status === 'active').length,
        candidateCount: selectCandidateResources(record).filter(resource =>
            resource.resourceType === 'CarePlan').length,
        statusOptions: unique(allItems.map(item => item.status)),
        intentOptions: unique(allItems.map(item => item.intent)),
    };
};
