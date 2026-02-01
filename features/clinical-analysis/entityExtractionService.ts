
import { GoogleGenAI } from "@google/genai";
import { UploadedFile } from '../../types';
import { ENTITY_EXTRACTION_PROMPT } from '../../constants';
import { cleanJsonOutput, parseAndValidate } from '../../utils';
import { PatientEntityData } from '../patient-management/types';
import { EntityExtractionSchema, EntityExtraction } from '../chat/schemas';

const MODEL = 'gemini-3-flash-preview'; 

export const extractEntitiesFromUpload = async (file: UploadedFile, signal?: AbortSignal): Promise<Partial<PatientEntityData>> => {
    try {
        if (signal?.aborted) return {};

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const contents = [
            {
                role: 'user',
                parts: [
                    {
                        inlineData: {
                            mimeType: file.type,
                            data: file.base64
                        }
                    },
                    { text: ENTITY_EXTRACTION_PROMPT }
                ]
            }
        ];

        const response = await ai.models.generateContent({
            model: MODEL,
            contents: contents,
            config: {
                responseMimeType: 'application/json'
            }
        });

        if (signal?.aborted) return {};

        const text = response.text;
        if (!text) return {};

        // Validated parsing with explicit type
        const parsed = parseAndValidate<EntityExtraction>(text, EntityExtractionSchema);
        if (!parsed) return {};

        const result: Partial<PatientEntityData> = {};

        if (parsed.allergies && parsed.allergies.length > 0) {
            result.allergies = parsed.allergies;
        }
        
        if (parsed.codeStatus && parsed.codeStatus.trim()) {
            result.codeStatus = parsed.codeStatus.trim();
        }

        if (parsed.diagnosis && parsed.diagnosis.length > 0) {
            result.diagnosis = parsed.diagnosis;
        }

        return result;

    } catch (e) {
        // If it was just an abort, we can ignore warning
        if (signal?.aborted) return {};
        console.warn("Entity Extraction Failed:", e);
        return {};
    }
};
