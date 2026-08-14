import { encryptionService } from './encryptionService';

const DB_NAME = 'MediBrief_EncryptedSourceStore';
const STORE_NAME = 'sources';
const DB_VERSION = 1;

export const ENCRYPTED_SOURCE_STORAGE_PREFIX =
    'medibrief-encrypted-source:';

export interface EncryptedSourceInput {
    id: string;
    text: string;
    fileName: string;
    mimeType: string;
    sha256: string;
    byteLength: number;
    storedAt: string;
}

interface StoredEncryptedSource {
    id: string;
    encryptedPayload: string;
    fileName: string;
    mimeType: string;
    sha256: string;
    byteLength: number;
    storedAt: string;
}

export interface DecryptedSourceDocument {
    id: string;
    text: string;
    fileName: string;
    mimeType: string;
    sha256: string;
    byteLength: number;
    storedAt: string;
}

const bytes = (value: string): number =>
    new TextEncoder().encode(value).byteLength;

const toHex = (buffer: ArrayBuffer): string =>
    [...new Uint8Array(buffer)]
        .map(value => value.toString(16).padStart(2, '0'))
        .join('');

export const sha256Hex = async (value: string): Promise<string> => {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
        throw new Error(
            'SHA-256 is unavailable in this runtime; source evidence was not stored.',
        );
    }
    return toHex(await subtle.digest(
        'SHA-256',
        new TextEncoder().encode(value),
    ));
};

export const isEncryptedSourceStorageId = (value: string): boolean =>
    value.startsWith(ENCRYPTED_SOURCE_STORAGE_PREFIX);

const openDB = (): Promise<IDBDatabase> => {
    if (!globalThis.indexedDB) {
        return Promise.reject(new Error(
            'IndexedDB is unavailable; source evidence was not stored.',
        ));
    }

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = event => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = event => {
            resolve((event.target as IDBOpenDBRequest).result);
        };
        request.onerror = () => reject(request.error);
    });
};

const put = async (source: StoredEncryptedSource): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const request = transaction.objectStore(STORE_NAME).put(source);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

const get = async (
    id: string,
): Promise<StoredEncryptedSource | undefined> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const request = transaction.objectStore(STORE_NAME).get(id);
        request.onsuccess = () => resolve(
            request.result as StoredEncryptedSource | undefined,
        );
        request.onerror = () => reject(request.error);
    });
};

const remove = async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const request = transaction.objectStore(STORE_NAME).delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const encryptedSourceStorage = {
    saveSource: async (input: EncryptedSourceInput): Promise<void> => {
        if (!isEncryptedSourceStorageId(input.id)) {
            throw new Error('Encrypted source storage ID is invalid.');
        }
        if (!encryptionService.hasKey()) {
            throw new Error(
                'The local vault is locked; source evidence was not stored.',
            );
        }

        const byteLength = bytes(input.text);
        const sha256 = await sha256Hex(input.text);
        if (byteLength !== input.byteLength || sha256 !== input.sha256) {
            throw new Error(
                'Source evidence changed after preview; import was cancelled.',
            );
        }

        await put({
            id: input.id,
            encryptedPayload: await encryptionService.encrypt(input.text),
            fileName: input.fileName,
            mimeType: input.mimeType,
            sha256,
            byteLength,
            storedAt: input.storedAt,
        });
    },

    getSource: async (
        id: string,
    ): Promise<DecryptedSourceDocument | undefined> => {
        const stored = await get(id);
        if (!stored) return undefined;
        if (!encryptionService.hasKey()) {
            throw new Error('The local vault is locked.');
        }

        const text = await encryptionService.decrypt(
            stored.encryptedPayload,
        );
        if (text === null) {
            throw new Error(
                'Encrypted source evidence could not be decrypted.',
            );
        }

        const byteLength = bytes(text);
        const sha256 = await sha256Hex(text);
        if (
            byteLength !== stored.byteLength
            || sha256 !== stored.sha256
        ) {
            throw new Error(
                'Encrypted source evidence failed integrity verification.',
            );
        }

        return {
            id: stored.id,
            text,
            fileName: stored.fileName,
            mimeType: stored.mimeType,
            sha256,
            byteLength,
            storedAt: stored.storedAt,
        };
    },

    deleteSource: remove,
};
