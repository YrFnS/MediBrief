
import { FHIRObservation } from '../fhir/types';
import { CDSSAlert, ClinicalRule } from './types';
import { v4 as uuidv4 } from 'uuid';

// Helper to extract value from observation array by name (case-insensitive partial match)
const getValue = (obs: FHIRObservation[], name: string): number | null => {
    const found = obs.find(o => o.code.text.toLowerCase().includes(name.toLowerCase()));
    return found && found.valueQuantity ? found.valueQuantity.value : null;
};

// --- RULES DEFINITION ---

const SepsisRule: ClinicalRule = {
    id: 'sepsis-protocol-v1',
    name: 'Sepsis Watch',
    evaluate: (obs) => {
        const temp = getValue(obs, 'Temperature') || getValue(obs, 'Temp');
        const hr = getValue(obs, 'Heart Rate') || getValue(obs, 'HR') || getValue(obs, 'Pulse');
        const wbc = getValue(obs, 'WBC') || getValue(obs, 'White Blood Cell');
        const lactate = getValue(obs, 'Lactate');

        const triggers = [];
        let score = 0;

        if (temp && (temp > 38.3 || temp < 36)) { score++; triggers.push(`Temp: ${temp}`); }
        if (hr && hr > 90) { score++; triggers.push(`HR: ${hr}`); }
        if (wbc && (wbc > 12 || wbc < 4)) { score++; triggers.push(`WBC: ${wbc}`); }
        if (lactate && lactate > 2) { score += 2; triggers.push(`Lactate: ${lactate}`); }

        if (score >= 2) {
            return {
                id: uuidv4(),
                ruleId: 'sepsis-protocol-v1',
                title: 'POSSIBLE SEPSIS DETECTED',
                description: 'Patient meets SIRS/Sepsis criteria based on recent vitals and labs.',
                level: 'Critical',
                timestamp: Date.now(),
                triggers,
                actions: [
                    { label: 'Order Lactate / Cultures', type: 'order', payload: 'Order: Serum Lactate, Blood Cultures x2' },
                    { label: 'Start Fluids', type: 'order', payload: 'Order: 30ml/kg Crystalloid Bolus' },
                    { label: 'Dismiss', type: 'dismiss' }
                ]
            };
        }
        return null;
    }
};

const HyperKalemiaRule: ClinicalRule = {
    id: 'electrolyte-k-high',
    name: 'Hyperkalemia Check',
    evaluate: (obs) => {
        const k = getValue(obs, 'Potassium') || getValue(obs, 'K+');
        if (k && k > 5.5) {
            return {
                id: uuidv4(),
                ruleId: 'electrolyte-k-high',
                title: 'CRITICAL HYPERKALEMIA',
                description: `Potassium level of ${k} is critically high. Risk of arrhythmias.`,
                level: 'Critical',
                timestamp: Date.now(),
                triggers: [`K+: ${k}`],
                actions: [
                    { label: 'Order EKG', type: 'order', payload: 'Order: 12-Lead EKG STAT' },
                    { label: 'Calcium Gluconate', type: 'order', payload: 'Order: Calcium Gluconate 1g IV' },
                    { label: 'Acknowledge', type: 'dismiss' }
                ]
            };
        }
        return null;
    }
};

const HypoKalemiaRule: ClinicalRule = {
    id: 'electrolyte-k-low',
    name: 'Hypokalemia Check',
    evaluate: (obs) => {
        const k = getValue(obs, 'Potassium') || getValue(obs, 'K+');
        if (k && k < 3.5) {
            return {
                id: uuidv4(),
                ruleId: 'electrolyte-k-low',
                title: 'Hypokalemia',
                description: `Potassium level of ${k} is low.`,
                level: 'Warning',
                timestamp: Date.now(),
                triggers: [`K+: ${k}`],
                actions: [
                    { label: 'Replete K+', type: 'order', payload: 'Order: KCl 40mEq PO' },
                    { label: 'Dismiss', type: 'dismiss' }
                ]
            };
        }
        return null;
    }
};

const HTNCrisisRule: ClinicalRule = {
    id: 'htn-crisis',
    name: 'Hypertensive Crisis',
    evaluate: (obs) => {
        const sbp = getValue(obs, 'Systolic') || getValue(obs, 'BP Systolic');
        const dbp = getValue(obs, 'Diastolic') || getValue(obs, 'BP Diastolic');

        if ((sbp && sbp > 180) || (dbp && dbp > 120)) {
             return {
                id: uuidv4(),
                ruleId: 'htn-crisis',
                title: 'HYPERTENSIVE URGENCY',
                description: `BP ${sbp}/${dbp} exceeds critical thresholds.`,
                level: 'Critical',
                timestamp: Date.now(),
                triggers: [`BP: ${sbp}/${dbp}`],
                actions: [
                    { label: 'Check Symptoms', type: 'acknowledge' },
                    { label: 'Dismiss', type: 'dismiss' }
                ]
            };
        }
        return null;
    }
};

const ALL_RULES = [SepsisRule, HyperKalemiaRule, HypoKalemiaRule, HTNCrisisRule];

export const evaluateRules = (observations: FHIRObservation[]): CDSSAlert[] => {
    const alerts: CDSSAlert[] = [];
    ALL_RULES.forEach(rule => {
        const result = rule.evaluate(observations);
        if (result) alerts.push(result);
    });
    return alerts;
};
