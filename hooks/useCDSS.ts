
import { useCallback } from 'react';
import { usePatientStore } from '../features/patient-management/usePatientStore';
import { PatientContext } from '../features/patient-management/types';

export const useCDSS = (patient?: PatientContext) => {
    const { dispatch } = usePatientStore();
    
    // Read directly from patient state.
    // The "Rules Engine" is now an async AI process that pushes alerts to this state.
    const activeAlerts = patient?.activeAlerts || [];

    const dismissAlert = useCallback((alertId: string) => {
        if (patient) {
            dispatch({
                type: 'DISMISS_ALERT',
                payload: { id: patient.id, alertId }
            });
        }
    }, [dispatch, patient]);

    return {
        activeAlerts,
        dismissAlert
    };
};
