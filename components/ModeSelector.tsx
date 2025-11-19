
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
        <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-full p-1">
            {Object.values(ChatMode).map((mode) => {
                const Icon = ICONS[mode];
                return (
                    <button
                        key={mode}
                        onClick={() => onModeChange(mode)}
                        className={`relative group px-2 py-1 md:px-3 md:py-1.5 rounded-full text-xs md:text-sm font-semibold transition-colors duration-300 flex items-center space-x-1.5
                            ${currentMode === mode 
                                ? 'bg-white dark:bg-slate-800 text-blue-500 shadow' 
                                : 'text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                            }`}
                    >
                        <Icon className="w-4 h-4" />
                        <span className="hidden md:inline">{mode}</span>
                         <span className="absolute top-full mt-2 w-max max-w-xs bg-slate-800 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-30">
                            {MODEL_CONFIGS[mode].description}
                        </span>
                    </button>
                )
            })}
        </div>
    );
};

export default ModeSelector;
