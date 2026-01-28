
import { GoogleGenAI } from "@google/genai";
import { UploadedFile } from '../../types';
import { ENTITY_EXTRACTION_PROMPT } from '../../constants';
import { cleanJsonOutput } from '../../utils';
import { PatientEntityData } from '../patient-management/types';

const MODEL = 'gemini-3-flash-preview'; // Fast, cheap model for extraction

export const extractEntitiesFromUpload = async (file: UploadedFile): Promise<Partial<PatientEntityData>> => {
    try {
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

        const text = response.text;
        if (!text) return {};

        const cleaned = cleanJsonOutput(text);
        const parsed = JSON.parse(cleaned);

        // Validation / Sanitization
        const result: Partial<PatientEntityData> = {};

        if (Array.isArray(parsed.allergies) && parsed.allergies.length > 0) {
            result.allergies = parsed.allergies.map((s: any) => String(s));
        }
        
        if (typeof parsed.codeStatus === 'string' && parsed.codeStatus.trim()) {
            result.codeStatus = parsed.codeStatus.trim();
        }

        if (Array.isArray(parsed.diagnosis) && parsed.diagnosis.length > 0) {
            result.diagnosis = parsed.diagnosis.map((s: any) => String(s));
        }

        return result;

    } catch (e) {
        console.warn("Entity Extraction Failed:", e);
        return {};
    }
};
