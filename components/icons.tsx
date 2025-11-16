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