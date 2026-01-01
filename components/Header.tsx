
import React from 'react';
import type { ChatMode } from '../types';
import ModeSelector from './ModeSelector';
import { LogoIcon, NewChatIcon, DownloadIcon, CogIcon } from './icons';

interface HeaderProps {
    currentMode: ChatMode;
    onModeChange: (mode: ChatMode) => void;
    onClearChat: () => void;
    onExportChat: () => void;
    onOpenSettings: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentMode, onModeChange, onClearChat, onExportChat, onOpenSettings }) => {
    return (
        <header className="flex-shrink-0 bg-white dark:bg-slate-800 shadow-md px-3 py-2 md:p-3 z-20">
            <div className="max-w-5xl mx-auto flex justify-between items-center">
                <div className="flex items-center space-x-1.5 md:space-x-2">
                    <div className="p-1.5 md:p-2 bg-blue-500 rounded-full">
                         <LogoIcon className="w-4 h-4 md:w-6 md:h-6 text-white" />
                    </div>
                    <h1 className="text-lg md:text-2xl font-bold text-slate-700 dark:text-slate-200">Medi<span className="text-blue-500">Brief</span></h1>
                </div>
                <div className="flex items-center gap-1 md:gap-2">
                     <button 
                        onClick={onOpenSettings}
                        className="p-1.5 md:p-2 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title="Connection Settings"
                    >
                        <CogIcon className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                    <button 
                        onClick={onExportChat}
                        className="p-1.5 md:p-2 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title="Export briefing as PDF"
                        aria-label="Export briefing as PDF"
                    >
                        <DownloadIcon className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                    <button 
                        onClick={onClearChat}
                        className="p-1.5 md:p-2 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title="New Chat"
                        aria-label="Start a new chat"
                    >
                        <NewChatIcon className="w-4 h-4 md:w-5 md:h-5" />
                    </button>
                    <ModeSelector currentMode={currentMode} onModeChange={onModeChange} />
                </div>
            </div>
        </header>
    );
};

export default Header;
