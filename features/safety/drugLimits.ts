
// A deterministic "Truth Source" for clinical safety limits.
// In a production environment, this would be synced with an FDA/BNF database.
// For this architecture, it serves as the hard-coded "Ground Truth" that the AI cannot override.

export interface DrugLimit {
    maxDailyMg: number; // Maximum daily dose in milligrams
    blackBox: boolean; // Has FDA Black Box warning
    criticalInteraction?: string[]; // Drugs that are absolutely contraindicated
}

export const DRUG_LIMITS: Record<string, DrugLimit> = {
    // ANALGESICS / ANTIPYRETICS
    "acetaminophen": { maxDailyMg: 4000, blackBox: true }, // Tylenol
    "paracetamol": { maxDailyMg: 4000, blackBox: true },
    "ibuprofen": { maxDailyMg: 3200, blackBox: true }, // Advil/Motrin
    "aspirin": { maxDailyMg: 4000, blackBox: false },
    "naproxen": { maxDailyMg: 1500, blackBox: true },
    "ketorolac": { maxDailyMg: 40, blackBox: true }, // Oral limit (usually 5 days max)
    "tramadol": { maxDailyMg: 400, blackBox: false },

    // ANTIBIOTICS
    "amoxicillin": { maxDailyMg: 3000, blackBox: false },
    "ciprofloxacin": { maxDailyMg: 1500, blackBox: true }, // Tendon rupture risk
    "azithromycin": { maxDailyMg: 500, blackBox: false }, // Standard Z-Pak daily

    // CARDIAC
    "lisinopril": { maxDailyMg: 80, blackBox: true }, // Fetal toxicity
    "amlodipine": { maxDailyMg: 10, blackBox: false },
    "metoprolol": { maxDailyMg: 400, blackBox: true }, // Abrupt cessation warning
    "atorvastatin": { maxDailyMg: 80, blackBox: false },

    // PSYCH
    "sertraline": { maxDailyMg: 200, blackBox: true }, // Suicidality
    "citalopram": { maxDailyMg: 40, blackBox: true }, // QT prolongation

    // CRITICAL CARE
    "potassium chloride": { maxDailyMg: 200, blackBox: false } // Highly variable, but high oral doses dangerous
};

// Aliases for matching regex
export const DRUG_ALIASES: Record<string, string> = {
    "tylenol": "acetaminophen",
    "apap": "acetaminophen",
    "advil": "ibuprofen",
    "motrin": "ibuprofen",
    "aleve": "naproxen",
    "zoloft": "sertraline",
    "lipitor": "atorvastatin",
    "norvasc": "amlodipine",
    "zithromax": "azithromycin"
};
