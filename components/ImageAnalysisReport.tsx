import React, { useMemo } from 'react';
import { ImageIcon, UserIcon, CalendarIcon, ClipboardListIcon, EyeIcon, LightbulbIcon, AlertTriangleIcon, SparklesIcon } from './icons';
import { parseJsonSafe } from '../utils';

interface ImageAnalysisReportProps {
    content: string;
}

interface ParsedAnalysis {
    reportType?: string;
    imageType?: string;
    patient?: string;
    date?: string;
    extractedInformation?: string;
    visualObservations?: string;
    potentialAbnormalities?: string;
    differentialDiagnosisSuggestions?: string;
    certaintyScore?: string;
    nextSteps?: string;
    note?: string;
}

interface ReportSectionProps {
    Icon: React.FC<{className: string}>;
    title: string;
    content?: string;
    isCode?: boolean;
    extra?: React.ReactNode;
}

const ensureString = (val: any): string | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
};

const getCertaintyColor = (score: string) => {
    if (!score) return 'bg-slate-100 text-slate-600 border-slate-200';
    const s = score.toLowerCase();
    if (s.includes('high')) return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800';
    if (s.includes('medium')) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800';
    if (s.includes('low')) return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800';
    return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
};

const ReportSection: React.FC<ReportSectionProps> = ({ Icon, title, content, isCode = false, extra }) => {
    const displayContent = ensureString(content);
    
    if ((!displayContent || displayContent.toLowerCase() === 'not visible' || displayContent.toLowerCase() === 'n/a') && !extra) {
        return null;
    }
    return (
        <div className="border-l-2 border-slate-200 dark:border-slate-700 pl-4 py-1">
            <div className="flex items-center gap-2 mb-2">
                <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">{title}</h3>
                {extra}
            </div>
            {displayContent && (
                isCode ? (
                    <pre className="whitespace-pre-wrap bg-slate-50 dark:bg-slate-900 p-3 rounded-sm text-xs text-slate-700 dark:text-slate-300 font-mono border border-slate-200 dark:border-slate-800"><code>{displayContent}</code></pre>
                ) : (
                    <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans">{displayContent}</p>
                )
            )}
        </div>
    );
};

const ImageAnalysisReport: React.FC<ImageAnalysisReportProps> = ({ content }) => {
    const analysis = useMemo(() => parseJsonSafe<ParsedAnalysis>(content), [content]);

    if (!analysis || Object.keys(analysis).length === 0) {
        return <div className="text-red-500 text-sm">Error analyzing image data.</div>;
    }

    return (
        <div className="bg-white dark:bg-slate-900/40 -m-5 p-5 border-t border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-mono font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-6 border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-lg">🔬</span>
                <span>IMAGE_ANALYSIS_PROTOCOL</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 mb-6 border border-slate-200 dark:border-slate-700 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-700 bg-slate-50 dark:bg-slate-800/30">
                <div className="p-3">
                    <p className="font-mono text-[10px] uppercase text-slate-400 mb-1">Modality</p>
                    <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">{ensureString(analysis.imageType) || 'N/A'}</p>
                </div>
                 <div className="p-3">
                    <p className="font-mono text-[10px] uppercase text-slate-400 mb-1">Patient ID</p>
                    <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">{ensureString(analysis.patient) || 'Not Visible'}</p>
                </div>
                 <div className="p-3">
                    <p className="font-mono text-[10px] uppercase text-slate-400 mb-1">Study Date</p>
                    <p className="font-bold text-slate-700 dark:text-slate-200 text-sm">{ensureString(analysis.date) || 'Not Visible'}</p>
                </div>
            </div>

            <div className="space-y-5">
                <ReportSection Icon={ClipboardListIcon} title="Extracted Information" content={analysis.extractedInformation} isCode />
                
                <ReportSection 
                    Icon={EyeIcon} 
                    title="Visual Observations" 
                    content={analysis.visualObservations} 
                    extra={
                        analysis.certaintyScore ? (
                            <span className={`ml-auto text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-sm ${getCertaintyColor(analysis.certaintyScore)}`}>
                                CONFIDENCE: {analysis.certaintyScore}
                            </span>
                        ) : null
                    }
                />
                
                <ReportSection Icon={AlertTriangleIcon} title="Abnormalities Detected" content={analysis.potentialAbnormalities} />
                
                <ReportSection Icon={SparklesIcon} title="Differential Diagnosis" content={analysis.differentialDiagnosisSuggestions} />

                <ReportSection Icon={LightbulbIcon} title="Recommended Actions" content={analysis.nextSteps} />

                {analysis.note && (
                    <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/10 border-l-2 border-amber-500 flex items-start gap-2 text-amber-900 dark:text-amber-100">
                        <p className="text-xs font-mono"><strong className="uppercase">Clinician Note:</strong> {ensureString(analysis.note)}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageAnalysisReport;