import { z } from 'zod';
import {
    LEGACY_MEDIBRIEF_BACKUP_VERSION,
    MEDIBRIEF_BACKUP_FORMAT,
    MEDIBRIEF_BACKUP_VERSION,
} from './constants';
import {
    ClinicalRecordExportSchema,
    IsoDateTimeSchema,
} from './schemas';

const PatientStatusSchema = z.enum([
    'Stable',
    'Critical',
    'Discharge Ready',
    'New Admission',
]);

export const BackupPatientDocumentSchema = z.object({
    storageId: z.string().min(1),
    name: z.string().min(1),
    type: z.string().min(1),
    uploadedAt: z.number().finite(),
}).strict();

export const BackupPatientMetadataSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    mrn: z.string().min(1).optional(),
    status: PatientStatusSchema,
    entities: z.object({
        allergies: z.array(z.string()),
        codeStatus: z.string(),
        diagnosis: z.array(z.string()),
    }).strict(),
    demographics: z.object({
        age: z.number().finite().nonnegative().optional(),
        weight: z.number().finite().nonnegative().optional(),
        sex: z.enum(['Male', 'Female', 'Other']).optional(),
    }).strict().optional(),
    documents: z.array(BackupPatientDocumentSchema),
    createdAt: z.number().finite(),
    lastActive: z.number().finite(),
}).strict();

const BackupGroundingSourceSchema = z.object({
    web: z.object({
        uri: z.string().min(1),
        title: z.string(),
    }).strict().optional(),
    maps: z.object({
        uri: z.string().min(1),
        title: z.string(),
        placeId: z.string().optional(),
    }).strict().optional(),
    rejected: z.boolean().optional(),
}).strict().superRefine((source, ctx) => {
    if (!source.web && !source.maps) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'A grounding source must contain a web or maps source.',
        });
    }
});

export const BackupChatMessageSchema = z.object({
    role: z.enum(['user', 'model']),
    content: z.string(),
    displayContent: z.string().optional(),
    filePreview: z.object({
        name: z.string().min(1),
        type: z.string().min(1),
        storageId: z.string().min(1).optional(),
    }).strict().optional(),
    sources: z.array(BackupGroundingSourceSchema).optional(),
}).strict();

const LegacyChatMessageSchema = BackupChatMessageSchema.extend({
    filePreview: z.object({
        url: z.string().optional(),
        name: z.string().min(1),
        type: z.string().min(1),
        storageId: z.string().min(1).optional(),
    }).passthrough().optional(),
}).passthrough();

const FHIRCodingSchema = z.object({
    system: z.string().optional(),
    version: z.string().optional(),
    code: z.string().optional(),
    display: z.string().optional(),
    userSelected: z.boolean().optional(),
}).strict();

const FHIRCodeableConceptSchema = z.object({
    coding: z.array(FHIRCodingSchema).optional(),
    text: z.string().optional(),
}).strict();

const FHIRQuantitySchema = z.object({
    value: z.number().finite().optional(),
    comparator: z.enum(['<', '<=', '>=', '>']).optional(),
    unit: z.string().optional(),
    system: z.string().optional(),
    code: z.string().optional(),
}).strict();

const FHIRReferenceRangeSchema = z.object({
    low: FHIRQuantitySchema.optional(),
    high: FHIRQuantitySchema.optional(),
    type: FHIRCodeableConceptSchema.optional(),
    appliesTo: z.array(FHIRCodeableConceptSchema).optional(),
    text: z.string().optional(),
}).strict();

const FHIRReferenceSchema = z.object({
    reference: z.string(),
    type: z.string().optional(),
    display: z.string().optional(),
}).strict();

export const BackupFHIRObservationSchema = z.object({
    resourceType: z.literal('Observation'),
    id: z.string(),
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
    category: z.array(FHIRCodeableConceptSchema).optional(),
    code: FHIRCodeableConceptSchema,
    subject: FHIRReferenceSchema.optional(),
    effectiveDateTime: z.string().optional(),
    issued: z.string().optional(),
    performer: z.array(FHIRReferenceSchema).optional(),
    valueQuantity: FHIRQuantitySchema.optional(),
    valueString: z.string().optional(),
    valueBoolean: z.boolean().optional(),
    valueInteger: z.number().int().optional(),
    valueCodeableConcept: FHIRCodeableConceptSchema.optional(),
    interpretation: z.array(FHIRCodeableConceptSchema).optional(),
    referenceRange: z.array(FHIRReferenceRangeSchema).optional(),
    note: z.array(z.object({ text: z.string() }).strict()).optional(),
}).strict();

const BackupClinicalDataStoreSchema = z.object({
    observations: z.array(BackupFHIRObservationSchema),
}).strict();

const BackupCDSSActionSchema = z.object({
    label: z.string(),
    type: z.enum(['order', 'dismiss', 'acknowledge']),
    payload: z.string().optional(),
}).strict();

const BackupCDSSAlertSchema = z.object({
    id: z.string(),
    ruleId: z.string(),
    title: z.string(),
    description: z.string(),
    level: z.enum(['Critical', 'Warning', 'Info']),
    timestamp: z.number().finite(),
    triggers: z.array(z.string()),
    actions: z.array(BackupCDSSActionSchema),
}).strict();

export const BackupStoredFileSchema = z.object({
    id: z.string().min(1),
    data: z.string(),
    mimeType: z.string().min(1),
    timestamp: z.number().finite(),
}).strict();

export const BackupAssetBundleSchema = z.object({
    files: z.record(z.string(), BackupStoredFileSchema),
    missingStorageIds: z.array(z.string().min(1)),
}).strict().superRefine((assets, ctx) => {
    Object.entries(assets.files).forEach(([storageId, file]) => {
        if (file.id !== storageId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['files', storageId, 'id'],
                message: 'Asset map keys must match the stored file ID.',
            });
        }
    });

    if (new Set(assets.missingStorageIds).size !== assets.missingStorageIds.length) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['missingStorageIds'],
            message: 'Missing storage IDs must be unique.',
        });
    }
});

export const BackupLegacyClinicalStateSchema = z.object({
    data: z.record(z.string(), BackupClinicalDataStoreSchema),
    alerts: z.record(z.string(), z.array(BackupCDSSAlertSchema)),
    dismissalHistory: z.record(
        z.string(),
        z.record(z.string(), z.number().finite()),
    ),
}).strict();

const collectStorageIds = (backup: {
    patients: Record<string, z.infer<typeof BackupPatientMetadataSchema>>;
    chats: Record<string, z.infer<typeof BackupChatMessageSchema>[]>;
    clinicalRecords: z.infer<typeof ClinicalRecordExportSchema>;
}): Set<string> => {
    const storageIds = new Set<string>();

    Object.values(backup.patients).forEach(patient => {
        patient.documents.forEach(document => storageIds.add(document.storageId));
    });
    Object.values(backup.chats).flat().forEach(message => {
        if (message.filePreview?.storageId) {
            storageIds.add(message.filePreview.storageId);
        }
    });
    Object.values(backup.clinicalRecords.records).forEach(record => {
        record.resources.documents.forEach(document =>
            storageIds.add(document.storageId),
        );
    });

    return storageIds;
};

export const MediBriefBackupV2Schema = z.object({
    format: z.literal(MEDIBRIEF_BACKUP_FORMAT),
    version: z.literal(MEDIBRIEF_BACKUP_VERSION),
    exportedAt: IsoDateTimeSchema,
    activePatientId: z.string().min(1),
    patients: z.record(z.string(), BackupPatientMetadataSchema),
    chats: z.record(z.string(), z.array(BackupChatMessageSchema)),
    legacyClinical: BackupLegacyClinicalStateSchema,
    clinicalRecords: ClinicalRecordExportSchema,
    assets: BackupAssetBundleSchema,
}).strict().superRefine((backup, ctx) => {
    const patientIds = Object.keys(backup.patients);
    if (patientIds.length === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['patients'],
            message: 'A backup must contain at least one patient context.',
        });
        return;
    }

    if (!backup.patients[backup.activePatientId]) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['activePatientId'],
            message: 'The active patient must exist in the backup roster.',
        });
    }

    patientIds.forEach(patientId => {
        if (!backup.clinicalRecords.records[patientId]) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['clinicalRecords', 'records', patientId],
                message: 'Every roster patient must have a clinical record aggregate.',
            });
        }
    });

    Object.entries(backup.clinicalRecords.records).forEach(
        ([patientId, record]) => {
            if (record.patientId !== patientId) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['clinicalRecords', 'records', patientId, 'patientId'],
                    message: 'Clinical record map keys must match patient IDs.',
                });
            }
            if (!backup.patients[patientId]) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['clinicalRecords', 'records', patientId],
                    message: 'Clinical records cannot reference a patient missing from the roster.',
                });
            }
        },
    );

    const knownPatientIds = new Set(patientIds);
    const patientScopedMaps: Array<[string, Record<string, unknown>]> = [
        ['chats', backup.chats],
        ['legacyClinical.data', backup.legacyClinical.data],
        ['legacyClinical.alerts', backup.legacyClinical.alerts],
        ['legacyClinical.dismissalHistory', backup.legacyClinical.dismissalHistory],
    ];
    patientScopedMaps.forEach(([path, map]) => {
        Object.keys(map).forEach(patientId => {
            if (!knownPatientIds.has(patientId)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: path.split('.').concat(patientId),
                    message: 'Patient-scoped backup data must reference a roster patient.',
                });
            }
        });
    });

    const accountedAssets = new Set([
        ...Object.keys(backup.assets.files),
        ...backup.assets.missingStorageIds,
    ]);
    collectStorageIds(backup).forEach(storageId => {
        if (!accountedAssets.has(storageId)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['assets'],
                message: `Referenced asset ${storageId} is neither embedded nor declared missing.`,
            });
        }
    });
});

const LegacyPatientContextSchema = BackupPatientMetadataSchema.extend({
    chatHistory: z.array(LegacyChatMessageSchema).optional().default([]),
    clinicalData: BackupClinicalDataStoreSchema.optional(),
    activeAlerts: z.array(BackupCDSSAlertSchema).optional(),
}).passthrough();

export const LegacyBackupV4_2Schema = z.object({
    version: z.literal(LEGACY_MEDIBRIEF_BACKUP_VERSION),
    activePatientId: z.string().min(1),
    patients: z.record(z.string(), LegacyPatientContextSchema),
}).passthrough();

export type BackupPatientMetadata = z.infer<typeof BackupPatientMetadataSchema>;
export type BackupChatMessage = z.infer<typeof BackupChatMessageSchema>;
export type BackupStoredFile = z.infer<typeof BackupStoredFileSchema>;
export type BackupLegacyClinicalState = z.infer<typeof BackupLegacyClinicalStateSchema>;
export type MediBriefBackupV2 = z.infer<typeof MediBriefBackupV2Schema>;
export type LegacyBackupV4_2 = z.infer<typeof LegacyBackupV4_2Schema>;
