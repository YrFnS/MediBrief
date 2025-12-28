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
        <div>
            <div className="flex items-center gap-2 mb-2">
                <Icon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                <h3 className="font-bold text-sm text-slate-700 dark:text-slate-200">{title}</h3>
                {extra}
            </div>
            {displayContent && (
                isCode ? (
                    <pre className="whitespace-pre-wrap bg-slate-100 dark:bg-slate-700/50 p-3 rounded-md text-sm text-slate-700 dark:text-slate-300 font-mono border border-slate-200 dark:border-slate-600"><code>{displayContent}</code></pre>
                ) : (
                    <p className="pl-7 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{displayContent}</p>
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
        <div className="bg-slate-50 dark:bg-slate-900/50 -m-4 p-4 rounded-xl">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
                <span className="text-2xl">🔬</span>
                <span>Medical Image Analysis</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 text-sm">
                <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                    <ImageIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-slate-700 dark:text-slate-200 text-xs uppercase tracking-wide">Image Type</p>
                        <p className="text-slate-600 dark:text-slate-300 font-medium">{ensureString(analysis.imageType) || 'N/A'}</p>
                    </div>
                </div>
                 <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                    <UserIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-slate-700 dark:text-slate-200 text-xs uppercase tracking-wide">Patient</p>
                        <p className="text-slate-600 dark:text-slate-300 font-medium">{ensureString(analysis.patient) || 'Not Visible'}</p>
                    </div>
                </div>
                 <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600">
                    <CalendarIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-slate-700 dark:text-slate-200 text-xs uppercase tracking-wide">Date</p>
                        <p className="text-slate-600 dark:text-slate-300 font-medium">{ensureString(analysis.date) || 'Not Visible'}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-5 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                <ReportSection Icon={ClipboardListIcon} title="Extracted Information" content={analysis.extractedInformation} isCode />
                
                <ReportSection 
                    Icon={EyeIcon} 
                    title="Visual Observations" 
                    content={analysis.visualObservations} 
                    extra={
                        analysis.certaintyScore ? (
                            <span className={`ml-auto text-[10px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider ${getCertaintyColor(analysis.certaintyScore)}`}>
                                {analysis.certaintyScore} Confidence
                            </span>
                        ) : null
                    }
                />
                
                <ReportSection Icon={AlertTriangleIcon} title="Potential Abnormalities" content={analysis.potentialAbnormalities} />
                
                <ReportSection Icon={SparklesIcon} title="Differential Diagnosis Suggestions" content={analysis.differentialDiagnosisSuggestions} />

                <ReportSection Icon={LightbulbIcon} title="Next Steps / Actions" content={analysis.nextSteps} />

                {analysis.note && (
                    <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 flex items-start gap-2 text-amber-800 dark:text-amber-200">
                        <AlertTriangleIcon className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-500" />
                        <p className="text-sm"><strong className="font-semibold">Note:</strong> {ensureString(analysis.note)}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageAnalysisReport;