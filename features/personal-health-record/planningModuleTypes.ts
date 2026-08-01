import type {
    HealthDataModule,
    LinkedRecordView,
    ResourceProvenanceView,
} from './coreModuleTypes';

export type PlanningHealthDataModule =
    | 'appointments'
    | 'tasks'
    | 'care-plans'
    | 'medication-reconciliation'
    | 'manage';

export type PersonalHealthDataModule =
    | HealthDataModule
    | PlanningHealthDataModule;

export type AppointmentTimingFilter =
    | 'all'
    | 'upcoming'
    | 'past'
    | 'unknown';

export interface AppointmentParticipantView {
    name: string;
    role?: string;
    status?: string;
    statusLabel?: string;
}

export interface AppointmentModuleItem {
    id: string;
    title: string;
    status: string;
    statusLabel: string;
    current: boolean;
    bookingMeaning: string;
    timing: Exclude<AppointmentTimingFilter, 'all'>;
    timingLabel: string;
    startLabel: string;
    endLabel: string;
    requestedPeriodLabels: string[];
    knownClinicalDate: boolean;
    reasons: string[];
    participants: AppointmentParticipantView[];
    location?: string;
    encounter?: LinkedRecordView;
    note?: string;
    provenance: ResourceProvenanceView;
    searchText: string;
    sortTimestamp: number;
}

export interface AppointmentsModuleViewModel {
    items: AppointmentModuleItem[];
    totalConfirmed: number;
    currentCount: number;
    historicalCount: number;
    proposedCount: number;
    bookedCount: number;
    unknownDateCount: number;
    candidateCount: number;
    statusOptions: string[];
}

export type TaskReminderFilter =
    | 'all'
    | 'overdue'
    | 'due-today'
    | 'upcoming'
    | 'later'
    | 'no-date'
    | 'closed';

export interface ClinicalTaskModuleItem {
    id: string;
    title: string;
    status: string;
    statusLabel: string;
    current: boolean;
    intent: string;
    intentLabel: string;
    intentMeaning: string;
    priority: string;
    priorityLabel: string;
    code?: string;
    description?: string;
    dueLabel: string;
    knownDueDate: boolean;
    reminderState: Exclude<TaskReminderFilter, 'all'>;
    reminderLabel: string;
    owner?: string;
    relatedResources: LinkedRecordView[];
    completedAtLabel?: string;
    note?: string;
    provenance: ResourceProvenanceView;
    searchText: string;
    sortTimestamp: number;
}

export interface ClinicalTasksModuleViewModel {
    items: ClinicalTaskModuleItem[];
    totalConfirmed: number;
    openCount: number;
    historicalCount: number;
    overdueCount: number;
    dueSoonCount: number;
    noDateOpenCount: number;
    candidateCount: number;
    statusOptions: string[];
    intentOptions: string[];
    priorityOptions: string[];
}

export interface CarePlanModuleItem {
    id: string;
    title: string;
    status: string;
    statusLabel: string;
    current: boolean;
    intent: string;
    intentLabel: string;
    intentMeaning: string;
    description?: string;
    periodLabel: string;
    knownClinicalDate: boolean;
    addressedConditions: LinkedRecordView[];
    activityTasks: LinkedRecordView[];
    encounter?: LinkedRecordView;
    note?: string;
    provenance: ResourceProvenanceView;
    searchText: string;
    sortTimestamp: number;
}

export interface CarePlansModuleViewModel {
    items: CarePlanModuleItem[];
    totalConfirmed: number;
    currentCount: number;
    historicalCount: number;
    activeCount: number;
    candidateCount: number;
    statusOptions: string[];
    intentOptions: string[];
}
