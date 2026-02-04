
import React from 'react';
import { usePatientStore } from '../patient-management/usePatientStore';
import { useClinicalStore } from '../clinical-analysis/stores/useClinicalStore';
import { useChatStore } from '../chat/stores/useChatStore';
import { useAuditStore } from '../audit/useAuditStore';
import InterventionCard from './InterventionCard';
import CDSSAggregator from './CDSSAggregator';
import { CDSSAlert } from './types';

// Stable empty array to prevent infinite render loops when no alerts exist
const EMPTY_ALERTS: CDSSAlert[] = [];

const CDSSContainer: React.FC = () => {
    const activePatientId = usePatientStore(state => state.activePatientId);

    // Create a stable selector that doesn't create new array references
    const alertsSelector = React.useMemo(
        () => (state: { alerts: Record<string, CDSSAlert[]> }) =>
            state.alerts[activePatientId] ?? EMPTY_ALERTS,
        [activePatientId]
    );

    // Select Alerts from Clinical Store (Stable)
    const activeAlerts: CDSSAlert[] = useClinicalStore(alertsSelector);
    const clinicalActions = useClinicalStore(state => state.actions);
    const chatActions = useChatStore(state => state.actions);
    const auditActions = useAuditStore(state => state.actions);

    if (activeAlerts.length === 0) return null;

    const handleAction = (alert: CDSSAlert, actionIndex: number) => {
        const action = alert.actions[actionIndex];

        if (action.type === 'dismiss') {
            // Updated: Pass ruleId to enable suppression logic
            clinicalActions.dismissAlert(activePatientId, alert.id, alert.ruleId);
            auditActions.logEvent(
                'ALERT_DISMISSED',
                activePatientId,
                `Dismissed alert: ${alert.title}`,
                'USER',
                { ruleId: alert.ruleId, alertLevel: alert.level }
            );
        } else if (action.type === 'order' || action.type === 'acknowledge') {
            // Inject the action into the chat as a system note or user action
            if (action.payload) {
                chatActions.addMessage(activePatientId, {
                    role: 'model',
                    content: `✅ **ACTION EXECUTED**: ${action.payload}\n\n*Protocol: ${alert.title}*`
                });
            }
            // Acknowledge implies dismissal/resolution
            clinicalActions.dismissAlert(activePatientId, alert.id, alert.ruleId);

            auditActions.logEvent(
                'ALERT_ACTION',
                activePatientId,
                `Executed action "${action.label}" for alert: ${alert.title}`,
                'USER',
                { ruleId: alert.ruleId, actionType: action.type, payload: action.payload }
            );
        }
    };

    // Filter alerts into visibility tiers
    const criticalAlerts = activeAlerts.filter(a => a.level === 'Critical');
    const standardAlerts = activeAlerts.filter(a => a.level !== 'Critical');

    return (
        <>
            {/* TIER 1: CRITICAL INTERVENTION LAYER (BLOCKING OVERLAY) */}
            {/* Sits on top of everything except the absolute header, dims the chat content */}
            {criticalAlerts.length > 0 && (
                <div className="fixed inset-0 z-[60] flex items-start justify-center pt-20 md:pt-32 bg-slate-900/40 backdrop-blur-[3px] pointer-events-auto px-4 pb-4 overflow-y-auto animate-fade-in">
                    <div className="w-full max-w-3xl flex flex-col gap-4">
                        {criticalAlerts.map(alert => (
                            <InterventionCard
                                key={alert.id}
                                alert={alert}
                                onAction={handleAction}
                                variant="banner"
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* TIER 2: STANDARD NOTIFICATION LAYER (BOTTOM RIGHT TOASTS) */}
            {/* Non-intrusive updates for warnings and info */}
            {standardAlerts.length > 0 && (
                <div className="absolute bottom-4 right-4 z-40 flex flex-col items-end pointer-events-none w-full max-w-sm px-4 md:px-0">
                    <div className="pointer-events-auto w-full">
                        {standardAlerts.length > 1 ? (
                            <CDSSAggregator
                                alerts={standardAlerts}
                                onAction={handleAction}
                            />
                        ) : (
                            <InterventionCard
                                key={standardAlerts[0].id}
                                alert={standardAlerts[0]}
                                onAction={handleAction}
                                variant="toast"
                            />
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default CDSSContainer;
