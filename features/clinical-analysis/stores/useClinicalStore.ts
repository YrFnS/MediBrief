
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { FHIRObservation, ClinicalDataStore } from '../../fhir/types';
import { CDSSAlert } from '../../cdss/types';
import { indexedDBStorage } from '../../../services/storage';

interface ClinicalState {
    data: Record<string, ClinicalDataStore>;
    alerts: Record<string, CDSSAlert[]>;
}

interface ClinicalActions {
    actions: {
        initializePatient: (patientId: string) => void;
        deletePatient: (patientId: string) => void;
        
        ingestObservations: (patientId: string, observations: FHIRObservation[]) => void;
        updateAlerts: (patientId: string, alerts: CDSSAlert[]) => void;
        dismissAlert: (patientId: string, alertId: string) => void;
    }
}

export const useClinicalStore = create<ClinicalState & ClinicalActions>()(
    persist(
        (set) => ({
            data: {},
            alerts: {},
            actions: {
                initializePatient: (patientId) => set((state) => {
                    if (state.data[patientId]) return state;
                    return {
                        data: { ...state.data, [patientId]: { observations: [] } },
                        alerts: { ...state.alerts, [patientId]: [] }
                    };
                }),
                deletePatient: (patientId) => set((state) => {
                    const newData = { ...state.data };
                    const newAlerts = { ...state.alerts };
                    delete newData[patientId];
                    delete newAlerts[patientId];
                    return { data: newData, alerts: newAlerts };
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
                    
                    // Dedup alerts by title/timeframe
                    const newAlerts = incomingAlerts.filter(na => 
                        !currentAlerts.some(ca => ca.title === na.title && ca.timestamp > Date.now() - 3600000)
                    );

                    return {
                        alerts: {
                            ...state.alerts,
                            [patientId]: [...currentAlerts, ...newAlerts]
                        }
                    };
                }),

                dismissAlert: (patientId, alertId) => set((state) => {
                    const currentAlerts = state.alerts[patientId] || [];
                    return {
                        alerts: {
                            ...state.alerts,
                            [patientId]: currentAlerts.filter(a => a.id !== alertId && a.ruleId !== alertId)
                        }
                    };
                })
            }
        }),
        {
            name: 'medibrief-clinical-storage',
            storage: createJSONStorage(() => indexedDBStorage),
        }
    )
);
