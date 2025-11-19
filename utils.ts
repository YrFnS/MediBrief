
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

    // 3. Fallback: Robust search for valid JSON object.
    // We iterate through potential starting braces to avoid capturing conversational preambles 
    // that might contain braces, e.g., "Here is the plan {option A}. JSON: { ... }"
    let startIndex = text.indexOf('{');
    const lastIndex = text.lastIndexOf('}');

    while (startIndex !== -1 && lastIndex > startIndex) {
        const candidate = text.substring(startIndex, lastIndex + 1);
        try {
            JSON.parse(candidate);
            // If it parses successfully, return it immediately
            return candidate; 
        } catch (e) {
            // If parse fails, look for the NEXT opening brace and try again
            startIndex = text.indexOf('{', startIndex + 1);
        }
    }

    // Last Ditch: Just return the text.
    // Removing the greedy "{ ... }" substring fallback because it's too aggressive
    // and often captures invalid JSON when the model is "thinking" in text.
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