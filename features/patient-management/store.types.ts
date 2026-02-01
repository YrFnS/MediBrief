
import { PatientContext, PatientEntityData, PatientDocument } from './types';
import { FHIRObservation } from '../fhir/types';
import { ChatMessage, GroundingSource } from '../../types';
import { CDSSAlert } from '../cdss/types';

export interface PatientStoreState {
    patients: Record<string, PatientContext>;
    activePatientId: string;
}

export type PatientAction =
    | { type: 'CREATE_PATIENT'; payload: { name?: string } }
    | { type: 'DELETE_PATIENT'; payload: { id: string } }
    | { type: 'SWITCH_PATIENT'; payload: { id: string } }
    | { type: 'UPDATE_PATIENT_DETAILS'; payload: { id: string; updates: Partial<PatientContext> } }
    | { type: 'UPDATE_PATIENT_ENTITIES'; payload: { id: string; entities: Partial<PatientEntityData> } }
    | { type: 'ADD_DOCUMENT'; payload: { id: string; document: PatientDocument } }
    | { type: 'INGEST_CLINICAL_DATA'; payload: { id: string; observations: FHIRObservation[] } }
    | { type: 'UPDATE_ALERTS'; payload: { id: string; alerts: CDSSAlert[] } }
    | { type: 'DISMISS_ALERT'; payload: { id: string; alertId: string } }
    | { type: 'START_REQUEST'; payload: { userMessage: ChatMessage } }
    | { type: 'ADD_RESPONSE_PLACEHOLDER' }
    | { type: 'APPEND_TO_LAST_MESSAGE'; payload: { chunk: string; sources?: GroundingSource[] } }
    | { type: 'REQUEST_FINISH' }
    | { type: 'ADD_FULL_RESPONSE'; payload: { message: ChatMessage } }
    | { type: 'UPDATE_LAST_MESSAGE_CONTENT'; payload: string }
    | { type: 'REQUEST_FAILED'; payload: string }
    | { type: 'ADD_INTERIM_MESSAGE'; payload: ChatMessage }
    | { type: 'RESET_ACTIVE_CHAT' }
    | { type: 'HYDRATE'; payload: PatientStoreState };
