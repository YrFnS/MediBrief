import { describe, expect, it } from 'vitest';
import {
    CLINICAL_RECORD_EXPORT_FORMAT,
    CLINICAL_RECORD_EXPORT_VERSION,
    MEDIBRIEF_BACKUP_FORMAT,
    MEDIBRIEF_BACKUP_VERSION,
    MediBriefBackupV2Schema,
    prepareMediBriefBackupImport,
} from '../features/clinical-record';
import { FIXED_TIME, makePatientRecord } from './fixtures';

const patientMetadata = (documents: Array<{
    storageId: string;
    name: string;
    type: string;
    uploadedAt: number;
}> = []) => ({
    id: 'patient-1',
    name: 'Test Patient',
    status: 'Stable' as const,
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

const baseBackup = () => ({
    format: MEDIBRIEF_BACKUP_FORMAT,
    version: MEDIBRIEF_BACKUP_VERSION,
    exportedAt: FIXED_TIME,
    activePatientId: 'patient-1',
    patients: {
        'patient-1': patientMetadata(),
    },
    chats: {
        'patient-1': [],
    },
    legacyClinical: {
        data: {
            'patient-1': { observations: [] },
        },
        alerts: {
            'patient-1': [],
        },
        dismissalHistory: {
            'patient-1': {},
        },
    },
    clinicalRecords: {
        format: CLINICAL_RECORD_EXPORT_FORMAT,
        exportVersion: CLINICAL_RECORD_EXPORT_VERSION,
        exportedAt: FIXED_TIME,
        records: {
            'patient-1': makePatientRecord(),
        },
    },
    assets: {
        files: {},
        missingStorageIds: [],
    },
});

describe('backup v2 validation', () => {
    it('accepts a complete patient-scoped backup', () => {
        expect(MediBriefBackupV2Schema.safeParse(baseBackup()).success)
            .toBe(true);
    });

    it('rejects an active patient missing from the roster', () => {
        const backup = baseBackup();
        backup.activePatientId = 'missing-patient';

        expect(MediBriefBackupV2Schema.safeParse(backup).success)
            .toBe(false);
    });

    it('requires every referenced asset to be embedded or explicitly missing', () => {
        const backup = baseBackup();
        backup.patients['patient-1'].documents = [{
            storageId: 'asset-1',
            name: 'report.pdf',
            type: 'application/pdf',
            uploadedAt: Date.parse(FIXED_TIME),
        }];

        expect(MediBriefBackupV2Schema.safeParse(backup).success)
            .toBe(false);

        backup.assets.missingStorageIds = ['asset-1'];
        expect(MediBriefBackupV2Schema.safeParse(backup).success)
            .toBe(true);
    });

    it('rejects a clinical-record map key that does not match the patient', () => {
        const backup = baseBackup();
        backup.clinicalRecords.records['patient-1'] = {
            ...makePatientRecord('patient-2'),
        };

        expect(MediBriefBackupV2Schema.safeParse(backup).success)
            .toBe(false);
    });
});

describe('legacy v4.2 preparation', () => {
    it('converts legacy facts into a validated v2 envelope before apply', () => {
        const prepared = prepareMediBriefBackupImport({
            version: '4.2',
            activePatientId: 'patient-1',
            patients: {
                'patient-1': {
                    ...patientMetadata(),
                    entities: {
                        allergies: ['Penicillin'],
                        codeStatus: 'Full Code',
                        diagnosis: ['Asthma'],
                    },
                    chatHistory: [{
                        role: 'user',
                        content: 'Legacy message',
                    }],
                    clinicalData: {
                        observations: [],
                    },
                    activeAlerts: [],
                },
            },
        });

        expect(prepared.sourceFormat).toBe('legacy-v4.2');
        expect(MediBriefBackupV2Schema.safeParse(prepared.backup).success)
            .toBe(true);
        const record = prepared.backup.clinicalRecords.records['patient-1'];
        expect(record.resources.conditions[0]?.verificationStatus)
            .toBe('candidate');
        expect(record.resources.allergies[0]?.verificationStatus)
            .toBe('candidate');
        expect(prepared.backup.chats['patient-1'][0]?.content)
            .toBe('Legacy message');
    });
});
