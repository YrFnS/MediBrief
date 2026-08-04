import React from 'react';
import { DocumentTextIcon } from '../../components/icons';
import { useClinicalRecordStore } from '../clinical-record/useClinicalRecordStore';
import EmergencySummary from './components/EmergencySummary';
import HealthDataWorkspace from './components/HealthDataWorkspace';
import PatientOverview from './components/PatientOverview';
import PatientTimeline from './components/PatientTimeline';
import RecordSearchAndExport from './components/RecordSearchAndExport';
import type {
    PersonalRecordContentView,
    PersonalRecordView,
} from './types';

interface PersonalHealthRecordShellProps {
    patientId: string;
    view: PersonalRecordContentView;
    onNavigate: (view: PersonalRecordView) => void;
}

const PersonalHealthRecordShell: React.FC<PersonalHealthRecordShellProps> = ({
    patientId,
    view,
    onNavigate,
}) => {
    const record = useClinicalRecordStore(state => state.records[patientId]);

    if (!record) {
        return (
            <div className="flex flex-1 items-center justify-center overflow-y-auto bg-slate-50 p-5 dark:bg-slate-950">
                <div className="max-w-md rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-950/80">
                    <DocumentTextIcon className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
                    <h1 className="mt-3 text-lg font-bold text-slate-900 dark:text-white">
                        Structured record unavailable
                    </h1>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                        The patient roster is available, but its structured clinical record has not finished initializing. Lock and unlock the local vault or restore a validated backup before adding medical information.
                    </p>
                </div>
            </div>
        );
    }

    switch (view) {
        case 'overview':
            return (
                <PatientOverview
                    record={record}
                    onOpenTimeline={() => onNavigate('timeline')}
                    onOpenEmergency={() => onNavigate('emergency')}
                />
            );
        case 'health-data':
            return (
                <HealthDataWorkspace
                    record={record}
                    onReviewCandidates={() => onNavigate('overview')}
                />
            );
        case 'timeline':
            return <PatientTimeline record={record} />;
        case 'search':
            return (
                <RecordSearchAndExport
                    record={record}
                    onReviewCandidates={() => onNavigate('overview')}
                />
            );
        case 'emergency':
            return <EmergencySummary record={record} />;
    }
};

export default PersonalHealthRecordShell;
