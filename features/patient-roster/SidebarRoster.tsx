import React, { useRef, useState } from 'react';
import {
    ChevronLeftIcon,
    ClipboardIcon,
    DownloadIcon,
    PlusIcon,
    UsersIcon,
} from '../../components/icons';
import { useToast } from '../../components/Toast';
import { blobStorage } from '../../services/blobStorageService';
import { useChatStore } from '../chat/stores/useChatStore';
import { useClinicalStore } from '../clinical-analysis/stores/useClinicalStore';
import {
    applyPreparedMediBriefBackup,
    createMediBriefBackupV2,
    downloadMediBriefBackup,
    migrateCurrentLegacyStores,
    prepareMediBriefBackupText,
} from '../clinical-record/backupService';
import { mapLegacyAdministrativeSex } from '../clinical-record/legacyMigration';
import { useClinicalRecordStore } from '../clinical-record/useClinicalRecordStore';
import type {
    PatientDemographics,
    PatientMetadata,
} from '../patient-management/types';
import { usePatientStore } from '../patient-management/usePatientStore';
import AddPatientDialog from './AddPatientDialog';
import PatientCard from './PatientCard';

interface SidebarRosterProps {
    isOpen: boolean;
    toggle: () => void;
}

const SidebarRoster: React.FC<SidebarRosterProps> = ({ isOpen, toggle }) => {
    const patients = usePatientStore(state => state.patients);
    const activePatientId = usePatientStore(state => state.activePatientId);
    const actions = usePatientStore(state => state.actions);

    const chatActions = useChatStore(state => state.actions);
    const clinicalActions = useClinicalStore(state => state.actions);
    const clinicalRecordActions = useClinicalRecordStore(state => state.actions);

    const { showToast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isBackupBusy, setIsBackupBusy] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const patientsList = (Object.values(patients) as PatientMetadata[])
        .sort((left, right) => right.lastActive - left.lastActive);

    const handleSwitch = (id: string) => {
        actions.switchPatient(id);
    };

    const handleDelete = async (id: string, name: string) => {
        if (Object.keys(patients).length <= 1) {
            showToast('Cannot delete the only active patient context.', 'error');
            return;
        }

        if (!confirm(
            `Are you sure you want to delete the context for "${name}"?\nThis action cannot be undone.`,
        )) return;

        const patient = patients[id];
        if (patient?.documents) {
            let deletedCount = 0;
            for (const document of patient.documents) {
                if (!document.storageId) continue;
                try {
                    await blobStorage.deleteFile(document.storageId);
                    deletedCount += 1;
                } catch (error) {
                    console.warn(
                        'Failed to delete file asset:',
                        document.storageId,
                        error,
                    );
                }
            }
            if (deletedCount > 0) {
                console.info(`Cleaned up ${deletedCount} patient asset(s).`);
            }
        }

        actions.deletePatient(id);
        chatActions.deleteChat(id);
        clinicalActions.deletePatient(id);
        clinicalRecordActions.deletePatientRecord(id);
        showToast('Patient context deleted', 'info');
    };

    const handleCreate = (
        name: string,
        demographics: PatientDemographics,
    ) => {
        const newId = actions.createPatient(name, demographics);
        chatActions.initializeChat(newId);
        clinicalActions.initializePatient(newId);
        clinicalRecordActions.initializePatientRecord({
            patientId: newId,
            displayName: name,
            administrativeSex: mapLegacyAdministrativeSex(demographics.sex),
        });

        // Age and weight remain dated/unknown-date observations rather than
        // being converted into an invented date of birth or static profile fact.
        migrateCurrentLegacyStores();

        setIsDialogOpen(false);
        showToast(`Patient context '${name}' initialized`, 'success');
    };

    const handleExportData = async () => {
        if (isBackupBusy) return;
        setIsBackupBusy(true);

        try {
            const { backup, migrationReport } = await createMediBriefBackupV2();
            downloadMediBriefBackup(backup);

            const migratedCount =
                migrationReport.patientRecordsCreated
                + migrationReport.patientRecordsUpdated;
            const missingCount = backup.assets.missingStorageIds.length;

            showToast(
                missingCount > 0
                    ? `Backup created with ${missingCount} missing local asset payload(s). Their references were preserved.`
                    : `Portable backup created${migratedCount > 0 ? ` after migrating ${migratedCount} patient record(s)` : ''}.`,
                missingCount > 0 ? 'info' : 'success',
            );
        } catch (error) {
            console.error('Backup export failed:', error);
            showToast(
                `Backup Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'error',
            );
        } finally {
            setIsBackupBusy(false);
        }
    };

    const handleImportClick = () => {
        if (!isBackupBusy) fileInputRef.current?.click();
    };

    const handleFileImport = async (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = event.target.files?.[0];
        if (!file || isBackupBusy) return;

        setIsBackupBusy(true);
        try {
            const prepared = prepareMediBriefBackupText(await file.text());
            const result = await applyPreparedMediBriefBackup(prepared);

            if (result.warnings.length > 0) {
                console.warn('Backup restore warnings:', result.warnings);
                showToast(
                    `Restored ${result.restoredPatients} patient context(s) with ${result.warnings.length} warning(s).`,
                    'info',
                );
            } else {
                showToast(
                    `Restored ${result.restoredPatients} patient context(s), ${result.restoredClinicalRecords} clinical record(s), and ${result.restoredAssets} file asset(s).`,
                    'success',
                );
            }
        } catch (error) {
            console.error('Backup restore failed:', error);
            showToast(
                `Import Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'error',
            );
        } finally {
            setIsBackupBusy(false);
            event.target.value = '';
        }
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
                        hidden md:flex absolute -right-3 top-20 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full p-1.5 shadow-float text-slate-500 hover:text-blue-500 transition-colors
                        ${isOpen ? 'rotate-0' : 'rotate-180'}
                    `}
                    aria-label="Toggle Roster"
                >
                    <ChevronLeftIcon className="w-3 h-3" />
                </button>

                <div className={`flex flex-col h-full overflow-hidden ${!isOpen && 'hidden md:flex'}`}>
                    <div className="p-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between h-20">
                        {isOpen ? (
                            <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                                <div className="p-2 bg-blue-50 dark:bg-slate-800 rounded-lg text-blue-500">
                                    <UsersIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <span className="font-bold text-sm tracking-tight block">
                                        Patient Roster
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                        ACTIVE CONTEXTS
                                    </span>
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

                    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50/50 dark:bg-transparent">
                        {isOpen ? (
                            patientsList.map(patient => (
                                <PatientCard
                                    key={patient.id}
                                    patient={patient}
                                    isActive={patient.id === activePatientId}
                                    onClick={() => handleSwitch(patient.id)}
                                    onDelete={() => handleDelete(patient.id, patient.name)}
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
                                            patient.status === 'Critical'
                                                ? 'bg-red-500'
                                                : patient.status === 'Stable'
                                                    ? 'bg-emerald-500'
                                                    : 'bg-slate-400'
                                        }`}></div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

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
                                        disabled={isBackupBusy}
                                        className="flex-1 flex items-center justify-center gap-1.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Create portable backup"
                                    >
                                        <DownloadIcon className="w-3.5 h-3.5" />
                                        <span>{isBackupBusy ? 'Working' : 'Backup'}</span>
                                    </button>
                                    <button
                                        onClick={handleImportClick}
                                        disabled={isBackupBusy}
                                        className="flex-1 flex items-center justify-center gap-1.5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 px-3 py-2 rounded-lg text-[10px] font-bold uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Restore v2 or legacy v4.2 backup"
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
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".json,application/json"
                            onChange={handleFileImport}
                        />
                    </div>
                </div>
            </aside>

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
