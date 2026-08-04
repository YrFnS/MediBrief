import type {
    DocumentReferenceRecord,
    PatientClinicalRecord,
    SourceDocumentReference,
} from './types';

export type SourcePreviewKind = 'image' | 'embedded' | 'download';

export interface ResolvedDocumentSource {
    documentRecord?: DocumentReferenceRecord;
    storageId: string;
    fileName: string;
    mimeType: string;
}

/**
 * Resolves candidate provenance against the patient's durable document list.
 * Extractors may store either the DocumentReference resource ID or its stable
 * local storage ID, so both are supported deliberately.
 */
export const resolveDocumentSource = (
    record: PatientClinicalRecord | undefined,
    source: SourceDocumentReference,
): ResolvedDocumentSource => {
    const documentRecord = record?.resources.documents.find(document =>
        document.id === source.documentId
        || document.storageId === source.documentId,
    );

    return {
        ...(documentRecord ? { documentRecord } : {}),
        storageId: documentRecord?.storageId || source.documentId,
        fileName: documentRecord?.fileName
            || source.fileName
            || 'Source document',
        mimeType: documentRecord?.mimeType || 'application/octet-stream',
    };
};

export const getSourcePreviewKind = (
    mimeType: string,
): SourcePreviewKind => {
    if (mimeType.startsWith('image/')) return 'image';
    if (
        mimeType === 'application/pdf'
        || mimeType.startsWith('text/')
        || mimeType === 'application/json'
    ) return 'embedded';
    return 'download';
};

export const sourceFileUnavailableMessage = (
    storageId: string,
): string =>
    `The source metadata is available, but file ${storageId} is not present in this browser’s local asset vault.`;
