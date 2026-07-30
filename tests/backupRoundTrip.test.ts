import { beforeEach, describe, expect, it, vi } from 'vitest';
import { blobStorage } from '../services/blobStorageService';
import { useChatStore } from '../features/chat/stores/useChatStore';
import { useClinicalStore } from '../features/clinical-analysis/stores/useClinicalStore';
import {
    applyPreparedMediBriefBackup,
    createMediBriefBackupV2,
    MediBriefBackupV2Schema,
    prepareMediBriefBackupImport,
    useClinicalRecordStore,
} from '../features/clinical-record';
import type { PatientMetadata } from '../features/patient-management/types';
import { usePatientStore } from '../features/patient-management/usePatientStore';
import { FIXED_TIME, makePatientRecord } from './fixtures';

const patient = (
    name = 'Backup Patient',
    documents: PatientMetadata['documents'] = [],
): PatientMetadata => ({
    id: 'patient-1',
    name,
    status: 'Stable',
    entities: {
        allergies: [],
        codeStatus: '',
        diagnosis: [],
    },
    demographics: {},
    documents,
    createdAt: Date.parse(FIXED_TIME),
    lastActive: Date.parse(FIXED_TIME),
});

const setBaselineStores = (name = 'Backup Patient') => {
    usePatientStore.setState({
        patients: {
            'patient-1': patient(name, [{
                storageId: 'roundtrip-asset',
                name: 'report.txt',
                type: 'text/plain',
                uploadedAt: Date.parse(FIXED_TIME),
            }]),
        },
        activePatientId: 'patient-1',
    });
    useChatStore.setState({
        chats: {
            'patient-1': [{ role: 'user', content: 'Persist this chat' }],
        },
    });
    useClinicalStore.setState({
        data: { 'patient-1': { observations: [] } },
        alerts: { 'patient-1': [] },
        dismissalHistory: { 'patient-1': {} },
    });
    useClinicalRecordStore.setState({
        records: { 'patient-1': makePatientRecord() },
    });
};

describe('backup v2 transaction', () => {
    beforeEach(async () => {
        setBaselineStores();
        await blobStorage.deleteFile('roundtrip-asset');
        await blobStorage.deleteFile('rollback-asset-a');
        await blobStorage.deleteFile('rollback-asset-b');
    });

    it('round-trips stores and portable file assets', async () => {
        await blobStorage.saveFile(
            'roundtrip-asset',
            'cG9ydGFibGUgY29udGVudA==',
            'text/plain',
        );
        const { backup } = await createMediBriefBackupV2();

        expect(backup.assets.files['roundtrip-asset']?.data)
            .toBe('cG9ydGFibGUgY29udGVudA==');

        setBaselineStores('Mutated Patient');
        useChatStore.setState({ chats: { 'patient-1': [] } });
        await blobStorage.deleteFile('roundtrip-asset');

        const result = await applyPreparedMediBriefBackup(
            prepareMediBriefBackupImport(backup),
        );

        expect(result.restoredPatients).toBe(1);
        expect(result.restoredAssets).toBe(1);
        expect(result.unresolvedAssetIds).toEqual([]);
        expect(usePatientStore.getState().patients['patient-1'].name)
            .toBe('Backup Patient');
        expect(useChatStore.getState().chats['patient-1'][0]?.content)
            .toBe('Persist this chat');
        expect((await blobStorage.getFile('roundtrip-asset'))?.data)
            .toBe('cG9ydGFibGUgY29udGVudA==');
    });

    it('restores store and overwritten asset snapshots when apply fails', async () => {
        setBaselineStores('Current Patient');
        await blobStorage.saveFile(
            'rollback-asset-a',
            'b3JpZ2luYWw=',
            'text/plain',
        );

        const { backup: exported } = await createMediBriefBackupV2();
        const failingBackup = MediBriefBackupV2Schema.parse({
            ...exported,
            patients: {
                'patient-1': {
                    ...exported.patients['patient-1'],
                    name: 'Incoming Patient',
                    documents: [],
                },
            },
            clinicalRecords: {
                ...exported.clinicalRecords,
                records: {
                    'patient-1': makePatientRecord(),
                },
            },
            assets: {
                files: {
                    'rollback-asset-a': {
                        id: 'rollback-asset-a',
                        data: 'aW5jb21pbmc=',
                        mimeType: 'text/plain',
                        timestamp: Date.parse(FIXED_TIME),
                    },
                    'rollback-asset-b': {
                        id: 'rollback-asset-b',
                        data: 'ZmFpbA==',
                        mimeType: 'text/plain',
                        timestamp: Date.parse(FIXED_TIME),
                    },
                },
                missingStorageIds: [],
            },
        });

        const originalPut = blobStorage.putFile.bind(blobStorage);
        vi.spyOn(blobStorage, 'putFile')
            .mockImplementationOnce(file => originalPut(file))
            .mockRejectedValueOnce(new Error('simulated asset failure'));

        await expect(applyPreparedMediBriefBackup({
            backup: failingBackup,
            sourceFormat: 'v2',
            warnings: [],
        })).rejects.toThrow('simulated asset failure');

        expect(usePatientStore.getState().patients['patient-1'].name)
            .toBe('Current Patient');
        expect((await blobStorage.getFile('rollback-asset-a'))?.data)
            .toBe('b3JpZ2luYWw=');
        expect(await blobStorage.getFile('rollback-asset-b'))
            .toBeUndefined();
    });
});
