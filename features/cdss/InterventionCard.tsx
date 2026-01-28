
import React from 'react';
import { CDSSAlert } from './types';
import { AlertTriangleIcon, CheckIcon, ShieldCheckIcon, BoltIcon } from '../../components/icons';

interface InterventionCardProps {
    alert: CDSSAlert;
    onAction: (alert: CDSSAlert, actionIndex: number) => void;
}

const InterventionCard: React.FC<InterventionCardProps> = ({ alert, onAction }) => {
    const isCritical = alert.level === 'Critical';

    return (
        <div className={`
            w-full max-w-sm rounded-sm shadow-2xl border-l-4 animate-slide-up mb-3 overflow-hidden
            ${isCritical 
                ? 'bg-red-50 dark:bg-slate-900 border-red-500 border-y border-r border-slate-200 dark:border-slate-800' 
                : 'bg-amber-50 dark:bg-slate-900 border-amber-500 border-y border-r border-slate-200 dark:border-slate-800'}
        `}>
            {/* Header */}
            <div className={`px-4 py-2 flex items-center justify-between ${isCritical ? 'bg-red-100/50 dark:bg-red-900/20' : 'bg-amber-100/50 dark:bg-amber-900/20'}`}>
                <div className="flex items-center gap-2">
                    <AlertTriangleIcon className={`w-4 h-4 ${isCritical ? 'text-red-600' : 'text-amber-600'}`} />
                    <span className={`text-xs font-mono font-bold uppercase tracking-widest ${isCritical ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
                        {alert.title}
                    </span>
                </div>
                <div className="flex gap-1">
                    {alert.triggers.map((t, i) => (
                        <span key={i} className="text-[9px] font-mono bg-white dark:bg-black/50 px-1.5 py-0.5 rounded-sm border border-black/10">
                            {t}
                        </span>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="p-4">
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                    {alert.description}
                </p>

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                    {alert.actions.map((action, idx) => {
                        const isDismiss = action.type === 'dismiss';
                        return (
                            <button
                                key={idx}
                                onClick={() => onAction(alert, idx)}
                                className={`
                                    flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wide rounded-sm transition-all
                                    ${isDismiss 
                                        ? 'bg-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border border-transparent hover:border-slate-300' 
                                        : isCritical 
                                            ? 'bg-red-600 hover:bg-red-500 text-white shadow-sm' 
                                            : 'bg-amber-500 hover:bg-amber-400 text-white shadow-sm'
                                    }
                                `}
                            >
                                {action.type === 'order' && <BoltIcon className="w-3 h-3" />}
                                {action.type === 'acknowledge' && <CheckIcon className="w-3 h-3" />}
                                {action.type === 'dismiss' && <span className="text-lg leading-none">×</span>}
                                <span>{action.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default InterventionCard;
