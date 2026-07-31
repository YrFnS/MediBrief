export type OpenMedOcrMode = 'auto' | 'always' | 'never';
export type OpenMedOcrEngine =
    | 'auto'
    | 'doctr'
    | 'tesseract'
    | 'easyocr'
    | 'paddleocr';

export type OpenMedDocumentMethod =
    | 'local-text'
    | 'embedded-pdf'
    | 'ocr'
    | 'hybrid'
    | 'none';

export type OpenMedDocumentBridgeStatus =
    | 'completed'
    | 'partial'
    | 'empty'
    | 'unsupported';

export interface OpenMedDocumentPage {
    pageNumber: number;
    start: number;
    end: number;
    method: OpenMedDocumentMethod;
    wordCount: number;
    characterCount: number;
    engine?: string;
    averageConfidence?: number;
    minimumConfidence?: number;
}

export interface OpenMedDocumentSourceSpan {
    start: number;
    end: number;
    pageNumber: number;
    method: OpenMedDocumentMethod;
    bbox?: [number, number, number, number];
    confidence?: number;
}

export interface OpenMedDocumentExtractionResponse {
    status: OpenMedDocumentBridgeStatus;
    documentId: string;
    fileName: string;
    mimeType: string;
    sourceSha256: string;
    text: string;
    textSha256: string;
    method: OpenMedDocumentMethod;
    pageCount: number;
    pages: OpenMedDocumentPage[];
    sourceSpans: OpenMedDocumentSourceSpan[];
    warnings: string[];
    failedPages: number[];
    engine: string;
    bridgeVersion: string;
    extractedAt: string;
    ocrEngine: OpenMedOcrEngine;
    languages: string[];
}

export interface OpenMedDocumentHealth {
    available: boolean;
    endpoint: string;
    status: 'available' | 'unavailable' | 'invalid-response' | 'aborted';
    message: string;
    service?: string;
    engine?: string;
    bridgeVersion?: string;
    features: string[];
    availableOcrEngines: string[];
    ocrAvailable: boolean;
}

export interface OpenMedDocumentExtractOptions {
    documentId: string;
    fileName: string;
    mimeType: string;
    base64: string;
    ocrMode: OpenMedOcrMode;
    ocrEngine: OpenMedOcrEngine;
    languages: string[];
    resolution: number;
    signal?: AbortSignal;
}

export interface OpenMedDocumentEntityEvidence {
    documentId: string;
    fileName: string;
    mimeType: string;
    sourceSha256: string;
    textSha256: string;
    method: OpenMedDocumentMethod;
    pageNumber?: number;
    pageNumbers: number[];
    bbox?: [number, number, number, number];
    averageOcrConfidence?: number;
    ocrEngine: OpenMedOcrEngine;
    languages: string[];
    engine: string;
    bridgeVersion: string;
    extractedAt: string;
}

export type DocumentExtractionRunStatus =
    | 'queued'
    | 'running'
    | 'completed'
    | 'partial'
    | 'empty'
    | 'unsupported'
    | 'failed'
    | 'cancelled';

export interface DocumentExtractionRunRecord {
    key: string;
    patientId: string;
    documentId: string;
    storageId?: string;
    fileName: string;
    mimeType: string;
    status: DocumentExtractionRunStatus;
    attempts: number;
    startedAt?: string;
    completedAt?: string;
    updatedAt: string;
    method?: OpenMedDocumentMethod;
    pageCount?: number;
    pagesWithText?: number;
    characterCount?: number;
    sourceSha256?: string;
    textSha256?: string;
    ocrEngine?: OpenMedOcrEngine;
    languages?: string[];
    warnings: string[];
    failedPages: number[];
    createdCandidates: number;
    duplicateCandidates: number;
    fallbackUsed: boolean;
    message?: string;
}
