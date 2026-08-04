import { beforeEach, describe, expect, it } from 'vitest';
import { blobStorage } from '../services/blobStorageService';
import { useChatStore } from '../features/chat/stores/useChatStore';
import { useClinicalStore } from '../features/clinical-analysis/stores/useClinicalStore';
import {
    applyPreparedMediBriefBackup,
    CLINICAL_RECORD_EXPORT_FORMAT,
    CLINICAL_RECORD_EXPORT_VERSION,
    MEDIBRIEF_BACKUP_FORMAT,
    MEDIBRIEF_BACKUP_VERSION,
    MediBriefBackupV2Schema,
    useClinicalRecordStore,
} from '../features/clinical-record';
import { usePatientStore } from '../features/patient-management/usePatientStore';
import { FIXED_TIME, makePatientRecord } from './fixtures';

describe('missing backup assets', () => {
    beforeEach(async () => {
        await blobStorage.deleteFile('missing-source-asset');
    });

    it('restores metadata and reports unresolved file payloads explicitly', async () => {
        const record = makePatientRecord();
        const backup = MediBriefBackupV2Schema.parse({
            format: MEDIBRIEF_BACKUP_FORMAT,
            version: MEDIBRIEF_BACKUP_VERSION,
            exportedAt: FIXED_TIME,
            activePatientId: 'patient-1',
            patients: {
                'patient-1': {
                    id: 'patient-1',
                    name: 'Test Patient',
                    status: 'Stable',
                    entities: {
                        allergies: [],
                        codeStatus: '',
                        diagnosis: [],
                    },
                    demographics: {},
                    documents: [{
                        storageId: 'missing-source-asset',
                        name: 'missing.pdf',
                        type: 'application/pdf',
                        uploadedAt: Date.parse(FIXED_TIME),
                    }],
                    createdAt: Date.parse(FIXED_TIME),
                    lastActive: Date.parse(FIXED_TIME),
                },
            },
            chats: { 'patient-1': [] },
            legacyClinical: {
                data: { 'patient-1': { observations: [] } },
                alerts: { 'patient-1': [] },
                dismissalHistory: { 'patient-1': {} },
            },
            clinicalRecords: {
                format: CLINICAL_RECORD_EXPORT_FORMAT,
                exportVersion: CLINICAL_RECORD_EXPORT_VERSION,
                exportedAt: FIXED_TIME,
                records: { 'patient-1': record },
            },
            assets: {
                files: {},
                missingStorageIds: ['missing-source-asset'],
            },
        });

        const result = await applyPreparedMediBriefBackup({
            backup: backup as any,
            sourceFormat: 'v2',
            warnings: [],
        });

        expect(result.unresolvedAssetIds).toEqual(['missing-source-asset']);
        expect(result.warnings[0]).toContain('metadata was restored');
        expect(usePatientStore.getState().patients['patient-1'].documents[0].name)
            .toBe('missing.pdf');
        expect(useChatStore.getState().chats['patient-1']).toEqual([]);
        expect(useClinicalStore.getState().data['patient-1'].observations)
            .toEqual([]);
        expect(useClinicalRecordStore.getState().records['patient-1'])
            .toBeDefined();
    });
});
