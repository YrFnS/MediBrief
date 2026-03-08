export const isHighCredibilitySource = (uri: string) => {
    try {
        const url = new URL(uri);
        const domain = url.hostname.toLowerCase();
        return domain.endsWith('.gov') || 
               domain.endsWith('.org') || 
               domain.endsWith('.edu') || 
               domain.includes('mayoclinic') ||
               domain.includes('webmd') || 
               domain.includes('medscape') ||
               domain.includes('ncbi') ||
               domain.includes('pubmed');
    } catch {
        return false;
    }
};
