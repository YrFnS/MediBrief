
import React from 'react';
import type { ChatMode } from '../types';
import ModeSelector from './ModeSelector';
import { StethoscopeIcon, TrashIcon } from './icons';

interface HeaderProps {
    currentMode: ChatMode;
    onModeChange: (mode: ChatMode) => void;
    onClearChat: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentMode, onModeChange, onClearChat }) => {
    return (
        <header className="flex-shrink-0 bg-white dark:bg-slate-800 shadow-md p-2 md:p-3 z-20">
            <div className="max-w-5xl mx-auto flex justify-between items-center">
                <div className="flex items-center space-x-2">
                    <div className="p-2 bg-blue-500 rounded-full">
                         <StethoscopeIcon className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-xl md:text-2xl font-bold text-slate-700 dark:text-slate-200">Medi<span className="text-blue-500">Brief</span></h1>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={onClearChat}
                        className="p-2 rounded-full text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title="Clear chat history"
                        aria-label="Clear chat history"
                    >
                        <TrashIcon className="w-5 h-5" />
                    </button>
                    <ModeSelector currentMode={currentMode} onModeChange={onModeChange} />
                </div>
            </div>
        </header>
    );
};

export default Header;
