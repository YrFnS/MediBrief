
import { useCallback } from 'react';
import { useClinicalStore } from '../features/clinical-analysis/stores/useClinicalStore';
import { FullPatientContext } from '../features/patient-management/types';

export const useCDSS = (patient?: FullPatientContext) => {
    const actions = useClinicalStore(state => state.actions);
    
    const activeAlerts = patient?.activeAlerts || [];

    const dismissAlert = useCallback((alertId: string, ruleId: string) => {
        if (patient) {
            actions.dismissAlert(patient.id, alertId, ruleId);
        }
    }, [actions, patient]);

    return {
        activeAlerts,
        dismissAlert
    };
};
