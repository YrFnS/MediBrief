import type {
    ClinicalResourceType,
    DatePrecision,
    SourceDocumentReference,
} from '../clinical-record/types';
import type {
    GroundedAssistantFinalization,
} from '../grounded-assistance/assistantGrounding';
import type { PatientGroundingBundle } from '../grounded-assistance/types';

export type RecordedTrendDirection = 'higher' | 'lower' | 'unchanged';

export type TrendNormalizationBasis =
    | 'original-values'
    | 'normalized-values'
    | 'mixed-original-and-normalized';

export interface DeterministicTrendPoint {
    evidenceId: string;
    observationId: string;
    date: string;
    dateLabel: string;
    value: number;
    unit: string;
    originalValueLabel: string;
    normalizedValueLabel?: string;
    reportNames: string[];
    source?: SourceDocumentReference;
}

export interface DeterministicTrendExplanation {
    schemaVersion: 1;
    seriesKey: string;
    name: string;
    loincCode?: string;
    specimenLabel?: string;
    unit: string;
    groupingBasis: 'loinc' | 'exact-name-and-specimen';
    normalizationBasis: TrendNormalizationBasis;
    pointCount: number;
    firstPoint: DeterministicTrendPoint;
    lastPoint: DeterministicTrendPoint;
    minimumPoint: DeterministicTrendPoint;
    maximumPoint: DeterministicTrendPoint;
    absoluteChange: number;
    direction: RecordedTrendDirection;
    elapsedDays: number;
    points: DeterministicTrendPoint[];
    matchingExclusions: Array<{
        observationId: string;
        reason: string;
        message: string;
    }>;
    unitConflictMessages: string[];
    qualityNotices: string[];
    deterministicStatements: string[];
    limitations: string[];
}

export interface DeterministicTrendViewModel {
    explanations: DeterministicTrendExplanation[];
    seriesCount: number;
    pointCount: number;
    exclusionCount: number;
    unitConflictCount: number;
    candidateCount: number;
}

export interface TrendGroundingRequest {
    explanation: DeterministicTrendExplanation;
    bundle: PatientGroundingBundle;
    prompt: string;
}

export interface TrendModelExplanationResult {
    rawText: string;
    finalization: GroundedAssistantFinalization;
}

export type ExplicitReminderSourceType =
    | 'appointment'
    | 'task'
    | 'care-plan'
    | 'medication'
    | 'validated-advisory';

export type ExplicitReminderState =
    | 'overdue'
    | 'due-today'
    | 'upcoming'
    | 'later'
    | 'completed'
    | 'cancelled'
    | 'unknown-date'
    | 'unscheduled';

export interface ExplicitReminderItem {
    id: string;
    sourceType: ExplicitReminderSourceType;
    resourceType: ClinicalResourceType;
    resourceId: string;
    evidenceId: string;
    title: string;
    description: string;
    sourceStatus: string;
    state: ExplicitReminderState;
    stateLabel: string;
    dateLabel: string;
    datePrecision: DatePrecision;
    exactDate?: string;
    timingMeaning: string;
    actionBoundary: string;
    sourceLabel: string;
    sourceDocument?: SourceDocumentReference;
    relatedResourceIds: string[];
    warnings: string[];
    canCreateFollowUpTask: boolean;
    existingFollowUpTaskId?: string;
    sortTimestamp: number;
    searchText: string;
}

export interface ExplicitReminderViewModel {
    items: ExplicitReminderItem[];
    counts: Record<ExplicitReminderState, number>;
    totalCount: number;
    openCount: number;
    closedCount: number;
    candidateCount: number;
    actionableCount: number;
}

export interface ReminderFollowUpTaskInput {
    patientId: string;
    reminder: ExplicitReminderItem;
    reason: string;
    createdAt?: string;
    createdBy?: string;
}

export interface ReminderFollowUpTaskResult {
    task: import('../clinical-record/types').ClinicalTaskRecord;
    warnings: string[];
}
