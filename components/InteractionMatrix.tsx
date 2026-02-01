
import React, { useMemo } from 'react';
import { DrugsIcon, AlertTriangleIcon, CheckIcon, ShieldCheckIcon } from './icons';
import { parseAndValidate } from '../utils';
import { InteractionMatrixSchema, InteractionMatrix as InteractionMatrixType } from '../features/chat/schemas';

const getSeverityStyles = (severity: string) => {
    const s = severity.toLowerCase();
    if (s === 'high' || s === 'severe') return {
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-200 dark:border-red-800',
        text: 'text-red-800 dark:text-red-300',
        iconColor: 'text-red-600 dark:text-red-400',
        badge: 'bg-red-600 text-white'
    };
    if (s === 'moderate') return {
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-200 dark:border-amber-800',
        text: 'text-amber-800 dark:text-amber-300',
        iconColor: 'text-amber-600 dark:text-amber-400',
        badge: 'bg-amber-500 text-white'
    };
    return {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-800',
        text: 'text-blue-800 dark:text-blue-300',
        iconColor: 'text-blue-600 dark:text-blue-400',
        badge: 'bg-blue-500 text-white'
    };
};

const InteractionMatrix: React.FC<{ content: string }> = ({ content }) => {
    const report = useMemo(() => parseAndValidate<InteractionMatrixType>(content, InteractionMatrixSchema), [content]);

    if (!report) return <div className="text-red-500 text-xs p-2 border border-red-200 bg-red-50 rounded">Error: Invalid Interaction Data</div>;

    const hasCritical = report.interactions.some(i => i.severity.toLowerCase() === 'high' || i.severity.toLowerCase() === 'severe');

    return (
        <div className="bg-white dark:bg-slate-900/40 -m-5 p-5 border-t border-slate-200 dark:border-slate-800">
            {/* Header */}
            <div className={`flex items-center justify-between mb-6 pb-4 border-b ${hasCritical ? 'border-red-200 dark:border-red-900/50' : 'border-slate-200 dark:border-slate-800'}`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-sm ${hasCritical ? 'bg-red-100 dark:bg-red-900/30' : 'bg-slate-100 dark:bg-slate-800'}`}>
                        <DrugsIcon className={`w-5 h-5 ${hasCritical ? 'text-red-600' : 'text-slate-600 dark:text-slate-400'}`} />
                    </div>
                    <div>
                        <h2 className="text-sm font-mono font-bold text-slate-900 dark:text-white leading-none">PHARMA_INTERACTION_MATRIX</h2>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider">Analysis complete</span>
                    </div>
                </div>
                {hasCritical ? (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-red-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-sm animate-pulse">
                        <AlertTriangleIcon className="w-3 h-3" />
                        <span>Critical</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-green-600 text-white text-[10px] font-bold uppercase tracking-widest rounded-sm">
                        <ShieldCheckIcon className="w-3 h-3" />
                        <span>Clear</span>
                    </div>
                )}
            </div>

            {/* Drug List */}
            <div className="mb-6">
                <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-2">Analyzed Compounds</p>
                <div className="flex flex-wrap gap-2">
                    {report.drugs.map((drug, i) => (
                        <span key={i} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300 rounded-sm">
                            {drug}
                        </span>
                    ))}
                </div>
            </div>

            {/* Interactions List */}
            <div className="space-y-3">
                 <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest mb-2">Detected Interactions</p>
                 {report.interactions.length === 0 ? (
                     <div className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 flex items-center gap-3">
                         <CheckIcon className="w-5 h-5 text-green-500" />
                         <p className="text-sm text-green-800 dark:text-green-300">No significant interactions detected among these medications.</p>
                     </div>
                 ) : (
                     report.interactions.map((interaction, idx) => {
                         const styles = getSeverityStyles(interaction.severity);
                         return (
                             <div key={idx} className={`p-4 border rounded-sm ${styles.bg} ${styles.border}`}>
                                 <div className="flex justify-between items-start mb-2">
                                     <div className="flex items-center gap-2">
                                         <span className={`text-xs font-bold ${styles.text}`}>{interaction.drug1}</span>
                                         <span className="text-slate-400">↔</span>
                                         <span className={`text-xs font-bold ${styles.text}`}>{interaction.drug2}</span>
                                     </div>
                                     <span className={`px-1.5 py-0.5 text-[9px] uppercase font-bold tracking-wider rounded-sm ${styles.badge}`}>
                                         {interaction.severity}
                                     </span>
                                 </div>
                                 <p className={`text-sm ${styles.text} mb-2 leading-relaxed`}>{interaction.mechanism}</p>
                                 <div className="flex items-start gap-1.5 opacity-80">
                                     <span className={`text-[10px] font-bold uppercase mt-0.5 ${styles.text}`}>Mgmt:</span>
                                     <span className={`text-xs ${styles.text}`}>{interaction.management}</span>
                                 </div>
                             </div>
                         );
                     })
                 )}
            </div>
            
            {/* Summary Footer */}
            {report.summary && (
                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 italic font-mono">
                    "{report.summary}"
                </div>
            )}
        </div>
    );
};

export default InteractionMatrix;
