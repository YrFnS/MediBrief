
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { PatientMetadata, PatientEntityData } from './types';

// --- Default Data Factory ---
export const DEFAULT_PATIENT_ID = 'general-context';

export const createDefaultPatient = (): PatientMetadata => ({
    id: DEFAULT_PATIENT_ID,
    name: 'General Context',
    status: 'New Admission',
    documents: [],
    entities: { allergies: [], codeStatus: 'Full Code', diagnosis: [] },
    createdAt: Date.now(),
    lastActive: Date.now()
});

// --- State Definitions ---

export interface PatientState {
    patients: Record<string, PatientMetadata>;
    activePatientId: string;
}

export interface PatientActions {
    actions: {
        createPatient: (name?: string) => string; // Returns new ID
        deletePatient: (id: string) => void;
        switchPatient: (id: string) => void;
        updatePatientDetails: (id: string, updates: Partial<PatientMetadata>) => void;
        updatePatientEntities: (id: string, entities: Partial<PatientEntityData>) => void;
        touchPatient: (id: string) => void;
        // Batch set for Import/Restore
        setAllPatients: (patients: Record<string, PatientMetadata>, activeId: string) => void;
    }
}

export const usePatientStore = create<PatientState & PatientActions>()(
    persist(
        (set) => ({
            patients: { [DEFAULT_PATIENT_ID]: createDefaultPatient() },
            activePatientId: DEFAULT_PATIENT_ID,

            actions: {
                createPatient: (name) => {
                    const newId = uuidv4();
                    const newPatient: PatientMetadata = {
                        ...createDefaultPatient(),
                        id: newId,
                        name: name || `Patient ${newId.substring(0,4)}`,
                        status: 'New Admission',
                    };
                    set((state) => ({
                        patients: { ...state.patients, [newId]: newPatient },
                        activePatientId: newId
                    }));
                    return newId;
                },

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

                touchPatient: (id) => set((state) => {
                    if (!state.patients[id]) return state;
                    return {
                        patients: {
                            ...state.patients,
                            [id]: { ...state.patients[id], lastActive: Date.now() }
                        }
                    };
                }),

                setAllPatients: (patients, activeId) => set({
                    patients,
                    activePatientId: activeId
                })
            }
        }),
        {
            name: 'medibrief-metadata-storage',
            storage: createJSONStorage(() => sessionStorage),
        }
    )
);
