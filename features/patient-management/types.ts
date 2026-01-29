
import { ChatMessage, UploadedFile } from '../../types';
import { ClinicalDataStore } from '../fhir/types';
import { CDSSAlert } from '../cdss/types';

export type PatientStatus = 'Stable' | 'Critical' | 'Discharge Ready' | 'New Admission';

export interface PatientEntityData {
    allergies: string[];
    codeStatus: string;
    diagnosis: string[];
}

// 1. Metadata Store Interface
export interface PatientMetadata {
  id: string;
  name: string; // e.g. "Bed 4 - Unknown Male"
  mrn?: string;
  status: PatientStatus;
  entities: PatientEntityData;
  documents: UploadedFile[]; // Kept here as context
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
