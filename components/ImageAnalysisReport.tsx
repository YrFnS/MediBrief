
import React, { useMemo } from 'react';
import { ImageIcon, UserIcon, CalendarIcon, ClipboardListIcon, EyeIcon, LightbulbIcon, AlertTriangleIcon } from './icons';
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
    nextSteps?: string;
    note?: string;
}

interface ReportSectionProps {
    Icon: React.FC<{className: string}>;
    title: string;
    content?: string;
    isCode?: boolean;
}

const ensureString = (val: any): string | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
};

const ReportSection: React.FC<ReportSectionProps> = ({ Icon, title, content, isCode = false }) => {
    const displayContent = ensureString(content);
    
    if (!displayContent || displayContent.toLowerCase() === 'not visible' || displayContent.toLowerCase() === 'n/a') {
        return null;
    }
    return (
        <div>
            <h3 className="flex items-center gap-2 font-bold mb-2 text-sm text-slate-700 dark:text-slate-200">
                <Icon className="w-5 h-5" />
                <span>{title}</span>
            </h3>
            {isCode ? (
                 <pre className="whitespace-pre-wrap bg-slate-100 dark:bg-slate-700/50 p-3 rounded-md text-sm text-slate-700 dark:text-slate-300 font-mono"><code>{displayContent}</code></pre>
            ) : (
                <p className="pl-7 text-sm text-slate-700 dark:text-slate-300">{displayContent}</p>
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
                <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                    <ImageIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-slate-700 dark:text-slate-200">Image Type</p>
                        <p className="text-slate-600 dark:text-slate-300">{ensureString(analysis.imageType) || 'N/A'}</p>
                    </div>
                </div>
                 <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                    <UserIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-slate-700 dark:text-slate-200">Patient</p>
                        <p className="text-slate-600 dark:text-slate-300">{ensureString(analysis.patient) || 'Not Visible'}</p>
                    </div>
                </div>
                 <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-700/50 rounded-lg">
                    <CalendarIcon className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    <div>
                        <p className="font-semibold text-slate-700 dark:text-slate-200">Date</p>
                        <p className="text-slate-600 dark:text-slate-300">{ensureString(analysis.date) || 'Not Visible'}</p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <ReportSection Icon={ClipboardListIcon} title="Extracted Information" content={analysis.extractedInformation} isCode />
                <ReportSection Icon={EyeIcon} title="Visual Observations" content={analysis.visualObservations} />
                <ReportSection Icon={AlertTriangleIcon} title="Potential Abnormalities" content={analysis.potentialAbnormalities} />
                <ReportSection Icon={LightbulbIcon} title="Next Steps / Actions" content={analysis.nextSteps} />

                {analysis.note && (
                    <div className="p-3 rounded-lg bg-amber-100/50 dark:bg-amber-900/20 flex items-start gap-2 text-amber-800 dark:text-amber-200">
                        <AlertTriangleIcon className="w-5 h-5 mt-0.5 flex-shrink-0" />
                        <p className="text-sm"><strong className="font-semibold">Note:</strong> {ensureString(analysis.note)}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageAnalysisReport;