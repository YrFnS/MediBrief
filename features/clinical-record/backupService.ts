import type { ChatMessage } from '../../types';
import {
    blobStorage,
    type StoredFile,
} from '../../services/blobStorageService';
import type { CDSSAlert } from '../cdss/types';
import type { ClinicalDataStore } from '../fhir/types';
import { useChatStore } from '../chat/stores/useChatStore';
import { useClinicalStore } from '../clinical-analysis/stores/useClinicalStore';
import type { PatientMetadata } from '../patient-management/types';
import { usePatientStore } from '../patient-management/usePatientStore';
import {
    CLINICAL_RECORD_EXPORT_FORMAT,
    CLINICAL_RECORD_EXPORT_VERSION,
    MEDIBRIEF_BACKUP_FORMAT,
    MEDIBRIEF_BACKUP_VERSION,
} from './constants';
import {
    LegacyBackupV4_2Schema,
    MediBriefBackupV2Schema,
    type BackupChatMessage,
    type BackupStoredFile,
    type LegacyBackupV4_2,
    type MediBriefBackupV2,
} from './backupSchemas';
import {
    migrateLegacyStoresToClinicalRecords,
    type LegacyMigrationReport,
} from './legacyMigration';
import type {
    ClinicalRecordExport,
    PatientClinicalRecord,
} from './types';
import { useClinicalRecordStore } from './useClinicalRecordStore';

export type BackupSourceFormat = 'v2' | 'legacy-v4.2';

export interface BackupCreationResult {
    backup: MediBriefBackupV2;
    migrationReport: LegacyMigrationReport;
}

export interface PreparedBackupImport {
    backup: MediBriefBackupV2;
    sourceFormat: BackupSourceFormat;
    migrationReport?: LegacyMigrationReport;
    warnings: string[];
}

export interface BackupApplyResult {
    sourceFormat: BackupSourceFormat;
    restoredPatients: number;
    restoredClinicalRecords: number;
    restoredChats: number;
    restoredAssets: number;
    unresolvedAssetIds: string[];
    warnings: string[];
}

const cloneJson = <T>(value: T): T =>
    JSON.parse(JSON.stringify(value)) as T;

const parseBackupV2 = (input: unknown): MediBriefBackupV2 =>
    MediBriefBackupV2Schema.parse(input) as unknown as MediBriefBackupV2;

const parseLegacyBackup = (input: unknown): LegacyBackupV4_2 =>
    LegacyBackupV4_2Schema.parse(input) as unknown as LegacyBackupV4_2;

const sanitizeChatMessage = (message: ChatMessage): BackupChatMessage => ({
    role: message.role,
    content: message.content,
    ...(message.displayContent !== undefined
        ? { displayContent: message.displayContent }
        : {}),
    ...(message.filePreview
        ? {
            filePreview: {
                name: message.filePreview.name,
                type: message.filePreview.type,
                ...(message.filePreview.storageId
                    ? { storageId: message.filePreview.storageId }
                    : {}),
            },
        }
        : {}),
    ...(message.sources ? { sources: cloneJson(message.sources) } : {}),
});

const sanitizeChats = (
    chats: Record<string, ChatMessage[]>,
): Record<string, BackupChatMessage[]> =>
    Object.fromEntries(
        Object.entries(chats).map(([patientId, messages]) => [
            patientId,
            messages.map(sanitizeChatMessage),
        ]),
    );

const collectReferencedStorageIds = ({
    patients,
    chats,
    records,
}: {
    patients: Record<string, PatientMetadata>;
    chats: Record<string, BackupChatMessage[]>;
    records: Record<string, PatientClinicalRecord>;
}): string[] => {
    const storageIds = new Set<string>();

    Object.values(patients).forEach(patient => {
        patient.documents.forEach(document => {
            if (document.storageId) storageIds.add(document.storageId);
        });
    });
    Object.values(chats).flat().forEach(message => {
        if (message.filePreview?.storageId) {
            storageIds.add(message.filePreview.storageId);
        }
    });
    Object.values(records).forEach(record => {
        record.resources.documents.forEach(document => {
            if (document.storageId) storageIds.add(document.storageId);
        });
    });

    return [...storageIds].sort();
};

const buildClinicalRecordExport = (
    records: Record<string, PatientClinicalRecord>,
    exportedAt: string,
): ClinicalRecordExport => ({
    format: CLINICAL_RECORD_EXPORT_FORMAT,
    exportVersion: CLINICAL_RECORD_EXPORT_VERSION,
    exportedAt,
    records: cloneJson(records),
});

const exportAssets = async (
    storageIds: string[],
): Promise<{
    files: Record<string, BackupStoredFile>;
    missingStorageIds: string[];
}> => {
    const files: Record<string, BackupStoredFile> = {};
    const missingStorageIds: string[] = [];

    for (const storageId of storageIds) {
        try {
            const stored = await blobStorage.getFile(storageId);
            if (stored) {
                files[storageId] = cloneJson(stored);
            } else {
                missingStorageIds.push(storageId);
            }
        } catch (error) {
            console.warn(`Unable to read asset ${storageId} for backup.`, error);
            missingStorageIds.push(storageId);
        }
    }

    return { files, missingStorageIds };
};

export const migrateCurrentLegacyStores = (
    migratedAt = new Date().toISOString(),
): LegacyMigrationReport => {
    const patientState = usePatientStore.getState();
    const legacyClinicalState = useClinicalStore.getState();
    const currentClinicalRecords = useClinicalRecordStore.getState().records;
    const result = migrateLegacyStoresToClinicalRecords({
        patients: patientState.patients,
        clinicalData: legacyClinicalState.data,
        existingRecords: currentClinicalRecords,
        migratedAt,
    });

    if (result.changed) {
        useClinicalRecordStore.setState({ records: result.records });
    }

    return result.report;
};

export const createMediBriefBackupV2 = async (): Promise<BackupCreationResult> => {
    const exportedAt = new Date().toISOString();
    const migrationReport = migrateCurrentLegacyStores(exportedAt);

    const patientState = usePatientStore.getState();
    const chatState = useChatStore.getState();
    const legacyClinicalState = useClinicalStore.getState();
    const clinicalRecordState = useClinicalRecordStore.getState();

    const patients = cloneJson(patientState.patients);
    const chats = sanitizeChats(chatState.chats);
    const clinicalRecords = buildClinicalRecordExport(
        clinicalRecordState.records,
        exportedAt,
    );
    const storageIds = collectReferencedStorageIds({
        patients,
        chats,
        records: clinicalRecordState.records,
    });
    const assets = await exportAssets(storageIds);

    const backup = parseBackupV2({
        format: MEDIBRIEF_BACKUP_FORMAT,
        version: MEDIBRIEF_BACKUP_VERSION,
        exportedAt,
        activePatientId: patientState.activePatientId,
        patients,
        chats,
        legacyClinical: {
            data: cloneJson(legacyClinicalState.data),
            alerts: cloneJson(legacyClinicalState.alerts),
            dismissalHistory: cloneJson(
                legacyClinicalState.dismissalHistory,
            ),
        },
        clinicalRecords,
        assets,
    });

    return { backup, migrationReport };
};

export const downloadMediBriefBackup = (
    backup: MediBriefBackupV2,
): void => {
    const data = JSON.stringify(backup);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `medibrief-backup-v2-${backup.exportedAt.slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
};

const legacyPatientMetadata = (
    context: LegacyBackupV4_2['patients'][string],
): PatientMetadata => ({
    id: context.id,
    name: context.name,
    ...(context.mrn ? { mrn: context.mrn } : {}),
    status: context.status,
    entities: cloneJson(context.entities),
    demographics: cloneJson(context.demographics || {}),
    documents: cloneJson(context.documents),
    createdAt: context.createdAt,
    lastActive: context.lastActive,
});

const convertLegacyBackup = (
    legacy: LegacyBackupV4_2,
): PreparedBackupImport => {
    const convertedAt = new Date().toISOString();
    const patients: Record<string, PatientMetadata> = {};
    const chats: Record<string, BackupChatMessage[]> = {};
    const data: Record<string, ClinicalDataStore> = {};
    const alerts: Record<string, CDSSAlert[]> = {};

    Object.entries(legacy.patients).forEach(([patientId, context]) => {
        patients[patientId] = legacyPatientMetadata(context);
        chats[patientId] = context.chatHistory.map(message =>
            sanitizeChatMessage(message as ChatMessage),
        );
        data[patientId] = cloneJson(
            context.clinicalData || { observations: [] },
        );
        alerts[patientId] = cloneJson(context.activeAlerts || []);
    });

    const patientIds = Object.keys(patients);
    if (patientIds.length === 0) {
        throw new Error('The legacy backup does not contain any patient contexts.');
    }

    const warnings: string[] = [];
    const activePatientId = patients[legacy.activePatientId]
        ? legacy.activePatientId
        : patientIds[0];
    if (activePatientId !== legacy.activePatientId) {
        warnings.push(
            'The legacy active patient was missing; the first restored patient was selected instead.',
        );
    }

    const migration = migrateLegacyStoresToClinicalRecords({
        patients,
        clinicalData: data,
        migratedAt: convertedAt,
    });
    migration.report.warnings.forEach(warning => {
        warnings.push(`${warning.patientId}: ${warning.message}`);
    });

    const clinicalRecords = buildClinicalRecordExport(
        migration.records,
        convertedAt,
    );
    const storageIds = collectReferencedStorageIds({
        patients,
        chats,
        records: migration.records,
    });

    const backup = parseBackupV2({
        format: MEDIBRIEF_BACKUP_FORMAT,
        version: MEDIBRIEF_BACKUP_VERSION,
        exportedAt: convertedAt,
        activePatientId,
        patients,
        chats,
        legacyClinical: {
            data,
            alerts,
            dismissalHistory: Object.fromEntries(
                patientIds.map(patientId => [patientId, {}]),
            ),
        },
        clinicalRecords,
        assets: {
            files: {},
            missingStorageIds: storageIds,
        },
    });

    if (storageIds.length > 0) {
        warnings.push(
            'This v4.2 backup contains document references but not portable file payloads. Existing files with the same local storage IDs will be reused when available.',
        );
    }

    return {
        backup,
        sourceFormat: 'legacy-v4.2',
        migrationReport: migration.report,
        warnings,
    };
};

export const prepareMediBriefBackupImport = (
    input: unknown,
): PreparedBackupImport => {
    if (
        typeof input === 'object'
        && input !== null
        && 'format' in input
        && (input as { format?: unknown }).format === MEDIBRIEF_BACKUP_FORMAT
    ) {
        return {
            backup: parseBackupV2(input),
            sourceFormat: 'v2',
            warnings: [],
        };
    }

    return convertLegacyBackup(parseLegacyBackup(input));
};

export const prepareMediBriefBackupText = (
    json: string,
): PreparedBackupImport => {
    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        throw new Error('The selected file is not valid JSON.');
    }
    return prepareMediBriefBackupImport(parsed);
};

const restoreAssetSnapshot = async (
    incomingIds: string[],
    snapshots: Map<string, StoredFile | undefined>,
): Promise<void> => {
    for (const storageId of [...incomingIds].reverse()) {
        const previous = snapshots.get(storageId);
        try {
            if (previous) {
                await blobStorage.putFile(previous);
            } else {
                await blobStorage.deleteFile(storageId);
            }
        } catch (rollbackError) {
            console.error(
                `Unable to roll back asset ${storageId}.`,
                rollbackError,
            );
        }
    }
};

export const applyPreparedMediBriefBackup = async (
    prepared: PreparedBackupImport,
): Promise<BackupApplyResult> => {
    // Parse again immediately before mutation so callers cannot alter a prepared
    // object between validation and application.
    const backup = parseBackupV2(prepared.backup);

    const previousPatients = cloneJson(usePatientStore.getState().patients);
    const previousActivePatientId = usePatientStore.getState().activePatientId;
    const previousChats = cloneJson(useChatStore.getState().chats);
    const previousLegacyClinical = {
        data: cloneJson(useClinicalStore.getState().data),
        alerts: cloneJson(useClinicalStore.getState().alerts),
        dismissalHistory: cloneJson(
            useClinicalStore.getState().dismissalHistory,
        ),
    };
    const previousClinicalRecords = cloneJson(
        useClinicalRecordStore.getState().records,
    );

    const assetEntries = Object.entries(backup.assets.files);
    const assetSnapshots = new Map<string, StoredFile | undefined>();
    const writtenAssetIds: string[] = [];

    try {
        for (const [storageId, file] of assetEntries) {
            assetSnapshots.set(storageId, await blobStorage.getFile(storageId));
            await blobStorage.putFile(cloneJson(file));
            writtenAssetIds.push(storageId);
        }

        usePatientStore.setState({
            patients: cloneJson(backup.patients),
            activePatientId: backup.activePatientId,
        });
        useChatStore.setState({
            chats: cloneJson(backup.chats) as Record<string, ChatMessage[]>,
        });
        useClinicalStore.setState({
            data: cloneJson(backup.legacyClinical.data),
            alerts: cloneJson(backup.legacyClinical.alerts),
            dismissalHistory: cloneJson(
                backup.legacyClinical.dismissalHistory,
            ),
        });
        useClinicalRecordStore.setState({
            records: cloneJson(backup.clinicalRecords.records),
        });
    } catch (error) {
        usePatientStore.setState({
            patients: previousPatients,
            activePatientId: previousActivePatientId,
        });
        useChatStore.setState({ chats: previousChats });
        useClinicalStore.setState(previousLegacyClinical);
        useClinicalRecordStore.setState({
            records: previousClinicalRecords,
        });
        await restoreAssetSnapshot(writtenAssetIds, assetSnapshots);
        throw error;
    }

    const unresolvedAssetIds: string[] = [];
    for (const storageId of backup.assets.missingStorageIds) {
        try {
            if (!await blobStorage.getFile(storageId)) {
                unresolvedAssetIds.push(storageId);
            }
        } catch {
            unresolvedAssetIds.push(storageId);
        }
    }

    const warnings = [...prepared.warnings];
    if (unresolvedAssetIds.length > 0) {
        warnings.push(
            `${unresolvedAssetIds.length} referenced document asset(s) were not embedded and are not available in this browser's local asset vault. Their metadata was restored without inventing file contents.`,
        );
    }

    return {
        sourceFormat: prepared.sourceFormat,
        restoredPatients: Object.keys(backup.patients).length,
        restoredClinicalRecords: Object.keys(
            backup.clinicalRecords.records,
        ).length,
        restoredChats: Object.values(backup.chats)
            .reduce((total, messages) => total + messages.length, 0),
        restoredAssets: assetEntries.length,
        unresolvedAssetIds,
        warnings,
    };
};
