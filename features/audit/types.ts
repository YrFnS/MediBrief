
export type AuditEventType =
    | 'SYSTEM_INIT'
    | 'PATIENT_ACCESS'
    | 'ALERT_TRIGGERED'
    | 'ALERT_DISMISSED'
    | 'ALERT_ACTION'
    | 'DOSAGE_CHECK'
    | 'BRIEFING_GENERATED'
    | 'EXPORT_PDF';

export type AuditActor = 'AI' | 'USER' | 'SYSTEM';

export interface AuditEvent {
    id: string;
    timestamp: number;
    type: AuditEventType;
    patientId: string;
    actor: AuditActor;
    details: string;
    metadata?: Record<string, any>;
}
