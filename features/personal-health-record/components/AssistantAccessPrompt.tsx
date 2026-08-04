import React from 'react';
import {
    BotIcon,
    CogIcon,
    ShieldCheckIcon,
} from '../../../components/icons';

interface AssistantAccessPromptProps {
    onOpenSettings: () => void;
}

const AssistantAccessPrompt: React.FC<AssistantAccessPromptProps> = ({
    onOpenSettings,
}) => (
    <div className="flex flex-1 items-center justify-center overflow-y-auto bg-slate-50 p-5 dark:bg-slate-950">
        <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-float dark:border-slate-800 dark:bg-slate-950 md:p-8">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
                <BotIcon className="h-7 w-7" />
            </span>
            <p className="mt-5 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-blue-600">
                Optional assistant workspace
            </p>
            <h1 className="mt-2 text-2xl font-display font-bold text-slate-950 dark:text-white">
                Add an AI provider key to use the assistant
            </h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                Overview, timeline, emergency summary, candidate review, and the local structured record remain available without an AI key. A key is needed only for chat, document analysis, live voice, and ambient scribe features.
            </p>

            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-left dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                    <ShieldCheckIcon className="h-4 w-4" />
                    <span className="text-xs font-bold">Your record is still usable</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-emerald-800/75 dark:text-emerald-200/70">
                    Return to Overview, Timeline, or Emergency Summary at any time. The assistant is no longer the gatekeeper for the personal health record.
                </p>
            </div>

            <button
                type="button"
                onClick={onOpenSettings}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-blue-500/20 transition-colors hover:bg-blue-500"
            >
                <CogIcon className="h-4 w-4" />
                Configure AI provider
            </button>
        </div>
    </div>
);

export default AssistantAccessPrompt;
