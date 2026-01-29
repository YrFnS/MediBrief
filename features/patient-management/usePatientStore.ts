
import React, { useReducer, useEffect, useContext, createContext } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PatientContext, PatientEntityData } from './types';
import { FHIRObservation } from '../fhir/types';
import { ChatMessage, GroundingSource } from '../../types';
import { CDSSAlert } from '../cdss/types';

// --- State Definitions ---

export interface PatientStoreState {
    patients: Record<string, PatientContext>;
    activePatientId: string;
}

// --- Actions ---

export type PatientAction =
    | { type: 'CREATE_PATIENT'; payload: { name?: string } }
    | { type: 'DELETE_PATIENT'; payload: { id: string } }
    | { type: 'SWITCH_PATIENT'; payload: { id: string } }
    | { type: 'UPDATE_PATIENT_DETAILS'; payload: { id: string; updates: Partial<PatientContext> } }
    | { type: 'UPDATE_PATIENT_ENTITIES'; payload: { id: string; entities: Partial<PatientEntityData> } }
    | { type: 'INGEST_CLINICAL_DATA'; payload: { id: string; observations: FHIRObservation[] } }
    | { type: 'UPDATE_ALERTS'; payload: { id: string; alerts: CDSSAlert[] } }
    | { type: 'DISMISS_ALERT'; payload: { id: string; alertId: string } }
    | { type: 'START_REQUEST'; payload: { userMessage: ChatMessage } }
    | { type: 'ADD_RESPONSE_PLACEHOLDER' }
    | { type: 'APPEND_TO_LAST_MESSAGE'; payload: { chunk: string; sources?: GroundingSource[] } }
    | { type: 'REQUEST_FINISH' }
    | { type: 'ADD_FULL_RESPONSE'; payload: { message: ChatMessage } }
    | { type: 'UPDATE_LAST_MESSAGE_CONTENT'; payload: string }
    | { type: 'REQUEST_FAILED'; payload: string }
    | { type: 'ADD_INTERIM_MESSAGE'; payload: ChatMessage }
    | { type: 'RESET_ACTIVE_CHAT' }
    | { type: 'HYDRATE'; payload: PatientStoreState };

// --- Initial State Helper ---

const DEFAULT_PATIENT_ID = 'general-context';
const STORAGE_KEY = 'mediBriefPatientStore_v4';

const createDefaultPatient = (): PatientContext => ({
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

const getInitialState = (): PatientStoreState => {
    try {
        const savedState = localStorage.getItem(STORAGE_KEY);
        if (savedState) {
            const parsed = JSON.parse(savedState);
            if (parsed.patients && parsed.activePatientId) {
                // Migration checks
                const cleanState = {
                    patients: parsed.patients,
                    activePatientId: parsed.activePatientId
                };
                
                // Ensure data structure integrity
                Object.keys(cleanState.patients).forEach(key => {
                    const p = cleanState.patients[key];
                    if (!p.clinicalData) p.clinicalData = { observations: [] };
                    if (!p.activeAlerts) p.activeAlerts = [];
                });
                return cleanState;
            }
        }
    } catch (e) {
        console.warn("Failed to load patient store, resetting.");
    }
    
    const defaultPatient = createDefaultPatient();
    return {
        patients: { [DEFAULT_PATIENT_ID]: defaultPatient },
        activePatientId: DEFAULT_PATIENT_ID,
    };
};

// --- Reducer ---

const patientReducer = (state: PatientStoreState, action: PatientAction): PatientStoreState => {
    const activeId = state.activePatientId;
    const activePatient = state.patients[activeId];

    switch (action.type) {
        case 'HYDRATE':
            return action.payload;
        case 'CREATE_PATIENT': {
            const newId = uuidv4();
            const newPatient: PatientContext = {
                ...createDefaultPatient(),
                id: newId,
                name: action.payload.name || `Patient ${Object.keys(state.patients).length + 1}`,
                status: 'New Admission',
            };
            return {
                ...state,
                patients: { ...state.patients, [newId]: newPatient },
                activePatientId: newId
            };
        }
        case 'DELETE_PATIENT': {
            const targetId = action.payload.id;
            if (Object.keys(state.patients).length <= 1) return state;

            const newPatients = { ...state.patients };
            delete newPatients[targetId];

            let newActiveId = state.activePatientId;
            if (state.activePatientId === targetId) {
                newActiveId = Object.keys(newPatients)[0];
            }

            return {
                ...state,
                patients: newPatients,
                activePatientId: newActiveId
            };
        }
        case 'SWITCH_PATIENT':
            return {
                ...state,
                activePatientId: action.payload.id
            };
        case 'UPDATE_PATIENT_DETAILS': {
            const targetId = action.payload.id;
            if (!state.patients[targetId]) return state;
            return {
                ...state,
                patients: {
                    ...state.patients,
                    [targetId]: { ...state.patients[targetId], ...action.payload.updates }
                }
            };
        }
        case 'UPDATE_PATIENT_ENTITIES': {
            const targetId = action.payload.id;
            const targetPatient = state.patients[targetId];
            if (!targetPatient) return state;

            const newEntities = { ...targetPatient.entities };
            const incoming = action.payload.entities;
            
            if (incoming.allergies) {
                newEntities.allergies = [...new Set([...newEntities.allergies, ...incoming.allergies])];
            }
            if (incoming.codeStatus) newEntities.codeStatus = incoming.codeStatus;
            if (incoming.diagnosis) {
                 newEntities.diagnosis = [...new Set([...newEntities.diagnosis, ...incoming.diagnosis])];
            }

            return {
                ...state,
                patients: {
                    ...state.patients,
                    [targetId]: { ...targetPatient, entities: newEntities }
                }
            };
        }
        case 'INGEST_CLINICAL_DATA': {
            const targetId = action.payload.id;
            const targetPatient = state.patients[targetId];
            if (!targetPatient) return state;

            const existingObs = targetPatient.clinicalData?.observations || [];
            const newObs = action.payload.observations.filter(obs => 
                !existingObs.some(ex => 
                    ex.code.text === obs.code.text && 
                    ex.valueQuantity?.value === obs.valueQuantity?.value &&
                    ex.effectiveDateTime === obs.effectiveDateTime
                )
            );

            return {
                ...state,
                patients: {
                    ...state.patients,
                    [targetId]: {
                        ...targetPatient,
                        clinicalData: {
                            ...targetPatient.clinicalData,
                            observations: [...existingObs, ...newObs]
                        }
                    }
                }
            };
        }
        case 'UPDATE_ALERTS': {
             const targetId = action.payload.id;
             const targetPatient = state.patients[targetId];
             if (!targetPatient) return state;

             // Merge alerts, deduping by title and recent timeframe
             const currentAlerts = targetPatient.activeAlerts || [];
             const newAlerts = action.payload.alerts.filter(na => 
                 !currentAlerts.some(ca => ca.title === na.title && ca.timestamp > Date.now() - 3600000)
             );

             return {
                ...state,
                patients: {
                    ...state.patients,
                    [targetId]: {
                        ...targetPatient,
                        activeAlerts: [...currentAlerts, ...newAlerts]
                    }
                }
             };
        }
        case 'DISMISS_ALERT': {
            const targetId = action.payload.id;
             const targetPatient = state.patients[targetId];
             if (!targetPatient) return state;

             return {
                 ...state,
                 patients: {
                     ...state.patients,
                     [targetId]: {
                         ...targetPatient,
                         activeAlerts: targetPatient.activeAlerts.filter(a => a.id !== action.payload.alertId && a.ruleId !== action.payload.alertId)
                     }
                 }
             }
        }
        case 'START_REQUEST':
            return {
                ...state,
                patients: {
                    ...state.patients,
                    [activeId]: {
                        ...activePatient,
                        chatHistory: [...activePatient.chatHistory, action.payload.userMessage],
                        lastActive: Date.now()
                    }
                }
            };
        case 'ADD_RESPONSE_PLACEHOLDER':
            return {
                ...state,
                patients: {
                    ...state.patients,
                    [activeId]: {
                        ...activePatient,
                        chatHistory: [...activePatient.chatHistory, { role: 'model', content: '' }]
                    }
                }
            };
        case 'APPEND_TO_LAST_MESSAGE': {
            const history = [...activePatient.chatHistory];
            const lastMsg = history[history.length - 1];
            if (lastMsg && lastMsg.role === 'model') {
                lastMsg.content += action.payload.chunk;
                if (action.payload.sources) {
                    const existing = lastMsg.sources || [];
                    const newSources = action.payload.sources.filter(ns => 
                        !existing.some(es => 
                            (es.web?.uri && es.web.uri === ns.web?.uri) || 
                            (es.maps?.uri && es.maps.uri === ns.maps?.uri)
                        )
                    );
                    lastMsg.sources = [...existing, ...newSources];
                }
            }
            return {
                ...state,
                patients: {
                    ...state.patients,
                    [activeId]: { ...activePatient, chatHistory: history }
                }
            };
        }
        case 'REQUEST_FINISH':
            return state; 
        case 'ADD_FULL_RESPONSE':
            return {
                ...state,
                patients: {
                    ...state.patients,
                    [activeId]: {
                        ...activePatient,
                        chatHistory: [...activePatient.chatHistory, action.payload.message],
                        lastActive: Date.now()
                    }
                }
            };
        case 'ADD_INTERIM_MESSAGE':
             return {
                ...state,
                patients: {
                    ...state.patients,
                    [activeId]: {
                        ...activePatient,
                        chatHistory: [...activePatient.chatHistory, action.payload]
                    }
                }
            };
        case 'UPDATE_LAST_MESSAGE_CONTENT': {
            const history = [...activePatient.chatHistory];
            const lastMsg = history[history.length - 1];
            if (lastMsg) lastMsg.content = action.payload;
            return {
                ...state,
                patients: {
                    ...state.patients,
                    [activeId]: { ...activePatient, chatHistory: history }
                }
            };
        }
        case 'REQUEST_FAILED': {
             const history = [...activePatient.chatHistory];
             const lastMsg = history[history.length - 1];
             const errorMsg = `Sorry, I encountered an error.\n\n**Details:** ${action.payload}`;
             if (lastMsg && lastMsg.role === 'model' && !lastMsg.content) {
                 lastMsg.content = errorMsg;
             } else {
                 history.push({ role: 'model', content: errorMsg });
             }
             return {
                ...state,
                patients: {
                    ...state.patients,
                    [activeId]: { ...activePatient, chatHistory: history }
                }
             };
        }
        case 'RESET_ACTIVE_CHAT':
            return {
                ...state,
                patients: {
                    ...state.patients,
                    [activeId]: { ...activePatient, chatHistory: [] }
                }
            };
        default:
            return state;
    }
};

// --- Context ---

interface PatientContextType {
    state: PatientStoreState;
    dispatch: React.Dispatch<PatientAction>;
    activePatient: PatientContext;
    activeMessages: ChatMessage[];
}

const PatientStoreContext = createContext<PatientContextType | undefined>(undefined);

// EXPORT 1: The Provider Component
export const PatientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(patientReducer, getInitialState());

    // Persistence Effect
    useEffect(() => {
        try {
            const stateToSave = {
                patients: Object.entries(state.patients).reduce((acc, [id, p]) => {
                    const patient = p as PatientContext;
                    acc[id] = {
                        ...patient,
                        chatHistory: patient.chatHistory.map(msg => {
                            if (msg.filePreview?.base64) {
                                return { 
                                    ...msg, 
                                    filePreview: { ...msg.filePreview, base64: undefined } 
                                };
                            }
                            return msg;
                        })
                    };
                    return acc;
                }, {} as Record<string, PatientContext>),
                activePatientId: state.activePatientId
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
        } catch (e) {
            console.error("Failed to save patient store", e);
        }
    }, [state]);

    const activePatient = state.patients[state.activePatientId];

    return React.createElement(PatientStoreContext.Provider, {
        value: { 
            state, 
            dispatch, 
            activePatient, 
            activeMessages: activePatient?.chatHistory || [] 
        }
    }, children);
};

// EXPORT 2: The Hook
export const usePatientStore = () => {
    const context = useContext(PatientStoreContext);
    if (!context) {
        throw new Error("usePatientStore must be used within a PatientProvider");
    }
    return context;
};
