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
import { useAuditStore } from '../../audit/useAuditStore';
import { selectCandidateResources } from '../../clinical-record/selectors';
import type { PatientClinicalRecord } from '../../clinical-record/types';
import {
    buildMedicationReconciliationViewModel,
} from '../../medication-reconciliation';
import MedicationReconciliationWorkspace from '../../medication-reconciliation/components/MedicationReconciliationWorkspace';
import {
    buildExplicitReminderViewModel,
} from '../../trend-reminders';
import TrendAndReminderWorkspace from '../../trend-reminders/components/TrendAndReminderWorkspace';
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

type HealthArea =
    | 'record'
    | 'medications'
    | 'results'
    | 'care'
    | 'documents'
    | 'manage';

interface ModuleDefinition {
    value: PersonalHealthDataModule;
    area: HealthArea;
    label: string;
    shortLabel: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
}

interface AreaDefinition {
    value: HealthArea;
    label: string;
    shortLabel: string;
    description: string;
    defaultModule: PersonalHealthDataModule;
    icon: React.ComponentType<{ className?: string }>;
}

const MODULES: ModuleDefinition[] = [
    {
        value: 'conditions',
        area: 'record',
        label: 'Conditions',
        shortLabel: 'Conditions',
        description: 'Current and historical problem list',
        icon: ActivityIcon,
    },
    {
        value: 'allergies',
        area: 'record',
        label: 'Allergies',
        shortLabel: 'Allergies',
        description: 'Criticality, reactions, and history',
        icon: AlertTriangleIcon,
    },
    {
        value: 'visits',
        area: 'record',
        label: 'Visits',
        shortLabel: 'Visits',
        description: 'Encounters and linked care records',
        icon: UserIcon,
    },
    {
        value: 'procedures',
        area: 'record',
        label: 'Procedures',
        shortLabel: 'Procedures',
        description: 'Interventions and device evidence',
        icon: RecordIcon,
    },
    {
        value: 'immunizations',
        area: 'record',
        label: 'Immunizations',
        shortLabel: 'Vaccines',
        description: 'Vaccine history and source details',
        icon: ShieldCheckIcon,
    },
    {
        value: 'notes',
        area: 'record',
        label: 'Clinical Notes',
        shortLabel: 'Notes',
        description: 'Durable reviewed documentation',
        icon: BriefingIcon,
    },
    {
        value: 'medications',
        area: 'medications',
        label: 'Medications',
        shortLabel: 'Medication list',
        description: 'Current use and medication history',
        icon: DrugsIcon,
    },
    {
        value: 'medication-reconciliation',
        area: 'medications',
        label: 'Medication Reconciliation',
        shortLabel: 'Reconciliation',
        description: 'Compare sources and review discrepancies',
        icon: ListChecksIcon,
    },
    {
        value: 'results',
        area: 'results',
        label: 'Labs & Reports',
        shortLabel: 'Results',
        description: 'Observations and diagnostic reports',
        icon: DocumentTextIcon,
    },
    {
        value: 'trend-reminders',
        area: 'results',
        label: 'Trends & Reminders',
        shortLabel: 'Trends',
        description: 'Recorded arithmetic and explicit date reminders',
        icon: ActivityIcon,
    },
    {
        value: 'appointments',
        area: 'care',
        label: 'Appointments',
        shortLabel: 'Appointments',
        description: 'Proposals and recorded booking states',
        icon: ClockIcon,
    },
    {
        value: 'tasks',
        area: 'care',
        label: 'Tasks & Reminders',
        shortLabel: 'Tasks',
        description: 'Follow-up, due states, and ownership',
        icon: ListChecksIcon,
    },
    {
        value: 'care-plans',
        area: 'care',
        label: 'Care Plans',
        shortLabel: 'Care plans',
        description: 'Conditions, activities, and plan history',
        icon: BriefingIcon,
    },
    {
        value: 'documents',
        area: 'documents',
        label: 'Documents',
        shortLabel: 'Documents',
        description: 'Local sources and relationships',
        icon: DocumentTextIcon,
    },
    {
        value: 'manage',
        area: 'manage',
        label: 'Manage Records',
        shortLabel: 'Manage records',
        description: 'Manual entry, corrections, and history',
        icon: RecordIcon,
    },
];

const AREAS: AreaDefinition[] = [
    {
        value: 'record',
        label: 'Health Record',
        shortLabel: 'Record',
        description: 'Conditions, allergies, visits, procedures, vaccines, and notes',
        defaultModule: 'conditions',
        icon: ActivityIcon,
    },
    {
        value: 'medications',
        label: 'Medications',
        shortLabel: 'Meds',
        description: 'Medication history and source reconciliation',
        defaultModule: 'medications',
        icon: DrugsIcon,
    },
    {
        value: 'results',
        label: 'Results',
        shortLabel: 'Results',
        description: 'Laboratory results, reports, trends, and explicit reminders',
        defaultModule: 'results',
        icon: DocumentTextIcon,
    },
    {
        value: 'care',
        label: 'Care',
        shortLabel: 'Care',
        description: 'Appointments, follow-up tasks, and care plans',
        defaultModule: 'appointments',
        icon: ListChecksIcon,
    },
    {
        value: 'documents',
        label: 'Documents',
        shortLabel: 'Docs',
        description: 'Original local sources and their record relationships',
        defaultModule: 'documents',
        icon: DocumentTextIcon,
    },
    {
        value: 'manage',
        label: 'Manage',
        shortLabel: 'Manage',
        description: 'Manual entry, corrections, and durable record history',
        defaultModule: 'manage',
        icon: RecordIcon,
    },
];

const INITIAL_AREA_SELECTIONS: Record<HealthArea, PersonalHealthDataModule> = {
    record: 'conditions',
    medications: 'medications',
    results: 'results',
    care: 'appointments',
    documents: 'documents',
    manage: 'manage',
};

const HealthDataWorkspace: React.FC<HealthDataWorkspaceProps> = ({
    record,
    onReviewCandidates,
}) => {
    const [area, setArea] = useState<HealthArea>('record');
    const [selectedModules, setSelectedModules] = useState<
        Record<HealthArea, PersonalHealthDataModule>
    >(INITIAL_AREA_SELECTIONS);
    const auditLogs = useAuditStore(state => state.logs);
    const reconciliation = useMemo(
        () => buildMedicationReconciliationViewModel(record, auditLogs),
        [auditLogs, record],
    );
    const reminderSummary = useMemo(
        () => buildExplicitReminderViewModel(record),
        [record],
    );
    const moduleBadges = useMemo(() => {
        const candidates = selectCandidateResources(record);
        return {
            conditions: candidates.filter(resource =>
                resource.resourceType === 'Condition').length,
            allergies: candidates.filter(resource =>
                resource.resourceType === 'AllergyIntolerance').length,
            medications: candidates.filter(resource =>
                resource.resourceType === 'Medication').length,
            'medication-reconciliation':
                reconciliation.unreviewedCount
                + reconciliation.actionPendingCount
                + reconciliation.candidateMedicationCount,
            results: candidates.filter(resource =>
                resource.resourceType === 'Observation'
                || resource.resourceType === 'DiagnosticReport').length,
            'trend-reminders': reminderSummary.actionableCount,
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
    }, [reconciliation, record, reminderSummary]);

    const areaBadges = useMemo(
        () => AREAS.reduce<Record<HealthArea, number>>(
            (totals, item) => {
                totals[item.value] = MODULES
                    .filter(module => module.area === item.value)
                    .reduce(
                        (total, module) => total + moduleBadges[module.value],
                        0,
                    );
                return totals;
            },
            {
                record: 0,
                medications: 0,
                results: 0,
                care: 0,
                documents: 0,
                manage: 0,
            },
        ),
        [moduleBadges],
    );

    const module = selectedModules[area];
    const activeArea = AREAS.find(item => item.value === area) ?? AREAS[0];
    const activeModules = MODULES.filter(item => item.area === area);
    const activeModule = activeModules.find(item => item.value === module)
        ?? activeModules[0];

    const selectArea = (nextArea: HealthArea): void => {
        setArea(nextArea);
    };

    const selectModule = (nextModule: PersonalHealthDataModule): void => {
        setSelectedModules(current => ({
            ...current,
            [area]: nextModule,
        }));
    };

    const handleAreaKeyDown = (
        event: React.KeyboardEvent<HTMLButtonElement>,
        index: number,
    ): void => {
        let nextIndex: number | null = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            nextIndex = (index + 1) % AREAS.length;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            nextIndex = (index - 1 + AREAS.length) % AREAS.length;
        } else if (event.key === 'Home') {
            nextIndex = 0;
        } else if (event.key === 'End') {
            nextIndex = AREAS.length - 1;
        }
        if (nextIndex === null) return;
        event.preventDefault();
        selectArea(AREAS[nextIndex].value);
        const tabs = event.currentTarget.parentElement
            ?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        tabs?.[nextIndex]?.focus();
    };

    return (
        <div className="flex min-h-0 flex-1 flex-col bg-slate-50/70 dark:bg-slate-950">
            <div className="flex-shrink-0 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95 md:px-6">
                <nav
                    className="no-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto"
                    aria-label="Health record areas"
                    aria-orientation="horizontal"
                    role="tablist"
                >
                    {AREAS.map((item, index) => {
                        const Icon = item.icon;
                        const active = area === item.value;
                        const pending = areaBadges[item.value];
                        return (
                            <button
                                key={item.value}
                                id={`health-area-tab-${item.value}`}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                aria-controls="health-data-panel"
                                tabIndex={active ? 0 : -1}
                                onClick={() => selectArea(item.value)}
                                onKeyDown={event =>
                                    handleAreaKeyDown(event, index)}
                                className={`group flex min-w-[130px] flex-1 items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors md:min-w-[160px] ${active
                                    ? 'border-blue-200 bg-blue-50 text-blue-900 shadow-sm dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100'
                                    : 'border-transparent text-slate-500 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:border-slate-800 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                                }`}
                            >
                                <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${active
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-500 group-hover:bg-white dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-slate-700'
                                }`}>
                                    <Icon className="h-4 w-4" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1.5 text-xs font-bold">
                                        <span className="hidden sm:inline">
                                            {item.label}
                                        </span>
                                        <span className="sm:hidden">
                                            {item.shortLabel}
                                        </span>
                                        {pending > 0 && (
                                            <span
                                                className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] text-white"
                                                aria-label={`${pending} items need review or follow-up`}
                                            >
                                                {pending}
                                            </span>
                                        )}
                                    </span>
                                    <span className="mt-0.5 hidden truncate text-[9px] font-mono uppercase tracking-wide opacity-65 xl:block">
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
                aria-labelledby={`health-area-tab-${area}`}
                className="flex min-h-0 flex-1 flex-col"
            >
                <div className="flex-shrink-0 border-b border-slate-200 bg-slate-50/95 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/95 md:px-6">
                    <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                                    {activeArea.label}
                                </h2>
                                <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                                    {activeModules.length}{' '}
                                    {activeModules.length === 1
                                        ? 'section'
                                        : 'sections'}
                                </span>
                                {areaBadges[area] > 0 && (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                                        {areaBadges[area]} need attention
                                    </span>
                                )}
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                                {activeArea.description}
                            </p>
                        </div>

                        <label
                            htmlFor="health-data-module-select"
                            className="flex min-w-0 flex-col gap-1 md:hidden"
                        >
                            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Section
                            </span>
                            <select
                                id="health-data-module-select"
                                aria-label={`${activeArea.label} section`}
                                value={module}
                                onChange={event => selectModule(
                                    event.target.value as PersonalHealthDataModule,
                                )}
                                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            >
                                {activeModules.map(item => (
                                    <option
                                        key={item.value}
                                        value={item.value}
                                    >
                                        {item.label}
                                        {moduleBadges[item.value] > 0
                                            ? ` (${moduleBadges[item.value]})`
                                            : ''}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <nav
                            aria-label={`${activeArea.label} sections`}
                            className="hidden max-w-full flex-wrap gap-1.5 md:flex"
                        >
                            {activeModules.map(item => {
                                const Icon = item.icon;
                                const active = module === item.value;
                                const pending = moduleBadges[item.value];
                                return (
                                    <button
                                        key={item.value}
                                        type="button"
                                        aria-current={active
                                            ? 'page'
                                            : undefined}
                                        onClick={() => selectModule(item.value)}
                                        className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${active
                                            ? 'border-slate-300 bg-white text-slate-950 shadow-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white'
                                            : 'border-transparent bg-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-slate-100'
                                        }`}
                                    >
                                        <Icon className="h-4 w-4 flex-shrink-0" />
                                        <span>{item.shortLabel}</span>
                                        {pending > 0 && (
                                            <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] text-white">
                                                {pending}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                </div>

                <section
                    aria-label={`${activeArea.label}: ${activeModule.label}`}
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
                    {module === 'medication-reconciliation' && (
                        <MedicationReconciliationWorkspace
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
                    {module === 'trend-reminders' && (
                        <TrendAndReminderWorkspace
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
                </section>
            </div>
        </div>
    );
};

export default HealthDataWorkspace;
