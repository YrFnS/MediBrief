const FDA_API_BASE = 'https://api.fda.gov/drug/label.json';

export interface DrugLabelInfo {
    status: 'found' | 'not_found' | 'service_error';
    found: boolean;
    brandName?: string;
    genericName?: string;
    boxedWarning?: string[];
    generalWarnings?: string[];
    source: 'openFDA' | 'Unknown';
}

/** @deprecated Use DrugLabelInfo. */
export type DrugSafetyInfo = DrugLabelInfo;

const LABEL_CACHE: Record<string, DrugLabelInfo> = {};

/**
 * Removes common dose and route fragments so a medication name can be used in
 * an openFDA label query. This does not normalize the drug clinically.
 */
export const sanitizeDrugName = (name: string): string => name
    .replace(/\b\d+(\.\d+)?\s*(mg|g|mcg|ml|l|iu|units|u)\b/gi, '')
    .replace(/\b(po|iv|im|subq|pr|topical|oral|intravenous)\b/gi, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Retrieves a limited set of public FDA label fields. A `found` result means a
 * matching label record was returned; it is not verification that the product,
 * extracted dose, or patient-specific regimen is safe or appropriate.
 */
export const fetchDrugSafetyInfo = async (
    drugName: string,
    signal?: AbortSignal,
): Promise<DrugLabelInfo> => {
    const sanitizedName = sanitizeDrugName(drugName);
    const cacheKey = sanitizedName.toLowerCase();

    if (!cacheKey) {
        return { status: 'not_found', found: false, source: 'openFDA' };
    }
    if (LABEL_CACHE[cacheKey]) return LABEL_CACHE[cacheKey];

    try {
        const searchQuery = `openfda.brand_name:"${sanitizedName}"+OR+openfda.generic_name:"${sanitizedName}"`;
        const response = await fetch(
            `${FDA_API_BASE}?search=${searchQuery}&limit=1`,
            { signal },
        );

        if (response.status === 429 || response.status >= 500) {
            throw new Error('Service unavailable');
        }
        if (!response.ok) {
            const result: DrugLabelInfo = {
                status: 'not_found',
                found: false,
                source: 'openFDA',
            };
            LABEL_CACHE[cacheKey] = result;
            return result;
        }

        const data = await response.json();
        const resultEntry = data.results?.[0];
        if (!resultEntry) {
            const result: DrugLabelInfo = {
                status: 'not_found',
                found: false,
                source: 'openFDA',
            };
            LABEL_CACHE[cacheKey] = result;
            return result;
        }

        const info: DrugLabelInfo = {
            status: 'found',
            found: true,
            brandName: resultEntry.openfda?.brand_name?.[0],
            genericName: resultEntry.openfda?.generic_name?.[0],
            boxedWarning: resultEntry.boxed_warning,
            generalWarnings: resultEntry.warnings
                ? resultEntry.warnings.slice(0, 1)
                : undefined,
            source: 'openFDA',
        };
        LABEL_CACHE[cacheKey] = info;
        return info;
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            throw error;
        }
        console.warn(`openFDA label lookup failed for ${drugName}:`, error);
        return {
            status: 'service_error',
            found: false,
            source: 'Unknown',
        };
    }
};
