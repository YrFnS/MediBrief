
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { usePatientStore } from '../patient-management/usePatientStore';
import { useClinicalStore } from '../clinical-analysis/stores/useClinicalStore';
import { PatientMetadata, PatientStatus } from '../patient-management/types';
import { FHIRObservation } from '../fhir/types';
import { AlertTriangleIcon, ActivityIcon, CheckIcon, ClockIcon } from '../../components/icons';

interface HeadsUpDisplayProps {
    patient: PatientMetadata;
}

const STATUS_OPTIONS: { value: PatientStatus; color: string; label: string }[] = [
    { value: 'Stable', color: 'bg-emerald-500', label: 'Stable' },
    { value: 'Critical', color: 'bg-red-500', label: 'Critical' },
    { value: 'New Admission', color: 'bg-indigo-500', label: 'New Admission' },
    { value: 'Discharge Ready', color: 'bg-blue-500', label: 'Discharge Ready' },
];

// Helper to extract latest vital from FHIR observations
const getLatestVital = (observations: FHIRObservation[], searchTerms: string[]) => {
    // Filter matches
    const matches = observations.filter(o => {
        const text = o.code.text?.toLowerCase() || '';
        return searchTerms.some(term => text.includes(term));
    });

    if (matches.length === 0) return null;

    // Sort by effectiveDateTime desc
    matches.sort((a, b) => {
        const dateA = a.effectiveDateTime ? new Date(a.effectiveDateTime).getTime() : 0;
        const dateB = b.effectiveDateTime ? new Date(b.effectiveDateTime).getTime() : 0;
        return dateB - dateA;
    });

    const latest = matches[0];
    const val = latest.valueQuantity?.value;
    const unit = latest.valueQuantity?.unit || '';
    const date = latest.effectiveDateTime ? new Date(latest.effectiveDateTime) : new Date();
    
    // Check staleness (older than 4 hours)
    const isStale = (Date.now() - date.getTime()) > (4 * 60 * 60 * 1000);

    return { val, unit, isStale, date };
};

const formatTimeAgo = (date: Date) => {
    const diffMs = Date.now() - date.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHrs < 1) return '<1h';
    if (diffHrs < 24) return `${diffHrs}h`;
    return `${Math.floor(diffHrs / 24)}d`;
};

const VitalCard: React.FC<{ label: string; value: string | number; unit: string; isStale: boolean; date?: Date; colorClass: string }> = ({ label, value, unit, isStale, date, colorClass }) => {
    return (
        <div className={`flex flex-col px-3 border-r border-slate-100 dark:border-slate-800 last:border-0 min-w-[80px] transition-opacity duration-500`}>
            <div className="flex justify-between items-center mb-0.5">
                <span className="text-[9px] font-mono uppercase text-slate-400 font-bold tracking-wider">{label}</span>
                {isStale && date && (
                    <div className="flex items-center gap-0.5 text-[8px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-900/30 px-1 rounded-sm" title={`Last updated: ${date.toLocaleString()}`}>
                        <ClockIcon className="w-2 h-2" />
                        <span>{formatTimeAgo(date)}</span>
                    </div>
                )}
            </div>
            
            <div className="flex items-baseline gap-1 relative">
                {isStale ? (
                    // Stale State: Dimmed value with Strikethrough visual cue or just lowered opacity
                    <span className="text-sm font-mono font-bold tracking-tight tabular-nums text-slate-400 dark:text-slate-500 line-through decoration-slate-300 decoration-1 opacity-70" title="Value is older than 4 hours">
                        {value}
                    </span>
                ) : (
                    // Fresh State
                    <span className={`text-sm font-mono font-bold tracking-tight tabular-nums ${colorClass}`}>
                        {value}
                    </span>
                )}
                
                <span className="text-[9px] text-slate-400 font-medium">
                    {unit}
                </span>
            </div>
        </div>
    );
};

const HeadsUpDisplay: React.FC<HeadsUpDisplayProps> = ({ patient }) => {
    const actions = usePatientStore(state => state.actions);
    
    // Subscribe to clinical data for this patient
    const clinicalData = useClinicalStore(state => state.data[patient.id]);
    const observations = clinicalData?.observations || [];

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

    // Memoize Vitals Extraction
    const vitals = useMemo(() => {
        const hr = getLatestVital(observations, ['heart rate', 'pulse', 'hr']);
        const bp = getLatestVital(observations, ['blood pressure', 'bp', 'systolic']);
        const spo2 = getLatestVital(observations, ['o2', 'oxygen', 'saturation', 'spo2']);
        const temp = getLatestVital(observations, ['temp', 'temperature']);

        return { hr, bp, spo2, temp };
    }, [observations]);

    return (
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 shadow-sm transition-all animate-slide-up">
            <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between">
                
                {/* TOP ROW: Identity & Status */}
                <div className="flex items-center gap-3 px-3 py-2 border-b md:border-b-0 border-slate-100 dark:border-slate-800 w-full md:w-auto">
                    {/* Status Indicator & Switcher */}
                    <div ref={statusMenuRef} className="relative flex-shrink-0">
                        <button 
                            onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                            className={`w-2 h-8 rounded-full transition-all duration-300 cursor-pointer hover:scale-y-110 ${isCritical ? 'bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 
                                status === 'Stable' ? 'bg-emerald-500' :
                                status === 'Discharge Ready' ? 'bg-blue-500' : 'bg-indigo-500'}`}
                            title={`Current Status: ${status}`}
                        ></button>

                        {/* Status Dropdown Menu */}
                        {isStatusMenuOpen && (
                            <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-lg py-1 z-50 animate-fade-in overflow-hidden">
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
                    <div className="flex flex-col justify-center min-w-0">
                        <h2 className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 leading-none mb-0.5">Active Context</h2>
                        
                        {isEditingName ? (
                            <input
                                ref={nameInputRef}
                                type="text"
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                onBlur={handleNameSave}
                                onKeyDown={handleKeyDown}
                                autoFocus
                                className="text-sm font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 border-b-2 border-blue-500 px-0 rounded-none focus:outline-none w-full"
                            />
                        ) : (
                            <p 
                                onClick={() => { setIsEditingName(true); setTimeout(() => nameInputRef.current?.focus(), 0); }}
                                className="text-sm font-bold text-slate-900 dark:text-white truncate cursor-text hover:text-blue-600 dark:hover:text-blue-400 transition-colors leading-tight"
                                title="Click to rename"
                            >
                                {name}
                            </p>
                        )}
                    </div>
                </div>

                {/* BOTTOM ROW (Mobile) / RIGHT SIDE (Desktop): Clinical Data */}
                <div className="flex items-center flex-1 overflow-x-auto no-scrollbar mask-fade-r px-3 py-1.5 md:py-2 md:justify-end gap-4 divide-x divide-slate-100 dark:divide-slate-800">
                    
                    {/* VITALS MONITOR */}
                    {(vitals.hr || vitals.bp || vitals.spo2 || vitals.temp) && (
                        <div className="flex items-center gap-0 pr-2 animate-fade-in">
                            {vitals.hr && (
                                <VitalCard 
                                    label="HR" 
                                    value={vitals.hr.val ?? '--'} 
                                    unit="bpm" 
                                    isStale={vitals.hr.isStale}
                                    date={vitals.hr.date}
                                    colorClass="text-green-600 dark:text-green-400"
                                />
                            )}
                            {vitals.bp && (
                                <VitalCard 
                                    label="BP" 
                                    value={vitals.bp.val ?? '--'} 
                                    unit="mmHg" 
                                    isStale={vitals.bp.isStale}
                                    date={vitals.bp.date}
                                    colorClass="text-slate-700 dark:text-slate-200"
                                />
                            )}
                            {vitals.spo2 && (
                                <VitalCard 
                                    label="SpO2" 
                                    value={vitals.spo2.val ?? '--'} 
                                    unit="%" 
                                    isStale={vitals.spo2.isStale}
                                    date={vitals.spo2.date}
                                    colorClass="text-blue-600 dark:text-blue-400"
                                />
                            )}
                             {vitals.temp && (
                                <VitalCard 
                                    label="Temp" 
                                    value={vitals.temp.val ?? '--'} 
                                    unit="°C" 
                                    isStale={vitals.temp.isStale}
                                    date={vitals.temp.date}
                                    colorClass="text-amber-600 dark:text-amber-400"
                                />
                            )}
                        </div>
                    )}

                    {/* Safety Badges */}
                    <div className="flex items-center gap-2 pl-4 flex-shrink-0">
                        {codeStatus && codeStatus !== 'Full Code' && (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 dark:bg-purple-900/30 border border-purple-100 dark:border-purple-800 rounded-md">
                                <ActivityIcon className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                                <span className="text-[9px] font-mono font-bold uppercase text-purple-700 dark:text-purple-300 tracking-wide whitespace-nowrap">{codeStatus}</span>
                            </div>
                        )}

                        {hasAllergies ? (
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded-md animate-pulse-slow cursor-help" title={entities.allergies.join(", ")}>
                                <AlertTriangleIcon className="w-3 h-3 text-red-600 dark:text-red-400" />
                                <span className="text-[9px] font-mono font-bold uppercase text-red-700 dark:text-red-300 tracking-wide whitespace-nowrap">
                                    {entities.allergies.length} ALLERGIES
                                </span>
                            </div>
                        ) : (
                            <div 
                                className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-md opacity-60"
                            >
                                <span className="text-[9px] font-mono font-bold uppercase text-slate-400 tracking-wide whitespace-nowrap">
                                    NKDA
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HeadsUpDisplay;
