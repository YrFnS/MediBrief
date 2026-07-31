import { z } from 'zod';
import {
    CLINICAL_RECORD_EXPORT_FORMAT,
    CLINICAL_RECORD_EXPORT_VERSION,
    CLINICAL_RECORD_SCHEMA_VERSION,
} from './constants';
import type {
    ClinicalRecordExport,
    ClinicalRecordResource,
    PatientClinicalRecord,
} from './types';

export const ClinicalResourceTypeSchema = z.enum([
    'PatientProfile',
    'Encounter',
    'Condition',
    'AllergyIntolerance',
    'Medication',
    'Observation',
    'DiagnosticReport',
    'Specimen',
    'Procedure',
    'Immunization',
    'Appointment',
    'ClinicalTask',
    'CarePlan',
    'DocumentReference',
    'ClinicalNote',
]);

export const VerificationStatusSchema = z.enum([
    'candidate',
    'confirmed',
    'rejected',
    'entered-in-error',
]);

export const ClinicalAssertionContextSchema = z.object({
    polarity: z.enum(['affirmed', 'negated', 'unknown']),
    certainty: z.enum(['certain', 'uncertain', 'unknown']),
    temporality: z.enum(['current', 'historical', 'hypothetical', 'unknown']),
    experiencer: z.enum(['patient', 'family', 'other', 'unknown']),
}).strict();

export const IsoDateTimeSchema = z.string().min(1).refine(
    value => !Number.isNaN(Date.parse(value)),
    'Expected a valid date-time string',
);

export const ClinicalDateSchema = z.object({
    value: z.string().nullable(),
    precision: z.enum(['day', 'month', 'year', 'unknown']),
    sourceText: z.string().min(1).optional(),
}).strict().superRefine((date, ctx) => {
    if (date.precision === 'unknown') {
        if (date.value !== null) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['value'],
                message: 'Unknown clinical dates must use a null value',
            });
        }
        return;
    }

    if (date.value === null) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['value'],
            message: `A ${date.precision}-precision clinical date requires a value`,
        });
        return;
    }

    const patterns: Record<'day' | 'month' | 'year', RegExp> = {
        day: /^\d{4}-\d{2}-\d{2}$/,
        month: /^\d{4}-\d{2}$/,
        year: /^\d{4}$/,
    };

    if (!patterns[date.precision].test(date.value)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['value'],
            message: `Clinical date does not match ${date.precision} precision`,
        });
    }
});

export const ClinicalPeriodSchema = z.object({
    start: ClinicalDateSchema.optional(),
    end: ClinicalDateSchema.optional(),
}).strict();

export const ClinicalIdentifierSchema = z.object({
    system: z.string().min(1).optional(),
    value: z.string().min(1),
    type: z.string().min(1).optional(),
    use: z.enum(['usual', 'official', 'temporary', 'secondary', 'old']).optional(),
}).strict();

export const ClinicalCodingSchema = z.object({
    system: z.string().min(1).optional(),
    version: z.string().min(1).optional(),
    code: z.string().min(1),
    display: z.string().min(1).optional(),
    userSelected: z.boolean().optional(),
}).strict();

export const ClinicalCodeableConceptSchema = z.object({
    text: z.string().min(1),
    coding: z.array(ClinicalCodingSchema).optional(),
}).strict();

export const ClinicalReferenceSchema = z.object({
    resourceType: ClinicalResourceTypeSchema.optional(),
    id: z.string().min(1),
    display: z.string().min(1).optional(),
}).strict();

export const DiagnosticVersionRelationshipTypeSchema = z.enum([
    'amends',
    'corrects',
    'replaces',
]);

export const DiagnosticReportRelationshipSchema = z.object({
    id: z.string().min(1),
    type: z.union([
        DiagnosticVersionRelationshipTypeSchema,
        z.enum(['duplicate-of', 'distinct-from']),
    ]),
    relatedReportId: z.string().min(1),
    recordedAt: IsoDateTimeSchema,
    recordedBy: z.string().min(1).optional(),
    reason: z.string().min(1),
}).strict();

export const ObservationLineageSchema = z.object({
    relationship: DiagnosticVersionRelationshipTypeSchema,
    predecessorObservationId: z.string().min(1),
    recordedAt: IsoDateTimeSchema,
    recordedBy: z.string().min(1).optional(),
    reason: z.string().min(1),
}).strict();

export const ClinicalQuantityValueSchema = z.object({
    value: z.number().finite(),
    unit: z.string().optional(),
    system: z.string().optional(),
    code: z.string().optional(),
    comparator: z.enum(['<', '<=', '>=', '>']).optional(),
}).strict();

export const ClinicalQuantitySchema = z.object({
    original: ClinicalQuantityValueSchema,
    normalized: ClinicalQuantityValueSchema.optional(),
    normalizationWarning: z.string().min(1).optional(),
}).strict();

export const ObservationValueSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('quantity'),
        quantity: ClinicalQuantitySchema,
    }).strict(),
    z.object({
        type: z.literal('string'),
        text: z.string(),
    }).strict(),
    z.object({
        type: z.literal('boolean'),
        value: z.boolean(),
    }).strict(),
    z.object({
        type: z.literal('integer'),
        value: z.number().int(),
    }).strict(),
    z.object({
        type: z.literal('codeable-concept'),
        concept: ClinicalCodeableConceptSchema,
    }).strict(),
]);

export const SourceDocumentReferenceSchema = z.object({
    documentId: z.string().min(1),
    fileName: z.string().min(1).optional(),
    pageNumber: z.number().int().positive().optional(),
    section: z.string().min(1).optional(),
    startOffset: z.number().int().nonnegative().optional(),
    endOffset: z.number().int().nonnegative().optional(),
    excerpt: z.string().min(1).optional(),
}).strict().superRefine((source, ctx) => {
    if (
        source.startOffset !== undefined
        && source.endOffset !== undefined
        && source.endOffset < source.startOffset
    ) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['endOffset'],
            message: 'endOffset must be greater than or equal to startOffset',
        });
    }
});

export const RecordSourceSchema = z.object({
    kind: z.enum([
        'manual',
        'document-extraction',
        'import',
        'legacy-migration',
        'device',
        'ai-suggestion',
    ]),
    document: SourceDocumentReferenceSchema.optional(),
    externalSystem: z.string().min(1).optional(),
    externalId: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
}).strict().superRefine((source, ctx) => {
    if (source.kind === 'document-extraction' && !source.document) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['document'],
            message: 'Document extraction sources must reference their source document',
        });
    }
});

export const ExtractionMetadataSchema = z.object({
    engine: z.string().min(1),
    model: z.string().min(1).optional(),
    engineVersion: z.string().min(1).optional(),
    promptVersion: z.string().min(1).optional(),
    confidence: z.number().min(0).max(1).optional(),
    extractedAt: IsoDateTimeSchema,
}).strict();

export const ReviewMetadataSchema = z.object({
    reviewedAt: IsoDateTimeSchema,
    reviewedBy: z.string().min(1).optional(),
    reason: z.string().min(1).optional(),
}).strict();

export const ClinicalProvenanceSchema = z.object({
    source: RecordSourceSchema,
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    createdBy: z.string().min(1).optional(),
    updatedBy: z.string().min(1).optional(),
    extraction: ExtractionMetadataSchema.optional(),
    confirmation: ReviewMetadataSchema.optional(),
    rejection: ReviewMetadataSchema.optional(),
}).strict();

export const ClinicalAmendmentSchema = z.object({
    id: z.string().min(1),
    amendedAt: IsoDateTimeSchema,
    amendedBy: z.string().min(1).optional(),
    reason: z.string().min(1).optional(),
    changedFields: z.array(z.string().min(1)).min(1),
    previousValues: z.record(z.string(), z.unknown()).optional(),
}).strict();

const BaseClinicalResourceShape = {
    id: z.string().min(1),
    patientId: z.string().min(1),
    verificationStatus: VerificationStatusSchema,
    recordedAt: IsoDateTimeSchema,
    effective: z.union([ClinicalDateSchema, ClinicalPeriodSchema]).optional(),
    assertion: ClinicalAssertionContextSchema.optional(),
    provenance: ClinicalProvenanceSchema,
    amendments: z.array(ClinicalAmendmentSchema),
    tags: z.array(z.string().min(1)).optional(),
};

export const PatientContactPointSchema = z.object({
    system: z.enum(['phone', 'email', 'other']),
    value: z.string().min(1),
    use: z.enum(['home', 'work', 'mobile', 'old', 'temporary']).optional(),
}).strict();

export const PatientAddressSchema = z.object({
    text: z.string().min(1).optional(),
    lines: z.array(z.string().min(1)).optional(),
    city: z.string().min(1).optional(),
    district: z.string().min(1).optional(),
    state: z.string().min(1).optional(),
    postalCode: z.string().min(1).optional(),
    country: z.string().min(1).optional(),
}).strict();

export const PatientProfileRecordSchema = z.object({
    ...BaseClinicalResourceShape,
    resourceType: z.literal('PatientProfile'),
    displayName: z.string().min(1),
    identifiers: z.array(ClinicalIdentifierSchema),
    dateOfBirth: ClinicalDateSchema.optional(),
    administrativeSex: z.enum(['male', 'female', 'other', 'unknown']).optional(),
    genderIdentity: z.string().min(1).optional(),
    preferredLanguage: z.string().min(1).optional(),
    bloodType: z.string().min(1).optional(),
    contacts: z.array(PatientContactPointSchema),
    addresses: z.array(PatientAddressSchema),
    deceased: z.boolean().optional(),
}).strict();

export const EncounterParticipantSchema = z.object({
    role: ClinicalCodeableConceptSchema.optional(),
    person: z.string().min(1).optional(),
    organization: z.string().min(1).optional(),
}).strict().refine(
    participant => Boolean(participant.person || participant.organization),
    'Encounter participants require a person or organization',
);

export const EncounterRecordSchema = z.object({
    ...BaseClinicalResourceShape,
    resourceType: z.literal('Encounter'),
    status: z.enum(['planned', 'in-progress', 'finished', 'cancelled', 'unknown']),
    encounterClass: z.enum(['ambulatory', 'inpatient', 'emergency', 'virtual', 'home', 'other']),
    type: ClinicalCodeableConceptSchema.optional(),
    period: ClinicalPeriodSchema.optional(),
    reason: z.array(ClinicalCodeableConceptSchema).optional(),
    participants: z.array(EncounterParticipantSchema),
    location: z.string().min(1).optional(),
    serviceProvider: z.string().min(1).optional(),
}).strict();

export const ConditionRecordSchema = z.object({
    ...BaseClinicalResourceShape,
    resourceType: z.literal('Condition'),
    code: ClinicalCodeableConceptSchema,
    clinicalStatus: z.enum(['active', 'inactive', 'resolved', 'remission', 'unknown']),
    severity: ClinicalCodeableConceptSchema.optional(),
    bodySite: z.array(ClinicalCodeableConceptSchema).optional(),
    onset: ClinicalDateSchema.optional(),
    abatement: ClinicalDateSchema.optional(),
    encounterId: z.string().min(1).optional(),
    note: z.string().optional(),
}).strict();

export const AllergyReactionSchema = z.object({
    manifestation: z.array(ClinicalCodeableConceptSchema).min(1),
    description: z.string().optional(),
    onset: ClinicalDateSchema.optional(),
    severity: z.enum(['mild', 'moderate', 'severe', 'unknown']).optional(),
    exposureRoute: ClinicalCodeableConceptSchema.optional(),
}).strict();

export const AllergyIntoleranceRecordSchema = z.object({
    ...BaseClinicalResourceShape,
    resourceType: z.literal('AllergyIntolerance'),
    substance: ClinicalCodeableConceptSchema,
    clinicalStatus: z.enum(['active', 'inactive', 'resolved', 'unknown']),
    criticality: z.enum(['low', 'high', 'unable-to-assess']),
    categories: z.array(z.enum(['food', 'medication', 'environment', 'biologic', 'other'])),
    reactions: z.array(AllergyReactionSchema),
    lastOccurrence: ClinicalDateSchema.optional(),
    note: z.string().optional(),
}).strict();

export const MedicationDosageSchema = z.object({
    text: z.string().min(1),
    dose: ClinicalQuantitySchema.optional(),
    route: ClinicalCodeableConceptSchema.optional(),
    frequency: z.string().min(1).optional(),
    timingText: z.string().min(1).optional(),
    asNeeded: z.boolean().optional(),
    maximumDosePerPeriod: z.object({
        dose: ClinicalQuantitySchema,
        period: z.string().min(1),
    }).strict().optional(),
}).strict();

export const MedicationRecordSchema = z.object({
    ...BaseClinicalResourceShape,
    resourceType: z.literal('Medication'),
    kind: z.enum(['statement', 'request', 'administration']),
    medication: ClinicalCodeableConceptSchema,
    status: z.enum([
        'active',
        'completed',
        'stopped',
        'on-hold',
        'not-taken',
        'entered-in-error',
        'unknown',
    ]),
    dosageInstructions: z.array(MedicationDosageSchema),
    reason: z.array(ClinicalCodeableConceptSchema).optional(),
    start: ClinicalDateSchema.optional(),
    end: ClinicalDateSchema.optional(),
    prescriber: z.string().min(1).optional(),
    encounterId: z.string().min(1).optional(),
    note: z.string().optional(),
}).strict();

export const ObservationReferenceRangeSchema = z.object({
    low: ClinicalQuantityValueSchema.optional(),
    high: ClinicalQuantityValueSchema.optional(),
    text: z.string().min(1).optional(),
    appliesTo: z.array(ClinicalCodeableConceptSchema).optional(),
}).strict();

export const ObservationRecordSchema = z.object({
    ...BaseClinicalResourceShape,
    resourceType: z.literal('Observation'),
    status: z.enum([
        'registered',
        'preliminary',
        'final',
        'amended',
        'corrected',
        'cancelled',
        'entered-in-error',
        'unknown',
    ]),
    category: z.array(ClinicalCodeableConceptSchema).optional(),
    code: ClinicalCodeableConceptSchema,
    value: ObservationValueSchema.optional(),
    interpretation: z.array(ClinicalCodeableConceptSchema).optional(),
    referenceRanges: z.array(ObservationReferenceRangeSchema),
    specimenId: z.string().min(1).optional(),
    encounterId: z.string().min(1).optional(),
    diagnosticReportId: z.string().min(1).optional(),
    lineage: ObservationLineageSchema.optional(),
    issuedAt: IsoDateTimeSchema.optional(),
    performer: z.array(z.string().min(1)).optional(),
    note: z.string().optional(),
}).strict();

export const DiagnosticReportRecordSchema = z.object({
    ...BaseClinicalResourceShape,
    resourceType: z.literal('DiagnosticReport'),
    status: z.enum([
        'registered',
        'partial',
        'preliminary',
        'final',
        'amended',
        'corrected',
        'cancelled',
        'entered-in-error',
        'unknown',
    ]),
    code: ClinicalCodeableConceptSchema,
    category: z.array(ClinicalCodeableConceptSchema).optional(),
    effectivePeriod: ClinicalPeriodSchema.optional(),
    issuedAt: IsoDateTimeSchema.optional(),
    resultIds: z.array(z.string().min(1)),
    specimenIds: z.array(z.string().min(1)),
    documentIds: z.array(z.string().min(1)),
    conclusion: z.string().optional(),
    conclusionCodes: z.array(ClinicalCodeableConceptSchema).optional(),
    encounterId: z.string().min(1).optional(),
    performer: z.array(z.string().min(1)).optional(),
    relationships: z.array(DiagnosticReportRelationshipSchema).optional(),
}).strict();

export const SpecimenRecordSchema = z.object({
    ...BaseClinicalResourceShape,
    resourceType: z.literal('Specimen'),
    status: z.enum(['available', 'unavailable', 'unsatisfactory', 'entered-in-error', 'unknown']),
    type: ClinicalCodeableConceptSchema.optional(),
    collectedAt: ClinicalDateSchema.optional(),
    receivedAt: ClinicalDateSchema.optional(),
    bodySite: ClinicalCodeableConceptSchema.optional(),
    collectionMethod: ClinicalCodeableConceptSchema.optional(),
    note: z.string().optional(),
}).strict();

export const ProcedureRecordSchema = z.object({
    ...BaseClinicalResourceShape,
    resourceType: z.literal('Procedure'),
    status: z.enum([
        'preparation',
        'in-progress',
        'not-done',
        'on-hold',
        'stopped',
        'completed',
        'entered-in-error',
        'unknown',
    ]),
    code: ClinicalCodeableConceptSchema,
    performed: z.union([ClinicalDateSchema, ClinicalPeriodSchema]).optional(),
    bodySite: z.array(ClinicalCodeableConceptSchema).optional(),
    reason: z.array(ClinicalCodeableConceptSchema).optional(),
    outcome: ClinicalCodeableConceptSchema.optional(),
    complications: z.array(ClinicalCodeableConceptSchema).optional(),
    performer: z.array(z.string().min(1)).optional(),
    encounterId: z.string().min(1).optional(),
    reportIds: z.array(z.string().min(1)).optional(),
    note: z.string().optional(),
}).strict();

export const ImmunizationRecordSchema = z.object({
    ...BaseClinicalResourceShape,
    resourceType: z.literal('Immunization'),
    status: z.enum(['completed', 'entered-in-error', 'not-done', 'unknown']),
    vaccineCode: ClinicalCodeableConceptSchema,
    occurrence: ClinicalDateSchema.optional(),
    lotNumber: z.string().min(1).optional(),
    manufacturer: z.string().min(1).optional(),
    doseQuantity: ClinicalQuantitySchema.optional(),
    site: ClinicalCodeableConceptSchema.optional(),
    route: ClinicalCodeableConceptSchema.optional(),
    reason: z.array(ClinicalCodeableConceptSchema).optional(),
    performer: z.string().min(1).optional(),
    note: z.string().optional(),
}).strict();

export const AppointmentParticipantSchema = z.object({
    name: z.string().min(1),
    role: ClinicalCodeableConceptSchema.optional(),
    status: z.enum(['accepted', 'declined', 'tentative', 'needs-action']).optional(),
}).strict();

export const AppointmentRecordSchema = z.object({
    ...BaseClinicalResourceShape,
    resourceType: z.literal('Appointment'),
    status: z.enum([
        'proposed',
        'pending',
        'booked',
        'arrived',
        'fulfilled',
        'cancelled',
        'no-show',
        'entered-in-error',
        'unknown',
    ]),
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    start: IsoDateTimeSchema.optional(),
    end: IsoDateTimeSchema.optional(),
    requestedPeriod: z.array(ClinicalPeriodSchema).optional(),
    reason: z.array(ClinicalCodeableConceptSchema).optional(),
    participants: z.array(AppointmentParticipantSchema),
    location: z.string().min(1).optional(),
    encounterId: z.string().min(1).optional(),
    note: z.string().optional(),
}).strict();

export const ClinicalTaskRecordSchema = z.object({
    ...BaseClinicalResourceShape,
    resourceType: z.literal('ClinicalTask'),
    status: z.enum([
        'draft',
        'requested',
        'received',
        'accepted',
        'in-progress',
        'completed',
        'cancelled',
        'failed',
        'entered-in-error',
    ]),
    intent: z.enum(['proposal', 'plan', 'order', 'original-order', 'reflex-order', 'filler-order']),
    priority: z.enum(['routine', 'urgent', 'asap', 'stat']),
    code: ClinicalCodeableConceptSchema.optional(),
    title: z.string().min(1),
    description: z.string().optional(),
    due: z.union([ClinicalDateSchema, ClinicalPeriodSchema]).optional(),
    owner: z.string().min(1).optional(),
    relatedResources: z.array(ClinicalReferenceSchema),
    completedAt: IsoDateTimeSchema.optional(),
    note: z.string().optional(),
}).strict();

export const CarePlanRecordSchema = z.object({
    ...BaseClinicalResourceShape,
    resourceType: z.literal('CarePlan'),
    status: z.enum(['draft', 'active', 'on-hold', 'revoked', 'completed', 'entered-in-error', 'unknown']),
    intent: z.enum(['proposal', 'plan', 'order', 'option']),
    title: z.string().min(1),
    description: z.string().optional(),
    period: ClinicalPeriodSchema.optional(),
    addressesConditionIds: z.array(z.string().min(1)),
    activityTaskIds: z.array(z.string().min(1)),
    encounterId: z.string().min(1).optional(),
    note: z.string().optional(),
}).strict();

export const DocumentReferenceRecordSchema = z.object({
    ...BaseClinicalResourceShape,
    resourceType: z.literal('DocumentReference'),
    status: z.enum(['current', 'superseded', 'entered-in-error']),
    storageId: z.string().min(1),
    fileName: z.string().min(1),
    mimeType: z.string().min(1),
    title: z.string().min(1).optional(),
    documentType: ClinicalCodeableConceptSchema.optional(),
    authoredOn: ClinicalDateSchema.optional(),
    uploadedAt: IsoDateTimeSchema,
    pageCount: z.number().int().positive().optional(),
    hash: z.string().min(1).optional(),
    description: z.string().optional(),
    relatedResources: z.array(ClinicalReferenceSchema),
}).strict();

export const ClinicalNoteSectionSchema = z.object({
    title: z.string().min(1),
    code: ClinicalCodeableConceptSchema.optional(),
    text: z.string(),
}).strict();

export const ClinicalNoteRecordSchema = z.object({
    ...BaseClinicalResourceShape,
    resourceType: z.literal('ClinicalNote'),
    status: z.enum(['draft', 'final', 'amended', 'entered-in-error']),
    noteType: z.enum(['soap', 'visit-note', 'discharge-summary', 'progress-note', 'patient-note', 'other']),
    title: z.string().min(1),
    authoredAt: IsoDateTimeSchema,
    author: z.string().min(1).optional(),
    encounterId: z.string().min(1).optional(),
    sections: z.array(ClinicalNoteSectionSchema).min(1),
    sourceDocumentIds: z.array(z.string().min(1)),
    transcriptDocumentId: z.string().min(1).optional(),
    amendsNoteId: z.string().min(1).optional(),
}).strict();

export const ClinicalRecordResourceSchema = z.discriminatedUnion('resourceType', [
    PatientProfileRecordSchema,
    EncounterRecordSchema,
    ConditionRecordSchema,
    AllergyIntoleranceRecordSchema,
    MedicationRecordSchema,
    ObservationRecordSchema,
    DiagnosticReportRecordSchema,
    SpecimenRecordSchema,
    ProcedureRecordSchema,
    ImmunizationRecordSchema,
    AppointmentRecordSchema,
    ClinicalTaskRecordSchema,
    CarePlanRecordSchema,
    DocumentReferenceRecordSchema,
    ClinicalNoteRecordSchema,
]);

export const PatientClinicalResourcesSchema = z.object({
    encounters: z.array(EncounterRecordSchema),
    conditions: z.array(ConditionRecordSchema),
    allergies: z.array(AllergyIntoleranceRecordSchema),
    medications: z.array(MedicationRecordSchema),
    observations: z.array(ObservationRecordSchema),
    diagnosticReports: z.array(DiagnosticReportRecordSchema),
    specimens: z.array(SpecimenRecordSchema),
    procedures: z.array(ProcedureRecordSchema),
    immunizations: z.array(ImmunizationRecordSchema),
    appointments: z.array(AppointmentRecordSchema),
    tasks: z.array(ClinicalTaskRecordSchema),
    carePlans: z.array(CarePlanRecordSchema),
    documents: z.array(DocumentReferenceRecordSchema),
    notes: z.array(ClinicalNoteRecordSchema),
}).strict();

export const PatientClinicalRecordSchema = z.object({
    schemaVersion: z.literal(CLINICAL_RECORD_SCHEMA_VERSION),
    patientId: z.string().min(1),
    profile: PatientProfileRecordSchema,
    resources: PatientClinicalResourcesSchema,
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
}).strict().superRefine((record, ctx) => {
    if (record.profile.patientId !== record.patientId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['profile', 'patientId'],
            message: 'Patient profile must belong to the enclosing patient record',
        });
    }

    const resourceGroups = Object.values(record.resources).flat();
    resourceGroups.forEach((resource, index) => {
        if (resource.patientId !== record.patientId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['resources', index, 'patientId'],
                message: `Resource ${resource.id} belongs to a different patient`,
            });
        }
    });
});

export const ClinicalRecordExportSchema = z.object({
    format: z.literal(CLINICAL_RECORD_EXPORT_FORMAT),
    exportVersion: z.literal(CLINICAL_RECORD_EXPORT_VERSION),
    exportedAt: IsoDateTimeSchema,
    records: z.record(z.string(), PatientClinicalRecordSchema),
}).strict();

export const parseClinicalRecordResource = (input: unknown): ClinicalRecordResource =>
    ClinicalRecordResourceSchema.parse(input) as ClinicalRecordResource;

export const safeParseClinicalRecordResource = (input: unknown) =>
    ClinicalRecordResourceSchema.safeParse(input);

export const parsePatientClinicalRecord = (input: unknown): PatientClinicalRecord =>
    PatientClinicalRecordSchema.parse(input) as PatientClinicalRecord;

export const safeParsePatientClinicalRecord = (input: unknown) =>
    PatientClinicalRecordSchema.safeParse(input);

export const parseClinicalRecordExport = (input: unknown): ClinicalRecordExport =>
    ClinicalRecordExportSchema.parse(input) as ClinicalRecordExport;

export const safeParseClinicalRecordExport = (input: unknown) =>
    ClinicalRecordExportSchema.safeParse(input);
