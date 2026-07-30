import React from 'react';
import type { ChatMode } from '../types';
import ModeSelector from './ModeSelector';
import {
    CogIcon,
    DownloadIcon,
    LogoIcon,
    MenuIcon,
    NewChatIcon,
} from './icons';

interface HeaderProps {
    currentMode: ChatMode;
    onModeChange: (mode: ChatMode) => void;
    onClearChat: () => void;
    onExportChat: () => void;
    onToggleSidebar: () => void;
    onOpenSettings: () => void;
    showAssistantControls?: boolean;
}

const Header: React.FC<HeaderProps> = ({
    currentMode,
    onModeChange,
    onClearChat,
    onExportChat,
    onToggleSidebar,
    onOpenSettings,
    showAssistantControls = true,
}) => (
    <header className="sticky top-0 z-30 flex-shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur-md transition-colors dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2 md:gap-4 md:px-6 md:py-3">
            <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-3">
                <button
                    type="button"
                    onClick={onToggleSidebar}
                    className="-ml-1 flex-shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600 md:hidden dark:hover:bg-slate-800"
                    aria-label="Toggle patient roster"
                >
                    <MenuIcon className="h-5 w-5" />
                </button>

                <div className="flex min-w-0 items-center gap-2 md:gap-3">
                    <div className="flex-shrink-0 rounded-lg bg-blue-600 p-1.5 text-white shadow-lg shadow-blue-500/20 md:p-2">
                        <LogoIcon className="h-4 w-4 md:h-5 md:w-5" />
                    </div>
                    <div className="flex min-w-0 flex-col justify-center">
                        <h1 className="truncate text-sm font-display font-bold leading-none tracking-tight text-slate-900 dark:text-white md:text-lg">
                            MediBrief
                        </h1>
                        <span className="hidden truncate text-[8px] font-mono font-medium tracking-wider text-slate-400 xs:block md:text-[10px]">
                            LOCAL PERSONAL HEALTH RECORD
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex flex-shrink-0 items-center gap-1.5 md:gap-4">
                {showAssistantControls ? (
                    <ModeSelector
                        currentMode={currentMode}
                        onModeChange={onModeChange}
                    />
                ) : (
                    <span className="hidden rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-700 sm:inline dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                        Record workspace
                    </span>
                )}

                <div className="mx-1 hidden h-6 w-px bg-slate-200 md:block dark:bg-slate-800" />

                <div className="flex items-center gap-0.5 md:gap-1">
                    <button
                        type="button"
                        onClick={onOpenSettings}
                        className="rounded-lg p-1.5 text-slate-500 transition-all hover:bg-blue-50 hover:text-blue-600 md:p-2 dark:hover:bg-blue-950/40"
                        title="Settings"
                        aria-label="Open settings"
                    >
                        <CogIcon className="h-4 w-4 md:h-5 md:w-5" />
                    </button>
                    {showAssistantControls && (
                        <>
                            <button
                                type="button"
                                onClick={onExportChat}
                                className="rounded-lg p-1.5 text-slate-500 transition-all hover:bg-blue-50 hover:text-blue-600 md:p-2 dark:hover:bg-blue-950/40"
                                title="Export assistant briefing"
                                aria-label="Export assistant briefing"
                            >
                                <DownloadIcon className="h-4 w-4 md:h-5 md:w-5" />
                            </button>
                            <button
                                type="button"
                                onClick={onClearChat}
                                className="rounded-lg p-1.5 text-slate-500 transition-all hover:bg-red-50 hover:text-red-600 md:p-2 dark:hover:bg-red-950/40"
                                title="Clear assistant conversation"
                                aria-label="Clear assistant conversation"
                            >
                                <NewChatIcon className="h-4 w-4 md:h-5 md:w-5" />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    </header>
);

export default Header;
