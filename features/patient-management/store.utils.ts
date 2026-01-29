
import { PatientContext } from './types';
import { PatientStoreState } from './store.types';

export const DEFAULT_PATIENT_ID = 'general-context';
export const STORAGE_KEY = 'mediBriefPatientStore_v4';

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

export const getInitialState = (): PatientStoreState => {
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
