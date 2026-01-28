
import React, { useState, useRef, useEffect } from 'react';
import { ChatMode } from '../types';
import { MODEL_CONFIGS } from '../constants';
import { BoltIcon, DeepAnalysisIcon, SparklesIcon, LiveIcon, ScribeIcon } from './icons';

interface ModeSelectorProps {
    currentMode: ChatMode;
    onModeChange: (mode: ChatMode) => void;
}

const ICONS: Record<ChatMode, React.FC<{className: string}>> = {
    [ChatMode.Standard]: SparklesIcon,
    [ChatMode.Deep]: DeepAnalysisIcon,
    [ChatMode.Live]: LiveIcon,
    [ChatMode.Scribe]: ScribeIcon,
};

const ModeSelector: React.FC<ModeSelectorProps> = ({ currentMode, onModeChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const CurrentIcon = ICONS[currentMode] || SparklesIcon;

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (mode: ChatMode) => {
        onModeChange(mode);
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* MOBILE / COMPACT TRIGGER */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`lg:hidden flex items-center gap-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-sm min-w-[130px] transition-all active:bg-slate-200 dark:active:bg-slate-800 ${isOpen ? 'ring-1 ring-blue-500 border-blue-500' : ''}`}
            >
                <CurrentIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-500" />
                <span className="text-xs font-mono font-bold uppercase text-slate-700 dark:text-slate-200 truncate flex-1 text-left">
                    {currentMode}
                </span>
                <div className="border-l border-slate-300 dark:border-slate-700 pl-2 text-slate-400">
                    <svg className={`w-2.5 h-2.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
            </button>

            {/* CUSTOM DROPDOWN MENU (Mobile) */}
            {isOpen && (
                <div className="lg:hidden absolute top-full left-0 mt-1 w-[200px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl z-50 rounded-sm overflow-hidden animate-slide-up origin-top-left">
                    <div className="py-1">
                        {Object.values(ChatMode).map((mode) => {
                            const Icon = ICONS[mode];
                            const isActive = currentMode === mode;
                            return (
                                <button
                                    key={mode}
                                    onClick={() => handleSelect(mode)}
                                    className={`w-full text-left flex items-center gap-3 px-3 py-2.5 transition-colors
                                        ${isActive 
                                            ? 'bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-400 border-l-2 border-blue-500' 
                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border-l-2 border-transparent'
                                        }`}
                                >
                                    <Icon className={`w-4 h-4 ${isActive ? 'text-blue-500' : 'text-slate-400'}`} />
                                    <div>
                                        <p className="font-mono text-xs font-bold uppercase">{mode}</p>
                                        <p className="text-[9px] opacity-70 truncate max-w-[120px] leading-tight">
                                            {MODEL_CONFIGS[mode].description.split(':')[0]}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* DESKTOP: Horizontal Tabs (Visible on lg+ screens) */}
            <div className="hidden lg:flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1">
                {Object.values(ChatMode).map((mode) => {
                    const Icon = ICONS[mode];
                    const isActive = currentMode === mode;
                    return (
                        <button
                            key={mode}
                            onClick={() => onModeChange(mode)}
                            className={`relative group px-3 py-1.5 rounded-sm text-xs font-mono uppercase tracking-wide transition-all duration-200 flex items-center gap-2
                                ${isActive 
                                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 shadow-sm' 
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
                                }`}
                        >
                            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400 dark:text-blue-600' : ''}`} />
                            <span>{mode}</span>
                             <span className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-max max-w-xs bg-slate-900 text-white text-[10px] rounded-sm py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-40 border border-slate-700 shadow-xl">
                                {MODEL_CONFIGS[mode].description}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    );
};

export default ModeSelector;
