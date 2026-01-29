
import { GoogleGenAI } from "@google/genai";
import { v4 as uuidv4 } from 'uuid';
import { FHIRObservation } from '../fhir/types';
import { CDSSAlert } from './types';
import { CDSS_CHECK_PROMPT } from '../../constants';
import { cleanJsonOutput } from '../../utils';

export const evaluateClinicalSafety = async (observations: FHIRObservation[]): Promise<CDSSAlert[]> => {
    if (!observations || observations.length === 0) return [];

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Format observations for the model
        const obsString = observations.map(o => 
            `${o.code.text}: ${o.valueQuantity?.value} ${o.valueQuantity?.unit} (${o.effectiveDateTime})`
        ).join('\n');

        const contents = [
            {
                role: 'user',
                parts: [
                    { text: CDSS_CHECK_PROMPT },
                    { text: `\n\n**PATIENT OBSERVATIONS:**\n${obsString}` }
                ]
            }
        ];

        // Use standard model with Search capability
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                responseMimeType: 'application/json',
                tools: [{ googleSearch: {} }] // MANDATORY: AI must verify via search
            }
        });

        const text = response.text;
        if (!text) return [];

        const cleaned = cleanJsonOutput(text);
        const parsed = JSON.parse(cleaned);

        if (parsed.alerts && Array.isArray(parsed.alerts)) {
            return parsed.alerts.map((alert: any) => ({
                id: uuidv4(),
                ruleId: `ai-gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
