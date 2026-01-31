
import { get, set, del } from 'idb-keyval';
import { StateStorage } from 'zustand/middleware';

// Custom Storage Engine for Zustand that uses IndexedDB (Async)
// This bypasses the 5MB limit of localStorage/sessionStorage
export const indexedDBStorage: StateStorage = {
    getItem: async (name: string): Promise<string | null> => {
        return (await get(name)) || null;
    },
    setItem: async (name: string, value: string): Promise<void> => {
        await set(name, value);
    },
    removeItem: async (name: string): Promise<void> => {
        await del(name);
    },
};
