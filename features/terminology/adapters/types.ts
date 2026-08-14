export type TerminologyValidationStatus =
    | 'valid'
    | 'invalid'
    | 'indeterminate';

export type TerminologyAdapterMode =
    | 'local-reviewed-subset'
    | 'fhir-validate-code'
    | 'rxnorm-properties';

/**
 * This boundary is intentionally coded-data-only. It cannot carry a patient
 * identifier, clinical note, source excerpt, document, or resource object.
 */
export interface TerminologyCodeValidationRequest {
    system: string;
    code: string;
    version?: string;
    display?: string;
    valueSetUrl?: string;
}

export interface TerminologyCodeValidationResult {
    adapterId: string;
    status: TerminologyValidationStatus;
    system: string;
    code: string;
    version?: string;
    requestedDisplay?: string;
    preferredDisplay?: string;
    message: string;
    warnings: string[];
    checkedAt: string;
    externalRequest: boolean;
    requestFingerprint: string;
}

export interface TerminologyValidationAdapter {
    id: string;
    name: string;
    mode: TerminologyAdapterMode;
    externalRequest: boolean;
    supportedSystems: readonly string[] | 'configured';
    privacyBoundary: string;
    attribution?: string;
    validateCode(
        request: TerminologyCodeValidationRequest,
    ): Promise<TerminologyCodeValidationResult>;
}

export interface FhirValidateCodeAdapterOptions {
    id?: string;
    name?: string;
    endpoint: string;
    supportedSystems: string[];
    timeoutMs?: number;
    maxResponseBytes?: number;
    fetchImpl?: typeof fetch;
}

export interface RxNormValidationAdapterOptions {
    id?: string;
    name?: string;
    endpoint?: string;
    timeoutMs?: number;
    maxResponseBytes?: number;
    fetchImpl?: typeof fetch;
}

export interface FhirParametersResource {
    resourceType: 'Parameters';
    parameter: Array<Record<string, unknown>>;
}
