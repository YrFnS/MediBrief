import { completeOpenRouterChat } from '../../services/openRouter';
import type { UploadedFile } from '../../types';
import { ENTITY_EXTRACTION_PROMPT } from '../../constants';
import { parseAndValidate } from '../../utils';
import {
    EntityExtractionSchema,
    type EntityExtraction,
} from '../chat/schemas';

export const ENTITY_EXTRACTION_PROMPT_VERSION = 'entity-extraction-v2-openrouter';

export interface EntityExtractionOptions {
    apiKey: string;
    model: string;
    signal?: AbortSignal;
}

const EMPTY_EXTRACTION: EntityExtraction = {
    allergies: [],
    codeStatus: null,
    diagnosis: [],
};

/**
 * Extracts candidate entities only. The caller is responsible for attaching
 * provenance and human review before any result becomes confirmed patient data.
 */
export const extractEntitiesFromUpload = async (
    file: UploadedFile,
    options: EntityExtractionOptions,
): Promise<EntityExtraction> => {
    if (options.signal?.aborted) return EMPTY_EXTRACTION;

    const text = await completeOpenRouterChat({
        apiKey: options.apiKey,
        model: options.model,
        signal: options.signal,
        responseFormat: 'json',
        temperature: 0,
        title: 'MediBrief Candidate Extraction',
        messages: [{
            role: 'user',
            content: [
                { type: 'text', text: ENTITY_EXTRACTION_PROMPT },
                ...(file.type.startsWith('image/')
                    ? [{
                        type: 'image_url' as const,
                        image_url: {
                            url: `data:${file.type};base64,${file.base64}`,
                        },
                    }]
                    : [{
                        type: 'file' as const,
                        file: {
                            filename: file.file.name,
                            file_data: `data:${file.type};base64,${file.base64}`,
                        },
                    }]),
            ],
        }],
    });

    if (options.signal?.aborted) return EMPTY_EXTRACTION;
    return parseAndValidate(text, EntityExtractionSchema) || EMPTY_EXTRACTION;
};
