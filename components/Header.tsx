
import React from 'react';
import type { ChatMode } from '../types';
import ModeSelector from './ModeSelector';
import { LogoIcon, NewChatIcon, DownloadIcon, MenuIcon } from './icons';

interface HeaderProps {
    currentMode: ChatMode;
    onModeChange: (mode: ChatMode) => void;
    onClearChat: () => void;
    onExportChat: () => void;
    onToggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ currentMode, onModeChange, onClearChat, onExportChat, onToggleSidebar }) => {
    return (
        <header className="flex-shrink-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-30 relative sticky top-0">
            <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center gap-4">
                
                <div className="flex items-center gap-3">
                    {/* Mobile Menu Button */}
                    <button
                        onClick={onToggleSidebar}
                        className="md:hidden p-2 -ml-2 text-slate-500 hover:text-blue-600 transition-colors rounded-lg hover:bg-slate-100"
                        aria-label="Toggle Menu"
                    >
                        <MenuIcon className="w-5 h-5" />
                    </button>

                    {/* Brand / Status Block */}
                    <div className="flex items-center gap-3">
                        <div className="relative flex-shrink-0">
                            <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20 text-white">
                                <LogoIcon className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="min-w-0 flex flex-col">
                            <h1 className="font-display font-bold text-lg tracking-tight text-slate-900 leading-none">
                                MediBrief
                            </h1>
                            <span className="text-[10px] font-mono font-medium text-slate-400 tracking-wider">CLINICAL INTELLIGENCE LAYER</span>
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                    <ModeSelector currentMode={currentMode} onModeChange={onModeChange} />
                    
                    <div className="h-6 w-px bg-slate-200 mx-1 hidden md:block"></div>

                    <div className="flex items-center gap-1">
                        <button 
                            onClick={onExportChat}
                            className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
                            title="Export briefing"
                        >
                            <DownloadIcon className="w-5 h-5" />
                        </button>
                        <button 
                            onClick={onClearChat}
                            className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all"
                            title="Reset Session"
                        >
                            <NewChatIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
