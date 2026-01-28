
import { useState, useEffect, useMemo, useCallback } from 'react';
import { PatientContext } from '../features/patient-management/types';
import { CDSSAlert } from '../features/cdss/types';
import { evaluateRules } from '../features/cdss/rulesEngine';

export const useCDSS = (patient?: PatientContext) => {
    const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());
    
    // Memoize observations to prevent re-running logic on every render
    const observations = useMemo(() => patient?.clinicalData?.observations || [], [patient]);

    // Run Logic Engine
    const activeAlerts = useMemo(() => {
        if (!patient) return [];
        
        const generatedAlerts = evaluateRules(observations);
        
        // Filter out dismissed alerts (based on ruleId to prevent re-triggering same rule instantly)
        // In a real app, we'd check if the data has CHANGED since dismissal. 
        // For this demo, we'll simple-block by RuleID if dismissed in this session.
        return generatedAlerts.filter(alert => !dismissedAlertIds.has(alert.ruleId));
    }, [observations, dismissedAlertIds, patient]);

    const dismissAlert = useCallback((ruleId: string) => {
        setDismissedAlertIds(prev => new Set(prev).add(ruleId));
    }, []);

    const resetDismissals = useCallback(() => {
        setDismissedAlertIds(new Set());
    }, []);

    // If patient changes, optionally reset dismissals or keep them? 
    // Usually reset because it's a different context.
    useEffect(() => {
        resetDismissals();
    }, [patient?.id, resetDismissals]);

    return {
        activeAlerts,
        dismissAlert
    };
};
