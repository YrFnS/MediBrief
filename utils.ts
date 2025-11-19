
/**
 * Utility functions for handling AI responses and data parsing.
 */

export const cleanJsonOutput = (text: string): string => {
    // Robust cleaning: Find the first '{' and the last '}' and extract everything in between.
    // This handles cases where the model adds preamble (e.g., "Here is the JSON: ...") or markdown code blocks.
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return text.substring(firstBrace, lastBrace + 1);
    }
    
    // Fallback: Just return the text if no brackets found (will likely fail parsing, but better than empty)
    return text.trim();
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
