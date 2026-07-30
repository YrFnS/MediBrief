import React, { useState } from 'react';
import {
    AlertTriangleIcon,
    ChevronRightIcon,
    XCircleIcon,
} from '../../components/icons';
import InterventionCard from './InterventionCard';
import type { CDSSAlert } from './types';

interface CDSSAggregatorProps {
    alerts: CDSSAlert[];
    onAction: (alert: CDSSAlert, actionIndex: number) => void;
}

const CDSSAggregator: React.FC<CDSSAggregatorProps> = ({
    alerts,
    onAction,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const criticalCount = alerts.filter(
        alert => alert.level === 'Critical',
    ).length;
    const warningCount = alerts.filter(
        alert => alert.level === 'Warning',
    ).length;
    const infoCount = alerts.filter(alert => alert.level === 'Info').length;

    if (isExpanded) {
        return (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fade-in sm:items-center">
                <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl animate-slide-up dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                        <div className="flex items-center gap-2">
                            <div className="rounded-md bg-blue-100 p-1.5 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                <AlertTriangleIcon className="h-4 w-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold leading-none text-slate-800 dark:text-white">
                                    Validated Clinical Advisories
                                </h3>
                                <p className="mt-0.5 text-[10px] text-slate-500">
                                    {alerts.length} reviewed advisor{alerts.length === 1 ? 'y' : 'ies'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsExpanded(false)}
                            className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                        >
                            <XCircleIcon className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto bg-slate-100/50 p-4 dark:bg-black/20">
                        {alerts.map(alert => (
                            <InterventionCard
                                key={alert.id}
                                alert={alert}
                                onAction={onAction}
                                variant="toast"
                            />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            onClick={() => setIsExpanded(true)}
            className="group flex w-full max-w-sm cursor-pointer items-center justify-between rounded-sm border-l-4 border-blue-500 bg-white p-4 shadow-xl transition-all animate-slide-up hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800"
        >
            <div className="flex items-center gap-3">
                <div className="relative">
                    <AlertTriangleIcon className="h-6 w-6 text-blue-500" />
                    {criticalCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                        </span>
                    )}
                </div>
                <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {alerts.length} Validated Advisor{alerts.length === 1 ? 'y' : 'ies'}
                    </h4>
                    <div className="mt-0.5 flex gap-2 text-[10px] font-mono uppercase tracking-wide text-slate-500">
                        {criticalCount > 0 && (
                            <span className="font-bold text-red-500">
                                {criticalCount} Critical
                            </span>
                        )}
                        {warningCount > 0 && (
                            <span className="text-amber-500">
                                {warningCount} Warning
                            </span>
                        )}
                        {infoCount > 0 && <span>{infoCount} Info</span>}
                    </div>
                </div>
            </div>
            <div className="text-slate-300 transition-colors group-hover:text-blue-500">
                <ChevronRightIcon className="h-5 w-5" />
            </div>
        </div>
    );
};

export default CDSSAggregator;
