
import React, { useState, useMemo, useCallback } from 'react';
import { parse } from 'marked';
import DOMPurify from 'dompurify';
import { AlertTriangleIcon, UsersIcon, PillIcon, ListChecksIcon, PhoneForwardedIcon, ClockIcon, DownloadIcon, ClipboardCheckIcon, ClipboardIcon } from './icons';
import { exportBriefingToPdf } from '../services/exportService';
import { parseAndValidate } from '../utils';
import { BriefingSchema, Briefing } from '../features/chat/schemas';

interface BriefingReportProps {
    content: string; // Expects a JSON string
}

const SECTION_CONFIG: Record<string, { icon: React.FC<{className: string}>; color: string }> = {
    'PRIORITY CASES': { icon: AlertTriangleIcon, color: 'red' },
    'CRITICAL ALERTS': { icon: AlertTriangleIcon, color: 'red' },
    'PATIENT OVERVIEW': { icon: UsersIcon, color: 'blue' },
    'MEDICATIONS & TREATMENTS': { icon: PillIcon, color: 'indigo' },
    'FOLLOW-UP REQUIRED': { icon: ListChecksIcon, color: 'amber' },
    'HANDOFF NOTES': { icon: PhoneForwardedIcon, color: 'slate' },
    'SHIFT TIMELINE': { icon: ClockIcon, color: 'slate' },
};

const BriefingReport: React.FC<BriefingReportProps> = ({ content }) => {
    const [isCopied, setIsCopied] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

    const parsedBriefing = useMemo<Briefing | null>(() => {
        return parseAndValidate<Briefing>(content, BriefingSchema);
    }, [content]);

    const handleCopy = useCallback(() => {
        if (!parsedBriefing) return;
        
        let textToCopy = `${parsedBriefing.briefingTitle}\n\n`;
        parsedBriefing.sections.forEach(section => {
            textToCopy += `**${section.title}**\n`;
            section.items.forEach(item => { textToCopy += `- ${item}\n`; });
            textToCopy += '\n';
        });

        navigator.clipboard.writeText(textToCopy);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    }, [parsedBriefing]);
    
    const handleExportPdf = useCallback(async () => {
        if (!parsedBriefing || isExporting) return;
        
        setIsExporting(true);
        try {
            await exportBriefingToPdf(parsedBriefing);
        } catch (error) {
            console.error("Error exporting PDF:", error);
            alert("Sorry, there was an error exporting the PDF. Please try again.");
        } finally {
            setIsExporting(false);
        }
    }, [parsedBriefing, isExporting]);

    const toggleItem = (sectionIndex: number, itemIndex: number) => {
        const key = `${sectionIndex}-${itemIndex}`;
        setCheckedItems(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    const renderMarkdownItem = (item: string) => {
        const html = parse(item, { breaks: false, gfm: true }) as string;
        const sanitized = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
        return { __html: sanitized };
    };

    if (!parsedBriefing) {
        // Fallback to rendering generic markdown if JSON parse fails (graceful degradation)
        const rawHtml = parse(content, { breaks: true, gfm: true }) as string;
        const sanitizedRaw = DOMPurify.sanitize(rawHtml);
        
        return (
            <div className="space-y-2">
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-sm flex items-start gap-2">
                    <AlertTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700 dark:text-amber-200 font-mono">
                        System Notice: Briefing format invalid. Raw content displayed.
                    </p>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none p-2" dangerouslySetInnerHTML={{ __html: sanitizedRaw }} />
            </div>
        );
    }

    return (
        <div className="bg-slate-50 dark:bg-slate-900/30 -m-5 p-5 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-6 gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
                 <h2 className="text-sm font-mono font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="text-lg">📋</span>
                    <span>{parsedBriefing.briefingTitle}</span>
                </h2>
                <div className="flex gap-2 flex-shrink-0 self-end sm:self-auto">
                    <button onClick={handleCopy} disabled={isExporting} className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase px-2.5 py-1.5 rounded-sm border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50">
                        {isCopied ? <ClipboardCheckIcon className="w-3 h-3 text-green-500" /> : <ClipboardIcon className="w-3 h-3" />}
                        {isCopied ? 'Copied' : 'Copy'}
                    </button>
                    <button onClick={handleExportPdf} disabled={isExporting} className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase px-2.5 py-1.5 rounded-sm border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors disabled:opacity-50">
                        {isExporting ? <div className="w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div> : <DownloadIcon className="w-3 h-3" />}
                        {isExporting ? 'Generating...' : 'Export PDF'}
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                {parsedBriefing.sections.map((section, sIdx) => {
                    if (!section.items || section.items.length === 0) return null;
                    const config = SECTION_CONFIG[section.title] || { icon: ListChecksIcon, color: 'slate' };
                    const Icon = config.icon;
                    const isCritical = config.color === 'red';

                    return (
                        <div key={section.title} className={`border-l-2 pl-4 ${isCritical ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'}`}>
                            <h3 className={`flex items-center gap-2 font-mono font-bold text-xs uppercase tracking-widest mb-3 ${isCritical ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                                <Icon className="w-4 h-4" />
                                <span>{section.title}</span>
                            </h3>
                            <ul className="space-y-2">
                                {section.items.map((item, iIdx) => {
                                    const isChecked = checkedItems[`${sIdx}-${iIdx}`];
                                    return (
                                        <li 
                                            key={iIdx} 
                                            onClick={() => toggleItem(sIdx, iIdx)}
                                            className={`group flex items-start gap-3 cursor-pointer select-none transition-opacity ${isChecked ? 'opacity-40' : 'opacity-100'}`}
                                        >
                                            <div className={`mt-0.5 w-3 h-3 border flex items-center justify-center flex-shrink-0 transition-colors rounded-sm ${
                                                isChecked
                                                ? 'bg-slate-600 border-slate-600' 
                                                : 'border-slate-400 dark:border-slate-600 bg-transparent'
                                            }`}>
                                                {isChecked && <div className="w-1.5 h-1.5 bg-white"></div>}
                                            </div>
                                            <div 
                                                className={`text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-sans`}
                                                dangerouslySetInnerHTML={renderMarkdownItem(item)}
                                            />
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default BriefingReport;
