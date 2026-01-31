
import React, { useCallback, useRef, useEffect } from 'react';
import { UploadedFile } from '../types';
import { extractEntitiesFromUpload } from '../features/clinical-analysis/entityExtractionService';
import { usePatientStore } from '../features/patient-management/usePatientStore';

export const useEntityExtractor = () => {
    const actions = usePatientStore(state => state.actions);
    const abortControllerRef = useRef<AbortController | null>(null);
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const triggerExtraction = useCallback(async (file: UploadedFile, patientId: string) => {
        // Abort any pending extraction
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Run in background (fire and forget from UI perspective)
        extractEntitiesFromUpload(file, controller.signal).then(entities => {
            if (controller.signal.aborted) return;
            
            if (Object.keys(entities).length > 0) {
                actions.updatePatientEntities(patientId, entities);
            }
        }).catch(err => {
            // Ignore errors here, service logs them
        }).finally(() => {
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
            }
        });
    }, [actions]);

    return { triggerExtraction };
};
