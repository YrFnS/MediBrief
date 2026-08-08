import { completeOpenRouterChat } from '../../services/openRouter';
import { parseAndValidate } from '../../utils';
import { MedicationListSchema } from '../chat/schemas';
import type { ParsedMedication } from './types';

const EXTRACTION_PROMPT = `
You are a Clinical Entity Extractor.
Extract all medications and their specific dosages from the provided text.

RULES:
1. Return only valid JSON.
2. Normalize the drug name to its generic name if possible.
3. Extract numerical amount and unit separately.
4. If no dosage is specified, set amount to 0.
5. If no medications are found, return an empty array.

OUTPUT: [{"drugName":"string","amount":number,"unit":"string","context":"string"}]
`;

export const extractMedicationsFromText = async (
    text: string,
    options: { apiKey: string; model: string; signal?: AbortSignal },
): Promise<ParsedMedication[]> => {
    const output = await completeOpenRouterChat({
        apiKey: options.apiKey,
        model: options.model,
        signal: options.signal,
        responseFormat: 'json',
        temperature: 0,
        title: 'MediBrief Medication Candidate Extraction',
        messages: [{
            role: 'user',
            content: `${EXTRACTION_PROMPT}\n\nTEXT TO ANALYZE:\n${text}`,
        }],
    });
    return (parseAndValidate(output, MedicationListSchema) || []) as ParsedMedication[];
};
