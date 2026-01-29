
import React from 'react';
import { usePatientStore } from '../patient-management/usePatientStore';
import { useClinicalStore } from '../clinical-analysis/stores/useClinicalStore';
import { useChatStore } from '../chat/stores/useChatStore';
import InterventionCard from './InterventionCard';
import { CDSSAlert } from './types';

const CDSSContainer: React.FC = () => {
    const activePatientId = usePatientStore(state => state.activePatientId);
    
    // Select Alerts from Clinical Store
    const activeAlerts = useClinicalStore(state => state.alerts[activePatientId] || []);
    const clinicalActions = useClinicalStore(state => state.actions);
    const chatActions = useChatStore(state => state.actions);

    if (activeAlerts.length === 0) return null;

    const handleAction = (alert: CDSSAlert, actionIndex: number) => {
        const action = alert.actions[actionIndex];

        if (action.type === 'dismiss') {
            clinicalActions.dismissAlert(activePatientId, alert.ruleId);
        } else if (action.type === 'order' || action.type === 'acknowledge') {
            // Inject the action into the chat as a system note or user action
            if (action.payload) {
                chatActions.addMessage(activePatientId, { 
                    role: 'model', 
                    content: `✅ **ACTION EXECUTED**: ${action.payload}\n\n*Protocol: ${alert.title}*` 
                });
            }
            clinicalActions.dismissAlert(activePatientId, alert.ruleId);
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
