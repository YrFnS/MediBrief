
import React, { useMemo, useEffect, useState } from 'react';
import { PatientMetadata, PatientStatus } from '../patient-management/types';
import { UserIcon, AlertTriangleIcon, CheckIcon, ActivityIcon, XCircleIcon, ClockIcon } from '../../components/icons';

interface PatientCardProps {
    patient: PatientMetadata;
    isActive: boolean;
    onClick: () => void;
    onDelete: (e: React.MouseEvent) => void;
}

// Configuration for the "Live" themes based on status
const THEME_CONFIG: Record<PatientStatus, { 
    bg: string; 
    border: string; 
    text: string; 
    icon: React.FC<any>; 
    pulse: string; 
    glow: string;
}> = {
    'Critical': {
        bg: 'bg-red-50 dark:bg-red-950/20',
        border: 'border-red-200 dark:border-red-900',
        text: 'text-red-700 dark:text-red-400',
        icon: AlertTriangleIcon,
        pulse: 'animate-ping', // Fast panic pulse
        glow: 'shadow-[0_0_15px_rgba(239,68,68,0.15)]'
    },
    'Stable': {
        bg: 'bg-emerald-50 dark:bg-emerald-950/20',
        border: 'border-emerald-200 dark:border-emerald-900',
        text: 'text-emerald-700 dark:text-emerald-400',
        icon: ActivityIcon,
        pulse: 'animate-pulse', // Slow steady breath
        glow: 'shadow-[0_0_10px_rgba(16,185,129,0.1)]'
    },
    'New Admission': {
        bg: 'bg-indigo-50 dark:bg-indigo-950/20',
        border: 'border-indigo-200 dark:border-indigo-900',
        text: 'text-indigo-700 dark:text-indigo-400',
        icon: UserIcon,
        pulse: 'animate-bounce', // Attention seeking
        glow: 'shadow-[0_0_10px_rgba(99,102,241,0.1)]'
    },
    'Discharge Ready': {
        bg: 'bg-blue-50 dark:bg-blue-950/20',
        border: 'border-blue-200 dark:border-blue-900',
        text: 'text-blue-700 dark:text-blue-400',
        icon: CheckIcon,
        pulse: 'hidden', // No pulse, stable
        glow: 'shadow-none'
    }
};

const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
};

const PatientCard: React.FC<PatientCardProps> = ({ patient, isActive, onClick, onDelete }) => {
    const theme = THEME_CONFIG[patient.status] || THEME_CONFIG['New Admission'];
    const StatusIcon = theme.icon;
    const [timeAgo, setTimeAgo] = useState(formatTimeAgo(patient.lastActive));

    // Update time ago every minute
    useEffect(() => {
        const interval = setInterval(() => setTimeAgo(formatTimeAgo(patient.lastActive)), 60000);
        return () => clearInterval(interval);
    }, [patient.lastActive]);

    // Extract primary diagnosis for display
    const primaryDiagnosis = useMemo(() => {
        if (patient.entities.diagnosis.length > 0) return patient.entities.diagnosis[0];
        return "Undiagnosed";
    }, [patient.entities.diagnosis]);

    return (
        <div
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onClick()}
            className={`
                w-full text-left rounded-sm border transition-all duration-500 group relative overflow-hidden cursor-pointer
                ${isActive 
                    ? `border-l-4 translate-x-1 ${theme.bg} ${theme.border} ${theme.glow}`
                    : 'bg-transparent border-transparent border-l-4 border-l-transparent hover:bg-slate-50 dark:hover:bg-white/5 hover:border-slate-200 dark:hover:border-slate-800'
                }
                ${isActive ? theme.border.replace('border', 'border-l-') : ''} 
            `}
            style={{ borderLeftColor: isActive ? undefined : 'transparent' }} 
        >
            {/* Background Decoration (Subtle EKG Line) */}
            {isActive && (
                <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
                    <svg className="absolute bottom-0 left-0 w-full h-12 text-current" viewBox="0 0 400 50" preserveAspectRatio="none">
                         <path d="M0,25 L50,25 L60,10 L70,40 L80,25 L400,25" fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                    </svg>
                </div>
            )}

            <div className="p-3 relative z-10">
                {/* Header: Name & Live Status */}
                <div className="flex items-start justify-between mb-2">
                    <div className="flex flex-col min-w-0">
                        <span className={`text-xs font-mono font-bold uppercase tracking-wider truncate transition-colors ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                            {patient.name}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            {/* Live Pulse Indicator */}
                            <span className="relative flex h-1.5 w-1.5">
                              <span className={`${theme.pulse} absolute inline-flex h-full w-full rounded-full opacity-75 ${theme.text.replace('text-', 'bg-')}`}></span>
                              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${theme.text.replace('text-', 'bg-')}`}></span>
                            </span>
                            <span className={`text-[9px] font-mono uppercase ${isActive ? theme.text : 'text-slate-400'}`}>
                                {patient.status}
                            </span>
                        </div>
                    </div>

                    {/* Delete Action (Top Right) */}
                    <button 
                        type="button"
                        onClick={(e) => { 
                            e.preventDefault();
                            e.stopPropagation(); 
                            onDelete(e); 
                        }}
                        className={`
                            relative z-20 p-1.5 -mr-1 -mt-1 rounded-sm transition-all duration-200
                            ${isActive 
                                ? 'text-slate-400 hover:text-red-500 hover:bg-red-500/10' 
                                : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-slate-200 dark:hover:bg-slate-800'
                            }
                        `}
                        title="Delete Context"
                    >
                        <XCircleIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Body: Diagnosis & Time */}
                <div className="flex items-center justify-between mt-3">
                    <div className={`
                        px-2 py-0.5 rounded-sm border text-[9px] font-mono font-medium truncate max-w-[120px]
                        ${isActive 
                            ? `${theme.bg} ${theme.border} ${theme.text} border-opacity-50` 
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                        }
                    `}>
                        {primaryDiagnosis}
                    </div>
                    
                    <div className="flex items-center gap-1 text-[9px] text-slate-400 font-mono">
                        <ClockIcon className="w-2.5 h-2.5" />
                        <span>{timeAgo}</span>
                    </div>
                </div>

                {/* Footer: Alerts (Conditional) */}
                {(patient.entities.allergies.length > 0 || patient.entities.codeStatus !== 'Full Code') && (
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/50 flex gap-1 flex-wrap">
                         {patient.entities.codeStatus !== 'Full Code' && (
                             <span className="text-[8px] font-bold px-1 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-sm uppercase tracking-tight">
                                {patient.entities.codeStatus}
                             </span>
                         )}
                         {patient.entities.allergies.length > 0 && (
                             <span className="text-[8px] font-bold px-1 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-sm uppercase tracking-tight">
                                {patient.entities.allergies.length} Allergies
                             </span>
                         )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PatientCard;
