import type {
    ClinicalResourceType,
    SourceDocumentReference,
} from '../clinical-record/types';

export type PersonalRecordView =
    | 'overview'
    | 'health-data'
    | 'timeline'
    | 'search'
    | 'emergency'
    | 'assistant';

export type PersonalRecordContentView = Exclude<
    PersonalRecordView,
    'assistant'
>;

export type TimelineResourceType = Exclude<
    ClinicalResourceType,
    'PatientProfile'
>;

export type TimelineResourceFilter = 'all' | TimelineResourceType;

export interface TimelineDisplayItem {
    resourceId: string;
    resourceType: TimelineResourceType;
    resourceTypeLabel: string;
    label: string;
    detail?: string;
    status?: string;
    dateLabel: string;
    dateGroupKey: string;
    dateGroupLabel: string;
    knownClinicalDate: boolean;
    sortTimestamp: number;
    recordedLabel: string;
    sourceLabel: string;
    sourceDocument?: SourceDocumentReference;
    tags: string[];
}

export interface TimelineViewModel {
    dated: TimelineDisplayItem[];
    undated: TimelineDisplayItem[];
    total: number;
}

export interface RecordMetric {
    key: string;
    label: string;
    value: number;
    helper: string;
}

export interface FollowUpItem {
    id: string;
    kind: 'appointment' | 'task';
    title: string;
    status: string;
    detail?: string;
    dateLabel: string;
    knownDate: boolean;
}

export interface PatientOverviewViewModel {
    patientName: string;
    primaryIdentifier?: string;
    dateOfBirthLabel: string;
    ageLabel?: string;
    administrativeSexLabel: string;
    bloodTypeLabel: string;
    preferredLanguageLabel: string;
    contactLabel: string;
    activeConditions: Array<{
        id: string;
        name: string;
        status: string;
        detail?: string;
    }>;
    activeAllergies: Array<{
        id: string;
        name: string;
        criticality: string;
        reactions: string[];
    }>;
    activeMedications: Array<{
        id: string;
        name: string;
        status: string;
        dosage?: string;
    }>;
    metrics: RecordMetric[];
    pendingCandidates: number;
    pendingFollowUp: FollowUpItem[];
    recentTimeline: TimelineDisplayItem[];
    dataGaps: string[];
    updatedLabel: string;
}

export interface EmergencyVital {
    key: string;
    label: string;
    value: string;
    observedAt: string;
    stale: boolean;
}

export interface EmergencySummaryViewModel {
    patientName: string;
    identifiers: Array<{
        label: string;
        value: string;
    }>;
    dateOfBirthLabel: string;
    ageLabel?: string;
    administrativeSexLabel: string;
    bloodTypeLabel: string;
    preferredLanguageLabel: string;
    contacts: string[];
    codeStatus: string | null;
    allergies: Array<{
        id: string;
        name: string;
        criticality: string;
        reactions: string[];
    }>;
    medications: Array<{
        id: string;
        name: string;
        dosage?: string;
        status: string;
    }>;
    conditions: Array<{
        id: string;
        name: string;
        status: string;
        severity?: string;
    }>;
    vitals: EmergencyVital[];
    limitations: string[];
    generatedLabel: string;
    recordUpdatedLabel: string;
}
