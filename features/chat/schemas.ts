
import { z } from 'zod';

// --- Briefing Schema ---
export const BriefingSectionSchema = z.object({
    title: z.string().min(1),
    items: z.array(z.string().min(1))
});

export const BriefingSchema = z.object({
    briefingTitle: z.string().min(1),
    sections: z.array(BriefingSectionSchema)
});

// --- Lab Report Schema ---
export const LabResultSchema = z.object({
    testName: z.string().min(1),
    value: z.union([z.string(), z.number()]).transform(val => String(val)),
    units: z.string().min(1).optional().or(z.literal('')), // Units can be empty for some counts
    refRange: z.string().optional().or(z.literal('')),
    flag: z.enum(['Normal', 'High', 'Low', 'Critical', 'Abnormal', 'Unknown']).optional().default('Normal')
});

export const LabReportSchema = z.object({
    reportType: z.literal('lab-report'),
    patient: z.string().optional(),
    date: z.string().optional(),
    labs: z.array(LabResultSchema),
    interpretation: z.string().optional()
});

// --- Interaction Matrix Schema ---
export const InteractionSchema = z.object({
    drug1: z.string().min(1),
    drug2: z.string().min(1),
    severity: z.enum(['High', 'Moderate', 'Low', 'None', 'Unknown', 'Severe']), // Handle both High/Severe
    mechanism: z.string().optional(),
    management: z.string().optional()
});

export const InteractionMatrixSchema = z.object({
    reportType: z.literal('interaction-check'),
    drugs: z.array(z.string()),
    interactions: z.array(InteractionSchema),
    summary: z.string().optional()
});

// --- Entity Extraction Schema ---
export const EntityExtractionSchema = z.object({
    allergies: z.array(z.string()).optional().default([]),
    codeStatus: z.string().optional().nullable(),
    diagnosis: z.array(z.string()).optional().default([])
});

// --- Medication Extraction Schema ---
export const MedicationItemSchema = z.object({
    drugName: z.string().min(1),
    amount: z.number().nonnegative().max(100000), // Max 100k to allow for Units (e.g. Heparin 25,000U)
    unit: z.string().min(1),
    context: z.string().optional()
});

export const MedicationListSchema = z.array(MedicationItemSchema);

// --- Image Analysis Schema ---
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
    nextSteps: z.string().optional()
});

// --- CDSS Alert Schema ---
export const CDSSActionSchema = z.object({
    label: z.string().min(1),
    type: z.enum(['order', 'dismiss', 'acknowledge']),
    payload: z.string().optional()
});

export const CDSSAlertSchema = z.object({
    title: z.string().min(1),
    level: z.enum(['Critical', 'Warning', 'Info']),
    description: z.string().min(5),
    triggers: z.array(z.string()),
    source_citation: z.string().optional(),
    actions: z.array(CDSSActionSchema).optional()
});

export const CDSSResponseSchema = z.object({
    alerts: z.array(CDSSAlertSchema)
});

// --- Import/Export Safety Schema ---
export const PatientDocumentSchema = z.object({
    storageId: z.string(),
    name: z.string(),
    type: z.string(),
    uploadedAt: z.number()
});

export const PatientEntityDataSchema = z.object({
    allergies: z.array(z.string()),
    codeStatus: z.string(),
    diagnosis: z.array(z.string())
});

export const PatientMetadataSchema = z.object({
    id: z.string(),
    name: z.string(),
    status: z.enum(['Stable', 'Critical', 'Discharge Ready', 'New Admission']),
    entities: PatientEntityDataSchema,
    demographics: z.object({
        age: z.number().optional(),
        weight: z.number().optional(),
        sex: z.enum(['Male', 'Female', 'Other']).optional()
    }).optional(),
    documents: z.array(PatientDocumentSchema),
    createdAt: z.number(),
    lastActive: z.number()
});

// We validate the structure of the backup file strictly
export const BackupFileSchema = z.object({
    version: z.string(),
    activePatientId: z.string(),
    patients: z.record(z.string(), z.object({
        id: z.string(),
        name: z.string(),
        status: z.any(), // Looser on status enum during import to allow forward compatibility
        entities: z.any(),
        documents: z.array(z.any()),
        chatHistory: z.array(z.any()), // Chat messages structure is complex, we assume basic array
        clinicalData: z.object({
            observations: z.array(z.any())
        }).optional(),
        activeAlerts: z.array(z.any()).optional()
    }))
});

// Type Exports
export type Briefing = z.infer<typeof BriefingSchema>;
export type LabReport = z.infer<typeof LabReportSchema>;
export type InteractionMatrix = z.infer<typeof InteractionMatrixSchema>;
export type EntityExtraction = z.infer<typeof EntityExtractionSchema>;
export type MedicationList = z.infer<typeof MedicationListSchema>;
export type ImageAnalysis = z.infer<typeof ImageAnalysisSchema>;
export type CDSSResponse = z.infer<typeof CDSSResponseSchema>;
