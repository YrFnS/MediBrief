
import { GoogleGenAI } from "@google/genai";
import { parseAndValidate } from '../../utils';
import { ParsedMedication } from './types';
import { MedicationListSchema, MedicationList } from '../chat/schemas';

const MODEL = 'gemini-3-flash-preview'; 

const EXTRACTION_PROMPT = `
You are a Clinical Entity Extractor.
Extract all medications and their specific dosages from the provided text.

**RULES:**
1. Return ONLY valid JSON.
2. Normalize the drug name to its generic name if possible (e.g., "Tylenol" -> "Acetaminophen").
3. Extract numerical amount and unit separately.
4. If no dosage is specified, set amount to 0.

**OUTPUT SCHEMA:**
\`\`\`json
[
  { 
    "drugName": "string", 
    "amount": number, 
    "unit": "string" (e.g., "mg", "g", "mcg", "IU"),
    "context": "string" (e.g., "taking", "prescribed", "discontinued")
  }
]
\`\`\`

If no medications are found, return an empty array [].
`;

export const extractMedicationsFromText = async (text: string): Promise<MedicationList> => {
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        const response = await ai.models.generateContent({
            model: MODEL,
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: EXTRACTION_PROMPT },
                        { text: `\n\n**TEXT TO ANALYZE:**\n${text}` }
                    ]
                }
            ],
            config: {
                responseMimeType: 'application/json',
                temperature: 0
            }
        });

        const output = response.text;
        if (!output) return [];

        const parsed = parseAndValidate(output, MedicationListSchema);
        
        if (parsed) {
            return parsed;
        }
        return [];

    } catch (e) {
        console.warn("Safety Extraction Failed:", e);
        return [];
    }
};
