import { CLINICAL_RECORD_SCHEMA_VERSION } from './constants';

export type ClinicalRecordSchemaVersion = typeof CLINICAL_RECORD_SCHEMA_VERSION;

export type ClinicalResourceType =
    | 'PatientProfile'
    | 'Encounter'
    | 'Condition'
    | 'AllergyIntolerance'
    | 'Medication'
    | 'Observation'
    | 'DiagnosticReport'
    | 'Specimen'
    | 'Procedure'
    | 'Immunization'
    | 'Appointment'
    | 'ClinicalTask'
    | 'CarePlan'
    | 'DocumentReference'
    | 'ClinicalNote';

export type VerificationStatus =
    | 'candidate'
    | 'confirmed'
    | 'rejected'
    | 'entered-in-error';

export type AssertionPolarity = 'affirmed' | 'negated' | 'unknown';
export type AssertionCertainty = 'certain' | 'uncertain' | 'unknown';
export type AssertionTemporality = 'current' | 'historical' | 'hypothetical' | 'unknown';
export type AssertionExperiencer = 'patient' | 'family' | 'other' | 'unknown';

export type DatePrecision = 'day' | 'month' | 'year' | 'unknown';

/**
 * Represents a known, partial, or explicitly unknown clinical date.
 *
 * `value` is an ISO-like value matching the precision:
 * - day: YYYY-MM-DD
 * - month: YYYY-MM
 * - year: YYYY
 * - unknown: null
 *
 * `sourceText` preserves the original text when a source uses an ambiguous or
 * unsupported representation. Unknown dates must remain null rather than being
 * replaced with the current date.
 */
export interface ClinicalDate {
    value: string | null;
    precision: DatePrecision;
    sourceText?: string;
}

export interface ClinicalPeriod {
    start?: ClinicalDate;
    end?: ClinicalDate;
}

export interface ClinicalIdentifier {
    system?: string;
    value: string;
    type?: string;
    use?: 'usual' | 'official' | 'temporary' | 'secondary' | 'old';
}

export interface ClinicalCoding {
    system?: string;
    version?: string;
    code: string;
    display?: string;
    userSelected?: boolean;
}

export interface ClinicalCodeableConcept {
    text: string;
    coding?: ClinicalCoding[];
}

export interface ClinicalReference {
    resourceType?: ClinicalResourceType;
    id: string;
    display?: string;
}

export interface ClinicalQuantityValue {
    value: number;
    unit?: string;
    system?: string;
    code?: string;
    comparator?: '<' | '<=' | '>=' | '>';
}

/**
 * Preserves source truth while allowing normalized values for searching,
 * trending, and validated rules. Normalization must never overwrite original.
 */
export interface ClinicalQuantity {
    original: ClinicalQuantityValue;
    normalized?: ClinicalQuantityValue;
    normalizationWarning?: string;
}

export type ObservationValue =
    | {
        type: 'quantity';
        quantity: ClinicalQuantity;
    }
    | {
        type: 'string';
        text: string;
    }
    | {
        type: 'boolean';
        value: boolean;
    }
    | {
        type: 'integer';
        value: number;
    }
    | {
        type: 'codeable-concept';
        concept: ClinicalCodeableConcept;
    };

export interface SourceDocumentReference {
    documentId: string;
    fileName?: string;
    pageNumber?: number;
    section?: string;
    startOffset?: number;
    endOffset?: number;
    excerpt?: string;
}

export type RecordSourceKind =
    | 'manual'
    | 'document-extraction'
    | 'import'
    | 'legacy-migration'
    | 'device'
    | 'ai-suggestion';

export interface RecordSource {
    kind: RecordSourceKind;
    document?: SourceDocumentReference;
    externalSystem?: string;
    externalId?: string;
    description?: string;
}

export interface ExtractionMetadata {
    engine: string;
    model?: string;
    engineVersion?: string;
    promptVersion?: string;
    confidence?: number;
    extractedAt: string;
}

export interface ReviewMetadata {
    reviewedAt: string;
    reviewedBy?: string;
    reason?: string;
}

export interface ClinicalProvenance {
    source: RecordSource;
    createdAt: string;
    updatedAt: string;
    createdBy?: string;
    updatedBy?: string;
    extraction?: ExtractionMetadata;
    confirmation?: ReviewMetadata;
    rejection?: ReviewMetadata;
}

export interface ClinicalAssertionContext {
    polarity: AssertionPolarity;
    certainty: AssertionCertainty;
    temporality: AssertionTemporality;
    experiencer: AssertionExperiencer;
}

export interface ClinicalAmendment {
    id: string;
    amendedAt: string;
    amendedBy?: string;
    reason?: string;
    changedFields: string[];
    previousValues?: Record<string, unknown>;
}

export interface BaseClinicalResource {
    id: string;
    patientId: string;
    resourceType: ClinicalResourceType;
    verificationStatus: VerificationStatus;
    recordedAt: string;
    effective?: ClinicalDate | ClinicalPeriod;
    assertion?: ClinicalAssertionContext;
    provenance: ClinicalProvenance;
    amendments: ClinicalAmendment[];
    tags?: string[];
}

export type AdministrativeSex = 'male' | 'female' | 'other' | 'unknown';

export interface PatientContactPoint {
    system: 'phone' | 'email' | 'other';
    value: string;
    use?: 'home' | 'work' | 'mobile' | 'old' | 'temporary';
}

export interface PatientAddress {
    text?: string;
    lines?: string[];
    city?: string;
    district?: string;
    state?: string;
    postalCode?: string;
    country?: string;
}

export interface PatientProfileRecord extends BaseClinicalResource {
    resourceType: 'PatientProfile';
    displayName: string;
    identifiers: ClinicalIdentifier[];
    dateOfBirth?: ClinicalDate;
    administrativeSex?: AdministrativeSex;
    genderIdentity?: string;
    preferredLanguage?: string;
    bloodType?: string;
    contacts: PatientContactPoint[];
    addresses: PatientAddress[];
    deceased?: boolean;
}

export type EncounterStatus =
    | 'planned'
    | 'in-progress'
    | 'finished'
    | 'cancelled'
    | 'unknown';

export type EncounterClass =
    | 'ambulatory'
    | 'inpatient'
    | 'emergency'
    | 'virtual'
    | 'home'
    | 'other';

export interface EncounterParticipant {
    role?: ClinicalCodeableConcept;
    person?: string;
    organization?: string;
}

export interface EncounterRecord extends BaseClinicalResource {
    resourceType: 'Encounter';
    status: EncounterStatus;
    encounterClass: EncounterClass;
    type?: ClinicalCodeableConcept;
    period?: ClinicalPeriod;
    reason?: ClinicalCodeableConcept[];
    participants: EncounterParticipant[];
    location?: string;
    serviceProvider?: string;
}

export type ConditionClinicalStatus =
    | 'active'
    | 'inactive'
    | 'resolved'
    | 'remission'
    | 'unknown';

export interface ConditionRecord extends BaseClinicalResource {
    resourceType: 'Condition';
    code: ClinicalCodeableConcept;
    clinicalStatus: ConditionClinicalStatus;
    severity?: ClinicalCodeableConcept;
    bodySite?: ClinicalCodeableConcept[];
    onset?: ClinicalDate;
    abatement?: ClinicalDate;
    encounterId?: string;
    note?: string;
}

export type AllergyClinicalStatus = 'active' | 'inactive' | 'resolved' | 'unknown';
export type AllergyCriticality = 'low' | 'high' | 'unable-to-assess';
export type AllergyCategory = 'food' | 'medication' | 'environment' | 'biologic' | 'other';
export type ReactionSeverity = 'mild' | 'moderate' | 'severe' | 'unknown';

export interface AllergyReaction {
    manifestation: ClinicalCodeableConcept[];
    description?: string;
    onset?: ClinicalDate;
    severity?: ReactionSeverity;
    exposureRoute?: ClinicalCodeableConcept;
}

export interface AllergyIntoleranceRecord extends BaseClinicalResource {
    resourceType: 'AllergyIntolerance';
    substance: ClinicalCodeableConcept;
    clinicalStatus: AllergyClinicalStatus;
    criticality: AllergyCriticality;
    categories: AllergyCategory[];
    reactions: AllergyReaction[];
    lastOccurrence?: ClinicalDate;
    note?: string;
}

export type MedicationRecordKind = 'statement' | 'request' | 'administration';
export type MedicationStatus =
    | 'active'
    | 'completed'
    | 'stopped'
    | 'on-hold'
    | 'not-taken'
    | 'entered-in-error'
    | 'unknown';

export interface MedicationDosage {
    text: string;
    dose?: ClinicalQuantity;
    route?: ClinicalCodeableConcept;
    frequency?: string;
    timingText?: string;
    asNeeded?: boolean;
    maximumDosePerPeriod?: {
        dose: ClinicalQuantity;
        period: string;
    };
}

export interface MedicationRecord extends BaseClinicalResource {
    resourceType: 'Medication';
    kind: MedicationRecordKind;
    medication: ClinicalCodeableConcept;
    status: MedicationStatus;
    dosageInstructions: MedicationDosage[];
    reason?: ClinicalCodeableConcept[];
    start?: ClinicalDate;
    end?: ClinicalDate;
    prescriber?: string;
    encounterId?: string;
    note?: string;
}

export type ObservationStatus =
    | 'registered'
    | 'preliminary'
    | 'final'
    | 'amended'
    | 'corrected'
    | 'cancelled'
    | 'entered-in-error'
    | 'unknown';

export interface ObservationReferenceRange {
    low?: ClinicalQuantityValue;
    high?: ClinicalQuantityValue;
    text?: string;
    appliesTo?: ClinicalCodeableConcept[];
}

export interface ObservationRecord extends BaseClinicalResource {
    resourceType: 'Observation';
    status: ObservationStatus;
    category?: ClinicalCodeableConcept[];
    code: ClinicalCodeableConcept;
    value?: ObservationValue;
    interpretation?: ClinicalCodeableConcept[];
    referenceRanges: ObservationReferenceRange[];
    specimenId?: string;
    encounterId?: string;
    diagnosticReportId?: string;
    issuedAt?: string;
    performer?: string[];
    note?: string;
}

export type DiagnosticReportStatus =
    | 'registered'
    | 'partial'
    | 'preliminary'
    | 'final'
    | 'amended'
    | 'corrected'
    | 'cancelled'
    | 'entered-in-error'
    | 'unknown';

export interface DiagnosticReportRecord extends BaseClinicalResource {
    resourceType: 'DiagnosticReport';
    status: DiagnosticReportStatus;
    code: ClinicalCodeableConcept;
    category?: ClinicalCodeableConcept[];
    effectivePeriod?: ClinicalPeriod;
    issuedAt?: string;
    resultIds: string[];
    specimenIds: string[];
    documentIds: string[];
    conclusion?: string;
    conclusionCodes?: ClinicalCodeableConcept[];
    encounterId?: string;
    performer?: string[];
}

export type SpecimenStatus = 'available' | 'unavailable' | 'unsatisfactory' | 'entered-in-error' | 'unknown';

export interface SpecimenRecord extends BaseClinicalResource {
    resourceType: 'Specimen';
    status: SpecimenStatus;
    type?: ClinicalCodeableConcept;
    collectedAt?: ClinicalDate;
    receivedAt?: ClinicalDate;
    bodySite?: ClinicalCodeableConcept;
    collectionMethod?: ClinicalCodeableConcept;
    note?: string;
}

export type ProcedureStatus =
    | 'preparation'
    | 'in-progress'
    | 'not-done'
    | 'on-hold'
    | 'stopped'
    | 'completed'
    | 'entered-in-error'
    | 'unknown';

export interface ProcedureRecord extends BaseClinicalResource {
    resourceType: 'Procedure';
    status: ProcedureStatus;
    code: ClinicalCodeableConcept;
    performed?: ClinicalDate | ClinicalPeriod;
    bodySite?: ClinicalCodeableConcept[];
    reason?: ClinicalCodeableConcept[];
    outcome?: ClinicalCodeableConcept;
    complications?: ClinicalCodeableConcept[];
    performer?: string[];
    encounterId?: string;
    reportIds?: string[];
    note?: string;
}

export type ImmunizationStatus = 'completed' | 'entered-in-error' | 'not-done' | 'unknown';

export interface ImmunizationRecord extends BaseClinicalResource {
    resourceType: 'Immunization';
    status: ImmunizationStatus;
    vaccineCode: ClinicalCodeableConcept;
    occurrence?: ClinicalDate;
    lotNumber?: string;
    manufacturer?: string;
    doseQuantity?: ClinicalQuantity;
    site?: ClinicalCodeableConcept;
    route?: ClinicalCodeableConcept;
    reason?: ClinicalCodeableConcept[];
    performer?: string;
    note?: string;
}

export type AppointmentStatus =
    | 'proposed'
    | 'pending'
    | 'booked'
    | 'arrived'
    | 'fulfilled'
    | 'cancelled'
    | 'no-show'
    | 'entered-in-error'
    | 'unknown';

export interface AppointmentParticipant {
    name: string;
    role?: ClinicalCodeableConcept;
    status?: 'accepted' | 'declined' | 'tentative' | 'needs-action';
}

export interface AppointmentRecord extends BaseClinicalResource {
    resourceType: 'Appointment';
    status: AppointmentStatus;
    title?: string;
    description?: string;
    start?: string;
    end?: string;
    requestedPeriod?: ClinicalPeriod[];
    reason?: ClinicalCodeableConcept[];
    participants: AppointmentParticipant[];
    location?: string;
    encounterId?: string;
    note?: string;
}

export type ClinicalTaskStatus =
    | 'draft'
    | 'requested'
    | 'received'
    | 'accepted'
    | 'in-progress'
    | 'completed'
    | 'cancelled'
    | 'failed'
    | 'entered-in-error';

export type ClinicalTaskIntent = 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order' | 'filler-order';
export type ClinicalTaskPriority = 'routine' | 'urgent' | 'asap' | 'stat';

export interface ClinicalTaskRecord extends BaseClinicalResource {
    resourceType: 'ClinicalTask';
    status: ClinicalTaskStatus;
    intent: ClinicalTaskIntent;
    priority: ClinicalTaskPriority;
    code?: ClinicalCodeableConcept;
    title: string;
    description?: string;
    due?: ClinicalDate | ClinicalPeriod;
    owner?: string;
    relatedResources: ClinicalReference[];
    completedAt?: string;
    note?: string;
}

export type CarePlanStatus = 'draft' | 'active' | 'on-hold' | 'revoked' | 'completed' | 'entered-in-error' | 'unknown';
export type CarePlanIntent = 'proposal' | 'plan' | 'order' | 'option';

export interface CarePlanRecord extends BaseClinicalResource {
    resourceType: 'CarePlan';
    status: CarePlanStatus;
    intent: CarePlanIntent;
    title: string;
    description?: string;
    period?: ClinicalPeriod;
    addressesConditionIds: string[];
    activityTaskIds: string[];
    encounterId?: string;
    note?: string;
}

export type DocumentReferenceStatus = 'current' | 'superseded' | 'entered-in-error';

export interface DocumentReferenceRecord extends BaseClinicalResource {
    resourceType: 'DocumentReference';
    status: DocumentReferenceStatus;
    storageId: string;
    fileName: string;
    mimeType: string;
    title?: string;
    documentType?: ClinicalCodeableConcept;
    authoredOn?: ClinicalDate;
    uploadedAt: string;
    pageCount?: number;
    hash?: string;
    description?: string;
    relatedResources: ClinicalReference[];
}

export type ClinicalNoteStatus = 'draft' | 'final' | 'amended' | 'entered-in-error';
export type ClinicalNoteType =
    | 'soap'
    | 'visit-note'
    | 'discharge-summary'
    | 'progress-note'
    | 'patient-note'
    | 'other';

export interface ClinicalNoteSection {
    title: string;
    code?: ClinicalCodeableConcept;
    text: string;
}

export interface ClinicalNoteRecord extends BaseClinicalResource {
    resourceType: 'ClinicalNote';
    status: ClinicalNoteStatus;
    noteType: ClinicalNoteType;
    title: string;
    authoredAt: string;
    author?: string;
    encounterId?: string;
    sections: ClinicalNoteSection[];
    sourceDocumentIds: string[];
    transcriptDocumentId?: string;
    amendsNoteId?: string;
}

export type ClinicalRecordResource =
    | PatientProfileRecord
    | EncounterRecord
    | ConditionRecord
    | AllergyIntoleranceRecord
    | MedicationRecord
    | ObservationRecord
    | DiagnosticReportRecord
    | SpecimenRecord
    | ProcedureRecord
    | ImmunizationRecord
    | AppointmentRecord
    | ClinicalTaskRecord
    | CarePlanRecord
    | DocumentReferenceRecord
    | ClinicalNoteRecord;

export interface PatientClinicalResources {
    encounters: EncounterRecord[];
    conditions: ConditionRecord[];
    allergies: AllergyIntoleranceRecord[];
    medications: MedicationRecord[];
    observations: ObservationRecord[];
    diagnosticReports: DiagnosticReportRecord[];
    specimens: SpecimenRecord[];
    procedures: ProcedureRecord[];
    immunizations: ImmunizationRecord[];
    appointments: AppointmentRecord[];
    tasks: ClinicalTaskRecord[];
    carePlans: CarePlanRecord[];
    documents: DocumentReferenceRecord[];
    notes: ClinicalNoteRecord[];
}

export interface PatientClinicalRecord {
    schemaVersion: ClinicalRecordSchemaVersion;
    patientId: string;
    profile: PatientProfileRecord;
    resources: PatientClinicalResources;
    createdAt: string;
    updatedAt: string;
}

export interface ClinicalRecordExport {
    format: 'medibrief-clinical-record';
    exportVersion: 1;
    exportedAt: string;
    records: Record<string, PatientClinicalRecord>;
}
