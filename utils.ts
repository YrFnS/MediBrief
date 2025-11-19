
/**
 * Utility functions for handling AI responses and data parsing.
 */

export const cleanJsonOutput = (text: string): string => {
    // 1. Priority: Look for standard markdown code blocks with json identifier
    // Regex explains: ```json followed by any whitespace, then capture group until next ```
    const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/i);
    if (jsonBlockMatch && jsonBlockMatch[1]) {
        return jsonBlockMatch[1].trim();
    }

    // 2. Secondary: Look for generic code blocks if the model forgot "json"
    const genericBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/i);
    if (genericBlockMatch && genericBlockMatch[1]) {
         const content = genericBlockMatch[1].trim();
         if (content.startsWith('{') && content.endsWith('}')) {
             return content;
         }
    }

    // 3. Fallback: Robust cleaning finding the first '{' and the last '}' 
    // This handles cases where the model adds preamble (e.g., "Here is the JSON: ...") but no markdown.
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');

    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return text.substring(firstBrace, lastBrace + 1);
    }
    
    // Fallback: Just return the text (likely to fail parsing, but gives us a chance)
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
