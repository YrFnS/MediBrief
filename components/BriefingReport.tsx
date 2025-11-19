import React, { useState, useMemo, useCallback } from 'react';
import { parse } from 'marked';
import DOMPurify from 'dompurify';
import { AlertTriangleIcon, UsersIcon, PillIcon, ListChecksIcon, PhoneForwardedIcon, ClockIcon, DownloadIcon, ClipboardCheckIcon, ClipboardIcon } from './icons';
import { exportBriefingToPdf } from '../services/exportService';
import { parseJsonSafe } from '../utils';

interface BriefingReportProps {
    content: string; // Expects a JSON string
}

interface ParsedSection {
    title: string;
    items: string[];
}

interface ParsedBriefing {
    briefingTitle: string;
    sections: ParsedSection[];
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

    const parsedBriefing = useMemo<ParsedBriefing | null>(() => {
        return parseJsonSafe<ParsedBriefing>(content);
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

    const renderMarkdownItem = (item: string) => {
        const html = parse(item, { breaks: false, gfm: true }) as string;
        // DOMPurify hook is already configured globally in Message.tsx or via a separate init
        // but we sanitize here locally just to be safe for the briefing content
        const sanitized = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
        return { __html: sanitized };
    };

    if (!parsedBriefing) {
        // SAFETY FIX: "The Black Box Failure"
        // If JSON parsing fails, DO NOT hide the content. Show it as raw markdown.
        // A doctor needs to see the text, even if it's ugly.
        const rawHtml = parse(content, { breaks: true, gfm: true }) as string;
        const sanitizedRaw = DOMPurify.sanitize(rawHtml);
        
        return (
            <div className="space-y-2">
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg flex items-start gap-2">
                    <AlertTriangleIcon className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700 dark:text-amber-200">
                        <strong>Formatting Error:</strong> The briefing could not be structured automatically. Displaying raw output below to ensure no information is lost.
                    </p>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none p-2" dangerouslySetInnerHTML={{ __html: sanitizedRaw }} />
            </div>
        );
    }

    return (
        <div className="bg-slate-50 dark:bg-slate-900/50 -m-4 p-4 rounded-xl">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-3">
                 <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <span className="text-2xl">📋</span>
                    <span>{parsedBriefing.briefingTitle}</span>
                </h2>
                <div className="flex gap-2 flex-shrink-0 self-end sm:self-auto">
                    <button onClick={handleCopy} disabled={isExporting} className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 transition-colors disabled:opacity-50">
                        {isCopied ? <ClipboardCheckIcon className="w-4 h-4 text-green-500" /> : <ClipboardIcon className="w-4 h-4" />}
                        {isCopied ? 'Copied!' : 'Copy'}
                    </button>
                    <button onClick={handleExportPdf} disabled={isExporting} className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 transition-colors disabled:opacity-50">
                        {isExporting ? <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div> : <DownloadIcon className="w-4 h-4" />}
                        {isExporting ? 'Exporting...' : 'Export PDF'}
                    </button>
                </div>
            </div>

            <div className="space-y-4">
                {parsedBriefing.sections.map((section) => {
                    if (!section.items || section.items.length === 0) return null;
                    const config = SECTION_CONFIG[section.title] || { icon: ListChecksIcon, color: 'slate' };
                    const Icon = config.icon;
                    const isCritical = config.color === 'red';

                    return (
                        <div key={section.title} className={`rounded-lg p-3 ${isCritical ? 'bg-red-100/50 dark:bg-red-900/20' : 'bg-slate-100 dark:bg-slate-700/50'}`}>
                            <h3 className={`flex items-center gap-2 font-bold mb-2 text-sm ${isCritical ? 'text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-200'}`}>
                                <Icon className="w-5 h-5" />
                                <span>{section.title}</span>
                            </h3>
                            <ul className="space-y-1.5 pl-4 text-sm text-slate-700 dark:text-slate-300">
                                {section.items.map((item, index) => (
                                     <li 
                                        key={index} 
                                        className="list-disc marker:text-slate-400 dark:marker:text-slate-500 [&>p]:inline"
                                        dangerouslySetInnerHTML={renderMarkdownItem(item)}
                                     />
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default BriefingReport;