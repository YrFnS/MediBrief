export type AlertLevel = 'Critical' | 'Warning' | 'Info';

export type AdvisoryValidationStatus =
    | 'validated'
    | 'unvalidated-legacy';

export type CDSSActionType =
    | 'create-task'
    | 'dismiss'
    | 'acknowledge'
    | 'order'; // Legacy persisted alerts are interpreted as create-task.

export interface CDSSAction {
    label: string;
    type: CDSSActionType;
    payload?: string;
}

export interface CDSSAlert {
    id: string;
    ruleId: string;
    title: string;
    description: string;
    level: AlertLevel;
    timestamp: number;
    triggers: string[];
    actions: CDSSAction[];
    validationStatus?: AdvisoryValidationStatus;
    sourceCitation?: string;
}

export interface ClinicalRule {
    id: string;
    name: string;
    evaluate: (observations: any[]) => CDSSAlert | null;
}
