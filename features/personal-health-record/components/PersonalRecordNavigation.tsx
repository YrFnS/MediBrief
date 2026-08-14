import React from 'react';
import {
    ActivityIcon,
    BotIcon,
    ClockIcon,
    DocumentTextIcon,
    MagnifyingGlassIcon,
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
        label: 'Today',
        shortLabel: 'Today',
        description: 'Attention items and confirmed record at a glance',
        icon: ActivityIcon,
    },
    {
        value: 'health-data',
        label: 'Health Record',
        shortLabel: 'Record',
        description: 'Grouped clinical details, care, and documents',
        icon: DocumentTextIcon,
    },
    {
        value: 'timeline',
        label: 'Timeline',
        shortLabel: 'Timeline',
        description: 'Longitudinal clinical history',
        icon: ClockIcon,
    },
    {
        value: 'search',
        label: 'Search & Export',
        shortLabel: 'Search',
        description: 'Find records and create local summaries',
        icon: MagnifyingGlassIcon,
    },
    {
        value: 'emergency',
        label: 'Emergency',
        shortLabel: 'Emergency',
        description: 'Printable confirmed-data summary',
        icon: ShieldCheckIcon,
    },
    {
        value: 'assistant',
        label: 'Assistant',
        shortLabel: 'Assistant',
        description: 'Optional reviewed-model tools',
        icon: BotIcon,
    },
];

const PersonalRecordNavigation: React.FC<PersonalRecordNavigationProps> = ({
    value,
    onChange,
    pendingCandidates = 0,
}) => {
    const handleKeyDown = (
        event: React.KeyboardEvent<HTMLButtonElement>,
        index: number,
    ): void => {
        let nextIndex: number | null = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            nextIndex = (index + 1) % items.length;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            nextIndex = (index - 1 + items.length) % items.length;
        } else if (event.key === 'Home') {
            nextIndex = 0;
        } else if (event.key === 'End') {
            nextIndex = items.length - 1;
        }

        if (nextIndex === null) return;
        event.preventDefault();
        onChange(items[nextIndex].value);
        const tabs = event.currentTarget.parentElement
            ?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        tabs?.[nextIndex]?.focus();
    };

    return (
        <div className="flex-shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90">
            <nav
                className="no-scrollbar mx-auto flex max-w-7xl items-stretch gap-1 overflow-x-auto px-3 py-2 md:px-6"
                aria-label="Patient record navigation"
                aria-orientation="horizontal"
                role="tablist"
            >
                {items.map((item, index) => {
                    const Icon = item.icon;
                    const active = item.value === value;
                    return (
                        <button
                            key={item.value}
                            id={`patient-record-tab-${item.value}`}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            aria-controls="patient-record-content"
                            tabIndex={active ? 0 : -1}
                            onClick={() => onChange(item.value)}
                            onKeyDown={event => handleKeyDown(event, index)}
                            className={`group relative flex min-w-[122px] flex-1 items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all md:min-w-[158px] ${active
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
                                    <span className="hidden sm:inline">
                                        {item.label}
                                    </span>
                                    <span className="sm:hidden">
                                        {item.shortLabel}
                                    </span>
                                    {(item.value === 'overview'
                                        || item.value === 'health-data')
                                        && pendingCandidates > 0 && (
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
};

export default PersonalRecordNavigation;
