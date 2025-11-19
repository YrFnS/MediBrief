
import { jsPDF } from 'jspdf';

interface ParsedSection {
    title: string;
    items: string[];
}

interface ParsedBriefing {
    briefingTitle: string;
    sections: ParsedSection[];
}

// Helper to strip emojis and unsupported unicode characters which break jsPDF standard fonts.
// Includes ranges for: Emoticons, Dingbats, Transport/Map symbols, Enclosed Alphanumeric, etc.
const stripEmojis = (str: string): string => {
    return str.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
              .replace(/\s+/g, ' ').trim();
};

export const exportBriefingToPdf = async (briefing: ParsedBriefing): Promise<void> => {
    try {
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
        doc.text(stripEmojis(briefing.briefingTitle), pageW / 2, y, { align: 'center' });
        y += 40;

        // Sections
        for (const section of briefing.sections) {
            if (!section.items || section.items.length === 0) continue;

            checkPageBreak(40);
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            doc.text(stripEmojis(section.title), margin, y);
            y += 20;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            
            for (const item of section.items) {
                const lines = doc.splitTextToSize(`• ${stripEmojis(item)}`, maxW - 15);
                const requiredHeight = lines.length * 12;

                if (checkPageBreak(requiredHeight)) {
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(12);
                    doc.text(`${stripEmojis(section.title)} (continued)`, margin, y);
                    y += 20;
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(10);
                }
                
                doc.text(lines, margin + 15, y);
                y += requiredHeight + 4;
            }
            y += 20;
        }
        
        // FIX: Windows does not allow colons in filenames. Replace : with -
        const safeDate = new Date().toISOString().split('T')[0];
        const safeTimestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        doc.save(`MediBrief-Shift-Briefing-${safeTimestamp}.pdf`);

    } catch (error) {
        console.error("Error exporting PDF:", error);
        throw new Error("Failed to generate PDF document.");
    }
};