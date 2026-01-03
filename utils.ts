
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
    return text.trim();
};

export const parseJsonSafe = <T>(content: string): T | null => {
    try {
        const cleaned = cleanJsonOutput(content);
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

export const isLabReport = (content: string): boolean => {
    const data = parseJsonSafe<any>(content);
    return data && typeof data === 'object' && data.reportType === 'lab-report';
};

export const isInteractionMatrix = (content: string): boolean => {
    const data = parseJsonSafe<any>(content);
    return data && typeof data === 'object' && data.reportType === 'interaction-check';
};

export const getFriendlyErrorMessage = (error: unknown): string => {
    let errorMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
        try {
            // Attempt to parse the error message as JSON, which is common for API errors
            const errorObj = JSON.parse(error.message);
            if (errorObj.error && errorObj.error.message) {
                const message = errorObj.error.message.toLowerCase();
                if (message.includes('overloaded') || message.includes('too many requests') || errorObj.error.code === 503 || errorObj.error.code === 500) {
                    return 'The service is currently experiencing high demand. Please wait a moment and try again.';
                }
                 if (message.includes('api key not valid')) {
                    return 'The API key is not valid. Please check your configuration.';
                }
                return errorObj.error.message; 
            } else {
                return error.message; 
            }
        } catch (parseError) {
            if (error.message.toLowerCase().includes('permission denied')) {
                return 'Microphone access was denied. Please allow microphone permission in your browser settings.';
            }
            return error.message;
        }
    } else if (typeof error === 'string') {
        return error;
    }
    return errorMessage;
};