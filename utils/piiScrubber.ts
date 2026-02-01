
/**
 * Best-effort PII Scrubber for HIPAA Compliance.
 * Removes common patterns for SSNs, Phone Numbers, Emails, and strict Date formats.
 * 
 * Note: Contextual entity recognition (Names) requires a local NLP model which is too heavy.
 * We rely on regex patterns for high-recall fields.
 */
export const scrubPII = (text: string): string => {
    if (!text) return text;

    // US SSN: 000-00-0000
    const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;
    
    // US Phone: (555) 555-5555, 555-555-5555, 555.555.5555
    const PHONE_PATTERN = /\b(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})\b/g;
    
    // Email Address
    const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    
    // Strict Date: MM/DD/YYYY or DD-MM-YYYY (Avoids "2 days ago")
    const DATE_PATTERN = /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b/g;

    // MRN heuristics (Commonly 6-9 digits, sometimes hyphenated)
    // We must be careful not to scrub lab values like "120"
    // const MRN_PATTERN = /\bMRN:?\s*(\d{6,12})\b/gi;

    let scrubbed = text;
    scrubbed = scrubbed.replace(SSN_PATTERN, '[REDACTED_SSN]');
    scrubbed = scrubbed.replace(PHONE_PATTERN, '[REDACTED_PHONE]');
    scrubbed = scrubbed.replace(EMAIL_PATTERN, '[REDACTED_EMAIL]');
    scrubbed = scrubbed.replace(DATE_PATTERN, '[REDACTED_DATE]');
    
    // scrubbed = scrubbed.replace(MRN_PATTERN, 'MRN: [REDACTED]');

    return scrubbed;
};
