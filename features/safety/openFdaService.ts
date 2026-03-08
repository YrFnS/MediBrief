
const FDA_API_BASE = 'https://api.fda.gov/drug/label.json';

export interface DrugSafetyInfo {
    status: 'verified' | 'not_found' | 'service_error';
    found: boolean; // Deprecated but kept for compatibility, maps to status !== 'not_found'
    brandName?: string;
    genericName?: string;
    boxedWarning?: string[]; // The critical "Black Box" warning
    generalWarnings?: string[];
    source: 'openFDA' | 'Unknown';
}

// Simple in-memory cache to prevent redundant network calls during a session
const SAFETY_CACHE: Record<string, DrugSafetyInfo> = {};

/**
 * Sanitizes a drug name by removing dosages, routes, and units.
 * e.g., "Tylenol 500mg PO" -> "Tylenol"
 */
export const sanitizeDrugName = (name: string): string => {
    return name
        .replace(/\b\d+(\.\d+)?\s*(mg|g|mcg|ml|l|iu|units|u)\b/gi, '') // Remove dosages like 500mg, 1g
        .replace(/\b(po|iv|im|subq|pr|topical|oral|intravenous)\b/gi, '') // Remove routes
        .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim();
};

/**
 * Queries openFDA for drug label information.
 * Focuses on 'boxed_warning' which is the highest safety alert level.
 */
export const fetchDrugSafetyInfo = async (drugName: string, signal?: AbortSignal): Promise<DrugSafetyInfo> => {
    // 1. Sanitize and Check Cache
    const sanitizedName = sanitizeDrugName(drugName);
    const cacheKey = sanitizedName.toLowerCase();
    
    if (!cacheKey) {
        return { status: 'not_found', found: false, source: 'openFDA' };
    }

    if (SAFETY_CACHE[cacheKey]) {
        return SAFETY_CACHE[cacheKey];
    }

    try {
        // 2. Construct Query
        // We search both brand and generic names for best coverage
        const searchQuery = `openfda.brand_name:"${sanitizedName}"+OR+openfda.generic_name:"${sanitizedName}"`;
        const url = `${FDA_API_BASE}?search=${searchQuery}&limit=1`;

        const response = await fetch(url, { signal });
        
        if (response.status === 429 || response.status >= 500) {
            throw new Error("Service Unavailable");
        }

        if (!response.ok) {
            // 404 means drug not found in FDA database (or name mismatch)
            const result: DrugSafetyInfo = { status: 'not_found', found: false, source: 'openFDA' };
            SAFETY_CACHE[cacheKey] = result;
            return result;
        }

        const data = await response.json();
        const resultEntry = data.results?.[0];

        if (!resultEntry) {
            const result: DrugSafetyInfo = { status: 'not_found', found: false, source: 'openFDA' };
            SAFETY_CACHE[cacheKey] = result;
            return result;
        }

        // 3. Extract Critical Safety Data
        const info: DrugSafetyInfo = {
            status: 'verified',
            found: true,
            brandName: resultEntry.openfda?.brand_name?.[0],
            genericName: resultEntry.openfda?.generic_name?.[0],
            boxedWarning: resultEntry.boxed_warning, // This is the key field for safety
            generalWarnings: resultEntry.warnings ? resultEntry.warnings.slice(0, 1) : undefined, // Grab first paragraph of general warnings
            source: 'openFDA'
        };

        // 4. Cache and Return
        SAFETY_CACHE[cacheKey] = info;
        return info;

    } catch (error: any) {
        if (error.name === 'AbortError') {
            throw error; // Propagate abort
        }
        console.warn(`openFDA Fetch Error for ${drugName}:`, error);
        // Fail open - we don't want to block the UI, but we explicitly report the error
        return { status: 'service_error', found: false, source: 'Unknown' };
    }
};
