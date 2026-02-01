
import React, { useMemo } from 'react';
import { ImageIcon, UserIcon, CalendarIcon, ClipboardListIcon, EyeIcon, LightbulbIcon, AlertTriangleIcon, SparklesIcon } from './icons';
import { parseAndValidate } from '../utils';
import { ImageAnalysisSchema, ImageAnalysis } from '../features/chat/schemas';

interface ImageAnalysisReportProps {
    content: string;
}

const ensureString = (val: any): string | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.join(', ');
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
};

const getCertaintyBadge = (score: string) => {
    if (!score) return null;
    const s = score.toLowerCase();
    let colorClass = 'bg-slate-100 text-slate-600 border-slate-200';
    
    if (s.includes('high')) colorClass = 'bg-emerald-500 text-white border-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.4)]';
    else if (s.includes('medium')) colorClass = 'bg-amber-500 text-white border-amber-600';
    else if (s.includes('low')) colorClass = 'bg-red-500 text-white border-red-600';

    return (
        <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-sm border ${colorClass}`}>
            CONFIDENCE: {score}
        </span>
    );
};

const Section: React.FC<{ title: string; icon: any; children: React.ReactNode; danger?: boolean }> = ({ title, icon: Icon, children, danger }) => (
    <div className={`
        relative overflow-hidden rounded-sm border p-4 transition-all
        ${danger 
            ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900' 
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
        }
    `}>
        {danger && <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>}
        <div className="flex items-center gap-2 mb-3 opacity-80">
            <Icon className={`w-4 h-4 ${danger ? 'text-red-500' : 'text-blue-500'}`} />
            <h3 className={`font-mono text-xs font-bold uppercase tracking-widest ${danger ? 'text-red-700 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                {title}
            </h3>
        </div>
        <div className={`text-sm leading-relaxed ${danger ? 'text-red-800 dark:text-red-200' : 'text-slate-700 dark:text-slate-300'}`}>
            {children}
        </div>
    </div>
);

const ImageAnalysisReport: React.FC<ImageAnalysisReportProps> = ({ content }) => {
    const analysis = useMemo(() => parseAndValidate<ImageAnalysis>(content, ImageAnalysisSchema), [content]);

    if (!analysis) {
        return <div className="text-red-500 text-sm p-4 border border-red-200 bg-red-50 rounded-sm">Error: Invalid Analysis Data Format</div>;
    }

    const hasAbnormalities = analysis.potentialAbnormalities && 
                             !analysis.potentialAbnormalities.toLowerCase().includes('none') && 
                             !analysis.potentialAbnormalities.toLowerCase().includes('n/a');

    return (
        <div className="bg-slate-50 dark:bg-slate-950/50 -m-5 p-5 border-t border-slate-200 dark:border-slate-800">
            
            {/* Header / Protocol Status */}
            <div className="flex flex-col sm:flex-row justify-between items-start mb-6 pb-4 border-b border-slate-200 dark:border-slate-800 gap-4">
                <div>
                    <h2 className="text-sm font-mono font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="text-lg">☢️</span>
                        <span className="tracking-tighter">RADIOLOGY_AI_REPORT // {analysis.imageType || 'UNKNOWN_MODALITY'}</span>
                    </h2>
                    <div className="flex gap-4 mt-1 text-[10px] font-mono text-slate-500 uppercase">
                        <span>PT_ID: {ensureString(analysis.patient) || 'ANONYMOUS'}</span>
                        <span>DATE: {ensureString(analysis.date) || 'UNDATED'}</span>
                    </div>
                </div>
                {getCertaintyBadge(analysis.certaintyScore || '')}
            </div>

            <div className="space-y-4">
                {/* Findings */}
                <Section title="Visual Observations" icon={EyeIcon}>
                    {ensureString(analysis.visualObservations) || 'No specific observations noted.'}
                </Section>

                {/* Abnormalities - Highlighted if present */}
                {hasAbnormalities && (
                    <Section title="Abnormalities Detected" icon={AlertTriangleIcon} danger>
                        {ensureString(analysis.potentialAbnormalities)}
                    </Section>
                )}

                {/* Differentials & OCR Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analysis.differentialDiagnosisSuggestions && (
                        <Section title="Differential Diagnosis" icon={SparklesIcon}>
                            {ensureString(analysis.differentialDiagnosisSuggestions)}
                        </Section>
                    )}
                    
                    {analysis.extractedInformation && analysis.extractedInformation.length > 5 && (
                        <div className="bg-slate-900 p-3 rounded-sm border border-slate-800 text-xs font-mono text-green-400 overflow-hidden relative">
                            <div className="absolute top-2 right-2 opacity-30"><ClipboardListIcon className="w-4 h-4"/></div>
                            <div className="uppercase opacity-50 text-[9px] mb-2 tracking-widest">OCR_Text_Extraction</div>
                            <p className="break-words whitespace-pre-wrap">{ensureString(analysis.extractedInformation)}</p>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <Section title="Recommended Actions" icon={LightbulbIcon}>
                    {ensureString(analysis.nextSteps) || 'Clinical correlation recommended.'}
                </Section>

                {/* Footer Note */}
                {analysis.note && (
                    <div className="mt-2 text-[10px] font-mono text-slate-400 italic text-center">
                        AI Note: {ensureString(analysis.note)}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ImageAnalysisReport;
