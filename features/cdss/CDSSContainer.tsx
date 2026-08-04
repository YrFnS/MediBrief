import React, { useMemo, useState } from 'react';
import { ShieldCheckIcon } from '../../components/icons';
import { useAuditStore } from '../audit/useAuditStore';
import { useChatStore } from '../chat/stores/useChatStore';
import { useClinicalStore } from '../clinical-analysis/stores/useClinicalStore';
import { createAdvisoryTaskRecord } from '../clinical-record/durableActions';
import type { ClinicalTaskPriority } from '../clinical-record/types';
import { useClinicalRecordStore } from '../clinical-record/useClinicalRecordStore';
import { usePatientStore } from '../patient-management/usePatientStore';
import CDSSAggregator from './CDSSAggregator';
import ValidatedRulesAuditWorkspace from './components/ValidatedRulesAuditWorkspace';
import InterventionCard from './InterventionCard';
import type { AlertLevel, CDSSAlert } from './types';
import { buildValidatedRuleReviewViewModel } from './validatedRuleReview';

const priorityForAlert = (level: AlertLevel): ClinicalTaskPriority => {
    if (level === 'Critical') return 'stat';
    if (level === 'Warning') return 'urgent';
    return 'routine';
};

const CDSSContainer: React.FC = () => {
    const [isValidatedReviewOpen, setIsValidatedReviewOpen] = useState(false);
    const activePatientId = usePatientStore(state => state.activePatientId);
    const activePatient = usePatientStore(
        state => state.patients[activePatientId],
    );
    const activeAlertsRaw = useClinicalStore(
        state => state.alerts[activePatientId],
    );
    const activeAlerts = (activeAlertsRaw || []).filter(
        alert => alert.validationStatus === 'validated',
    );
    const activeRecord = useClinicalRecordStore(
        state => state.records[activePatientId],
    );
    const auditLogs = useAuditStore(state => state.logs);
    const validatedReview = useMemo(
        () => activeRecord
            ? buildValidatedRuleReviewViewModel(activeRecord, auditLogs)
            : null,
        [activeRecord, auditLogs],
    );
    const legacyClinicalActions = useClinicalStore(state => state.actions);
    const clinicalRecordActions = useClinicalRecordStore(
        state => state.actions,
    );
    const chatActions = useChatStore(state => state.actions);
    const auditActions = useAuditStore(state => state.actions);

    if (activeAlerts.length === 0 && !activeRecord) return null;

    const handleAction = (alert: CDSSAlert, actionIndex: number) => {
        const action = alert.actions[actionIndex];
        if (!action) return;

        if (action.type === 'dismiss') {
            legacyClinicalActions.dismissAlert(
                activePatientId,
                alert.id,
                alert.ruleId,
            );
            auditActions.logEvent(
                'ALERT_DISMISSED',
                activePatientId,
                `Dismissed validated advisory: ${alert.title}`,
                'USER',
                {
                    ruleId: alert.ruleId,
                    alertLevel: alert.level,
                },
            );
            return;
        }

        if (action.type === 'acknowledge') {
            legacyClinicalActions.dismissAlert(
                activePatientId,
                alert.id,
                alert.ruleId,
            );
            chatActions.addMessage(activePatientId, {
                role: 'model',
                content: `📝 **Advisory acknowledged**\n“${alert.title}” was acknowledged. No order, treatment, or completed action was recorded.`,
            });
            auditActions.logEvent(
                'ADVISORY_ACKNOWLEDGED',
                activePatientId,
                `Acknowledged advisory: ${alert.title}`,
                'USER',
                {
                    ruleId: alert.ruleId,
                    alertLevel: alert.level,
                    actionLabel: action.label,
                },
            );
            return;
        }

        clinicalRecordActions.initializePatientRecord({
            patientId: activePatientId,
            displayName: activePatient?.name
                || `Patient ${activePatientId.slice(0, 4)}`,
        });
        const task = createAdvisoryTaskRecord({
            patientId: activePatientId,
            advisoryTitle: alert.title,
            actionLabel: action.label,
            details: action.payload || alert.description,
            sourceRuleId: alert.ruleId,
            priority: priorityForAlert(alert.level),
            createdBy: 'Local user',
        });
        const result = clinicalRecordActions.addResource(task);

        if (!result.ok) {
            chatActions.addMessage(activePatientId, {
                role: 'model',
                content: `⚠️ **Follow-up task not saved**\n${result.message || 'The local task could not be created.'}`,
            });
            return;
        }

        legacyClinicalActions.dismissAlert(
            activePatientId,
            alert.id,
            alert.ruleId,
        );
        chatActions.addMessage(activePatientId, {
            role: 'model',
            content: `📋 **Follow-up task created**\nSaved “${task.title}” to the patient record. This is a reminder/proposal, not a clinical order and not a completed action.\n\n**Task ID:** ${task.id}`,
        });
        auditActions.logEvent(
            'ADVISORY_TASK_CREATED',
            activePatientId,
            `Created follow-up task from advisory: ${alert.title}`,
            'USER',
            {
                ruleId: alert.ruleId,
                taskId: task.id,
                legacyActionType: action.type,
                actionLabel: action.label,
            },
        );
    };

    const criticalAlerts = activeAlerts.filter(
        alert => alert.level === 'Critical',
    );
    const standardAlerts = activeAlerts.filter(
        alert => alert.level !== 'Critical',
    );

    return (
        <>
            {criticalAlerts.length > 0 && (
                <div className="pointer-events-auto fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-slate-900/40 px-4 pb-4 pt-20 backdrop-blur-[3px] animate-fade-in md:pt-32">
                    <div className="flex w-full max-w-3xl flex-col gap-4">
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

            {standardAlerts.length > 0 && (
                <div className="pointer-events-none absolute bottom-4 right-4 z-40 flex w-full max-w-sm flex-col items-end px-4 md:px-0">
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

            {activeRecord && validatedReview && (
                <button
                    type="button"
                    onClick={() => setIsValidatedReviewOpen(true)}
                    aria-label="Open validated rules, evidence, and Phase 5 audit review"
                    className="fixed bottom-4 left-4 z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-blue-200 bg-white/95 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-blue-700 shadow-xl backdrop-blur-md transition-colors hover:bg-blue-50 dark:border-blue-900 dark:bg-slate-950/95 dark:text-blue-300 dark:hover:bg-blue-950/40"
                >
                    <ShieldCheckIcon className="h-4 w-4" />
                    Rules & audit
                    {validatedReview.unreviewedCount > 0 && (
                        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[9px] text-white">
                            {validatedReview.unreviewedCount}
                        </span>
                    )}
                </button>
            )}

            {activeRecord && isValidatedReviewOpen && (
                <div className="fixed inset-0 z-[70] flex bg-slate-50 dark:bg-slate-950">
                    <ValidatedRulesAuditWorkspace
                        record={activeRecord}
                        onClose={() => setIsValidatedReviewOpen(false)}
                    />
                </div>
            )}
        </>
    );
};

export default CDSSContainer;
