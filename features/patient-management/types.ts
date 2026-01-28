
import { ChatMessage, UploadedFile } from '../../types';
import { ClinicalDataStore } from '../fhir/types';

export type PatientStatus = 'Stable' | 'Critical' | 'Discharge Ready' | 'New Admission';

export interface PatientEntityData {
    allergies: string[];
    codeStatus: string;
    diagnosis: string[];
}

export interface PatientContext {
  id: string;
  name: string; // e.g. "Bed 4 - Unknown Male"
  mrn?: string;
  status: PatientStatus;
  documents: UploadedFile[];
  chatHistory: ChatMessage[]; 
  entities: PatientEntityData;
  clinicalData: ClinicalDataStore; // FHIR Store
  createdAt: number;
  lastActive: number;
}
