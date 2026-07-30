import React from 'react';
import {
    ActivityIcon,
    BotIcon,
    ClockIcon,
    ShieldCheckIcon,
} from '../../../components/icons';
import type { PersonalRecordView } from '../types';

interface PersonalRecordNavigationProps {
    value: PersonalRecordView;
    onChange: (view: PersonalRecordView) => void;
    pendingCandidates?: number;
}

const items: Array<{
    value: PersonalRecordView;
    label: string;
    shortLabel: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
}> = [
    {
        value: 'overview',
        label: 'Overview',
        shortLabel: 'Overview',
        description: 'Confirmed record at a glance',
        icon: ActivityIcon,
    },
    {
        value: 'timeline',
        label: 'Timeline',
        shortLabel: 'Timeline',
        description: 'Longitudinal clinical history',
        icon: ClockIcon,
    },
    {
        value: 'emergency',
        label: 'Emergency Summary',
        shortLabel: 'Emergency',
        description: 'Printable confirmed-data summary',
        icon: ShieldCheckIcon,
    },
    {
        value: 'assistant',
        label: 'Assistant',
        shortLabel: 'Assistant',
        description: 'Chat, document analysis, and scribe',
        icon: BotIcon,
    },
];

const PersonalRecordNavigation: React.FC<PersonalRecordNavigationProps> = ({
    value,
    onChange,
    pendingCandidates = 0,
}) => (
    <div className="flex-shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90">
        <nav
            className="no-scrollbar mx-auto flex max-w-7xl items-stretch gap-1 overflow-x-auto px-3 py-2 md:px-6"
            aria-label="Patient record navigation"
        >
            {items.map(item => {
                const Icon = item.icon;
                const active = item.value === value;
                return (
                    <button
                        key={item.value}
                        type="button"
                        onClick={() => onChange(item.value)}
                        aria-current={active ? 'page' : undefined}
                        className={`group relative flex min-w-[128px] flex-1 items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all md:min-w-[170px] ${active
                            ? 'border-blue-200 bg-blue-50 text-blue-800 shadow-sm dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200'
                            : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                        }`}
                    >
                        <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${active
                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                            : 'bg-slate-100 text-slate-500 group-hover:bg-white dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-slate-700'
                        }`}>
                            <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 text-xs font-bold">
                                <span className="hidden sm:inline">{item.label}</span>
                                <span className="sm:hidden">{item.shortLabel}</span>
                                {item.value === 'overview' && pendingCandidates > 0 && (
                                    <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                                        {pendingCandidates}
                                    </span>
                                )}
                            </span>
                            <span className="mt-0.5 hidden truncate text-[9px] font-mono uppercase tracking-wide opacity-65 md:block">
                                {item.description}
                            </span>
                        </span>
                    </button>
                );
            })}
        </nav>
    </div>
);

export default PersonalRecordNavigation;
