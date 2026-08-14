// A lightweight wrapper for IndexedDB to store heavy binary assets (Images/PDFs).
// This prevents the "QuotaExceededError" in sessionStorage/localStorage.

import {
    encryptedSourceStorage,
    isEncryptedSourceStorageId,
    sha256Hex,
} from './encryptedSourceStorage';

const DB_NAME = 'MediBrief_AssetStore';
const STORE_NAME = 'files';
const DB_VERSION = 1;

export interface StoredFile {
    id: string;
    data: string; // Base64 string
    mimeType: string;
    timestamp: number;
}

const openDB = (): Promise<IDBDatabase> => {
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

        request.onerror = event => {
            reject((event.target as IDBOpenDBRequest).error);
        };
    });
};

const putStoredFile = async (file: StoredFile): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(file);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

const getStoredFile = async (
    id: string,
): Promise<StoredFile | undefined> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => resolve(
            request.result as StoredFile | undefined,
        );
        request.onerror = () => reject(request.error);
    });
};

const deleteStoredFile = async (id: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

const textToBase64 = (value: string): string => {
    const encoded = new TextEncoder().encode(value);
    let binary = '';
    const chunkSize = 32_768;
    for (let offset = 0; offset < encoded.length; offset += chunkSize) {
        binary += String.fromCharCode(
            ...encoded.subarray(offset, offset + chunkSize),
        );
    }
    return btoa(binary);
};

const base64ToText = (value: string): string => {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }
    return new TextDecoder().decode(bytes);
};

const saveEncryptedSourceAsset = async (
    file: StoredFile,
): Promise<void> => {
    const text = base64ToText(file.data);
    const storedAt = new Date(file.timestamp).toISOString();
    await encryptedSourceStorage.saveSource({
        id: file.id,
        text,
        fileName: 'preserved-fhir-source.json',
        mimeType: file.mimeType,
        sha256: await sha256Hex(text),
        byteLength: new TextEncoder().encode(text).byteLength,
        storedAt,
    });
};

export const blobStorage = {
    /**
     * Save a base64 string to IndexedDB. Protected FHIR source IDs are routed
     * into the encrypted source vault instead of the plaintext asset store.
     */
    saveFile: async (
        id: string,
        base64: string,
        mimeType: string,
    ): Promise<void> => {
        const file = {
            id,
            data: base64,
            mimeType,
            timestamp: Date.now(),
        };
        if (isEncryptedSourceStorageId(id)) {
            await saveEncryptedSourceAsset(file);
            return;
        }
        await putStoredFile(file);
    },

    /**
     * Restore an exact stored-file record, preserving its original timestamp.
     * Encrypted IPS source snapshots are re-encrypted under the active vault
     * key during restore.
     */
    putFile: async (file: StoredFile): Promise<void> => {
        if (isEncryptedSourceStorageId(file.id)) {
            await saveEncryptedSourceAsset(file);
            return;
        }
        await putStoredFile(file);
    },

    /**
     * Retrieve a base64 string by ID. Encrypted IPS source content is decrypted
     * only long enough to construct the explicit backup/download asset.
     */
    getFile: async (id: string): Promise<StoredFile | undefined> => {
        if (isEncryptedSourceStorageId(id)) {
            const source = await encryptedSourceStorage.getSource(id);
            return source ? {
                id,
                data: textToBase64(source.text),
                mimeType: source.mimeType,
                timestamp: Date.parse(source.storedAt),
            } : undefined;
        }
        return getStoredFile(id);
    },

    /**
     * Delete a file by ID.
     */
    deleteFile: async (id: string): Promise<void> => {
        if (isEncryptedSourceStorageId(id)) {
            await encryptedSourceStorage.deleteSource(id);
            return;
        }
        await deleteStoredFile(id);
    },

    /**
     * Prune ordinary transient files older than X milliseconds to keep the
     * asset DB healthy. Protected IPS evidence lives in a separate encrypted
     * database and is deliberately not touched by this transient-file policy.
     * Default: 24 hours.
     */
    pruneOldFiles: async (
        maxAgeMs: number = 24 * 60 * 60 * 1000,
    ): Promise<void> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.openCursor();
            const now = Date.now();

            request.onsuccess = event => {
                const cursor = (event.target as IDBRequest)
                    .result as IDBCursorWithValue;
                if (cursor) {
                    const file = cursor.value as StoredFile;
                    if (now - file.timestamp > maxAgeMs) {
                        cursor.delete();
                    }
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
    },
};
