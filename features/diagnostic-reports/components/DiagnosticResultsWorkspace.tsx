import React from 'react';
import type { PatientClinicalRecord } from '../../clinical-record';
import ResultsModule from '../../personal-health-record/components/ResultsModule';
import DiagnosticInsightsPanel from './DiagnosticInsightsPanel';

interface DiagnosticResultsWorkspaceProps {
    record: PatientClinicalRecord;
    onReviewCandidates: () => void;
}

const DiagnosticResultsWorkspace: React.FC<
    DiagnosticResultsWorkspaceProps
> = ({ record, onReviewCandidates }) => (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50/70 dark:bg-slate-950">
        <div className="flex-shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-800 md:px-6">
            <div className="mx-auto w-full max-w-7xl">
                <DiagnosticInsightsPanel record={record} />
            </div>
        </div>
        <ResultsModule
            record={record}
            onReviewCandidates={onReviewCandidates}
        />
    </div>
);

export default DiagnosticResultsWorkspace;
