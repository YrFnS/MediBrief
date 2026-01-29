
import React, { useCallback } from 'react';
import { UploadedFile } from '../types';
import { extractEntitiesFromUpload } from '../features/clinical-analysis/entityExtractionService';
import { usePatientStore } from '../features/patient-management/usePatientStore';

export const useEntityExtractor = () => {
    const actions = usePatientStore(state => state.actions);
    
    const triggerExtraction = useCallback(async (file: UploadedFile, patientId: string) => {
        // Run in background (fire and forget from UI perspective)
        extractEntitiesFromUpload(file).then(entities => {
            if (Object.keys(entities).length > 0) {
                actions.updatePatientEntities(patientId, entities);
            }
        });
    }, [actions]);

    return { triggerExtraction };
};
