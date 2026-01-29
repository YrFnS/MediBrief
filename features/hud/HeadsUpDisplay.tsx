
import React, { useState, useRef, useEffect } from 'react';
import { usePatientStore } from '../patient-management/usePatientStore';
import { PatientMetadata, PatientStatus } from '../patient-management/types';
import { AlertTriangleIcon, ActivityIcon, HelpIcon, CheckIcon, ChevronRightIcon } from '../../components/icons';

interface HeadsUpDisplayProps {
    patient: PatientMetadata;
}

const STATUS_OPTIONS: { value: PatientStatus; color: string; label: string }[] = [
    { value: 'Stable', color: 'bg-emerald-500', label: 'Stable' },
    { value: 'Critical', color: 'bg-red-500', label: 'Critical' },
    { value: 'New Admission', color: 'bg-indigo-500', label: 'New Admission' },
    { value: 'Discharge Ready', color: 'bg-blue-500', label: 'Discharge Ready' },
];

const HeadsUpDisplay: React.FC<HeadsUpDisplayProps> = ({ patient }) => {
    const actions = usePatientStore(state => state.actions);
    const { entities, name, status, id } = patient;
    const hasAllergies = entities.allergies.length > 0;
    const isCritical = status === 'Critical';
    const codeStatus = entities.codeStatus;

    // Local State for interactions
    const [isEditingName, setIsEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(name);
    const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const statusMenuRef = useRef<HTMLDivElement>(null);

    // Close status menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (statusMenuRef.current && !statusMenuRef.current.contains(event.target as Node)) {
                setIsStatusMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNameSave = () => {
        if (nameInput.trim() !== name) {
            actions.updatePatientDetails(id, { name: nameInput.trim() });
        }
        setIsEditingName(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleNameSave();
        if (e.key === 'Escape') {
            setNameInput(name);
            setIsEditingName(false);
        }
    };

    const handleStatusChange = (newStatus: PatientStatus) => {
        actions.updatePatientDetails(id, { status: newStatus });
        setIsStatusMenuOpen(false);
    };

    return (
        <div className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm transition-all animate-slide-up">
            <div className="max-w-6xl mx-auto px-3 py-2 flex items-center justify-between gap-4 overflow-x-auto no-scrollbar relative">
                
                {/* Identity Block (Interactive) */}
                <div className="flex items-center gap-3 flex-shrink-0 relative group">
                    {/* Status Indicator & Switcher */}
                    <div ref={statusMenuRef} className="relative">
                        <button 
                            onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                            className={`w-2 h-8 rounded-sm transition-all duration-300 cursor-pointer hover:w-3 hover:brightness-110 ${isCritical ? 'bg-red-500 animate-pulse' : 
                                status === 'Stable' ? 'bg-emerald-500' :
                                status === 'Discharge Ready' ? 'bg-blue-500' : 'bg-indigo-500'}`}
                            title="Change Status"
                        ></button>

                        {/* Status Dropdown Menu */}
                        {isStatusMenuOpen && (
                            <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-sm py-1 z-50 animate-fade-in">
                                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 text-[10px] font-mono font-bold uppercase text-slate-400">
                                    Set Patient Status
                                </div>
                                {STATUS_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => handleStatusChange(opt.value)}
                                        className={`w-full text-left px-3 py-2 text-xs font-bold uppercase tracking-wide flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors
                                            ${status === opt.value ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}
                                        `}
                                    >
                                        <span className={`w-2 h-2 rounded-full ${opt.color}`}></span>
                                        <span className="flex-1">{opt.label}</span>
                                        {status === opt.value && <CheckIcon className="w-3 h-3 text-blue-500" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Name / Context Editor */}
                    <div className="flex flex-col">
                        <h2 className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Active Context</h2>
                        
                        {isEditingName ? (
                            <input
                                ref={nameInputRef}
                                type="text"
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                onBlur={handleNameSave}
                                onKeyDown={handleKeyDown}
                                autoFocus
                                className="text-sm font-bold text-slate-800 dark:text-white bg-white dark:bg-slate-800 border border-blue-500 px-1 rounded-sm focus:outline-none min-w-[150px]"
                            />
                        ) : (
                            <p 
                                onClick={() => { setIsEditingName(true); setTimeout(() => nameInputRef.current?.focus(), 0); }}
                                className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-[150px] md:max-w-xs cursor-text hover:text-blue-600 dark:hover:text-blue-400 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 px-1 -ml-1 rounded-sm transition-all"
                                title="Click to rename"
                            >
                                {name}
                            </p>
                        )}
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
                        <div 
                            className="hidden md:flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm opacity-70 hover:opacity-100 transition-opacity cursor-help group"
                            title="The AI has not detected allergies in the current files. This does NOT guarantee NKDA. Please verify manually."
                        >
                            <HelpIcon className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                            <span className="text-[10px] font-mono font-bold uppercase text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 tracking-wide transition-colors">
                                No Allergies Found (Verify)
                            </span>
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
