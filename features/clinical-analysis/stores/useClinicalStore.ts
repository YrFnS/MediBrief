
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { FHIRObservation, ClinicalDataStore } from '../../fhir/types';
import { CDSSAlert } from '../../cdss/types';
import { indexedDBStorage } from '../../../services/storage';

interface ClinicalState {
    data: Record<string, ClinicalDataStore>;
    alerts: Record<string, CDSSAlert[]>;
    // Tracks when a specific Rule ID was last dismissed for a patient
    // Structure: { [patientId]: { [ruleId]: timestamp } }
    dismissalHistory: Record<string, Record<string, number>>;
}

interface ClinicalActions {
    actions: {
        initializePatient: (patientId: string) => void;
        deletePatient: (patientId: string) => void;
        
        ingestObservations: (patientId: string, observations: FHIRObservation[]) => void;
        updateAlerts: (patientId: string, alerts: CDSSAlert[]) => void;
        dismissAlert: (patientId: string, alertId: string, ruleId: string) => void;
    }
}

// Duration to suppress a dismissed alert (e.g., 6 hours)
const ALERT_SUPPRESSION_MS = 6 * 60 * 60 * 1000;

export const useClinicalStore = create<ClinicalState & ClinicalActions>()(
    persist(
        (set, get) => ({
            data: {},
            alerts: {},
            dismissalHistory: {},
            
            actions: {
                initializePatient: (patientId) => set((state) => {
                    if (state.data[patientId]) return state;
                    return {
                        data: { ...state.data, [patientId]: { observations: [] } },
                        alerts: { ...state.alerts, [patientId]: [] },
                        dismissalHistory: { ...state.dismissalHistory, [patientId]: {} }
                    };
                }),
                deletePatient: (patientId) => set((state) => {
                    const newData = { ...state.data };
                    const newAlerts = { ...state.alerts };
                    const newHistory = { ...state.dismissalHistory };
                    
                    delete newData[patientId];
                    delete newAlerts[patientId];
                    delete newHistory[patientId];
                    
                    return { data: newData, alerts: newAlerts, dismissalHistory: newHistory };
                }),
                
                ingestObservations: (patientId, observations) => set((state) => {
                    const currentStore = state.data[patientId] || { observations: [] };
                    const existingObs = currentStore.observations;
                    
                    // Deduplication Logic
                    const newObs = observations.filter(obs => 
                        !existingObs.some(ex => 
                            ex.code.text === obs.code.text && 
                            ex.valueQuantity?.value === obs.valueQuantity?.value &&
                            ex.effectiveDateTime === obs.effectiveDateTime
                        )
                    );

                    return {
                        data: {
                            ...state.data,
                            [patientId]: {
                                ...currentStore,
                                observations: [...existingObs, ...newObs]
                            }
                        }
                    };
                }),

                updateAlerts: (patientId, incomingAlerts) => set((state) => {
                    const currentAlerts = state.alerts[patientId] || [];
                    const patientHistory = state.dismissalHistory[patientId] || {};
                    const now = Date.now();

                    // Filter 1: Remove alerts that are currently active (prevent duplicate entries of same alert)
                    // Filter 2: Remove alerts that were dismissed recently (Cooldown check)
                    const newAlerts = incomingAlerts.filter(na => {
                        const isAlreadyActive = currentAlerts.some(ca => ca.ruleId === na.ruleId);
                        if (isAlreadyActive) return false;

                        const lastDismissed = patientHistory[na.ruleId];
                        if (lastDismissed && (now - lastDismissed < ALERT_SUPPRESSION_MS)) {
                            // Suppress this alert
                            return false;
                        }
                        return true;
                    });

                    if (newAlerts.length === 0) return state;

                    return {
                        alerts: {
                            ...state.alerts,
                            [patientId]: [...currentAlerts, ...newAlerts]
                        }
                    };
                }),

                dismissAlert: (patientId, alertId, ruleId) => set((state) => {
                    const currentAlerts = state.alerts[patientId] || [];
                    const patientHistory = state.dismissalHistory[patientId] || {};

                    return {
                        alerts: {
                            ...state.alerts,
                            [patientId]: currentAlerts.filter(a => a.id !== alertId)
                        },
                        dismissalHistory: {
                            ...state.dismissalHistory,
                            [patientId]: {
                                ...patientHistory,
                                [ruleId]: Date.now() // Record dismissal time
                            }
                        }
                    };
                })
            }
        }),
        {
            name: 'medibrief-clinical-storage',
            storage: createJSONStorage(() => indexedDBStorage),
            skipHydration: true, // WAIT FOR SECURITY GATE
        }
    )
);
