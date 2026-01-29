
import { useCallback } from 'react';
import { usePatientStore } from '../features/patient-management/usePatientStore';
import { PatientContext } from '../features/patient-management/types';

export const useCDSS = (patient?: PatientContext) => {
    const actions = usePatientStore(state => state.actions);
    
    const activeAlerts = patient?.activeAlerts || [];

    const dismissAlert = useCallback((alertId: string) => {
        if (patient) {
            actions.dismissAlert(patient.id, alertId);
        }
    }, [actions, patient]);

    return {
        activeAlerts,
        dismissAlert
    };
};
