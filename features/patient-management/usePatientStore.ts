
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { PatientContext, PatientEntityData } from './types';
import { FHIRObservation } from '../fhir/types';
import { ChatMessage, GroundingSource } from '../../types';
import { CDSSAlert } from '../cdss/types';

// --- Default Data Factory ---
export const DEFAULT_PATIENT_ID = 'general-context';

export const createDefaultPatient = (): PatientContext => ({
    id: DEFAULT_PATIENT_ID,
    name: 'General Context',
    status: 'New Admission',
    documents: [],
    chatHistory: [],
    entities: { allergies: [], codeStatus: 'Full Code', diagnosis: [] },
    clinicalData: { observations: [] },
    activeAlerts: [],
    createdAt: Date.now(),
    lastActive: Date.now()
});

// --- State Definitions ---

export interface PatientState {
    patients: Record<string, PatientContext>;
    activePatientId: string;
}

export interface PatientActions {
    actions: {
        createPatient: (name?: string) => void;
        deletePatient: (id: string) => void;
        switchPatient: (id: string) => void;
        updatePatientDetails: (id: string, updates: Partial<PatientContext>) => void;
        updatePatientEntities: (id: string, entities: Partial<PatientEntityData>) => void;
        ingestClinicalData: (id: string, observations: FHIRObservation[]) => void;
        updateAlerts: (id: string, alerts: CDSSAlert[]) => void;
        dismissAlert: (id: string, alertId: string) => void;
        
        // Chat Actions
        startRequest: (userMessage: ChatMessage) => void;
        addResponsePlaceholder: () => void;
        appendToLastMessage: (chunk: string, sources?: GroundingSource[]) => void;
        requestFinish: () => void;
        addFullResponse: (message: ChatMessage) => void;
        updateLastMessageContent: (content: string) => void;
        requestFailed: (error: string) => void;
        addInterimMessage: (message: ChatMessage) => void;
        resetActiveChat: () => void;
    }
}

// --- ZUSTAND STORE IMPLEMENTATION ---

export const usePatientStore = create<PatientState & PatientActions>()(
    persist(
        (set, get) => ({
            patients: { [DEFAULT_PATIENT_ID]: createDefaultPatient() },
            activePatientId: DEFAULT_PATIENT_ID,

            actions: {
                createPatient: (name) => set((state) => {
                    const newId = uuidv4();
                    const newPatient: PatientContext = {
                        ...createDefaultPatient(),
                        id: newId,
                        name: name || `Patient ${Object.keys(state.patients).length + 1}`,
                        status: 'New Admission',
                    };
                    return {
                        patients: { ...state.patients, [newId]: newPatient },
                        activePatientId: newId
                    };
                }),

                deletePatient: (id) => set((state) => {
                    if (Object.keys(state.patients).length <= 1) return state;
                    const newPatients = { ...state.patients };
                    delete newPatients[id];
                    
                    let newActiveId = state.activePatientId;
                    if (state.activePatientId === id) {
                        newActiveId = Object.keys(newPatients)[0];
                    }
                    return { patients: newPatients, activePatientId: newActiveId };
                }),

                switchPatient: (id) => set({ activePatientId: id }),

                updatePatientDetails: (id, updates) => set((state) => {
                    if (!state.patients[id]) return state;
                    return {
                        patients: {
                            ...state.patients,
                            [id]: { ...state.patients[id], ...updates }
                        }
                    };
                }),

                updatePatientEntities: (id, entities) => set((state) => {
                    const target = state.patients[id];
                    if (!target) return state;

                    const newEntities = { ...target.entities };
                    if (entities.allergies) {
                        newEntities.allergies = [...new Set([...newEntities.allergies, ...entities.allergies])];
                    }
                    if (entities.codeStatus) newEntities.codeStatus = entities.codeStatus;
                    if (entities.diagnosis) {
                        newEntities.diagnosis = [...new Set([...newEntities.diagnosis, ...entities.diagnosis])];
                    }
                    
                    return {
                        patients: {
                            ...state.patients,
                            [id]: { ...target, entities: newEntities }
                        }
                    };
                }),

                ingestClinicalData: (id, observations) => set((state) => {
                    const target = state.patients[id];
                    if (!target) return state;

                    const existingObs = target.clinicalData?.observations || [];
                    const newObs = observations.filter(obs => 
                        !existingObs.some(ex => 
                            ex.code.text === obs.code.text && 
                            ex.valueQuantity?.value === obs.valueQuantity?.value &&
                            ex.effectiveDateTime === obs.effectiveDateTime
                        )
                    );

                    return {
                        patients: {
                            ...state.patients,
                            [id]: {
                                ...target,
                                clinicalData: {
                                    ...target.clinicalData,
                                    observations: [...existingObs, ...newObs]
                                }
                            }
                        }
                    };
                }),

                updateAlerts: (id, alerts) => set((state) => {
                    const target = state.patients[id];
                    if (!target) return state;

                    const currentAlerts = target.activeAlerts || [];
                    const newAlerts = alerts.filter(na => 
                        !currentAlerts.some(ca => ca.title === na.title && ca.timestamp > Date.now() - 3600000)
                    );

                    return {
                        patients: {
                            ...state.patients,
                            [id]: { ...target, activeAlerts: [...currentAlerts, ...newAlerts] }
                        }
                    };
                }),

                dismissAlert: (id, alertId) => set((state) => {
                    const target = state.patients[id];
                    if (!target) return state;

                    return {
                        patients: {
                            ...state.patients,
                            [id]: {
                                ...target,
                                activeAlerts: target.activeAlerts.filter(a => a.id !== alertId && a.ruleId !== alertId)
                            }
                        }
                    };
                }),

                // --- CHAT ACTIONS ---

                startRequest: (userMessage) => set((state) => {
                    const activeId = state.activePatientId;
                    const activePatient = state.patients[activeId];
                    return {
                        patients: {
                            ...state.patients,
                            [activeId]: {
                                ...activePatient,
                                chatHistory: [...activePatient.chatHistory, userMessage],
                                lastActive: Date.now()
                            }
                        }
                    };
                }),

                addResponsePlaceholder: () => set((state) => {
                    const activeId = state.activePatientId;
                    const activePatient = state.patients[activeId];
                    return {
                        patients: {
                            ...state.patients,
                            [activeId]: {
                                ...activePatient,
                                chatHistory: [...activePatient.chatHistory, { role: 'model', content: '' }]
                            }
                        }
                    };
                }),

                appendToLastMessage: (chunk, sources) => set((state) => {
                    const activeId = state.activePatientId;
                    const activePatient = state.patients[activeId];
                    const history = [...activePatient.chatHistory];
                    const lastMsg = history[history.length - 1];

                    if (lastMsg && lastMsg.role === 'model') {
                        lastMsg.content += chunk;
                        if (sources) {
                            const existing = lastMsg.sources || [];
                            const newSources = sources.filter(ns => 
                                !existing.some(es => 
                                    (es.web?.uri && es.web.uri === ns.web?.uri) || 
                                    (es.maps?.uri && es.maps.uri === ns.maps?.uri)
                                )
                            );
                            lastMsg.sources = [...existing, ...newSources];
                        }
                    }

                    return {
                        patients: {
                            ...state.patients,
                            [activeId]: { ...activePatient, chatHistory: history }
                        }
                    };
                }),

                requestFinish: () => {}, // No-op in Zustand, just for hook compatibility

                addFullResponse: (message) => set((state) => {
                    const activeId = state.activePatientId;
                    const activePatient = state.patients[activeId];
                    return {
                        patients: {
                            ...state.patients,
                            [activeId]: {
                                ...activePatient,
                                chatHistory: [...activePatient.chatHistory, message],
                                lastActive: Date.now()
                            }
                        }
                    };
                }),

                updateLastMessageContent: (content) => set((state) => {
                    const activeId = state.activePatientId;
                    const activePatient = state.patients[activeId];
                    const history = [...activePatient.chatHistory];
                    const lastMsg = history[history.length - 1];
                    if (lastMsg) lastMsg.content = content;

                    return {
                        patients: {
                            ...state.patients,
                            [activeId]: { ...activePatient, chatHistory: history }
                        }
                    };
                }),

                requestFailed: (error) => set((state) => {
                    const activeId = state.activePatientId;
                    const activePatient = state.patients[activeId];
                    const history = [...activePatient.chatHistory];
                    const lastMsg = history[history.length - 1];
                    const errorMsg = `Sorry, I encountered an error.\n\n**Details:** ${error}`;
                    
                    if (lastMsg && lastMsg.role === 'model' && !lastMsg.content) {
                        lastMsg.content = errorMsg;
                    } else {
                        history.push({ role: 'model', content: errorMsg });
                    }

                    return {
                        patients: {
                            ...state.patients,
                            [activeId]: { ...activePatient, chatHistory: history }
                        }
                    };
                }),

                addInterimMessage: (message) => set((state) => {
                    const activeId = state.activePatientId;
                    const activePatient = state.patients[activeId];
                    return {
                        patients: {
                            ...state.patients,
                            [activeId]: {
                                ...activePatient,
                                chatHistory: [...activePatient.chatHistory, message]
                            }
                        }
                    };
                }),

                resetActiveChat: () => set((state) => {
                    const activeId = state.activePatientId;
                    const activePatient = state.patients[activeId];
                    return {
                        patients: {
                            ...state.patients,
                            [activeId]: { ...activePatient, chatHistory: [] }
                        }
                    };
                })
            }
        }),
        {
            name: 'medibrief-storage',
            storage: createJSONStorage(() => sessionStorage),
            partialize: (state) => ({ 
                patients: state.patients, 
                activePatientId: state.activePatientId 
            }),
        }
    )
);
