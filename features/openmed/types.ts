export type ClinicalExtractionMode = 'auto' | 'openmed' | 'gemini';

export interface OpenMedClientConfig {
    baseUrl: string;
    timeoutMs: number;
    apiKey?: string;
    bearerToken?: string;
}

export interface OpenMedEntity {
    text: string;
    label: string;
    confidence: number;
    start: number;
    end: number;
}

export interface OpenMedAnalysisResponse {
    text: string;
    entities: OpenMedEntity[];
    modelName: string;
    engineVersion?: string;
    rejectedEntityCount: number;
}

export interface OpenMedHealthResponse {
    status: string;
    service?: string;
    version?: string;
    profile?: string;
}

export interface OpenMedServiceHealth {
    available: boolean;
    endpoint: string;
    status: 'available' | 'unavailable' | 'invalid-response' | 'aborted';
    message: string;
    service?: string;
    version?: string;
    profile?: string;
}

export interface OpenMedAnalyzeOptions {
    text: string;
    modelName: string;
    confidenceThreshold: number;
    groupEntities?: boolean;
    aggregationStrategy?: string;
    keepAlive?: string;
    signal?: AbortSignal;
}

export type OpenMedCandidateKind = 'condition' | 'medication';

export interface OpenMedCandidateEntity extends OpenMedEntity {
    kind: OpenMedCandidateKind;
    modelName: string;
    engineVersion?: string;
}

export type LocalTextExtractionStatus =
    | 'ready'
    | 'unsupported'
    | 'empty'
    | 'too-large'
    | 'invalid';

export interface LocalTextExtractionResult {
    status: LocalTextExtractionStatus;
    fileName: string;
    mimeType: string;
    text?: string;
    message: string;
}

export type OpenMedExtractionStatus =
    | 'success'
    | 'partial'
    | 'empty'
    | 'unsupported'
    | 'too-large'
    | 'invalid'
    | 'unavailable'
    | 'aborted';

export interface OpenMedExtractionResult {
    status: OpenMedExtractionStatus;
    entities: OpenMedCandidateEntity[];
    warnings: string[];
    text?: string;
    serviceVersion?: string;
}

export interface OpenMedExtractionSettings {
    baseUrl: string;
    timeoutMs: number;
    confidenceThreshold: number;
    diseaseModel: string;
    medicationModel: string;
    keepAlive?: string;
}

export interface OpenMedErrorEnvelope {
    code?: string;
    message: string;
    details?: unknown;
    requestId?: string;
    status?: number;
}
