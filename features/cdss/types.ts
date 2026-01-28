
export type AlertLevel = 'Critical' | 'Warning' | 'Info';

export interface CDSSAction {
    label: string;
    type: 'order' | 'dismiss' | 'acknowledge';
    payload?: string;
}

export interface CDSSAlert {
    id: string;
    ruleId: string;
    title: string;
    description: string;
    level: AlertLevel;
    timestamp: number;
    triggers: string[]; // e.g. ["HR: 110", "Temp: 38.5"]
    actions: CDSSAction[];
}

export interface ClinicalRule {
    id: string;
    name: string;
    evaluate: (observations: any[]) => CDSSAlert | null;
}
