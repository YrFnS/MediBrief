import React, { useMemo, useState } from 'react';
import {
    ActivityIcon,
    AlertTriangleIcon,
    BriefingIcon,
    ClockIcon,
    DocumentTextIcon,
    DrugsIcon,
    ListChecksIcon,
    RecordIcon,
    ShieldCheckIcon,
    UserIcon,
} from '../../../components/icons';
import { selectCandidateResources } from '../../clinical-record/selectors';
import type { PatientClinicalRecord } from '../../clinical-record/types';
import type { PersonalHealthDataModule } from '../planningModuleTypes';
import AllergiesModule from './AllergiesModule';
import AppointmentsModule from './AppointmentsModule';
import CarePlansModule from './CarePlansModule';
import ConditionsModule from './ConditionsModule';
import DocumentsModule from './DocumentsModule';
import ImmunizationsModule from './ImmunizationsModule';
import MedicationsModule from './MedicationsModule';
import NotesModule from './NotesModule';
import ProceduresModule from './ProceduresModule';
import RecordManagementModule from './RecordManagementModule';
import ResultsModule from './ResultsModule';
import TasksModule from './TasksModule';
import VisitsModule from './VisitsModule';

interface HealthDataWorkspaceProps {
    record: PatientClinicalRecord;
    onReviewCandidates: () => void;
}

const MODULES: Array<{
    value: PersonalHealthDataModule;
    label: string;
    shortLabel: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
}> = [
    {
        value: 'conditions',
        label: 'Conditions',
        shortLabel: 'Conditions',
        description: 'Current and historical problem list',
        icon: ActivityIcon,
    },
    {
        value: 'allergies',
        label: 'Allergies',
        shortLabel: 'Allergies',
        description: 'Criticality, reactions, and history',
        icon: AlertTriangleIcon,
    },
    {
        value: 'medications',
        label: 'Medications',
        shortLabel: 'Meds',
        description: 'Current use and medication history',
        icon: DrugsIcon,
    },
    {
        value: 'results',
        label: 'Labs & Reports',
        shortLabel: 'Results',
        description: 'Observations and diagnostic reports',
        icon: DocumentTextIcon,
    },
    {
        value: 'visits',
        label: 'Visits',
        shortLabel: 'Visits',
        description: 'Encounters and linked care records',
        icon: UserIcon,
    },
    {
        value: 'notes',
        label: 'Clinical Notes',
        shortLabel: 'Notes',
        description: 'Durable reviewed documentation',
        icon: BriefingIcon,
    },
    {
        value: 'procedures',
        label: 'Procedures',
        shortLabel: 'Procedures',
        description: 'Interventions and device evidence',
        icon: RecordIcon,
    },
    {
        value: 'immunizations',
        label: 'Immunizations',
        shortLabel: 'Vaccines',
        description: 'Vaccine history and source details',
        icon: ShieldCheckIcon,
    },
    {
        value: 'documents',
        label: 'Documents',
        shortLabel: 'Docs',
        description: 'Local sources and relationships',
        icon: DocumentTextIcon,
    },
    {
        value: 'appointments',
        label: 'Appointments',
        shortLabel: 'Appts',
        description: 'Proposals and recorded booking states',
        icon: ClockIcon,
    },
    {
        value: 'tasks',
        label: 'Tasks & Reminders',
        shortLabel: 'Tasks',
        description: 'Follow-up, due states, and ownership',
        icon: ListChecksIcon,
    },
    {
        value: 'care-plans',
        label: 'Care Plans',
        shortLabel: 'Plans',
        description: 'Conditions, activities, and plan history',
        icon: BriefingIcon,
    },
    {
        value: 'manage',
        label: 'Manage Records',
        shortLabel: 'Manage',
        description: 'Manual entry, corrections, and history',
        icon: RecordIcon,
    },
];

const HealthDataWorkspace: React.FC<HealthDataWorkspaceProps> = ({
    record,
    onReviewCandidates,
}) => {
    const [module, setModule] = useState<PersonalHealthDataModule>('conditions');
    const candidateCounts = useMemo(() => {
        const candidates = selectCandidateResources(record);
        return {
            conditions: candidates.filter(resource =>
                resource.resourceType === 'Condition').length,
            allergies: candidates.filter(resource =>
                resource.resourceType === 'AllergyIntolerance').length,
            medications: candidates.filter(resource =>
                resource.resourceType === 'Medication').length,
            results: candidates.filter(resource =>
                resource.resourceType === 'Observation'
                || resource.resourceType === 'DiagnosticReport').length,
            visits: candidates.filter(resource =>
                resource.resourceType === 'Encounter').length,
            notes: candidates.filter(resource =>
                resource.resourceType === 'ClinicalNote').length,
            procedures: candidates.filter(resource =>
                resource.resourceType === 'Procedure').length,
            immunizations: candidates.filter(resource =>
                resource.resourceType === 'Immunization').length,
            documents: candidates.filter(resource =>
                resource.resourceType === 'DocumentReference').length,
            appointments: candidates.filter(resource =>
                resource.resourceType === 'Appointment').length,
            tasks: candidates.filter(resource =>
                resource.resourceType === 'ClinicalTask').length,
            'care-plans': candidates.filter(resource =>
                resource.resourceType === 'CarePlan').length,
            manage: candidates.length,
        } satisfies Record<PersonalHealthDataModule, number>;
    }, [record]);

    const handleModuleKeyDown = (
        event: React.KeyboardEvent<HTMLButtonElement>,
        index: number,
    ): void => {
        let nextIndex: number | null = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            nextIndex = (index + 1) % MODULES.length;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            nextIndex = (index - 1 + MODULES.length) % MODULES.length;
        } else if (event.key === 'Home') {
            nextIndex = 0;
        } else if (event.key === 'End') {
            nextIndex = MODULES.length - 1;
        }
        if (nextIndex === null) return;
        event.preventDefault();
        setModule(MODULES[nextIndex].value);
        const tabs = event.currentTarget.parentElement
            ?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        tabs?.[nextIndex]?.focus();
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-shrink-0 border-b border-slate-200 bg-slate-50/95 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/95 md:px-6">
                <nav
                    className="no-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto"
                    aria-label="Health data modules"
                    aria-orientation="horizontal"
                    role="tablist"
                >
                    {MODULES.map((item, index) => {
                        const Icon = item.icon;
                        const active = module === item.value;
                        const pending = candidateCounts[item.value];
                        return (
                            <button
                                key={item.value}
                                id={`health-data-tab-${item.value}`}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                aria-controls="health-data-panel"
                                tabIndex={active ? 0 : -1}
                                onClick={() => setModule(item.value)}
                                onKeyDown={event => handleModuleKeyDown(event, index)}
                                className={`group flex min-w-[130px] flex-1 items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors md:min-w-[170px] ${active
                                    ? 'border-slate-300 bg-white text-slate-950 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white'
                                    : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-white dark:text-slate-400 dark:hover:border-slate-800 dark:hover:bg-slate-900'
                                }`}
                            >
                                <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${active
                                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                                    : 'bg-slate-200/70 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                }`}>
                                    <Icon className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1.5 text-xs font-bold">
                                        <span className="hidden sm:inline">{item.label}</span>
                                        <span className="sm:hidden">{item.shortLabel}</span>
                                        {pending > 0 && (
                                            <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] text-white">
                                                {pending}
                                            </span>
                                        )}
                                    </span>
                                    <span className="mt-0.5 hidden truncate text-[9px] font-mono uppercase tracking-wide opacity-60 lg:block">
                                        {item.description}
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </nav>
            </div>

            <div
                id="health-data-panel"
                role="tabpanel"
                aria-labelledby={`health-data-tab-${module}`}
                className="flex min-h-0 flex-1 flex-col"
            >
                {module === 'conditions' && (
                    <ConditionsModule
                        record={record}
                        onReviewCandidates={onReviewCandidates}
                    />
                )}
                {module === 'allergies' && (
                    <AllergiesModule
                        record={record}
                        onReviewCandidates={onReviewCandidates}
                    />
                )}
                {module === 'medications' && (
                    <MedicationsModule
                        record={record}
                        onReviewCandidates={onReviewCandidates}
                    />
                )}
                {module === 'results' && (
                    <ResultsModule
                        record={record}
                        onReviewCandidates={onReviewCandidates}
                    />
                )}
                {module === 'visits' && (
                    <VisitsModule
                        record={record}
                        onReviewCandidates={onReviewCandidates}
                    />
                )}
                {module === 'notes' && (
                    <NotesModule
                        record={record}
                        onReviewCandidates={onReviewCandidates}
                    />
                )}
                {module === 'procedures' && (
                    <ProceduresModule
                        record={record}
                        onReviewCandidates={onReviewCandidates}
                    />
                )}
                {module === 'immunizations' && (
                    <ImmunizationsModule
                        record={record}
                        onReviewCandidates={onReviewCandidates}
                    />
                )}
                {module === 'documents' && (
                    <DocumentsModule
                        record={record}
                        onReviewCandidates={onReviewCandidates}
                    />
                )}
                {module === 'appointments' && (
                    <AppointmentsModule
                        record={record}
                        onReviewCandidates={onReviewCandidates}
                    />
                )}
                {module === 'tasks' && (
                    <TasksModule
                        record={record}
                        onReviewCandidates={onReviewCandidates}
                    />
                )}
                {module === 'care-plans' && (
                    <CarePlansModule
                        record={record}
                        onReviewCandidates={onReviewCandidates}
                    />
                )}
                {module === 'manage' && (
                    <RecordManagementModule
                        record={record}
                        onReviewCandidates={onReviewCandidates}
                    />
                )}
            </div>
        </div>
    );
};

export default HealthDataWorkspace;
