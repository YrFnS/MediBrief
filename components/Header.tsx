import React from 'react';
import type { ChatMode } from '../types';
import ModeSelector from './ModeSelector';
import { LogoIcon, NewChatIcon, DownloadIcon } from './icons';

interface HeaderProps {
    currentMode: ChatMode;
    onModeChange: (mode: ChatMode) => void;
    onClearChat: () => void;
    onExportChat: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentMode, onModeChange, onClearChat, onExportChat }) => {
    return (
        <header className="flex-shrink-0 bg-white dark:bg-slate-950 border-b-2 border-slate-200 dark:border-slate-800 z-30 shadow-sm relative">
             {/* Decorative Scan Line */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-blue-500 opacity-50"></div>

            <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
                
                {/* Brand / Status Block */}
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="p-1.5 bg-slate-900 dark:bg-white rounded-none shadow-sm">
                            <LogoIcon className="w-5 h-5 text-white dark:text-slate-900" />
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-green-500 rounded-none shadow-sm border border-white dark:border-slate-900"></div>
                    </div>
                    <div>
                        <h1 className="font-display font-bold text-lg tracking-tight leading-none text-slate-900 dark:text-white">
                            MEDIBRIEF<span className="text-slate-400 font-mono text-xs font-normal ml-2 tracking-widest">C.I.L. v3.0</span>
                        </h1>
                        <div className="flex items-center gap-1.5 mt-0.5">
                             <span className="w-1.5 h-1.5 bg-emerald-500 animate-pulse"></span>
                             <span className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 tracking-wider">Intelligence Layer Active</span>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-4">
                    <ModeSelector currentMode={currentMode} onModeChange={onModeChange} />
                    
                    <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2 hidden md:block"></div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={onExportChat}
                            className="p-2 rounded-sm border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:translate-y-0.5"
                            title="Export briefing"
                        >
                            <DownloadIcon className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={onClearChat}
                            className="p-2 rounded-sm border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:translate-y-0.5"
                            title="Reset Session"
                        >
                            <NewChatIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;