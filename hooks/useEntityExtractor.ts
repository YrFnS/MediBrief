
import React, { useCallback } from 'react';
import { UploadedFile } from '../types';
import { extractEntitiesFromUpload } from '../features/clinical-analysis/entityExtractionService';
import { PatientAction } from '../features/patient-management/usePatientStore';

export const useEntityExtractor = (dispatch: React.Dispatch<PatientAction>) => {
    
    const triggerExtraction = useCallback(async (file: UploadedFile, patientId: string) => {
        // Run in background (fire and forget from UI perspective)
        extractEntitiesFromUpload(file).then(entities => {
            if (Object.keys(entities).length > 0) {
                dispatch({
                    type: 'UPDATE_PATIENT_ENTITIES',
                    payload: {
                        id: patientId,
                        entities
                    }
                });
            }
        });
    }, [dispatch]);

    return { triggerExtraction };
};
