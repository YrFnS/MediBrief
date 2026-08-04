import { describe, expect, it } from 'vitest';
import {
    getSourcePreviewKind,
    parseClinicalRecordResource,
    resolveDocumentSource,
    sourceFileUnavailableMessage,
    type DocumentReferenceRecord,
} from '../features/clinical-record';
import { FIXED_TIME, makePatientRecord } from './fixtures';

const documentRecord = (): DocumentReferenceRecord =>
    parseClinicalRecordResource({
        id: 'document-resource-1',
        patientId: 'patient-1',
        resourceType: 'DocumentReference',
        verificationStatus: 'confirmed',
        recordedAt: FIXED_TIME,
        provenance: {
            source: {
                kind: 'manual',
                description: 'Test upload',
            },
            createdAt: FIXED_TIME,
            updatedAt: FIXED_TIME,
        },
        amendments: [],
        status: 'current',
        storageId: 'asset-storage-1',
        fileName: 'report.pdf',
        mimeType: 'application/pdf',
        uploadedAt: FIXED_TIME,
        relatedResources: [],
    }) as DocumentReferenceRecord;

describe('source document resolution', () => {
    it('resolves both durable resource IDs and stable storage IDs', () => {
        const record = makePatientRecord();
        record.resources.documents = [documentRecord()];

        expect(resolveDocumentSource(record, {
            documentId: 'document-resource-1',
        })).toMatchObject({
            storageId: 'asset-storage-1',
            fileName: 'report.pdf',
            mimeType: 'application/pdf',
        });

        expect(resolveDocumentSource(record, {
            documentId: 'asset-storage-1',
        })).toMatchObject({
            storageId: 'asset-storage-1',
            fileName: 'report.pdf',
            mimeType: 'application/pdf',
        });
    });

    it('preserves source metadata when the durable document record is missing', () => {
        expect(resolveDocumentSource(undefined, {
            documentId: 'missing-asset',
            fileName: 'missing.txt',
        })).toEqual({
            storageId: 'missing-asset',
            fileName: 'missing.txt',
            mimeType: 'application/octet-stream',
        });
        expect(sourceFileUnavailableMessage('missing-asset'))
            .toContain('missing-asset');
    });

    it.each([
        ['image/png', 'image'],
        ['application/pdf', 'embedded'],
        ['text/plain', 'embedded'],
        ['application/json', 'embedded'],
        ['application/dicom', 'download'],
    ] as const)('maps %s to %s preview behavior', (mimeType, expected) => {
        expect(getSourcePreviewKind(mimeType)).toBe(expected);
    });
});
