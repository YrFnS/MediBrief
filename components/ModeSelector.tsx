import React from 'react';
import { ChatMode } from '../types';
import { MODEL_CONFIGS } from '../constants';
import { BoltIcon, DeepAnalysisIcon, MagnifyingGlassIcon, SparklesIcon, AutoModeIcon, LiveIcon } from './icons';

interface ModeSelectorProps {
    currentMode: ChatMode;
    onModeChange: (mode: ChatMode) => void;
}

const ICONS: Record<ChatMode, React.FC<{className: string}>> = {
    [ChatMode.Auto]: AutoModeIcon,
    [ChatMode.Standard]: SparklesIcon,
    [ChatMode.Quick]: BoltIcon,
    [ChatMode.Deep]: DeepAnalysisIcon,
    [ChatMode.Web]: MagnifyingGlassIcon,
    [ChatMode.Live]: LiveIcon,
};

const ModeSelector: React.FC<ModeSelectorProps> = ({ currentMode, onModeChange }) => {
    return (
        <div className="flex items-center bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1">
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
                        <span className="hidden lg:inline">{mode}</span>
                         <span className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-max max-w-xs bg-slate-900 text-white text-[10px] rounded-sm py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-40 border border-slate-700 shadow-xl">
                            {MODEL_CONFIGS[mode].description}
                        </span>
                    </button>
                )
            })}
        </div>
    );
};

export default ModeSelector;