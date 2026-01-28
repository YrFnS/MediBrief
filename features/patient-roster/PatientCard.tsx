
import React from 'react';
import { PatientContext, PatientStatus } from '../patient-management/types';
import { UserIcon, AlertTriangleIcon, CheckIcon, ActivityIcon } from '../../components/icons';

interface PatientCardProps {
    patient: PatientContext;
    isActive: boolean;
    onClick: () => void;
}

const getStatusColor = (status: PatientStatus) => {
    switch (status) {
        case 'Critical': return 'text-red-500 border-red-500 bg-red-500/10';
        case 'Stable': return 'text-emerald-500 border-emerald-500 bg-emerald-500/10';
        case 'Discharge Ready': return 'text-blue-500 border-blue-500 bg-blue-500/10';
        default: return 'text-slate-400 border-slate-400 bg-slate-400/10';
    }
};

const getStatusIcon = (status: PatientStatus) => {
    switch (status) {
        case 'Critical': return <AlertTriangleIcon className="w-3 h-3" />;
        case 'Stable': return <ActivityIcon className="w-3 h-3" />;
        case 'Discharge Ready': return <CheckIcon className="w-3 h-3" />;
        default: return <UserIcon className="w-3 h-3" />;
    }
};

const PatientCard: React.FC<PatientCardProps> = ({ patient, isActive, onClick }) => {
    const statusClass = getStatusColor(patient.status);
    
    return (
        <button
            onClick={onClick}
            className={`w-full text-left p-3 rounded-lg border transition-all duration-300 group relative overflow-hidden
                ${isActive 
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 border-blue-500 shadow-lg shadow-blue-500/20 translate-x-1' 
                    : 'bg-transparent border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700'
                }
            `}
        >
            <div className="flex items-start justify-between mb-1.5 pl-1 relative z-10">
                <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                    {patient.name}
                </span>
                {patient.status === 'Critical' && (
                    <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                )}
            </div>

            <div className="flex items-center gap-2 pl-1 relative z-10">
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[9px] font-mono uppercase font-bold tracking-wide 
                    ${isActive ? 'bg-black/20 border-white/20 text-white' : statusClass}`}>
                    {getStatusIcon(patient.status)}
                    <span>{patient.status}</span>
                </div>
                
                {patient.chatHistory.length > 0 && (
                     <span className={`text-[9px] font-mono ml-auto ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                        {patient.chatHistory.length} msgs
                     </span>
                )}
            </div>

            {/* Entity Quick View (If available) */}
            {(patient.entities.codeStatus || patient.entities.allergies.length > 0) && (
                <div className={`mt-2 pt-2 border-t pl-1 flex flex-wrap gap-1 relative z-10 ${isActive ? 'border-white/20' : 'border-slate-100 dark:border-slate-700/50'}`}>
                    {patient.entities.codeStatus && patient.entities.codeStatus !== 'Full Code' && (
                         <span className={`text-[8px] px-1.5 rounded-sm ${isActive ? 'bg-red-500/30 text-white' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'}`}>
                            {patient.entities.codeStatus}
                         </span>
                    )}
                    {patient.entities.allergies.length > 0 && (
                         <span className={`text-[8px] px-1.5 rounded-sm ${isActive ? 'bg-amber-500/30 text-white' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'}`}>
                            {patient.entities.allergies.length} ALLERGIES
                         </span>
                    )}
                </div>
            )}
        </button>
    );
};

export default PatientCard;
