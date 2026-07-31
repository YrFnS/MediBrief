export type OpenMedContextPolarity = 'affirmed' | 'negated';
export type OpenMedContextCertainty = 'certain' | 'uncertain';
export type OpenMedContextTemporality = 'recent' | 'historical' | 'hypothetical';
export type OpenMedContextExperiencer = 'patient' | 'family' | 'other';

export interface OpenMedContextAssertion {
    polarity: OpenMedContextPolarity;
    certainty: OpenMedContextCertainty;
    temporality: OpenMedContextTemporality;
    experiencer: OpenMedContextExperiencer;
}

export interface OpenMedContextCue {
    text: string;
    category: 'historical' | 'hypothetical' | 'uncertainty' | 'negation';
    start: number;
    end: number;
    direction: 'forward' | 'backward';
}

export interface OpenMedSectionEvidence {
    label: string;
    canonical?: string;
    header?: string;
    start: number;
    end: number;
    headerStart?: number;
    headerEnd?: number;
    contentStart?: number;
    source?: string;
}

export interface OpenMedExperiencerEvidence {
    source: 'cue' | 'section' | 'default';
    cue?: string;
    start?: number;
    end?: number;
}

export interface OpenMedMedicationSig {
    raw: string;
    windowStart: number;
    windowEnd: number;
    dose?: number;
    unit?: string;
    form?: string;
    route?: string;
    frequencyPerDay?: number;
    frequencyPeriod?: number | string;
    frequencyPeriodUnit?: string;
    asNeeded: boolean;
    condition?: string;
    durationDays?: number | string;
    missing: string[];
}

export interface OpenMedContextResult {
    id: string;
    kind: 'condition' | 'medication';
    text: string;
    start: number;
    end: number;
    assertion: OpenMedContextAssertion;
    cues: OpenMedContextCue[];
    section?: OpenMedSectionEvidence;
    experiencerEvidence: OpenMedExperiencerEvidence;
    medicationSig?: OpenMedMedicationSig;
    engine: string;
    engineVersion?: string;
    bridgeVersion: string;
    language: string;
    evaluatedAt: string;
}

export interface OpenMedContextResponse {
    text: string;
    engine: string;
    engineVersion?: string;
    bridgeVersion: string;
    language: string;
    evaluatedAt: string;
    results: OpenMedContextResult[];
}

export interface OpenMedContextRequestSpan {
    id: string;
    kind: 'condition' | 'medication';
    text: string;
    label: string;
    start: number;
    end: number;
}

export interface OpenMedContextHealth {
    available: boolean;
    endpoint: string;
    status: 'available' | 'unavailable' | 'invalid-response' | 'aborted';
    message: string;
    openMedVersion?: string;
    bridgeVersion?: string;
    features: string[];
}
