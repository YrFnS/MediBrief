import React from 'react';

export const UserIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
);

export const BotIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-8 14H9v-2h2v2zm4 0h-2v-2h2v2zm4-4H5V5h14v8z" />
        <circle cx="15" cy="9" r="1" />
        <circle cx="9" cy="9" r="1" />
    </svg>
);

export const SendIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
);

export const PaperclipIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
);

export const XCircleIcon: React.FC<{className?: string}> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
  </svg>
);


export const LinkIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M17 7h-4v2h4c1.65 0 3 1.35 3 3s-1.35 3-3 3h-4v2h4c2.76 0 5-2.24 5-5s-2.24-5-5-5zm-6 8H7c-1.65 0-3-1.35-3-3s1.35-3 3-3h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-2zm-3-4h8v2H8z" />
    </svg>
);

export const StethoscopeIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M17.84,5.43C17.44,5.15 17,5 16.5,5H13V4a1,1,0,0,0-1-1H11A1,1,0,0,0,10,4v8.5a2.5,2.5,0,0,0,5,0V6.69l1.43.95a1,1,0,0,0,1.14-.14C18.1,7,18.24,6.23 17.84,5.43ZM13,10.5A.5.5,0,0,1,12.5,11h-1a.5.5,0,0,1-.5-.5V7h2Z"/>
        <path d="M19,12a4,4,0,1,0,4,4A4,4,0,0,0,19,12Zm0,6a2,2,0,1,1,2-2A2,2,0,0,1,19,18Z"/>
        <path d="M6,22a4,4,0,1,0-4-4A4,4,0,0,0,6,22Zm0-6a2,2,0,1,1-2,2A2,2,0,0,1,6,16Z"/>
        <path d="M10,12.5v7a1,1,0,0,1-1,1H7a1,1,0,0,0,0,2H9a3,3,0,0,0,3-3v-7Z"/>
    </svg>
);

export const AutoModeIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12 2.75l.83 1.69 1.88.27-1.36 1.33.32 1.87L12 7l-1.67.88.32-1.87-1.36-1.33 1.88-.27L12 2.75zM19 11l-1.36-1.33.32-1.87L16.29 7l-1.67.88.32 1.87-1.36 1.33 1.88.27.83 1.69.83-1.69 1.88-.27zM5.71 7l-1.67.88.32 1.87L3 11l1.88.27.83 1.69.83-1.69 1.88-.27-1.36-1.33.32-1.87zM12 15.75l-1.67.88.32 1.87L9.29 20l1.88.27.83 1.69.83-1.69 1.88-.27-1.36-1.33.32-1.87L12 15.75z"/>
    </svg>
);

export const SparklesIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12 2.75l.83 1.69 1.88.27-1.36 1.33.32 1.87L12 7l-1.67.88.32-1.87-1.36-1.33 1.88-.27L12 2.75zM19.5 10.5l-1.88-.27- .83-1.69-.83 1.69-1.88.27 1.36 1.33-.32 1.87L16.5 13l1.67-.88-.32-1.87 1.36-1.33zM7.5 10.5l-1.88-.27-.83-1.69-.83 1.69-1.88.27 1.36 1.33-.32 1.87L4.5 13l1.67-.88-.32-1.87 1.36-1.33zM12 16.75l-.83 1.69-1.88.27 1.36 1.33-.32 1.87L12 21l1.67.88-.32-1.87 1.36-1.33-1.88-.27L12 16.75z"/>
    </svg>
);

export const BoltIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M11 21h-1l1-7H7v-2h6.11l-1.11-7h1l-1 7h4v2H12.89l1.11 7z"/>
    </svg>
);

export const BrainCircuitIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M12 2a4 4 0 0 1 4 4v2h-2a2 2 0 0 0-2-2v-2a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2V8a4 4 0 0 1 4 4m-4 5v-3m0 3a2 2 0 1 1-4 0v-2a2 2 0 1 0-4 0v2a2 2 0 1 1-4 0v-2c0-2.83 2.69-5.17 6-5.47M16 13v-3m0 3a2 2 0 1 1 4 0v-2a2 2 0 1 0 4 0v2a2 2 0 1 1 4 0v-2c0-2.83-2.69-5.17-6-5.47M12 13v-1"/>
    </svg>
);

export const MagnifyingGlassIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 0 0 1.48-5.34c-.47-2.78-2.79-5-5.59-5.34a6.505 6.505 0 0 0-7.27 7.27c.34 2.8 2.56 5.12 5.34 5.59a6.5 6.5 0 0 0 5.34-1.48l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0 .41-.41.41-1.08 0-1.49L15.5 14zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
    </svg>
);

export const BriefingIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M4.5 2.25A2.25 2.25 0 002.25 4.5v15A2.25 2.25 0 004.5 21.75h15A2.25 2.25 0 0021.75 19.5v-15A2.25 2.25 0 0019.5 2.25h-15zm3.75 6a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5h-7.5zm0 3.75a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5h-7.5z" clipRule="evenodd" />
    </svg>
);

export const DrugsIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M9 2.25a.75.75 0 000 1.5v9.092c0 .324.08.641.233.922l2.32 4.639a.75.75 0 101.33-.664l-2.32-4.639A.75.75 0 0110.5 12.842V3.75a.75.75 0 000-1.5H9z" clipRule="evenodd" />
        <path fillRule="evenodd" d="M6 3.75A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6zm9.053 7.96a.75.75 0 00-1.06-1.06L12 12.69 10.007 10.7a.75.75 0 00-1.06 1.06l2.5 2.5a.75.75 0 001.06 0l2.5-2.5z" clipRule="evenodd" />
    </svg>
);

export const ExportIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75z" clipRule="evenodd" />
        <path fillRule="evenodd" d="M3.75 13.5a.75.75 0 01.75-.75h3a.75.75 0 010 1.5h-3a.75.75 0 01-.75-.75zM16.5 12.75a.75.75 0 000 1.5h3a.75.75 0 000-1.5h-3z" clipRule="evenodd" />
    </svg>
);

export const HelpIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 13.85a.75.75 0 101.06-1.06L10.06 12l1.28-1.28a.75.75 0 00-1.06-1.06L9 10.94l-1.28-1.28a.75.75 0 00-1.06 1.06L7.94 12l-1.28 1.28a.75.75 0 101.06 1.06L9 13.06l1.28 1.28z" clipRule="evenodd" />
    </svg>
);

export const DocumentTextIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M5.625 1.5c-1.036 0-1.875.84-1.875 1.875v17.25c0 1.035.84 1.875 1.875 1.875h12.75c1.035 0 1.875-.84 1.875-1.875V12.75A3.75 3.75 0 0016.5 9h-1.875a.375.375 0 01-.375-.375V6.75A3.75 3.75 0 0010.5 3h-4.875zM15 4.875c0-.621.504-1.125 1.125-1.125a.375.375 0 01.375.375v4.5c0 .621-.504 1.125-1.125 1.125a.375.375 0 01-.375-.375v-4.5z" clipRule="evenodd" />
        <path d="M7.5 10.5a.75.75 0 00-1.5 0v.75a.75.75 0 001.5 0v-.75zM9 10.5a.75.75 0 01.75-.75h3a.75.75 0 010 1.5h-3a.75.75 0 01-.75-.75zm-1.5 3a.75.75 0 00-1.5 0v.75a.75.75 0 001.5 0v-.75zM9 13.5a.75.75 0 01.75-.75h3a.75.75 0 010 1.5h-3a.75.75 0 01-.75-.75zm-1.5 3a.75.75 0 00-1.5 0v.75a.75.75 0 001.5 0v-.75zM9 16.5a.75.75 0 01.75-.75h3a.75.75 0 010 1.5h-3a.75.75 0 01-.75-.75z" />
    </svg>
);

export const TrashIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.006a.75.75 0 01-.749.654H5.858a.75.75 0 01-.749-.654L4.104 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452z" clipRule="evenodd" />
    </svg>
);

export const MicrophoneIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
        <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
    </svg>
);


// Icons for Briefing Report
export const AlertTriangleIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M11.99 2.25c-.74 0-1.44.27-1.99.73L1.66 14.23a2.25 2.25 0 001.99 3.52h16.7a2.25 2.25 0 001.99-3.52L13.98 2.98A2.25 2.25 0 0012 2.25zm.9 9a.9.9 0 00-1.8 0v2.7a.9.9 0 001.8 0v-2.7zm-1.8 5.4a.9.9 0 101.8 0 .9.9 0 00-1.8 0z" clipRule="evenodd" />
    </svg>
);

export const UsersIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
    </svg>
);

export const PillIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12.94 4.06a8.5 8.5 0 00-10.88 2.02 8.5 8.5 0 002.02 10.88l6.94-6.94-2.02-2.02 4.9-4.9c1.2-1.2 3.14-1.2 4.34 0s1.2 3.14 0 4.34l-4.9 4.9 2.02 2.02L20 12.02A8.5 8.5 0 0012.94 4.06z"/>
    </svg>
);

export const ClipboardIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    </svg>
);

export const ClipboardCheckIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
        <path d="m9 14 2 2 4-4"/>
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    </svg>
);

export const ListChecksIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M3 14h4v-4H3v4zm0 5h4v-4H3v4zM3 9h4V5H3v4zm5 5h13v-4H8v4zm0 5h13v-4H8v4zM8 5v4h13V5H8z"/>
    </svg>
);

export const PhoneForwardedIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="m18 11 5-5-5-5v3h-1c-4.97 0-9 4.03-9 9v1h2v-1c0-3.86 3.14-7 7-7h1v3zM20 15.5c-1.25 0-2.45-.2-3.57-.57-.35-.11-.74-.03-1.02.24l-2.2 2.2c-2.83-1.44-5.15-3.75-6.59-6.59l2.2-2.21c.28-.26.36-.65.25-1C8.7 6.45 8.5 5.25 8.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1z"/>
    </svg>
);

export const ClockIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm4.25-3.75-1.42 1.42L16.2 9.05l1.42-1.42L15.25 5.25zM6.38 7.63l1.42 1.42L9.17 7.63 7.76 6.22 6.38 7.63z"/>
    </svg>
);

export const DownloadIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75z" clipRule="evenodd" />
        <path fillRule="evenodd" d="M3 18.75a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z" clipRule="evenodd" />
    </svg>
);

// Icons for ImageAnalysisReport
export const ImageIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06l4.47-4.47a.75.75 0 011.06 0l3.97 3.97L17.47 9.53a.75.75 0 011.06 0l2.25 2.25V6H3.75a.75.75 0 00-.75.75v9.31zM21 12.94l-2.25-2.25-3.53 3.53.97.97a.75.75 0 01-1.06 1.06l-1.5-1.5L9 18H3.75a.75.75 0 00.1-.14L9 12.31l3.97-3.97a.75.75 0 011.06 0l4.47 4.47V18a.75.75 0 00.75-.75v-4.31z" clipRule="evenodd" />
    </svg>
);

export const CalendarIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zM5.25 6.75c-.966 0-1.75.784-1.75 1.75v10.5c0 .966.784 1.75 1.75 1.75h13.5c.966 0 1.75-.784 1.75-1.75V8.5c0-.966-.784-1.75-1.75-1.75H5.25z" clipRule="evenodd" />
    </svg>
);

export const ClipboardListIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M12.75 2.25a.75.75 0 00-1.5 0v.175c-1.52.16-2.88.75-4.04 1.5-1.12.72-2.07 1.66-2.83 2.68a.75.75 0 001.2.92c.67-.9 1.5-1.7 2.53-2.31 1.07-.63 2.3-.98 3.64-.98h.01c1.34 0 2.57.35 3.64.98 1.03.6 1.86 1.4 2.53 2.31a.75.75 0 001.2-.92c-.76-1.02-1.7-1.96-2.83-2.68-1.16-.75-2.52-1.34-4.04-1.5V2.25z" clipRule="evenodd" />
        <path fillRule="evenodd" d="M4.5 9.75A.75.75 0 003.75 9V7.5c0-1.036.84-1.875 1.875-1.875h12.75c1.036 0 1.875.84 1.875 1.875V9a.75.75 0 00-1.5 0v-.806c.07-.03.14-.06.2-.1v.01c-.04-.04-.08-.07-.12-.11L18.75 7.5H5.25l.001.44c-.04.04-.08.07-.12.11a.75.75 0 00-.5.694v.806zM5.25 20.25c0 .414.336.75.75.75h12c.414 0 .75-.336.75-.75V10.5a.75.75 0 00-1.5 0v9H6v-9a.75.75 0 00-1.5 0v9.75z" clipRule="evenodd" />
    </svg>
);

export const EyeIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
    </svg>
);

export const LightbulbIcon: React.FC<{className?: string}> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z" />
    </svg>
);