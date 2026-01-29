
import { GoogleGenAI } from "@google/genai";
import { v4 as uuidv4 } from 'uuid';
import { FHIRObservation } from '../fhir/types';
import { CDSSAlert } from './types';
import { CDSS_CHECK_PROMPT } from '../../constants';
import { cleanJsonOutput } from '../../utils';
import { retrieveRelevantProtocols } from './retrievalService';

export const evaluateClinicalSafety = async (observations: FHIRObservation[]): Promise<CDSSAlert[]> => {
    if (!observations || observations.length === 0) return [];

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // 1. Format observations for the model
        const obsString = observations.map(o => 
            `- ${o.code.text || 'Unknown Test'}: ${o.valueQuantity?.value ?? 'N/A'} ${o.valueQuantity?.unit || ''} (Time: ${o.effectiveDateTime || 'Unknown'})`
        ).join('\n');

        // 2. RAG STEP: Retrieve relevant protocols based on the data
        const protocolContext = retrieveRelevantProtocols(observations);

        // 3. Construct Prompt
        const contents = [
            {
                role: 'user',
                parts: [
                    { text: CDSS_CHECK_PROMPT },
                    { text: protocolContext }, // INJECTED KNOWLEDGE
                    { text: `\n\n*** PATIENT OBSERVATIONS TO EVALUATE ***\n${obsString}` }
                ]
            }
        ];

        // 4. Generate with Low Temperature for adherence to protocol
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: contents,
            config: {
                responseMimeType: 'application/json',
                temperature: 0.1 // Strict adherence
            }
        });

        const text = response.text;
        if (!text) return [];

        const cleaned = cleanJsonOutput(text);
        const parsed = JSON.parse(cleaned);

        if (parsed.alerts && Array.isArray(parsed.alerts)) {
            return parsed.alerts.map((alert: any) => ({
                id: uuidv4(),
                ruleId: alert.source_citation ? `prot-${alert.source_citation}` : `ai-${Date.now()}`, // Use protocol ID as key if avail
                title: alert.title || 'CLINICAL ALERT',
                description: alert.description || 'Potential protocol violation detected.',
                level: (alert.level === 'Critical' || alert.level === 'Warning') ? alert.level : 'Info',
                timestamp: Date.now(),
                triggers: Array.isArray(alert.triggers) ? alert.triggers : [],
                actions: Array.isArray(alert.actions) ? alert.actions : [{ label: 'Dismiss', type: 'dismiss' }]
            }));
        }

        return [];

    } catch (e) {
        console.warn("CDSS AI Check Failed:", e);
        return [];
    }
};
