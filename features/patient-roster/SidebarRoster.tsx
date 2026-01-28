
import React, { useState, useRef } from 'react';
import { usePatientStore } from '../patient-management/usePatientStore';
import PatientCard from './PatientCard';
import AddPatientDialog from './AddPatientDialog';
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, UsersIcon, DownloadIcon, ClipboardIcon } from '../../components/icons';
import { useToast } from '../../components/Toast';

interface SidebarRosterProps {
    isOpen: boolean;
    toggle: () => void;
}

const SidebarRoster: React.FC<SidebarRosterProps> = ({ isOpen, toggle }) => {
    const { state, dispatch } = usePatientStore();
    const { showToast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const patientsList = Object.values(state.patients).sort((a, b) => b.lastActive - a.lastActive);

    const handleSwitch = (id: string) => {
        dispatch({ type: 'SWITCH_PATIENT', payload: { id } });
    };

    const handleCreate = (name: string) => {
        dispatch({ type: 'CREATE_PATIENT', payload: { name } });
        setIsDialogOpen(false);
        showToast(`Patient context '${name}' initialized`, 'success');
    };

    const handleExportData = () => {
        try {
            const dataStr = JSON.stringify(state);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `medibrief-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('System backup downloaded successfully', 'success');
        } catch (e) {
            showToast('Failed to export system data', 'error');
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedState = JSON.parse(event.target?.result as string);
                if (importedState && importedState.patients) {
                    dispatch({ type: 'HYDRATE', payload: importedState });
                    showToast('System data restored successfully', 'success');
                } else {
                    throw new Error("Invalid format");
                }
            } catch (error) {
                showToast('Invalid backup file format', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset input
    };

    return (
        <>
            <aside 
                className={`
                    flex-shrink-0 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out relative z-40
                    ${isOpen ? 'w-72' : 'w-0 opacity-0 md:opacity-100 md:w-12'}
                `}
            >
                <button
                    onClick={toggle}
                    className={`
                        absolute -right-3 top-20 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1 shadow-md text-slate-500 hover:text-blue-500 transition-colors
                        ${isOpen ? 'rotate-0' : 'rotate-180'}
                    `}
                    aria-label="Toggle Roster"
                >
                    <ChevronLeftIcon className="w-3 h-3" />
                </button>

                <div className={`flex flex-col h-full overflow-hidden ${!isOpen && 'hidden md:flex'}`}>
                    
                    {/* Header */}
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between h-16">
                        {isOpen ? (
                            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                                <UsersIcon className="w-4 h-4" />
                                <span className="font-mono text-xs font-bold uppercase tracking-widest">Active Roster</span>
                            </div>
                        ) : (
                            <div className="w-full flex justify-center">
                                <UsersIcon className="w-5 h-5 text-slate-400" />
                            </div>
                        )}
                        
                        {isOpen && (
                            <div className="text-[10px] font-mono text-slate-400 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded-sm">
                                {patientsList.length}
                            </div>
                        )}
                    </div>

                    {/* Patient List */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {isOpen ? (
                            patientsList.map(patient => (
                                <PatientCard
                                    key={patient.id}
                                    patient={patient}
                                    isActive={patient.id === state.activePatientId}
                                    onClick={() => handleSwitch(patient.id)}
                                />
                            ))
                        ) : (
                            <div className="flex flex-col gap-2 items-center mt-2">
                                {patientsList.map(patient => (
                                    <button
                                        key={patient.id}
                                        onClick={() => handleSwitch(patient.id)}
                                        className={`w-8 h-8 rounded-sm flex items-center justify-center border transition-all relative group
                                            ${patient.id === state.activePatientId 
                                                ? 'bg-blue-600 border-blue-600 text-white' 
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-blue-400'
                                            }
                                        `}
                                        title={patient.name}
                                    >
                                        <span className="text-[10px] font-bold font-mono">
                                            {patient.name.substring(0, 2).toUpperCase()}
                                        </span>
                                        <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                                            patient.status === 'Critical' ? 'bg-red-500' : 
                                            patient.status === 'Stable' ? 'bg-emerald-500' : 'bg-slate-400'
                                        }`}></div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/50 space-y-2">
                        {isOpen ? (
                            <>
                                <button 
                                    onClick={() => setIsDialogOpen(true)}
                                    className="w-full flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-blue-500 text-slate-600 dark:text-slate-300 px-3 py-2 rounded-sm text-xs font-bold uppercase tracking-wide transition-all shadow-sm"
                                >
                                    <PlusIcon className="w-3.5 h-3.5" />
                                    <span>Add Patient</span>
                                </button>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleExportData}
                                        className="flex-1 flex items-center justify-center gap-1.5 bg-slate-200 dark:bg-slate-800 border border-transparent hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-1.5 rounded-sm text-[10px] font-mono font-bold uppercase transition-colors"
                                        title="Backup Data"
                                    >
                                        <DownloadIcon className="w-3 h-3" />
                                        <span>Backup</span>
                                    </button>
                                    <button 
                                        onClick={handleImportClick}
                                        className="flex-1 flex items-center justify-center gap-1.5 bg-slate-200 dark:bg-slate-800 border border-transparent hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 px-2 py-1.5 rounded-sm text-[10px] font-mono font-bold uppercase transition-colors"
                                        title="Restore Data"
                                    >
                                        <ClipboardIcon className="w-3 h-3" />
                                        <span>Restore</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                             <button 
                                onClick={() => setIsDialogOpen(true)}
                                className="w-full flex items-center justify-center p-2 text-slate-500 hover:text-blue-500"
                                title="Add Patient"
                            >
                                <PlusIcon className="w-5 h-5" />
                            </button>
                        )}
                        <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileImport} />
                    </div>
                </div>
            </aside>

            {/* Mobile Overlay */}
            {isOpen && (
                <div 
                    className="md:hidden fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm"
                    onClick={toggle}
                ></div>
            )}

            <AddPatientDialog 
                isOpen={isDialogOpen} 
                onClose={() => setIsDialogOpen(false)} 
                onSubmit={handleCreate} 
            />
        </>
    );
};

export default SidebarRoster;
