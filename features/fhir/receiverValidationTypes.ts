import type { IpsValidationResult } from './ipsTypes';
import type { ReceiverExchangeProfile } from './receiverProfiles';
import type {
    TerminologyCodeValidationResult,
} from '../terminology/adapters';

export type ReceiverValidationState =
    | 'ready'
    | 'ready-with-warnings'
    | 'indeterminate'
    | 'not-ready';

export type ReceiverValidationSeverity =
    | 'error'
    | 'warning'
    | 'information';

export type ReceiverValidationCategory =
    | 'structure'
    | 'receiver-contract'
    | 'format'
    | 'profile'
    | 'resource-support'
    | 'size-limit'
    | 'terminology'
    | 'capability-uncertainty';

export interface ReceiverValidationIssue {
    severity: ReceiverValidationSeverity;
    category: ReceiverValidationCategory;
    code: string;
    path: string;
    message: string;
}

export interface ReceiverValidationSummary {
    bundleEntries: number;
    bundleBytes: number;
    resourceTypes: Record<string, number>;
    terminologyChecks: number;
    terminologyValid: number;
    terminologyInvalid: number;
    terminologyIndeterminate: number;
}

export interface ReceiverValidationReport {
    schemaVersion: '1';
    generatedAt: string;
    state: ReceiverValidationState;
    receiver: ReceiverExchangeProfile;
    ipsValidation: IpsValidationResult;
    issues: ReceiverValidationIssue[];
    terminologyResults: TerminologyCodeValidationResult[];
    summary: ReceiverValidationSummary;
    readyForManualTransfer: boolean;
    transferAuthorized: false;
    receiverAcceptanceEstablished: false;
    clinicalValidationEstablished: false;
    networkActivity: 'none' | 'coded-terminology-only';
    limitations: string[];
}
