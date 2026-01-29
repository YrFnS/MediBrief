
import React from 'react';
import { CDSSAlert } from './types';
import { AlertTriangleIcon, CheckIcon, ShieldCheckIcon, BoltIcon } from '../../components/icons';

interface InterventionCardProps {
    alert: CDSSAlert;
    onAction: (alert: CDSSAlert, actionIndex: number) => void;
    variant?: 'toast' | 'banner';
}

const InterventionCard: React.FC<InterventionCardProps> = ({ alert, onAction, variant = 'toast' }) => {
    const isCritical = alert.level === 'Critical';
    const isBanner = variant === 'banner';

    // --- CRITICAL BANNER (MODAL OVERLAY STYLE) ---
    if (isBanner) {
        return (
            <div className="w-full bg-red-600 text-white rounded-lg shadow-[0_0_40px_rgba(220,38,38,0.4)] border-2 border-red-400 overflow-hidden animate-slide-up relative">
                {/* Background Texture */}
                <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#000_10px,#000_20px)] pointer-events-none"></div>
                
                <div className="relative z-10 p-5 md:p-6 flex flex-col md:flex-row items-start md:items-center gap-5 md:gap-6">
                    {/* Icon Block */}
                    <div className="flex-shrink-0">
                        <div className="p-4 bg-white/20 rounded-full animate-pulse shadow-inner">
                            <AlertTriangleIcon className="w-8 h-8 text-white" />
                        </div>
                    </div>
                    
                    {/* Content Block */}
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                            <h3 className="text-xl font-display font-bold uppercase tracking-widest text-white leading-none">
                                {alert.title}
                            </h3>
                            <span className="bg-red-950/40 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-widest border border-red-400/50 text-red-100">
                                Immediate Action Required
                            </span>
                        </div>
                        <p className="text-red-50 text-sm font-medium leading-relaxed max-w-2xl mb-3">
                            {alert.description}
                        </p>
                        <div className="flex flex-wrap gap-2">
                             {alert.triggers.map((t, i) => (
                                <span key={i} className="text-[10px] font-mono bg-black/20 px-2 py-1 rounded text-red-100 border border-white/10 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse"></span>
                                    {t}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Actions Block */}
                    <div className="flex flex-col gap-2 w-full md:w-auto min-w-[180px] flex-shrink-0">
                        {alert.actions.map((action, idx) => (
                            <button
                                key={idx}
                                onClick={() => onAction(alert, idx)}
                                className={`
                                    w-full py-3 px-4 text-xs font-bold uppercase tracking-widest rounded shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2
                                    ${action.type === 'dismiss' 
                                        ? 'bg-red-800 hover:bg-red-900 text-red-200 border border-red-700' 
                                        : 'bg-white text-red-700 hover:bg-red-50 border-b-4 border-red-200'
                                    }
                                `}
                            >
                                {action.type === 'order' && <BoltIcon className="w-4 h-4" />}
                                {action.type === 'acknowledge' && <CheckIcon className="w-4 h-4" />}
                                {action.type === 'dismiss' && <span>Ignore</span>}
                                <span>{action.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // --- STANDARD TOAST (NON-INTRUSIVE) ---
    return (
        <div className={`
            w-full max-w-sm rounded-sm shadow-xl border-l-4 animate-slide-up mb-3 overflow-hidden backdrop-blur-md transition-all hover:scale-[1.02]
            ${isCritical 
                ? 'bg-red-50/95 dark:bg-slate-900/95 border-red-500 border-y border-r border-slate-200 dark:border-slate-800' 
                : 'bg-amber-50/95 dark:bg-slate-900/95 border-amber-500 border-y border-r border-slate-200 dark:border-slate-800'}
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
                    {alert.triggers.slice(0, 2).map((t, i) => (
                        <span key={i} className="text-[9px] font-mono bg-white/50 dark:bg-black/50 px-1.5 py-0.5 rounded-sm border border-black/5 dark:border-white/10">
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
