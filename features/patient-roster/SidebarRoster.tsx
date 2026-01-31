
import React, { useState, useRef } from 'react';
import { usePatientStore } from '../patient-management/usePatientStore';
import { useChatStore } from '../chat/stores/useChatStore';
import { useClinicalStore } from '../clinical-analysis/stores/useClinicalStore';
import PatientCard from './PatientCard';
import AddPatientDialog from './AddPatientDialog';
import { ChevronLeftIcon, UsersIcon, DownloadIcon, ClipboardIcon, PlusIcon } from '../../components/icons';
import { useToast } from '../../components/Toast';
import { PatientMetadata, FullPatientContext } from '../patient-management/types';

interface SidebarRosterProps {
    isOpen: boolean;
    toggle: () => void;
}

const SidebarRoster: React.FC<SidebarRosterProps> = ({ isOpen, toggle }) => {
    // Zustand Selectors
    const { patients, activePatientId, actions } = usePatientStore(state => ({
        patients: state.patients,
        activePatientId: state.activePatientId,
        actions: state.actions
    }));
    
    // Access other store actions for CRUD sync
    const chatActions = useChatStore(state => state.actions);
    const clinicalActions = useClinicalStore(state => state.actions);

    const { showToast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const patientsList = (Object.values(patients) as PatientMetadata[]).sort((a, b) => b.lastActive - a.lastActive);

    const handleSwitch = (id: string) => {
        actions.switchPatient(id);
    };

    const handleDelete = (id: string, name: string) => {
        if (Object.keys(patients).length <= 1) {
            showToast("Cannot delete the only active patient context.", 'error');
            return;
        }

        if (confirm(`Are you sure you want to delete the context for "${name}"?\nThis action cannot be undone.`)) {
             actions.deletePatient(id);
             chatActions.deleteChat(id);
             clinicalActions.deletePatient(id);
             showToast(`Patient context deleted`, 'info');
        }
    };

    const handleCreate = (name: string) => {
        const newId = actions.createPatient(name);
        chatActions.initializeChat(newId);
        clinicalActions.initializePatient(newId);
        setIsDialogOpen(false);
        showToast(`Patient context '${name}' initialized`, 'success');
    };

    const handleExportData = () => {
        try {
            const chatState = useChatStore.getState().chats;
            const clinicalState = useClinicalStore.getState().data;
            const alertsState = useClinicalStore.getState().alerts;
            
            // Construct composite export object
            const exportData: Record<string, FullPatientContext> = {};
            Object.keys(patients).forEach(id => {
                exportData[id] = {
                    ...patients[id],
                    chatHistory: chatState[id] || [],
                    clinicalData: clinicalState[id] || { observations: [] },
                    activeAlerts: alertsState[id] || []
                };
            });

            const payload = { 
                version: '4.2', 
                patients: exportData, 
                activePatientId 
            };

            const dataStr = JSON.stringify(payload);
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
                const imported = JSON.parse(event.target?.result as string);
                
                if (imported && imported.patients) {
                    // Deconstruct and distribute to stores
                    const patientMeta: Record<string, PatientMetadata> = {};
                    
                    Object.keys(imported.patients).forEach(id => {
                        const full = imported.patients[id] as FullPatientContext;
                        
                        // 1. Meta Store
                        patientMeta[id] = {
                            id: full.id,
                            name: full.name,
                            status: full.status,
                            entities: full.entities,
                            documents: full.documents,
                            createdAt: full.createdAt,
                            lastActive: full.lastActive
                        };

                        // 2. Chat Store
                        useChatStore.setState(state => ({
                            chats: { ...state.chats, [id]: full.chatHistory || [] }
                        }));

                        // 3. Clinical Store
                        useClinicalStore.setState(state => ({
                            data: { ...state.data, [id]: full.clinicalData || { observations: [] } },
                            alerts: { ...state.alerts, [id]: full.activeAlerts || [] }
                        }));
                    });

                    actions.setAllPatients(patientMeta, imported.activePatientId || Object.keys(patientMeta)[0]);
                    
                    showToast('System state restored successfully.', 'success');
                } else {
                    throw new Error("Invalid format");
                }
            } catch (error) {
                console.error(error);
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
                    flex-shrink-0 bg-white/95 dark:bg-[#080b14]/95 backdrop-blur-xl border-r border-slate-200 dark:border-white/5 transition-all duration-300 ease-in-out relative z-40
                    ${isOpen ? 'w-80' : 'w-0 opacity-0 md:opacity-100 md:w-16'}
                `}
            >
                <button
                    onClick={toggle}
                    className={`
                        absolute -right-3 top-20 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1.5 shadow-float text-slate-500 hover:text-blue-500 transition-colors
                        ${isOpen ? 'rotate-0' : 'rotate-180'}
                    `}
                    aria-label="Toggle Roster"
                >
                    <ChevronLeftIcon className="w-3 h-3" />
                </button>

                <div className={`flex flex-col h-full overflow-hidden ${!isOpen && 'hidden md:flex'}`}>
                    
                    {/* Header */}
                    <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between h-20">
                        {isOpen ? (
                            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                                <div className="p-2 bg-blue-50 dark:bg-slate-800 rounded-lg text-blue-500">
                                    <UsersIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <span className="font-bold text-sm tracking-tight block">Patient Roster</span>
                                    <span className="text-[10px] text-slate-400 font-medium">ACTIVE CONTEXTS</span>
                                </div>
                            </div>
                        ) : (
                            <div className="w-full flex justify-center">
                                <UsersIcon className="w-5 h-5 text-slate-400" />
                            </div>
                        )}
                        
                        {isOpen && (
                            <div className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-white/5 px-2 py-1 rounded-full">
                                {patientsList.length}
                            </div>
                        )}
                    </div>

                    {/* Patient List */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/50 dark:bg-transparent">
                        {isOpen ? (
                            patientsList.map(patient => (
                                <PatientCard
                                    key={patient.id}
                                    patient={patient}
                                    isActive={patient.id === activePatientId}
                                    onClick={() => handleSwitch(patient.id)}
                                    onDelete={(e) => handleDelete(patient.id, patient.name)}
                                />
                            ))
                        ) : (
                            <div className="flex flex-col gap-3 items-center mt-2">
                                {patientsList.map(patient => (
                                    <button
                                        key={patient.id}
                                        onClick={() => handleSwitch(patient.id)}
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all relative group shadow-sm
                                            ${patient.id === activePatientId 
                                                ? 'bg-blue-600 border-blue-600 text-white shadow-blue-500/30' 
                                                : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 hover:border-blue-400'
                                            }
                                        `}
                                        title={patient.name}
                                    >
                                        <span className="text-xs font-bold">
                                            {patient.name.substring(0, 2).toUpperCase()}
                                        </span>
                                        <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                                            patient.status === 'Critical' ? 'bg-red-500' : 
                                            patient.status === 'Stable' ? 'bg-emerald-500' : 'bg-slate-400'
                                        }`}></div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-white dark:bg-black/20 space-y-3">
                        {isOpen ? (
                            <>
                                <button 
                                    onClick={() => setIsDialogOpen(true)}
                                    className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 rounded-lg text-xs font-bold uppercase tracking-wide transition-all shadow-lg shadow-slate-900/10 active:translate-y-0.5"
                                >
                                    <PlusIcon className="w-4 h-4" />
                                    <span>New Context</span>
                                </button>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={handleExportData}
                                        className="flex-1 flex items-center justify-center gap-1.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-colors"
                                        title="Backup Data"
                                    >
                                        <DownloadIcon className="w-3.5 h-3.5" />
                                        <span>Backup</span>
                                    </button>
                                    <button 
                                        onClick={handleImportClick}
                                        className="flex-1 flex items-center justify-center gap-1.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-colors"
                                        title="Restore Data"
                                    >
                                        <ClipboardIcon className="w-3.5 h-3.5" />
                                        <span>Restore</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                             <button 
                                onClick={() => setIsDialogOpen(true)}
                                className="w-full flex items-center justify-center p-3 text-slate-400 hover:text-blue-500 transition-colors"
                                title="Add Patient"
                            >
                                <PlusIcon className="w-6 h-6" />
                            </button>
                        )}
                        <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileImport} />
                    </div>
                </div>
            </aside>

            {/* Mobile Overlay - Lighter/Clean */}
            {isOpen && (
                <div 
                    className="md:hidden fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-sm transition-opacity"
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
