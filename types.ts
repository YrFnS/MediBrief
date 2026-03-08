
export enum ChatMode {
  Standard = 'Normal',
  Deep = 'Deep Analysis',
  Live = 'Live',
  Scribe = 'Ambient Scribe',
}

export interface GroundingSource {
  web?: {
    uri: string;
    title: string;
  };
  maps?: {
    uri: string;
    title: string;
    placeId?: string;
  };
  rejected?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  displayContent?: string;
  filePreview?: {
    url?: string; // Ephemeral URL (blob:...) for display
    name: string;
    type: string;
    storageId?: string; // ID referencing IndexedDB record (Persistent)
    // Removed: base64 (Do not store in main state!)
  };
  sources?: GroundingSource[]; 
}

export interface UploadedFile {
  file: File;
  base64: string; // Kept here momentarily for ingestion, but stripped before storage
  type: string;
  url?: string;
  storageId?: string; // New field
}

export interface LiveTranscript {
    userInput: string;
    modelOutput: string;
}
