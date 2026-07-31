import React, { useMemo, useState } from 'react';
import {
    ActivityIcon,
    AlertTriangleIcon,
    DocumentTextIcon,
    DrugsIcon,
} from '../../../components/icons';
import { selectCandidateResources } from '../../clinical-record/selectors';
import type { PatientClinicalRecord } from '../../clinical-record/types';
import type { HealthDataModule } from '../coreModuleTypes';
import AllergiesModule from './AllergiesModule';
import ConditionsModule from './ConditionsModule';
import MedicationsModule from './MedicationsModule';
import ResultsModule from './ResultsModule';

interface HealthDataWorkspaceProps {
    record: PatientClinicalRecord;
    onReviewCandidates: () => void;
}

const MODULES: Array<{
    value: HealthDataModule;
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
];

const HealthDataWorkspace: React.FC<HealthDataWorkspaceProps> = ({
    record,
    onReviewCandidates,
}) => {
    const [module, setModule] = useState<HealthDataModule>('conditions');
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
        } satisfies Record<HealthDataModule, number>;
    }, [record]);

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-shrink-0 border-b border-slate-200 bg-slate-50/95 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/95 md:px-6">
                <nav
                    className="no-scrollbar mx-auto flex max-w-7xl gap-1 overflow-x-auto"
                    aria-label="Health data modules"
                >
                    {MODULES.map(item => {
                        const Icon = item.icon;
                        const active = module === item.value;
                        const pending = candidateCounts[item.value];
                        return (
                            <button
                                key={item.value}
                                type="button"
                                onClick={() => setModule(item.value)}
                                aria-current={active ? 'page' : undefined}
                                className={`group flex min-w-[130px] flex-1 items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors md:min-w-[180px] ${active
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
        </div>
    );
};

export default HealthDataWorkspace;
