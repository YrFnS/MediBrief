
import { get, set, del } from 'idb-keyval';
import { StateStorage } from 'zustand/middleware';
import { encryptionService } from './encryptionService';

// Custom Storage Engine for Zustand that uses IndexedDB (Async)
// This bypasses the 5MB limit of localStorage/sessionStorage
// AND implements transparent encryption via EncryptionService.

export const indexedDBStorage: StateStorage = {
    getItem: async (name: string): Promise<string | null> => {
        const raw = await get(name);
        if (!raw) return null;

        // Check if data is encrypted (JSON with 'iv' and 'data')
        if (typeof raw === 'string' && raw.includes('"iv":') && raw.includes('"data":') && raw.includes('"v":1')) {
            if (encryptionService.hasKey()) {
                try {
                    return await encryptionService.decrypt(raw);
                } catch (e) {
                    console.error("Failed to decrypt storage item:", name);
                    return null;
                }
            } else {
                // Return null if locked to prevent Zustand from hydrating with garbage/crashing
                // The SecurityGate will trigger rehydration once unlocked.
                return null;
            }
        }

        // Legacy/Plaintext Fallback
        return raw;
    },
    
    setItem: async (name: string, value: string): Promise<void> => {
        if (encryptionService.hasKey()) {
            const encrypted = await encryptionService.encrypt(value);
            await set(name, encrypted);
        } else {
            // If we are here, it means we are writing data WITHOUT a key.
            // This happens during initial setup before a PIN is set.
            // OR if the app is somehow used in an unlocked state (should be prevented by SecurityGate).
            await set(name, value);
        }
    },
    
    removeItem: async (name: string): Promise<void> => {
        await del(name);
    },
};
