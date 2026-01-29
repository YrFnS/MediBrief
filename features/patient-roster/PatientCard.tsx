
import React, { useMemo, useEffect, useState } from 'react';
import { PatientMetadata, PatientStatus } from '../patient-management/types';
import { UserIcon, AlertTriangleIcon, CheckIcon, ActivityIcon, XCircleIcon, ClockIcon } from '../../components/icons';

interface PatientCardProps {
    patient: PatientMetadata;
    isActive: boolean;
    onClick: () => void;
    onDelete: (e: React.MouseEvent) => void;
}

// Cleaner, softer theme config for "Clinical Zen"
const THEME_CONFIG: Record<PatientStatus, { 
    bg: string; 
    border: string; 
    text: string; 
    icon: React.FC<any>; 
    indicator: string;
}> = {
    'Critical': {
        bg: 'bg-red-50 dark:bg-red-950/30',
        border: 'border-red-200 dark:border-red-900',
        text: 'text-red-700 dark:text-red-300',
        icon: AlertTriangleIcon,
        indicator: 'bg-red-500'
    },
    'Stable': {
        bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        border: 'border-emerald-200 dark:border-emerald-900',
        text: 'text-emerald-700 dark:text-emerald-400',
        icon: ActivityIcon,
        indicator: 'bg-emerald-500'
    },
    'New Admission': {
        bg: 'bg-indigo-50 dark:bg-indigo-950/30',
        border: 'border-indigo-200 dark:border-indigo-900',
        text: 'text-indigo-700 dark:text-indigo-400',
        icon: UserIcon,
        indicator: 'bg-indigo-500'
    },
    'Discharge Ready': {
        bg: 'bg-blue-50 dark:bg-blue-950/30',
        border: 'border-blue-200 dark:border-blue-900',
        text: 'text-blue-700 dark:text-blue-400',
        icon: CheckIcon,
        indicator: 'bg-blue-500'
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
    const [timeAgo, setTimeAgo] = useState(formatTimeAgo(patient.lastActive));

    // Update time ago every minute
    useEffect(() => {
        const interval = setInterval(() => setTimeAgo(formatTimeAgo(patient.lastActive)), 60000);
        return () => clearInterval(interval);
    }, [patient.lastActive]);

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
                w-full text-left rounded-lg border transition-all duration-200 group relative cursor-pointer
                ${isActive 
                    ? `${theme.bg} ${theme.border} border-l-4 shadow-sm`
                    : 'bg-white dark:bg-slate-900/50 border-transparent border-l-4 border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800'
                }
            `}
            style={{ borderLeftColor: isActive ? undefined : 'transparent' }} 
        >
            <div className="p-3">
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                    <div className="flex flex-col min-w-0 pr-2">
                        <span className={`text-sm font-semibold truncate ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                            {patient.name}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${theme.indicator} ${patient.status === 'Critical' ? 'animate-pulse' : ''}`}></span>
                            <span className={`text-[10px] font-medium uppercase tracking-wide ${isActive ? theme.text : 'text-slate-400'}`}>
                                {patient.status}
                            </span>
                        </div>
                    </div>

                    <button 
                        type="button"
                        onClick={(e) => { 
                            e.preventDefault();
                            e.stopPropagation(); 
                            onDelete(e); 
                        }}
                        className={`
                            p-1 rounded-full transition-all duration-200
                            ${isActive 
                                ? 'text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' 
                                : 'text-slate-300 hover:text-red-500'
                            }
                        `}
                        title="Delete Context"
                    >
                        <XCircleIcon className="w-4 h-4" />
                    </button>
                </div>

                {/* Details */}
                <div className="flex items-center justify-between mt-3">
                    <div className={`
                        px-2 py-0.5 rounded-md border text-[10px] font-medium truncate max-w-[120px]
                        ${isActive 
                            ? 'bg-white/50 dark:bg-black/10 border-black/5 text-slate-700 dark:text-slate-300' 
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                        }
                    `}>
                        {primaryDiagnosis}
                    </div>
                    
                    <div className="flex items-center gap-1 text-[9px] text-slate-400 font-mono">
                        <ClockIcon className="w-3 h-3" />
                        <span>{timeAgo}</span>
                    </div>
                </div>

                {/* Status Tags */}
                {(patient.entities.allergies.length > 0 || patient.entities.codeStatus !== 'Full Code') && (
                    <div className="mt-2 pt-2 border-t border-black/5 dark:border-white/5 flex gap-1 flex-wrap">
                         {patient.entities.codeStatus !== 'Full Code' && (
                             <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-sm">
                                {patient.entities.codeStatus}
                             </span>
                         )}
                         {patient.entities.allergies.length > 0 && (
                             <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-sm">
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
