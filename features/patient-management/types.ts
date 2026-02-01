
import { ChatMessage } from '../../types';
import { ClinicalDataStore } from '../fhir/types';
import { CDSSAlert } from '../cdss/types';

export type PatientStatus = 'Stable' | 'Critical' | 'Discharge Ready' | 'New Admission';

export interface PatientEntityData {
    allergies: string[];
    codeStatus: string;
    diagnosis: string[];
}

export interface PatientDocument {
    storageId: string;
    name: string;
    type: string;
    uploadedAt: number;
}

// 1. Metadata Store Interface
export interface PatientMetadata {
  id: string;
  name: string; // e.g. "Bed 4 - Unknown Male"
  mrn?: string;
  status: PatientStatus;
  entities: PatientEntityData;
  documents: PatientDocument[]; // Optimized: Metadata only
  createdAt: number;
  lastActive: number;
}

// 2. Chat Store Interface
export interface PatientChatData {
    chatHistory: ChatMessage[];
}

// 3. Clinical Store Interface
export interface PatientClinicalData {
    clinicalData: ClinicalDataStore;
    activeAlerts: CDSSAlert[];
}

// Composite type for Export/Import only
export interface FullPatientContext extends PatientMetadata, PatientChatData, PatientClinicalData {}

export type PatientContext = FullPatientContext;
