
// FHIR R4 STRICT IMPLEMENTATION (Subset for Observation)
// https://www.hl7.org/fhir/observation.html

export type FHIRResourceType = 'Observation' | 'Patient' | 'Bundle';
export type ObservationStatus = 'registered' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled' | 'entered-in-error' | 'unknown';

export interface FHIRCoding {
    system?: string; // e.g., "http://loinc.org" or "http://unitsofmeasure.org"
    version?: string;
    code?: string;
    display?: string;
    userSelected?: boolean;
}

export interface FHIRCodeableConcept {
    coding?: FHIRCoding[];
    text?: string; // Plain text representation
}

export interface FHIRQuantity {
    value?: number;
    comparator?: '<' | '<=' | '>=' | '>';
    unit?: string;
    system?: string;
    code?: string;
}

export interface FHIRReferenceRange {
    low?: FHIRQuantity;
    high?: FHIRQuantity;
    type?: FHIRCodeableConcept;
    appliesTo?: FHIRCodeableConcept[];
    text?: string;
}

export interface FHIRReference {
    reference: string; // e.g. "Patient/123"
    type?: string;
    display?: string;
}

// Official FHIR R4 Observation Resource Structure
export interface FHIRObservation {
    resourceType: 'Observation';
    id: string;
    status: ObservationStatus;
    category?: FHIRCodeableConcept[];
    code: FHIRCodeableConcept; // Concept - reference to a terminology or just text
    subject?: FHIRReference; // The patient this observation is about
    effectiveDateTime?: string; // ISO8601
    issued?: string; // Instant
    performer?: FHIRReference[];
    
    // Actual result (FHIR uses value[x] choice, we model common ones)
    valueQuantity?: FHIRQuantity;
    valueString?: string;
    valueBoolean?: boolean;
    valueInteger?: number;
    valueCodeableConcept?: FHIRCodeableConcept;
    
    interpretation?: FHIRCodeableConcept[]; // High, Low, Normal, etc.
    referenceRange?: FHIRReferenceRange[];
    note?: { text: string }[];
}

export interface ClinicalDataStore {
    observations: FHIRObservation[];
    // Expandable to include conditions, medications, etc.
}
