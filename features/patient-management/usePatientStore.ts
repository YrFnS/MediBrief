
import { useReducer, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { PatientContext, PatientEntityData } from './types';
import { ClinicalDataStore, FHIRObservation } from '../fhir/types';
import { ChatMessage, ChatMode, GroundingSource, UploadedFile } from '../../types';

// --- State Definitions ---

export interface PatientStoreState {
    patients: Record<string, PatientContext>;
    activePatientId: string;
    globalChatMode: ChatMode;
    isLoading: boolean;
    error: string | null;
}

// --- Actions ---

export type PatientAction =
    | { type: 'CREATE_PATIENT'; payload: { name?: string } }
    | { type: 'SWITCH_PATIENT'; payload: { id: string } }
    | { type: 'UPDATE_PATIENT_DETAILS'; payload: { id: string; updates: Partial<PatientContext> } }
    | { type: 'UPDATE_PATIENT_ENTITIES'; payload: { id: string; entities: Partial<PatientEntityData> } }
    | { type: 'INGEST_CLINICAL_DATA'; payload: { id: string; observations: FHIRObservation[] } }
    // Chat Actions (Target Active Patient)
    | { type: 'START_REQUEST'; payload: { userMessage: ChatMessage } }
    | { type: 'ADD_RESPONSE_PLACEHOLDER' }
    | { type: 'APPEND_TO_LAST_MESSAGE'; payload: { chunk: string; sources?: GroundingSource[] } }
    | { type: 'REQUEST_FINISH' }
    | { type: 'ADD_FULL_RESPONSE'; payload: { message: ChatMessage } }
    | { type: 'UPDATE_LAST_MESSAGE_CONTENT'; payload: string }
    | { type: 'REQUEST_FAILED'; payload: string }
    | { type: 'ADD_INTERIM_MESSAGE'; payload: ChatMessage }
    // Global Actions
    | { type: 'SET_CHAT_MODE'; payload: ChatMode }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'RESET_ACTIVE_CHAT' };

// --- Initial State Helper ---

const DEFAULT_PATIENT_ID = 'general-context';

const createDefaultPatient = (): PatientContext => ({
    id: DEFAULT_PATIENT_ID,
    name: 'General Context',
    status: 'New Admission',
    documents: [],
    chatHistory: [],
    entities: { allergies: [], codeStatus: 'Full Code', diagnosis: [] },
    clinicalData: { observations: [] },
    createdAt: Date.now(),
    lastActive: Date.now()
});

const getInitialState = (): PatientStoreState => {
    try {
        const savedState = sessionStorage.getItem('mediBriefPatientStore');
        if (savedState) {
            const parsed = JSON.parse(savedState);
            // Validation check to ensure shape matches
            if (parsed.patients && parsed.activePatientId) {
                // Migration: Ensure clinicalData exists if loading old state
                Object.keys(parsed.patients).forEach(key => {
                    if (!parsed.patients[key].clinicalData) {
                        parsed.patients[key].clinicalData = { observations: [] };
                    }
                });
                return parsed;
            }
        }
    } catch (e) {
        console.warn("Failed to load patient store, resetting.");
    }
    
    // Default / Fallback State
    const defaultPatient = createDefaultPatient();
    return {
        patients: { [DEFAULT_PATIENT_ID]: defaultPatient },
        activePatientId: DEFAULT_PATIENT_ID,
        globalChatMode: ChatMode.Standard,
        isLoading: false,
        error: null
    };
};

// --- Reducer ---

const patientReducer = (state: PatientStoreState, action: PatientAction): PatientStoreState => {
    const activeId = state.activePatientId;
    const activePatient = state.patients[activeId];

    switch (action.type) {
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

            // Merge Logic: Don't overwrite existing allergies with empty arrays
            const newEntities = { ...targetPatient.entities };
            
            const incoming = action.payload.entities;
            if (incoming.allergies && incoming.allergies.length > 0) {
                // Dedup allergies
                const merged = [...new Set([...newEntities.allergies, ...incoming.allergies])];
                newEntities.allergies = merged;
            }
            if (incoming.codeStatus) {
                newEntities.codeStatus = incoming.codeStatus;
            }
            if (incoming.diagnosis && incoming.diagnosis.length > 0) {
                 const mergedDx = [...new Set([...newEntities.diagnosis, ...incoming.diagnosis])];
                 newEntities.diagnosis = mergedDx;
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
            // Simple Dedup: If we have an observation with same code, value, and date, ignore
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
        
        // --- Chat Actions (Scoped to Active Patient) ---
        
        case 'START_REQUEST':
            return {
                ...state,
                isLoading: true,
                error: null,
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
                    // Simple dedup based on URI
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
            return { ...state, isLoading: false };
        case 'ADD_FULL_RESPONSE':
            return {
                ...state,
                isLoading: false,
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
             // If the last message was empty placeholder, update it. Otherwise add new error msg.
             if (lastMsg && lastMsg.role === 'model' && !lastMsg.content) {
                 lastMsg.content = `Sorry, I encountered an error.\n\n**Details:** ${action.payload}`;
             } else {
                 history.push({ role: 'model', content: `Sorry, I encountered an error.\n\n**Details:** ${action.payload}` });
             }
             return {
                ...state,
                isLoading: false,
                error: action.payload,
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

        // --- Global Actions ---
        
        case 'SET_CHAT_MODE':
            return { ...state, globalChatMode: action.payload };
        case 'SET_LOADING':
            return { ...state, isLoading: action.payload };
        
        default:
            return state;
    }
};

export const usePatientStore = () => {
    const [state, dispatch] = useReducer(patientReducer, getInitialState());

    // Persistence Effect
    useEffect(() => {
        try {
            // Optimization: Strip base64 from images in history before saving to avoid QuotaExceeded
            const stateToSave = {
                ...state,
                patients: Object.entries(state.patients).reduce((acc, [id, patient]) => {
                    acc[id] = {
                        ...patient,
                        chatHistory: patient.chatHistory.map(msg => {
                            if (msg.filePreview?.base64) {
                                return { 
                                    ...msg, 
                                    filePreview: { ...msg.filePreview, base64: undefined } // Don't persist base64 to storage
                                };
                            }
                            return msg;
                        })
                    };
                    return acc;
                }, {} as Record<string, PatientContext>)
            };
            sessionStorage.setItem('mediBriefPatientStore', JSON.stringify(stateToSave));
        } catch (e) {
            console.error("Failed to save patient store", e);
        }
    }, [state]);

    const activePatient = state.patients[state.activePatientId];

    return { 
        state, 
        dispatch,
        activePatient,
        activeMessages: activePatient?.chatHistory || []
    };
};
