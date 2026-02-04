
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { AuditEvent, AuditEventType, AuditActor } from './types';
import { indexedDBStorage } from '../../services/storage';

interface AuditState {
    logs: AuditEvent[];
}

interface AuditActions {
    actions: {
        logEvent: (
            type: AuditEventType,
            patientId: string,
            details: string,
            actor: AuditActor,
            metadata?: Record<string, any>
        ) => void;
        getLogsByPatient: (patientId: string) => AuditEvent[];
        exportLogs: () => void;
    }
}

export const useAuditStore = create<AuditState & AuditActions>()(
    persist(
        (set, get) => ({
            logs: [],
            actions: {
                logEvent: (type, patientId, details, actor, metadata) => {
                    const newLog: AuditEvent = {
                        id: uuidv4(),
                        timestamp: Date.now(),
                        type,
                        patientId,
                        actor,
                        details,
                        metadata
                    };

                    set((state) => ({
                        logs: [...state.logs, newLog]
                    }));

                    // Optional: Console log in dev mode for visibility
                    if (process.env.NODE_ENV === 'development') {
                        console.debug(`[AUDIT] ${type}:`, details);
                    }
                },
                getLogsByPatient: (patientId) => {
                    return get().logs.filter(l => l.patientId === patientId).sort((a, b) => b.timestamp - a.timestamp);
                },
                exportLogs: () => {
                    const logs = get().logs;
                    const dataStr = JSON.stringify(logs, null, 2);
                    const blob = new Blob([dataStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `medibrief-audit-logs-${new Date().toISOString().split('T')[0]}.json`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }
            }
        }),
        {
            name: 'medibrief-audit-storage',
            storage: createJSONStorage(() => indexedDBStorage),
            skipHydration: true, // Wait for SecurityGate
            partialize: (state) => ({ logs: state.logs }),
            version: 1, // Bump version
            migrate: (persistedState: any, version: number) => {
                if (version === 0) return { logs: [] } as any;
                return persistedState;
            }
        }
    )
);
