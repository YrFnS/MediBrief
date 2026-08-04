import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIcon,
    AlertTriangleIcon,
    CheckIcon,
    ClockIcon,
} from '../../components/icons';
import {
    selectConfirmedPatientSummary,
    type ConfirmedVital,
} from '../clinical-record/selectors';
import { useClinicalRecordStore } from '../clinical-record/useClinicalRecordStore';
import { usePatientStore } from '../patient-management/usePatientStore';
import type {
    PatientMetadata,
    PatientStatus,
} from '../patient-management/types';

interface HeadsUpDisplayProps {
    patient: PatientMetadata;
}

const STATUS_OPTIONS: {
    value: PatientStatus;
    color: string;
    label: string;
}[] = [
    { value: 'Stable', color: 'bg-emerald-500', label: 'Stable' },
    { value: 'Critical', color: 'bg-red-500', label: 'Critical' },
    { value: 'New Admission', color: 'bg-indigo-500', label: 'New Admission' },
    { value: 'Discharge Ready', color: 'bg-blue-500', label: 'Discharge Ready' },
];

const formatTimeAgo = (date: Date) => {
    const diffMs = Date.now() - date.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHrs < 1) return '<1h';
    if (diffHrs < 24) return `${diffHrs}h`;
    return `${Math.floor(diffHrs / 24)}d`;
};

const VitalCard: React.FC<{
    label: string;
    vital: ConfirmedVital;
    colorClass: string;
}> = ({ label, vital, colorClass }) => (
    <div className="flex min-w-[80px] flex-col border-r border-slate-100 px-3 transition-opacity duration-500 last:border-0 dark:border-slate-800">
        <div className="mb-0.5 flex items-center justify-between">
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
                {label}
            </span>
            {vital.isStale && (
                <div
                    className="flex items-center gap-0.5 rounded-sm bg-amber-50 px-1 text-[8px] font-bold text-amber-500 dark:bg-amber-900/30"
                    title={`Last confirmed observation: ${vital.observedAt.toLocaleString()}`}
                >
                    <ClockIcon className="h-2 w-2" />
                    <span>{formatTimeAgo(vital.observedAt)}</span>
                </div>
            )}
        </div>

        <div className="relative flex items-baseline gap-1">
            <span
                className={`text-sm font-mono font-bold tracking-tight tabular-nums ${vital.isStale
                    ? 'text-slate-400 line-through decoration-1 decoration-slate-300 opacity-70 dark:text-slate-500'
                    : colorClass
                }`}
                title={vital.normalized
                    ? 'Displayed from a reviewed normalized value'
                    : 'Displayed from the reviewed original value'}
            >
                {vital.value}
            </span>
            <span className="text-[9px] font-medium text-slate-400">
                {vital.unit}
            </span>
        </div>
    </div>
);

const HeadsUpDisplay: React.FC<HeadsUpDisplayProps> = ({ patient }) => {
    const patientActions = usePatientStore(state => state.actions);
    const record = useClinicalRecordStore(state => state.records[patient.id]);
    const clinicalActions = useClinicalRecordStore(state => state.actions);

    const summary = useMemo(
        () => record ? selectConfirmedPatientSummary(record) : null,
        [record],
    );

    const displayName = summary?.profile.displayName || patient.name;
    const confirmedAllergies = summary?.allergies || [];
    const activeConditions = summary?.conditions.filter(condition =>
        condition.clinicalStatus === 'active'
        || condition.clinicalStatus === 'unknown',
    ) || [];
    const codeStatus = summary?.codeStatus || null;
    const vitals = summary?.vitals || {
        heartRate: null,
        bloodPressure: null,
        oxygenSaturation: null,
        temperature: null,
    };

    const { status, id } = patient;
    const isCritical = status === 'Critical';

    const [isEditingName, setIsEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(displayName);
    const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const statusMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setNameInput(displayName);
    }, [displayName]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                statusMenuRef.current
                && !statusMenuRef.current.contains(event.target as Node)
            ) {
                setIsStatusMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNameSave = () => {
        const nextName = nameInput.trim();
        if (nextName && nextName !== displayName) {
            patientActions.updatePatientDetails(id, { name: nextName });
            if (!record) {
                clinicalActions.initializePatientRecord({
                    patientId: id,
                    displayName: nextName,
                });
            } else {
                clinicalActions.updatePatientProfile(
                    id,
                    { displayName: nextName },
                    { reason: 'Patient display name updated from the active context header' },
                );
            }
        } else {
            setNameInput(displayName);
        }
        setIsEditingName(false);
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') handleNameSave();
        if (event.key === 'Escape') {
            setNameInput(displayName);
            setIsEditingName(false);
        }
    };

    const handleStatusChange = (newStatus: PatientStatus) => {
        patientActions.updatePatientDetails(id, { status: newStatus });
        setIsStatusMenuOpen(false);
    };

    const allergyTitle = confirmedAllergies
        .map(allergy => allergy.substance.text)
        .join(', ');
    const conditionTitle = activeConditions
        .map(condition => condition.code.text)
        .join(', ');

    return (
        <div className="sticky top-0 z-20 animate-slide-up border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-md transition-all dark:border-slate-800 dark:bg-slate-900/95">
            <div className="mx-auto flex max-w-5xl flex-col justify-between md:flex-row md:items-center">
                <div className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 dark:border-slate-800 md:w-auto md:border-b-0">
                    <div ref={statusMenuRef} className="relative flex-shrink-0">
                        <button
                            onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)}
                            className={`h-8 w-2 cursor-pointer rounded-full transition-all duration-300 hover:scale-y-110 ${isCritical
                                ? 'animate-pulse bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                                : status === 'Stable'
                                    ? 'bg-emerald-500'
                                    : status === 'Discharge Ready'
                                        ? 'bg-blue-500'
                                        : 'bg-indigo-500'
                            }`}
                            title={`Current workspace status: ${status}`}
                        />

                        {isStatusMenuOpen && (
                            <div className="absolute left-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-800">
                                <div className="border-b border-slate-100 px-3 py-2 text-[10px] font-mono font-bold uppercase text-slate-400 dark:border-slate-700">
                                    Set workspace status
                                </div>
                                {STATUS_OPTIONS.map(option => (
                                    <button
                                        key={option.value}
                                        onClick={() => handleStatusChange(option.value)}
                                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 ${status === option.value
                                            ? 'text-slate-900 dark:text-white'
                                            : 'text-slate-500 dark:text-slate-400'
                                        }`}
                                    >
                                        <span className={`h-2 w-2 rounded-full ${option.color}`} />
                                        <span className="flex-1">{option.label}</span>
                                        {status === option.value && (
                                            <CheckIcon className="h-3 w-3 text-blue-500" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex min-w-0 flex-col justify-center">
                        <h2 className="mb-0.5 text-[10px] font-mono font-bold uppercase leading-none tracking-widest text-slate-400">
                            Active patient record
                        </h2>

                        {isEditingName ? (
                            <input
                                ref={nameInputRef}
                                type="text"
                                value={nameInput}
                                onChange={event => setNameInput(event.target.value)}
                                onBlur={handleNameSave}
                                onKeyDown={handleKeyDown}
                                autoFocus
                                className="w-full rounded-none border-b-2 border-blue-500 bg-white px-0 text-sm font-bold text-slate-900 focus:outline-none dark:bg-slate-800 dark:text-white"
                            />
                        ) : (
                            <p
                                onClick={() => {
                                    setIsEditingName(true);
                                    setTimeout(() => nameInputRef.current?.focus(), 0);
                                }}
                                className="cursor-text truncate text-sm font-bold leading-tight text-slate-900 transition-colors hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                                title="Click to rename"
                            >
                                {displayName}
                            </p>
                        )}
                    </div>
                </div>

                <div className="no-scrollbar mask-fade-r flex flex-1 items-center gap-4 divide-x divide-slate-100 overflow-x-auto px-3 py-1.5 dark:divide-slate-800 md:justify-end md:py-2">
                    {(vitals.heartRate
                        || vitals.bloodPressure
                        || vitals.oxygenSaturation
                        || vitals.temperature) && (
                        <div className="flex animate-fade-in items-center gap-0 pr-2">
                            {vitals.heartRate && (
                                <VitalCard
                                    label="HR"
                                    vital={vitals.heartRate}
                                    colorClass="text-green-600 dark:text-green-400"
                                />
                            )}
                            {vitals.bloodPressure && (
                                <VitalCard
                                    label="BP"
                                    vital={vitals.bloodPressure}
                                    colorClass="text-slate-700 dark:text-slate-200"
                                />
                            )}
                            {vitals.oxygenSaturation && (
                                <VitalCard
                                    label="SpO2"
                                    vital={vitals.oxygenSaturation}
                                    colorClass="text-blue-600 dark:text-blue-400"
                                />
                            )}
                            {vitals.temperature && (
                                <VitalCard
                                    label="Temp"
                                    vital={vitals.temperature}
                                    colorClass="text-amber-600 dark:text-amber-400"
                                />
                            )}
                        </div>
                    )}

                    <div className="flex flex-shrink-0 items-center gap-2 pl-4">
                        {codeStatus && (
                            <div className="flex items-center gap-1.5 rounded-md border border-purple-100 bg-purple-50 px-2 py-1 dark:border-purple-800 dark:bg-purple-900/30">
                                <ActivityIcon className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                                <span className="whitespace-nowrap text-[9px] font-mono font-bold uppercase tracking-wide text-purple-700 dark:text-purple-300">
                                    {codeStatus}
                                </span>
                            </div>
                        )}

                        {activeConditions.length > 0 && (
                            <div
                                className="flex items-center gap-1.5 rounded-md border border-blue-100 bg-blue-50 px-2 py-1 dark:border-blue-800 dark:bg-blue-900/30"
                                title={conditionTitle}
                            >
                                <ActivityIcon className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                                <span className="whitespace-nowrap text-[9px] font-mono font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                                    {activeConditions.length} confirmed {activeConditions.length === 1 ? 'condition' : 'conditions'}
                                </span>
                            </div>
                        )}

                        {confirmedAllergies.length > 0 ? (
                            <div
                                className="animate-pulse-slow flex cursor-help items-center gap-1.5 rounded-md border border-red-100 bg-red-50 px-2 py-1 dark:border-red-800 dark:bg-red-900/30"
                                title={allergyTitle}
                            >
                                <AlertTriangleIcon className="h-3 w-3 text-red-600 dark:text-red-400" />
                                <span className="whitespace-nowrap text-[9px] font-mono font-bold uppercase tracking-wide text-red-700 dark:text-red-300">
                                    {confirmedAllergies.length} confirmed {confirmedAllergies.length === 1 ? 'allergy' : 'allergies'}
                                </span>
                            </div>
                        ) : (
                            <div
                                className="flex items-center gap-1.5 rounded-md border border-slate-100 bg-slate-50 px-2 py-1 opacity-70 dark:border-slate-700 dark:bg-slate-800"
                                title="No allergy record has been confirmed. This does not mean the patient has no allergies."
                            >
                                <span className="whitespace-nowrap text-[9px] font-mono font-bold uppercase tracking-wide text-slate-400">
                                    Allergy status unknown
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
