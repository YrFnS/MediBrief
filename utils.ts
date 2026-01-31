
import { z, ZodSchema } from 'zod';

/**
 * Utility functions for handling AI responses and data parsing.
 */

export const cleanJsonOutput = (text: string): string => {
    // 1. Priority: Look for standard markdown code blocks with json identifier
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
    let startIndex = text.indexOf('{');
    const lastIndex = text.lastIndexOf('}');

    while (startIndex !== -1 && lastIndex > startIndex) {
        const candidate = text.substring(startIndex, lastIndex + 1);
        try {
            JSON.parse(candidate);
            return candidate; 
        } catch (e) {
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

/**
 * Validates parsed JSON against a Zod schema.
 * Returns null if validation fails, logging the error.
 */
export const parseAndValidate = <T>(content: string, schema: ZodSchema<T>): T | null => {
    try {
        const cleaned = cleanJsonOutput(content);
        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        } catch {
            return null; // Invalid JSON syntax
        }
        
        const result = schema.safeParse(parsed);
        
        if (result.success) {
            return result.data;
        } else {
            console.warn("Zod Validation Failed:", result.error);
            return null;
        }
    } catch (e) {
        console.error("Parse Error:", e);
        return null;
    }
};

export const isJsonBriefing = (content: string): boolean => {
    // Quick heuristics, but consumers should use Zod for use
    return content.includes('briefingTitle') && content.includes('sections');
};

export const isImageAnalysis = (content: string): boolean => {
     return content.includes('"reportType": "medical-image"') || content.includes('"reportType":"medical-image"');
};

export const isLabReport = (content: string): boolean => {
    return content.includes('"reportType": "lab-report"') || content.includes('"reportType":"lab-report"');
};

export const isInteractionMatrix = (content: string): boolean => {
    return content.includes('"reportType": "interaction-check"') || content.includes('"reportType":"interaction-check"');
};

export const getFriendlyErrorMessage = (error: unknown): string => {
    let errorMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
        try {
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
