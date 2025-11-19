
/**
 * Utility functions for handling AI responses and data parsing.
 */

export const cleanJsonOutput = (text: string): string => {
    // Remove markdown code blocks (```json ... ``` or just ``` ... ```)
    return text.replace(/```json\n?|```/g, '').trim();
};

export const parseJsonSafe = <T>(content: string): T | null => {
    try {
        const cleaned = cleanJsonOutput(content);
        // Quick check for object start to avoid unnecessary parsing attempts
        if (!cleaned.startsWith('{')) return null;
        return JSON.parse(cleaned) as T;
    } catch (e) {
        return null;
    }
};

export const isJsonBriefing = (content: string): boolean => {
    const data = parseJsonSafe<any>(content);
    return data && typeof data === 'object' && 'briefingTitle' in data && 'sections' in data;
};

export const isImageAnalysis = (content: string): boolean => {
     const data = parseJsonSafe<any>(content);
     return data && typeof data === 'object' && data.reportType === 'medical-image';
};
