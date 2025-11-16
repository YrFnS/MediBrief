
export enum ChatMode {
  Auto = 'Auto',
  Standard = 'Standard',
  Quick = 'Quick Query',
  Deep = 'Deep Analysis',
  Web = 'Web Search',
  Live = 'Live',
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  displayContent?: string;
  filePreview?: {
    url?: string; // Optional, only for image previews
    name: string;
    type: string;
  };
  sources?: any[]; 
}

export interface UploadedFile {
  file: File;
  base64: string;
  type: string;
  url?: string; // Optional, only for images
}