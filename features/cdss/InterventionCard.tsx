import React from 'react';
import {
    AlertTriangleIcon,
    BoltIcon,
    CheckIcon,
} from '../../components/icons';
import type { CDSSAction, CDSSAlert } from './types';

interface InterventionCardProps {
    alert: CDSSAlert;
    onAction: (alert: CDSSAlert, actionIndex: number) => void;
    variant?: 'toast' | 'banner';
}

const displayedActionLabel = (action: CDSSAction): string => {
    if (action.type === 'order') {
        return `Create task: ${action.label}`;
    }
    return action.label;
};

const ActionIcon: React.FC<{ action: CDSSAction }> = ({ action }) => {
    if (action.type === 'create-task' || action.type === 'order') {
        return <BoltIcon className="h-4 w-4" />;
    }
    if (action.type === 'acknowledge') {
        return <CheckIcon className="h-4 w-4" />;
    }
    return <span className="text-lg leading-none">×</span>;
};

const InterventionCard: React.FC<InterventionCardProps> = ({
    alert,
    onAction,
    variant = 'toast',
}) => {
    const isCritical = alert.level === 'Critical';
    const isBanner = variant === 'banner';

    if (isBanner) {
        return (
            <div className="relative w-full overflow-hidden rounded-lg border-2 border-red-400 bg-red-600 text-white shadow-[0_0_40px_rgba(220,38,38,0.4)] animate-slide-up">
                <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)] opacity-10" />
                <div className="relative z-10 flex flex-col items-start gap-5 p-5 md:flex-row md:items-center md:gap-6 md:p-6">
                    <div className="flex-shrink-0">
                        <div className="rounded-full bg-white/20 p-4 shadow-inner">
                            <AlertTriangleIcon className="h-8 w-8 text-white" />
                        </div>
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h3 className="text-xl font-display font-bold uppercase leading-none tracking-widest text-white">
                                {alert.title}
                            </h3>
                            <span className="rounded border border-red-400/50 bg-red-950/40 px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest text-red-100">
                                Validated advisory — review promptly
                            </span>
                        </div>
                        <p className="mb-3 max-w-2xl text-sm font-medium leading-relaxed text-red-50">
                            {alert.description}
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {alert.triggers.map((trigger, index) => (
                                <span
                                    key={index}
                                    className="flex items-center gap-1.5 rounded border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-mono text-red-100"
                                >
                                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                                    {trigger}
                                </span>
                            ))}
                        </div>
                        {alert.sourceCitation && (
                            <p className="mt-3 text-[10px] font-mono text-red-100/80">
                                Source: {alert.sourceCitation}
                            </p>
                        )}
                    </div>

                    <div className="flex w-full min-w-[190px] flex-shrink-0 flex-col gap-2 md:w-auto">
                        {alert.actions.map((action, index) => {
                            const isDismiss = action.type === 'dismiss';
                            return (
                                <button
                                    key={index}
                                    onClick={() => onAction(alert, index)}
                                    className={`flex w-full items-center justify-center gap-2 rounded px-4 py-3 text-xs font-bold uppercase tracking-widest shadow-lg transition-transform active:scale-95 ${isDismiss
                                        ? 'border border-red-700 bg-red-800 text-red-100 hover:bg-red-900'
                                        : 'border-b-4 border-red-200 bg-white text-red-700 hover:bg-red-50'
                                    }`}
                                >
                                    <ActionIcon action={action} />
                                    <span>{displayedActionLabel(action)}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`mb-3 w-full max-w-sm overflow-hidden rounded-sm border-y border-r border-slate-200 border-l-4 shadow-xl backdrop-blur-md transition-all animate-slide-up hover:scale-[1.02] dark:border-slate-800 ${isCritical
            ? 'border-l-red-500 bg-red-50/95 dark:bg-slate-900/95'
            : 'border-l-amber-500 bg-amber-50/95 dark:bg-slate-900/95'
        }`}>
            <div className={`flex items-center justify-between px-4 py-2 ${isCritical
                ? 'bg-red-100/50 dark:bg-red-900/20'
                : 'bg-amber-100/50 dark:bg-amber-900/20'
            }`}>
                <div className="flex items-center gap-2">
                    <AlertTriangleIcon className={`h-4 w-4 ${isCritical
                        ? 'text-red-600'
                        : 'text-amber-600'
                    }`} />
                    <span className={`text-xs font-mono font-bold uppercase tracking-widest ${isCritical
                        ? 'text-red-700 dark:text-red-400'
                        : 'text-amber-700 dark:text-amber-400'
                    }`}>
                        {alert.title}
                    </span>
                </div>
                <div className="flex gap-1">
                    {alert.triggers.slice(0, 2).map((trigger, index) => (
                        <span
                            key={index}
                            className="rounded-sm border border-black/5 bg-white/50 px-1.5 py-0.5 text-[9px] font-mono dark:border-white/10 dark:bg-black/50"
                        >
                            {trigger}
                        </span>
                    ))}
                </div>
            </div>

            <div className="p-4">
                <p className="mb-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {alert.description}
                </p>
                {alert.sourceCitation && (
                    <p className="mb-3 text-[9px] font-mono text-slate-400">
                        Source: {alert.sourceCitation}
                    </p>
                )}
                <div className="flex flex-wrap gap-2">
                    {alert.actions.map((action, index) => {
                        const isDismiss = action.type === 'dismiss';
                        return (
                            <button
                                key={index}
                                onClick={() => onAction(alert, index)}
                                className={`flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-all ${isDismiss
                                    ? 'border border-transparent bg-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                    : isCritical
                                        ? 'bg-red-600 text-white shadow-sm hover:bg-red-500'
                                        : 'bg-amber-500 text-white shadow-sm hover:bg-amber-400'
                                }`}
                            >
                                <ActionIcon action={action} />
                                <span>{displayedActionLabel(action)}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default InterventionCard;
