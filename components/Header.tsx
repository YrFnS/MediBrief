
import React from 'react';
import type { ChatMode } from '../types';
import ModeSelector from './ModeSelector';
import { LogoIcon, NewChatIcon, DownloadIcon, MenuIcon, CogIcon } from './icons';

interface HeaderProps {
    currentMode: ChatMode;
    onModeChange: (mode: ChatMode) => void;
    onClearChat: () => void;
    onExportChat: () => void;
    onToggleSidebar: () => void;
    onOpenSettings: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentMode, onModeChange, onClearChat, onExportChat, onToggleSidebar, onOpenSettings }) => {
    return (
        <header className="flex-shrink-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-30 relative sticky top-0 transition-colors">
            <div className="max-w-5xl mx-auto px-3 py-2 md:px-4 md:py-3 flex justify-between items-center gap-2 md:gap-4">
                
                <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                    {/* Mobile Menu Button */}
                    <button
                        onClick={onToggleSidebar}
                        className="md:hidden p-1.5 -ml-1 text-slate-500 hover:text-blue-600 transition-colors rounded-lg hover:bg-slate-100 flex-shrink-0"
                        aria-label="Toggle Menu"
                    >
                        <MenuIcon className="w-5 h-5" />
                    </button>

                    {/* Brand / Status Block */}
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <div className="relative flex-shrink-0">
                            <div className="p-1.5 md:p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20 text-white">
                                <LogoIcon className="w-4 h-4 md:w-5 md:h-5" />
                            </div>
                        </div>
                        <div className="min-w-0 flex flex-col justify-center">
                            <h1 className="font-display font-bold text-sm md:text-lg tracking-tight text-slate-900 leading-none truncate">
                                MediBrief
                            </h1>
                            <span className="text-[8px] md:text-[10px] font-mono font-medium text-slate-400 tracking-wider truncate hidden xs:block">
                                CLINICAL INTELLIGENCE LAYER
                            </span>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1.5 md:gap-4 flex-shrink-0">
                    <ModeSelector currentMode={currentMode} onModeChange={onModeChange} />
                    
                    <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block"></div>

                    <div className="flex items-center gap-0.5 md:gap-1">
                        <button 
                            onClick={onOpenSettings}
                            className="p-1.5 md:p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
                            title="AI Settings"
                        >
                            <CogIcon className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                        <button 
                            onClick={onExportChat}
                            className="p-1.5 md:p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
                            title="Export briefing"
                        >
                            <DownloadIcon className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                        <button 
                            onClick={onClearChat}
                            className="p-1.5 md:p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all"
                            title="Reset Session"
                        >
                            <NewChatIcon className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
