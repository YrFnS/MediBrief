import { GoogleGenAI } from '@google/genai';
import type { UploadedFile } from '../../types';
import { ENTITY_EXTRACTION_PROMPT } from '../../constants';
import { parseAndValidate } from '../../utils';
import {
    EntityExtractionSchema,
    type EntityExtraction,
} from '../chat/schemas';

export const ENTITY_EXTRACTION_MODEL = 'gemini-3-flash-preview';
export const ENTITY_EXTRACTION_PROMPT_VERSION = 'entity-extraction-v1';

export interface EntityExtractionOptions {
    signal?: AbortSignal;
    apiKey?: string;
    model?: string;
}

const EMPTY_EXTRACTION: EntityExtraction = {
    allergies: [],
    codeStatus: null,
    diagnosis: [],
};

/**
 * Extracts candidate entities only. The caller is responsible for attaching
 * provenance and putting the result through human review before it is used as
 * confirmed patient data.
 */
export const extractEntitiesFromUpload = async (
    file: UploadedFile,
    options: EntityExtractionOptions = {},
): Promise<EntityExtraction> => {
    const { signal } = options;

    try {
        if (signal?.aborted) return EMPTY_EXTRACTION;

        const apiKey = options.apiKey || process.env.API_KEY || '';
        if (!apiKey) {
            console.warn('Entity extraction skipped because no Gemini API key is configured.');
            return EMPTY_EXTRACTION;
        }

        const ai = new GoogleGenAI({ apiKey });
        const contents = [
            {
                role: 'user',
                parts: [
                    {
                        inlineData: {
                            mimeType: file.type,
                            data: file.base64,
                        },
                    },
                    { text: ENTITY_EXTRACTION_PROMPT },
                ],
            },
        ];

        const response = await ai.models.generateContent({
            model: options.model || ENTITY_EXTRACTION_MODEL,
            contents,
            config: {
                responseMimeType: 'application/json',
                temperature: 0,
            },
        });

        if (signal?.aborted) return EMPTY_EXTRACTION;
        const text = response.text;
        if (!text) return EMPTY_EXTRACTION;

        return parseAndValidate(text, EntityExtractionSchema)
            || EMPTY_EXTRACTION;
    } catch (error) {
        if (signal?.aborted) return EMPTY_EXTRACTION;
        console.warn('Entity extraction failed:', error);
        return EMPTY_EXTRACTION;
    }
};
