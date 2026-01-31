
import React, { useState } from 'react';
import { CDSSAlert } from './types';
import InterventionCard from './InterventionCard';
import { AlertTriangleIcon, ChevronRightIcon, XCircleIcon } from '../../components/icons';

interface CDSSAggregatorProps {
    alerts: CDSSAlert[];
    onAction: (alert: CDSSAlert, actionIndex: number) => void;
}

const CDSSAggregator: React.FC<CDSSAggregatorProps> = ({ alerts, onAction }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const criticalCount = alerts.filter(a => a.level === 'Critical').length;
    const warningCount = alerts.filter(a => a.level === 'Warning').length;
    const infoCount = alerts.filter(a => a.level === 'Info').length;

    // --- EXPANDED VIEW (MODAL LIST) ---
    if (isExpanded) {
        return (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-slate-900 w-full max-w-lg max-h-[80vh] flex flex-col rounded-lg shadow-2xl border border-slate-200 dark:border-slate-700 animate-slide-up overflow-hidden">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                        <div className="flex items-center gap-2">
                            <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded-md text-blue-600 dark:text-blue-400">
                                <AlertTriangleIcon className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800 dark:text-white leading-none">Active Clinical Alerts</h3>
                                <p className="text-[10px] text-slate-500 mt-0.5">{alerts.length} protocols triggered</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsExpanded(false)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                            <XCircleIcon className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Scrollable List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-100/50 dark:bg-black/20">
                        {alerts.map((alert) => (
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

    // --- COLLAPSED VIEW (SUMMARY TOAST) ---
    return (
        <div 
            onClick={() => setIsExpanded(true)}
            className="w-full max-w-sm bg-white dark:bg-slate-900 border-l-4 border-blue-500 shadow-xl rounded-sm p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-all group animate-slide-up flex items-center justify-between"
        >
            <div className="flex items-center gap-3">
                <div className="relative">
                    <AlertTriangleIcon className="w-6 h-6 text-blue-500" />
                    {criticalCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                        </span>
                    )}
                </div>
                <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {alerts.length} Clinical Insights
                    </h4>
                    <div className="flex gap-2 text-[10px] text-slate-500 mt-0.5 font-mono uppercase tracking-wide">
                        {criticalCount > 0 && <span className="text-red-500 font-bold">{criticalCount} Critical</span>}
                        {warningCount > 0 && <span className="text-amber-500">{warningCount} Warning</span>}
                        {infoCount > 0 && <span>{infoCount} Info</span>}
                    </div>
                </div>
            </div>
            
            <div className="text-slate-300 group-hover:text-blue-500 transition-colors">
                <ChevronRightIcon className="w-5 h-5" />
            </div>
        </div>
    );
};

export default CDSSAggregator;
