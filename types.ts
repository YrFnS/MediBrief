
export enum ChatMode {
  Standard = 'Normal',
  Deep = 'Deep Analysis',
  Live = 'Live',
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
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  displayContent?: string;
  filePreview?: {
    url?: string; // Optional, only for image previews
    name: string;
    type: string;
    base64?: string; // Persisted data for multi-turn history
  };
  sources?: GroundingSource[]; 
}

export interface UploadedFile {
  file: File;
  base64: string;
  type: string;
  url?: string; // Optional, only for images
}

export interface LiveTranscript {
    userInput: string;
    modelOutput: string;
}
