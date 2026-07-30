// A lightweight wrapper for IndexedDB to store heavy binary assets (Images/PDFs).
// This prevents the "QuotaExceededError" in sessionStorage/localStorage.

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

export const blobStorage = {
    /**
     * Save a base64 string to IndexedDB.
     */
    saveFile: async (
        id: string,
        base64: string,
        mimeType: string,
    ): Promise<void> => {
        await putStoredFile({
            id,
            data: base64,
            mimeType,
            timestamp: Date.now(),
        });
    },

    /**
     * Restore an exact stored-file record, preserving its original timestamp.
     */
    putFile: async (file: StoredFile): Promise<void> => {
        await putStoredFile(file);
    },

    /**
     * Retrieve a base64 string by ID.
     */
    getFile: async (id: string): Promise<StoredFile | undefined> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Delete a file by ID.
     */
    deleteFile: async (id: string): Promise<void> => {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    /**
     * Prune files older than X milliseconds to keep DB healthy.
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
