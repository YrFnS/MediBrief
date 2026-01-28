
// A simplified subset of FHIR R4 resources for internal use

export interface FHIRQuantity {
    value: number;
    unit: string;
    system?: string;
    code?: string;
}

export interface FHIRReferenceRange {
    low?: FHIRQuantity;
    high?: FHIRQuantity;
    text?: string;
}

export interface FHIRCodeableConcept {
    text: string;
    coding?: {
        system: string;
        code: string;
        display: string;
    }[];
}

export interface FHIRObservation {
    resourceType: 'Observation';
    id: string;
    status: 'final' | 'preliminary';
    code: FHIRCodeableConcept;
    valueQuantity?: FHIRQuantity;
    valueString?: string;
    referenceRange?: FHIRReferenceRange[];
    effectiveDateTime: string; // ISO 8601
    interpretation?: FHIRCodeableConcept[];
}

// Container for clinical data in our Patient Store
export interface ClinicalDataStore {
    observations: FHIRObservation[];
    // Future expansion: medications, conditions, etc.
}
