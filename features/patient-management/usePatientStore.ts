
import React, { useReducer, useEffect, useContext, createContext } from 'react';
import { PatientContext } from './types';
import { ChatMessage } from '../../types';
import { PatientStoreState, PatientAction } from './store.types';
import { patientReducer } from './reducer';
import { getInitialState, STORAGE_KEY } from './store.utils';

// --- Context ---

interface PatientContextType {
    state: PatientStoreState;
    dispatch: React.Dispatch<PatientAction>;
    activePatient: PatientContext;
    activeMessages: ChatMessage[];
}

const PatientStoreContext = createContext<PatientContextType | undefined>(undefined);

// --- Provider ---

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
            // SECURITY UPDATE: sessionStorage
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
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

// --- Hook ---

export const usePatientStore = () => {
    const context = useContext(PatientStoreContext);
    if (!context) {
        throw new Error("usePatientStore must be used within a PatientProvider");
    }
    return context;
};

// --- Exports ---
export type { PatientAction, PatientStoreState };
