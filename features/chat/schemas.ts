import { z } from 'zod';

export const BriefingSectionSchema = z.object({
    title: z.string().min(1),
    items: z.array(z.string().min(1)),
});

export const BriefingSchema = z.object({
    briefingTitle: z.string().min(1),
    sections: z.array(BriefingSectionSchema),
});

export const LabResultSchema = z.object({
    testName: z.string().min(1),
    loinc: z.string().optional(),
    value: z.union([z.string(), z.number()]).transform(value => String(value)),
    units: z.string().min(1).optional().or(z.literal('')),
    refRange: z.string().optional().or(z.literal('')),
    flag: z.enum([
        'Normal',
        'High',
        'Low',
        'Critical',
        'Abnormal',
        'Unknown',
    ]).optional().default('Normal'),
});

export const LabReportSchema = z.object({
    reportType: z.literal('lab-report'),
    patient: z.string().optional(),
    date: z.string().optional(),
    labs: z.array(LabResultSchema),
    interpretation: z.string().optional(),
});

export const InteractionSchema = z.object({
    drug1: z.string().min(1),
    drug2: z.string().min(1),
    severity: z.enum([
        'High',
        'Moderate',
        'Low',
        'None',
        'Unknown',
        'Severe',
    ]),
    mechanism: z.string().optional(),
    management: z.string().optional(),
});

export const InteractionMatrixSchema = z.object({
    reportType: z.literal('interaction-check'),
    drugs: z.array(z.string()),
    interactions: z.array(InteractionSchema),
    summary: z.string().optional(),
});

export const EntityExtractionSchema = z.object({
    allergies: z.array(z.string()).optional().default([]),
    codeStatus: z.string().optional().nullable(),
    diagnosis: z.array(z.string()).optional().default([]),
});

export const MedicationItemSchema = z.object({
    drugName: z.string().min(1),
    amount: z.number().nonnegative().max(100000),
    unit: z.string().min(1),
    context: z.string().optional(),
});

export const MedicationListSchema = z.array(MedicationItemSchema);

export const ImageAnalysisSchema = z.object({
    reportType: z.literal('medical-image'),
    imageType: z.string().optional(),
    patient: z.string().optional(),
    date: z.string().optional(),
    visualObservations: z.string().optional(),
    certaintyScore: z.string().optional(),
    potentialAbnormalities: z.string().optional(),
    differentialDiagnosisSuggestions: z.string().optional(),
    extractedInformation: z.string().optional(),
    note: z.string().optional(),
    nextSteps: z.string().optional(),
});

/**
 * Advisory actions may create a local follow-up task, be acknowledged, or be
 * dismissed. They cannot represent a clinical order or completed treatment.
 */
export const CDSSActionSchema = z.object({
    label: z.string().min(1),
    type: z.enum(['create-task', 'dismiss', 'acknowledge']),
    payload: z.string().optional(),
});

export const CDSSAlertSchema = z.object({
    title: z.string().min(1),
    level: z.enum(['Critical', 'Warning', 'Info']),
    description: z.string().min(5),
    triggers: z.array(z.string()),
    validationStatus: z.literal('validated'),
    sourceCitation: z.string().min(1),
    actions: z.array(CDSSActionSchema).optional(),
});

export const CDSSResponseSchema = z.object({
    alerts: z.array(CDSSAlertSchema),
});

// Legacy import-only schemas. Portable backup v2 lives in clinical-record.
export const PatientDocumentSchema = z.object({
    storageId: z.string(),
    name: z.string(),
    type: z.string(),
    uploadedAt: z.number(),
});

export const PatientEntityDataSchema = z.object({
    allergies: z.array(z.string()),
    codeStatus: z.string(),
    diagnosis: z.array(z.string()),
});

export const PatientMetadataSchema = z.object({
    id: z.string(),
    name: z.string(),
    status: z.enum([
        'Stable',
        'Critical',
        'Discharge Ready',
        'New Admission',
    ]),
    entities: PatientEntityDataSchema,
    demographics: z.object({
        age: z.number().optional(),
        weight: z.number().optional(),
        sex: z.enum(['Male', 'Female', 'Other']).optional(),
    }).optional(),
    documents: z.array(PatientDocumentSchema),
    createdAt: z.number(),
    lastActive: z.number(),
});

export const BackupFileSchema = z.object({
    version: z.string(),
    activePatientId: z.string(),
    patients: z.record(z.string(), z.object({
        id: z.string(),
        name: z.string(),
        status: z.any(),
        entities: z.any(),
        documents: z.array(z.any()),
        chatHistory: z.array(z.any()),
        clinicalData: z.object({
            observations: z.array(z.any()),
        }).optional(),
        activeAlerts: z.array(z.any()).optional(),
    })),
});

export type Briefing = z.infer<typeof BriefingSchema>;
export type LabReport = z.infer<typeof LabReportSchema>;
export type InteractionMatrix = z.infer<typeof InteractionMatrixSchema>;
export type EntityExtraction = z.infer<typeof EntityExtractionSchema>;
export type MedicationList = z.infer<typeof MedicationListSchema>;
export type ImageAnalysis = z.infer<typeof ImageAnalysisSchema>;
export type CDSSResponse = z.infer<typeof CDSSResponseSchema>;
