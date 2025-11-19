
import { jsPDF } from 'jspdf';

interface ParsedSection {
    title: string;
    items: string[];
}

interface ParsedBriefing {
    briefingTitle: string;
    sections: ParsedSection[];
}

// Helper to strip emojis which break jsPDF
const stripEmojis = (str: string): string => {
    return str.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}]/gu, '');
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
        // Strip emojis from title
        doc.text(stripEmojis(briefing.briefingTitle), pageW / 2, y, { align: 'center' });
        y += 40;

        // Sections
        for (const section of briefing.sections) {
            if (!section.items || section.items.length === 0) continue;

            checkPageBreak(40);
            
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(14);
            // Strip emojis from section titles
            doc.text(stripEmojis(section.title), margin, y);
            y += 20;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            
            for (const item of section.items) {
                // Strip emojis from list items
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
        
        doc.save(`MediBrief-Shift-Briefing-${new Date().toISOString().split('T')[0]}.pdf`);

    } catch (error) {
        console.error("Error exporting PDF:", error);
        throw new Error("Failed to generate PDF document.");
    }
};
