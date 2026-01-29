
export interface MedicalProtocol {
    id: string;
    title: string;
    keywords: string[];
    content: string;
}

// In a real production app, this would be fetched from a vector database or CMS.
// For this vertical slice, we hard-code the "Gold Standard" texts.
export const HOSPITAL_PROTOCOLS: MedicalProtocol[] = [
    {
        id: "PROT-SEPSIS-3",
        title: "Sepsis-3 Clinical Criteria & Management (2024)",
        keywords: ["temp", "temperature", "heart rate", "hr", "resp", "respiratory", "wbc", "white blood", "lactate", "bp", "blood pressure", "map", "arterial"],
        content: `
        1. DEFINITIONS:
           - Sepsis is defined as life-threatening organ dysfunction caused by a dysregulated host response to infection.
           - Organ dysfunction can be represented by an increase in the Sequential [Sepsis-related] Organ Failure Assessment (SOFA) score of 2 points or more.

        2. CLINICAL SCREENING (qSOFA):
           Bedside criteria to identify patients with suspected infection who are at greater risk for a poor outcome.
           Presence of 2 or more of the following:
           - Respiratory rate >= 22 breaths/min
           - Altered mentation (GCS < 15)
           - Systolic blood pressure <= 100 mmHg

        3. SEPTIC SHOCK:
           Defined as a subset of sepsis in which underlying circulatory and cellular/metabolic abnormalities are profound enough to substantially increase mortality.
           Clinical Criteria:
           - Sepsis AND
           - Vasopressor requirement to maintain a mean arterial pressure (MAP) >= 65 mmHg AND
           - Serum lactate level > 2 mmol/L (>18 mg/dL) in the absence of hypovolemia.
        
        4. CRITICAL ALERT THRESHOLDS:
           - Lactate > 4.0 mmol/L: Immediate Critical Alert. Initiate fluid resuscitation (30mL/kg).
           - MAP < 65 mmHg: Critical Hypotension.
        `
    },
    {
        id: "PROT-KDIGO-AKI",
        title: "KDIGO Clinical Practice Guideline for Acute Kidney Injury",
        keywords: ["creatinine", "creat", "scr", "urine", "bun", "kidney", "renal", "egfr"],
        content: `
        1. DEFINITION AND STAGING OF AKI:
           AKI is defined as any of the following:
           - Increase in Serum Creatinine (SCr) by >= 0.3 mg/dl (>= 26.5 umol/l) within 48 hours; OR
           - Increase in SCr to >= 1.5 times baseline, which is known or presumed to have occurred within the prior 7 days; OR
           - Urine volume < 0.5 ml/kg/h for 6 hours.

        2. STAGING CRITERIA:
           - Stage 1: SCr 1.5-1.9 times baseline OR >=0.3 mg/dl increase.
           - Stage 2: SCr 2.0-2.9 times baseline.
           - Stage 3: SCr 3.0 times baseline OR increase in SCr to >= 4.0 mg/dl (>= 353.6 umol/l) OR initiation of renal replacement therapy.

        3. CRITICAL VALUES:
           - Potassium > 5.5 mmol/L is a common complication of AKI requiring immediate ECG monitoring.
           - Potassium > 6.0 mmol/L is a CRITICAL HYPERKALEMIA event.
        `
    },
    {
        id: "PROT-ACC-HTN",
        title: "ACC/AHA Guideline for Prevention and Management of High Blood Pressure",
        keywords: ["bp", "blood pressure", "systolic", "diastolic", "hypertension"],
        content: `
        1. BLOOD PRESSURE CATEGORIES:
           - Normal: <120/80 mmHg
           - Elevated: 120-129/<80 mmHg
           - Hypertension Stage 1: 130-139/80-89 mmHg
           - Hypertension Stage 2: >=140/90 mmHg

        2. HYPERTENSIVE CRISIS (Consult Required):
           - Hypertensive Urgency: >180/120 mmHg without Target Organ Damage.
           - Hypertensive Emergency: >180/120 mmHg WITH Target Organ Damage (chest pain, shortness of breath, back pain, numbness/weakness, change in vision).
           
        3. CRITICAL ACTION:
           - If Systolic > 180 or Diastolic > 120, repeat BP in 5 minutes. If unchanged, flag as Hypertensive Crisis.
        `
    },
    {
        id: "PROT-ELECTROLYTES",
        title: "Hospital Standard Electrolyte Panic Values",
        keywords: ["potassium", "k+", "sodium", "na+", "calcium", "magnesium", "glucose"],
        content: `
        1. POTASSIUM (K+):
           - CRITICAL LOW: < 2.5 mmol/L (Risk of arrhythmia)
           - CRITICAL HIGH: > 6.0 mmol/L (Risk of cardiac arrest)
        
        2. SODIUM (Na+):
           - CRITICAL LOW: < 120 mmol/L (Risk of seizure/coma)
           - CRITICAL HIGH: > 160 mmol/L

        3. GLUCOSE:
           - CRITICAL LOW (Hypoglycemia): < 54 mg/dL (< 3.0 mmol/L)
           - CRITICAL HIGH: > 400 mg/dL (Risk of DKA/HHS)
        `
    }
];
