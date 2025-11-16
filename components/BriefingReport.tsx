import React, { useState, useMemo, useCallback } from 'react';
import { AlertTriangleIcon, UsersIcon, PillIcon, ListChecksIcon, PhoneForwardedIcon, ClockIcon, DownloadIcon, ClipboardCheckIcon, ClipboardIcon } from './icons';

declare global {
  interface Window {
    jspdf: any;
  }
}

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
        try {
            const data: ParsedBriefing = JSON.parse(content);
            if (data && data.briefingTitle && Array.isArray(data.sections)) {
                return data;
            }
            return null;
        } catch (error) {
            console.error("Failed to parse briefing JSON:", error);
            return null;
        }
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
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' });

            const pageW = doc.internal.pageSize.getWidth();
            const margin = 40;
            const maxW = pageW - margin * 2;
            let y = margin;
            
            const checkPageBreak = (requiredHeight: number) => {
                if (y + requiredHeight > doc.internal.pageSize.getHeight() - margin) {
                    doc.addPage();
                    y = margin;
                    return true;
                }
                return false;
            };

            // Title
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.text(parsedBriefing.briefingTitle, pageW / 2, y, { align: 'center' });
            y += 40;

            // Sections
            for (const section of parsedBriefing.sections) {
                if (!section.items || section.items.length === 0) continue;

                checkPageBreak(40); // Space for section header
                
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(14);
                doc.text(section.title, margin, y);
                y += 20;

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(10);
                
                for (const item of section.items) {
                    const lines = doc.splitTextToSize(`• ${item}`, maxW - 15);
                    const requiredHeight = lines.length * 12;

                    if (checkPageBreak(requiredHeight)) {
                        // Redraw section header on new page if it's a long list
                        doc.setFont('helvetica', 'bold');
                        doc.setFontSize(12);
                        doc.text(`${section.title} (continued)`, margin, y);
                        y += 20;
                        doc.setFont('helvetica', 'normal');
                        doc.setFontSize(10);
                    }
                    
                    doc.text(lines, margin + 15, y);
                    y += requiredHeight + 4; // line height + small gap
                }
                y += 20; // Extra space between sections
            }
            
            doc.save(`MediBrief-Shift-Briefing-${new Date().toISOString().split('T')[0]}.pdf`);

        } catch (error) {
            console.error("Error exporting PDF:", error);
            alert("Sorry, there was an error exporting the PDF. Please try again.");
        } finally {
            setIsExporting(false);
        }
    }, [parsedBriefing, isExporting]);

    if (!parsedBriefing) {
        return <div className="text-sm text-red-500">Error: Could not display the shift briefing due to a formatting issue.</div>;
    }

    return (
        <div className="bg-slate-50 dark:bg-slate-900/50 -m-4 p-4 rounded-xl">
            <div className="flex justify-between items-start mb-4 gap-2">
                 <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <span className="text-2xl">📋</span>
                    <span>{parsedBriefing.briefingTitle}</span>
                </h2>
                <div className="flex gap-2 flex-shrink-0">
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
                                     <li key={index} className="list-disc marker:text-slate-400 dark:marker:text-slate-500">{item}</li>
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
