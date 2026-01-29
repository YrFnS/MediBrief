
import React from 'react';
import { useCDSS } from '../../hooks/useCDSS';
import InterventionCard from './InterventionCard';
import { usePatientStore } from '../patient-management/usePatientStore';
import { CDSSAlert } from './types';

const CDSSContainer: React.FC = () => {
    const { activePatient, actions } = usePatientStore(state => ({
        activePatient: state.patients[state.activePatientId],
        actions: state.actions
    }));
    const { activeAlerts, dismissAlert } = useCDSS(activePatient);

    if (activeAlerts.length === 0) return null;

    const handleAction = (alert: CDSSAlert, actionIndex: number) => {
        const action = alert.actions[actionIndex];

        if (action.type === 'dismiss') {
            dismissAlert(alert.ruleId);
        } else if (action.type === 'order' || action.type === 'acknowledge') {
            // Inject the action into the chat as a system note or user action
            if (action.payload) {
                actions.addFullResponse({ 
                    role: 'model', 
                    content: `✅ **ACTION EXECUTED**: ${action.payload}\n\n*Protocol: ${alert.title}*` 
                });
            }
            dismissAlert(alert.ruleId);
        }
    };

    return (
        <div className="absolute bottom-4 right-4 z-40 flex flex-col items-end pointer-events-none">
            <div className="pointer-events-auto flex flex-col items-end">
                {activeAlerts.map(alert => (
                    <InterventionCard 
                        key={alert.id} 
                        alert={alert} 
                        onAction={handleAction} 
                    />
                ))}
            </div>
        </div>
    );
};

export default CDSSContainer;
