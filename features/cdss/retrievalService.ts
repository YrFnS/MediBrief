
import { FHIRObservation } from '../fhir/types';
import { HOSPITAL_PROTOCOLS } from './protocolLibrary';

/**
 * RAG RETRIEVER
 * Analyzes the incoming patient data and retrieves relevant protocol text chunks.
 * This ensures the LLM context contains the "Ground Truth" needed for evaluation.
 */
export const retrieveRelevantProtocols = (observations: FHIRObservation[]): string => {
    if (!observations || observations.length === 0) return "";

    // 1. Create a "Search Vector" from the observation codes
    // In a real app, this would be embeddings. Here, we use token matching.
    const searchTokens = observations.map(o => {
        const text = o.code.text?.toLowerCase() || '';
        const coding = o.code.coding?.[0]?.display?.toLowerCase() || '';
        return `${text} ${coding}`;
    }).join(' ');

    // 2. Filter Protocols based on relevance
    // If a protocol's keywords appear in the patient data, we include it.
    const relevantProtocols = HOSPITAL_PROTOCOLS.filter(protocol => {
        return protocol.keywords.some(keyword => searchTokens.includes(keyword));
    });

    if (relevantProtocols.length === 0) return "";

    // 3. Construct the Context Block
    const contextBlock = relevantProtocols.map(p => `
    >>> BEGIN OFFICIAL PROTOCOL: ${p.title} (ID: ${p.id})
    ${p.content}
    <<< END OFFICIAL PROTOCOL
    `).join('\n\n');

    return `
    *** RETRIEVED HOSPITAL PROTOCOLS (GROUND TRUTH) ***
    The following are the active clinical protocols relevant to this patient.
    Use ONLY these definitions to determine safety alerts.
    
    ${contextBlock}
    `;
};
