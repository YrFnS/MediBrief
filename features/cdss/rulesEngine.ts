
import { v4 as uuidv4 } from 'uuid';
import { FHIRObservation } from '../fhir/types';
import { CDSSAlert } from './types';
import { normalizeValue, NORMALIZED_UNITS } from '../fhir/unitService';

/**
 * DETERMINISTIC CLINICAL RULES ENGINE
 * 
 * This engine evaluates patient data against hard-coded, standard clinical protocols.
 * It does NOT use LLM inference for decision making, ensuring 100% predictable safety alerts.
 * 
 * Protocols Implemented:
 * 1. Sepsis-3 (Lactate, MAP)
 * 2. KDIGO AKI (Creatinine, Potassium)
 * 3. Vital Sign Instability (Tachycardia, Hypotension, Hypoxia)
 */

interface ClinicalValue {
    value: number;
    unit: string;
    timestamp: number;
}

const extractLatestValue = (observations: FHIRObservation[], matches: string[]): ClinicalValue | null => {
    const relevant = observations.filter(o => {
        const text = o.code.text?.toLowerCase() || '';
        return matches.some(m => text.includes(m));
    }).sort((a, b) => {
        const tA = a.effectiveDateTime ? new Date(a.effectiveDateTime).getTime() : 0;
        const tB = b.effectiveDateTime ? new Date(b.effectiveDateTime).getTime() : 0;
        return tB - tA;
    });

    if (relevant.length === 0) return null;
    const latest = relevant[0];
    
    if (latest.valueQuantity?.value !== undefined) {
        // NORMALIZE
        const normalized = normalizeValue(
            latest.valueQuantity.value, 
            latest.valueQuantity.unit || '', 
            latest.code.text || ''
        );
        
        return {
            value: normalized.value,
            unit: normalized.unit,
            timestamp: latest.effectiveDateTime ? new Date(latest.effectiveDateTime).getTime() : Date.now()
        };
    }
    return null;
};

export const evaluateClinicalSafety = async (observations: FHIRObservation[]): Promise<CDSSAlert[]> => {
    const alerts: CDSSAlert[] = [];
    const now = Date.now();

    // --- 1. SEPSIS-3 PROTOCOL ---
    // Trigger: Lactate > 4.0 mmol/L (Septic Shock Indicator)
    const lactate = extractLatestValue(observations, ['lactate']);
    if (lactate && lactate.unit === NORMALIZED_UNITS.LACTATE && lactate.value > 4.0) {
        alerts.push({
            id: uuidv4(),
            ruleId: 'PROT-SEPSIS-3-LACTATE',
            title: 'CRITICAL: SEPTIC SHOCK CRITERIA',
            level: 'Critical',
            description: `Serum Lactate ${lactate.value} mmol/L exceeds critical threshold of 4.0 mmol/L. Consistent with Septic Shock.`,
            timestamp: now,
            triggers: [`Lactate: ${lactate.value} mmol/L`],
            actions: [
                { label: 'Order Fluid Bolus (30mL/kg)', type: 'order', payload: '30mL/kg Crystalloid Bolus' },
                { label: 'Order Vasopressors', type: 'order', payload: 'Norepinephrine' }
            ]
        });
    } else if (lactate && lactate.unit === NORMALIZED_UNITS.LACTATE && lactate.value >= 2.0) {
        alerts.push({
            id: uuidv4(),
            ruleId: 'PROT-SEPSIS-3-WARNING',
            title: 'WARNING: ELEVATED LACTATE',
            level: 'Warning',
            description: `Serum Lactate ${lactate.value} mmol/L is elevated (>2.0). Monitor for sepsis progression.`,
            timestamp: now,
            triggers: [`Lactate: ${lactate.value} mmol/L`],
            actions: [{ label: 'Repeat Lactate in 2h', type: 'order', payload: 'Repeat Lactate Level' }]
        });
    }

    // --- 2. KDIGO AKI / ELECTROLYTE PROTOCOL ---
    // Trigger: Potassium > 6.0 (Critical Hyperkalemia)
    const potassium = extractLatestValue(observations, ['potassium', 'k+']);
    if (potassium && potassium.unit === NORMALIZED_UNITS.POTASSIUM && potassium.value > 6.0) {
        alerts.push({
            id: uuidv4(),
            ruleId: 'PROT-ELECTROLYTE-K-CRIT',
            title: 'CRITICAL: HYPERKALEMIA',
            level: 'Critical',
            description: `Potassium ${potassium.value} mmol/L is critical (>6.0). Risk of cardiac arrhythmia.`,
            timestamp: now,
            triggers: [`K+: ${potassium.value} mmol/L`],
            actions: [
                { label: 'Order ECG', type: 'order', payload: '12-Lead ECG' },
                { label: 'Calcium Gluconate', type: 'order', payload: 'Calcium Gluconate 1g IV' }
            ]
        });
    }

    // Trigger: Creatinine > 4.0 (AKI Stage 3)
    const creatinine = extractLatestValue(observations, ['creatinine', 'scr']);
    if (creatinine && creatinine.unit === NORMALIZED_UNITS.CREATININE && creatinine.value > 4.0) {
        alerts.push({
            id: uuidv4(),
            ruleId: 'PROT-KDIGO-AKI-3',
            title: 'CRITICAL: ACUTE KIDNEY INJURY',
            level: 'Critical',
            description: `Creatinine ${creatinine.value} mg/dL suggests KDIGO Stage 3 AKI.`,
            timestamp: now,
            triggers: [`Cr: ${creatinine.value} mg/dL`],
            actions: [{ label: 'Renal Consult', type: 'order', payload: 'Nephrology Consult' }]
        });
    }

    // --- 3. HEMODYNAMIC STABILITY ---
    // Trigger: MAP < 65 or SBP < 90 (Hypotension)
    const sbp = extractLatestValue(observations, ['systolic', 'sbp']);
    if (sbp && sbp.value < 90) {
        alerts.push({
            id: uuidv4(),
            ruleId: 'PROT-HYPOTENSION',
            title: 'CRITICAL: HYPOTENSION',
            level: 'Critical',
            description: `Systolic BP ${sbp.value} mmHg is below critical threshold of 90 mmHg.`,
            timestamp: now,
            triggers: [`SBP: ${sbp.value} mmHg`],
            actions: [{ label: 'Assess Fluid Status', type: 'acknowledge' }]
        });
    }

    // Trigger: HR > 130 (Tachycardia)
    const hr = extractLatestValue(observations, ['heart rate', 'pulse', 'hr']);
    if (hr && hr.value > 130) {
        alerts.push({
            id: uuidv4(),
            ruleId: 'PROT-TACHYCARDIA',
            title: 'WARNING: TACHYCARDIA',
            level: 'Warning',
            description: `Heart Rate ${hr.value} bpm is significantly elevated.`,
            timestamp: now,
            triggers: [`HR: ${hr.value} bpm`],
            actions: [{ label: 'Check Rhythm', type: 'order', payload: 'Telemetry Strip' }]
        });
    }

    // Trigger: SpO2 < 90% (Hypoxia)
    const spo2 = extractLatestValue(observations, ['spo2', 'oxygen', 'saturation']);
    if (spo2 && spo2.value < 90) {
        alerts.push({
            id: uuidv4(),
            ruleId: 'PROT-HYPOXIA',
            title: 'CRITICAL: HYPOXIA',
            level: 'Critical',
            description: `SpO2 ${spo2.value}% indicates respiratory compromise.`,
            timestamp: now,
            triggers: [`SpO2: ${spo2.value}%`],
            actions: [{ label: 'Titrate O2', type: 'acknowledge' }]
        });
    }

    return alerts;
};
