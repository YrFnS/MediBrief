
import React from 'react';
import { PatientContext } from '../patient-management/types';
import { AlertTriangleIcon, ActivityIcon, ShieldCheckIcon } from '../../components/icons';

interface HeadsUpDisplayProps {
    patient: PatientContext;
}

const HeadsUpDisplay: React.FC<HeadsUpDisplayProps> = ({ patient }) => {
    const { entities, name, status } = patient;
    const hasAllergies = entities.allergies.length > 0;
    const isCritical = status === 'Critical';
    const codeStatus = entities.codeStatus;

    return (
        <div className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm transition-all animate-slide-up">
            <div className="max-w-6xl mx-auto px-3 py-2 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
                
                {/* Identity Block */}
                <div className="flex items-center gap-3 flex-shrink-0">
                    <div className={`w-2 h-8 rounded-sm ${isCritical ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`}></div>
                    <div>
                        <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Active Context</h2>
                        <p className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-[150px] md:max-w-xs">{name}</p>
                    </div>
                </div>

                {/* Safety Monitor Badges */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    
                    {/* Code Status Badge */}
                    {codeStatus && codeStatus !== 'Full Code' && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-sm">
                            <ActivityIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                            <span className="text-[10px] font-mono font-bold uppercase text-purple-700 dark:text-purple-300 tracking-wide">{codeStatus}</span>
                        </div>
                    )}

                    {/* Allergies Badge */}
                    {hasAllergies ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-sm animate-pulse-slow">
                            <AlertTriangleIcon className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                            <span className="text-[10px] font-mono font-bold uppercase text-red-700 dark:text-red-300 tracking-wide">
                                {entities.allergies.length} ALLERGIES DETECTED
                            </span>
                        </div>
                    ) : (
                         <div className="hidden md:flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm opacity-50">
                            <ShieldCheckIcon className="w-3.5 h-3.5 text-slate-400" />
                            <span className="text-[10px] font-mono font-bold uppercase text-slate-500 tracking-wide">NKDA Scanned</span>
                        </div>
                    )}

                    {/* Diagnosis Tags */}
                    {entities.diagnosis.length > 0 && (
                        <div className="hidden md:flex gap-1">
                            {entities.diagnosis.slice(0, 2).map((dx, i) => (
                                <span key={i} className="px-2 py-1 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900 text-[10px] font-mono text-blue-700 dark:text-blue-300 rounded-sm">
                                    {dx}
                                </span>
                            ))}
                            {entities.diagnosis.length > 2 && (
                                <span className="px-1.5 py-1 bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 rounded-sm">+{entities.diagnosis.length - 2}</span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HeadsUpDisplay;
