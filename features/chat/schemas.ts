
import { z } from 'zod';

// --- Briefing Schema ---
export const BriefingSectionSchema = z.object({
    title: z.string(),
    items: z.array(z.string())
});

export const BriefingSchema = z.object({
    briefingTitle: z.string(),
    sections: z.array(BriefingSectionSchema)
});

// --- Lab Report Schema ---
export const LabResultSchema = z.object({
    testName: z.string(),
    value: z.union([z.string(), z.number()]).transform(val => String(val)),
    units: z.string(),
    refRange: z.string(),
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
    drug1: z.string(),
    drug2: z.string(),
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
    drugName: z.string(),
    amount: z.number(),
    unit: z.string(),
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
    label: z.string(),
    type: z.enum(['order', 'dismiss', 'acknowledge']),
    payload: z.string().optional()
});

export const CDSSAlertSchema = z.object({
    title: z.string(),
    level: z.enum(['Critical', 'Warning', 'Info']),
    description: z.string(),
    triggers: z.array(z.string()),
    source_citation: z.string().optional(),
    actions: z.array(CDSSActionSchema).optional()
});

export const CDSSResponseSchema = z.object({
    alerts: z.array(CDSSAlertSchema)
});

// Type Exports
export type Briefing = z.infer<typeof BriefingSchema>;
export type LabReport = z.infer<typeof LabReportSchema>;
export type InteractionMatrix = z.infer<typeof InteractionMatrixSchema>;
export type EntityExtraction = z.infer<typeof EntityExtractionSchema>;
export type MedicationList = z.infer<typeof MedicationListSchema>;
export type ImageAnalysis = z.infer<typeof ImageAnalysisSchema>;
export type CDSSResponse = z.infer<typeof CDSSResponseSchema>;
