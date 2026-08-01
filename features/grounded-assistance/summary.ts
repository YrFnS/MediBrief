import { buildDiagnosticResultsIntelligence } from '../diagnostic-reports';
import type {
    ClinicalResourceType,
    DatePrecision,
    PatientClinicalRecord,
} from '../clinical-record/types';
import { buildPatientGroundingBundle } from './grounding';
import type {
    GroundingEvidence,
    GroundingEvidenceScope,
    PatientGroundingBundle,
} from './types';

export type DeterministicSummarySectionKey =
    | 'profile'
    | 'current-problems'
    | 'allergies'
    | 'active-medications'
    | 'recent-results'
    | 'visits'
    | 'plans'
    | 'tasks'
    | 'history';

export interface DeterministicSummaryItem {
    evidenceId: string;
    resourceType: ClinicalResourceType;
    resourceId: string;
    label: string;
    statement: string;
    scope: GroundingEvidenceScope;
    clinicalDate: string | null;
    datePrecision: DatePrecision;
    dateLabel: string;
    sourceLabel: string;
    qualifiers: string[];
}

export interface DeterministicSummarySection {
    key: DeterministicSummarySectionKey;
    title: string;
    description: string;
    items: DeterministicSummaryItem[];
    emptyState: string;
}

export interface DeterministicPatientSummary {
    schemaVersion: 1;
    patientId: string;
    generatedAt: string;
    evidenceBundle: PatientGroundingBundle;
    sections: DeterministicSummarySection[];
    pendingCandidateCount: number;
    retainedErrorOrRejectedCount: number;
    diagnosticConflictCount: number;
    diagnosticConflictLabels: string[];
    missingInformation: string[];
    limitations: string[];
}

export interface DeterministicSummaryOptions {
    generatedAt?: string;
    maximumHistoryItems?: number;
    maximumRecentResults?: number;
    maximumVisits?: number;
}

const dateLabelFor = (evidence: GroundingEvidence): string => {
    if (!evidence.clinicalDate || evidence.datePrecision === 'unknown') {
        return 'Clinical date unknown';
    }
    if (evidence.datePrecision === 'day') return evidence.clinicalDate;
    return `${evidence.clinicalDate} (${evidence.datePrecision} precision)`;
};

const sortByClinicalDate = (
    left: GroundingEvidence,
    right: GroundingEvidence,
): number => {
    const leftKnown = Boolean(left.clinicalDate);
    const rightKnown = Boolean(right.clinicalDate);
    if (leftKnown !== rightKnown) return leftKnown ? -1 : 1;
    if (left.clinicalDate !== right.clinicalDate) {
        return (right.clinicalDate || '').localeCompare(left.clinicalDate || '');
    }
    return left.id.localeCompare(right.id);
};

const toSummaryItem = (evidence: GroundingEvidence): DeterministicSummaryItem => ({
    evidenceId: evidence.id,
    resourceType: evidence.resourceType,
    resourceId: evidence.resourceId,
    label: evidence.label,
    statement: evidence.statement,
    scope: evidence.scope,
    clinicalDate: evidence.clinicalDate,
    datePrecision: evidence.datePrecision,
    dateLabel: dateLabelFor(evidence),
    sourceLabel: evidence.sourceLabel,
    qualifiers: [...evidence.qualifiers],
});

const section = ({
    key,
    title,
    description,
    evidence,
    emptyState,
    limit,
}: {
    key: DeterministicSummarySectionKey;
    title: string;
    description: string;
    evidence: GroundingEvidence[];
    emptyState: string;
    limit?: number;
}): DeterministicSummarySection => ({
    key,
    title,
    description,
    items: [...evidence]
        .sort(sortByClinicalDate)
        .slice(0, limit || evidence.length)
        .map(toSummaryItem),
    emptyState,
});

const knownDate = (value: PatientClinicalRecord['profile']['dateOfBirth']): boolean =>
    Boolean(value?.value && value.precision !== 'unknown');

export const buildDeterministicPatientSummary = (
    record: PatientClinicalRecord,
    options: DeterministicSummaryOptions = {},
): DeterministicPatientSummary => {
    const generatedAt = options.generatedAt || new Date().toISOString();
    const bundle = buildPatientGroundingBundle(record, {
        includeHistory: true,
        maxEvidence: 200,
        generatedAt,
    });
    const evidence = bundle.evidence;
    const current = (resourceType: ClinicalResourceType): GroundingEvidence[] =>
        evidence.filter(item =>
            item.resourceType === resourceType && item.scope === 'current');
    const planning = (resourceTypes: ClinicalResourceType[]): GroundingEvidence[] =>
        evidence.filter(item =>
            item.scope === 'planning'
            && resourceTypes.includes(item.resourceType));
    const historyTypes = new Set<ClinicalResourceType>([
        'Condition',
        'Medication',
        'DiagnosticReport',
        'Procedure',
        'Immunization',
        'ClinicalNote',
    ]);

    const profileEvidence = current('PatientProfile');
    const currentProblems = current('Condition');
    const allergies = current('AllergyIntolerance');
    const medications = current('Medication');
    const recentResults = evidence.filter(item =>
        item.scope === 'current'
        && ['Observation', 'DiagnosticReport'].includes(item.resourceType));
    const visits = evidence.filter(item => item.resourceType === 'Encounter');
    const plans = planning(['Appointment', 'CarePlan', 'Procedure']);
    const tasks = planning(['ClinicalTask']);
    const history = evidence.filter(item =>
        item.scope === 'history' && historyTypes.has(item.resourceType));

    const intelligence = buildDiagnosticResultsIntelligence(record);
    const missingMemberWarnings = intelligence.panels.flatMap(panel =>
        panel.missingMemberIds.map(memberId =>
            `${panel.name} references missing result ${memberId}.`));
    const unitWarnings = intelligence.unitConflicts.map(conflict =>
        `${conflict.identityLabel}: ${conflict.message}`);
    const diagnosticConflictLabels = [
        ...missingMemberWarnings,
        ...unitWarnings,
    ];

    const pendingCandidateCount = bundle.excludedCounts.candidate || 0;
    const retainedErrorOrRejectedCount =
        (bundle.excludedCounts.rejected || 0)
        + (bundle.excludedCounts['entered-in-error'] || 0);
    const unknownDateCount = evidence.filter(item =>
        item.datePrecision === 'unknown').length;
    const missingInformation: string[] = [];

    if (!knownDate(record.profile.dateOfBirth)) {
        missingInformation.push('Date of birth is not confirmed with a usable clinical date.');
    }
    if (!record.profile.administrativeSex
        || record.profile.administrativeSex === 'unknown') {
        missingInformation.push('Administrative sex is unknown.');
    }
    if (!record.profile.bloodType?.trim()) {
        missingInformation.push('Blood type is not confirmed.');
    }
    if (record.profile.contacts.length === 0) {
        missingInformation.push('No contact information is confirmed in the structured profile.');
    }
    if (allergies.length === 0) {
        missingInformation.push(
            'Allergy status is unknown because no active allergy record is confirmed.',
        );
    }
    if (medications.length === 0) {
        missingInformation.push(
            'No active medication is confirmed; this does not prove that none are taken.',
        );
    }
    if (currentProblems.length === 0) {
        missingInformation.push(
            'No current condition is confirmed; this does not prove that none exist.',
        );
    }
    if (unknownDateCount > 0) {
        missingInformation.push(
            `${unknownDateCount} included confirmed record item${unknownDateCount === 1 ? ' has' : 's have'} an unknown clinical date.`,
        );
    }
    if (pendingCandidateCount > 0) {
        missingInformation.push(
            `${pendingCandidateCount} candidate record${pendingCandidateCount === 1 ? ' is' : 's are'} awaiting review and excluded from confirmed facts.`,
        );
    }
    if (diagnosticConflictLabels.length > 0) {
        missingInformation.push(
            `${diagnosticConflictLabels.length} diagnostic graph or unit-comparability conflict${diagnosticConflictLabels.length === 1 ? ' requires' : 's require'} review.`,
        );
    }

    return {
        schemaVersion: 1,
        patientId: record.patientId,
        generatedAt,
        evidenceBundle: bundle,
        sections: [
            section({
                key: 'profile',
                title: 'Patient profile',
                description: 'Confirmed structured identity and demographic information.',
                evidence: profileEvidence,
                emptyState: 'The structured patient profile is unavailable.',
            }),
            section({
                key: 'current-problems',
                title: 'Current problems',
                description: 'Confirmed current condition records only.',
                evidence: currentProblems,
                emptyState: 'No current condition is confirmed. This does not prove that none exist.',
            }),
            section({
                key: 'allergies',
                title: 'Allergies and intolerances',
                description: 'Confirmed current allergy or intolerance records.',
                evidence: allergies,
                emptyState: 'Allergy status unknown — no active allergy record is confirmed.',
            }),
            section({
                key: 'active-medications',
                title: 'Active medications',
                description: 'Confirmed active, on-hold, or unknown-status medication records.',
                evidence: medications,
                emptyState: 'No active medication is confirmed. This does not prove that none are taken.',
            }),
            section({
                key: 'recent-results',
                title: 'Recent results and reports',
                description: 'Current confirmed observations and diagnostic reports, sorted by known clinical date.',
                evidence: recentResults,
                emptyState: 'No current confirmed result or diagnostic report is available.',
                limit: options.maximumRecentResults || 8,
            }),
            section({
                key: 'visits',
                title: 'Visits and encounters',
                description: 'Confirmed visit history and any current encounter.',
                evidence: visits,
                emptyState: 'No confirmed encounter is available.',
                limit: options.maximumVisits || 6,
            }),
            section({
                key: 'plans',
                title: 'Plans and appointments',
                description: 'Confirmed planning records. A proposal is not a booking, order, or completed action.',
                evidence: plans,
                emptyState: 'No open confirmed appointment, care plan, or planned procedure is recorded.',
            }),
            section({
                key: 'tasks',
                title: 'Tasks and reminders',
                description: 'Confirmed open local tasks and reminders.',
                evidence: tasks,
                emptyState: 'No open confirmed local task is recorded.',
            }),
            section({
                key: 'history',
                title: 'Relevant history',
                description: 'Selected confirmed historical conditions, medications, reports, procedures, immunizations, and notes.',
                evidence: history,
                emptyState: 'No additional confirmed history is available in the selected record.',
                limit: options.maximumHistoryItems || 10,
            }),
        ],
        pendingCandidateCount,
        retainedErrorOrRejectedCount,
        diagnosticConflictCount: diagnosticConflictLabels.length,
        diagnosticConflictLabels,
        missingInformation,
        limitations: [
            'This summary is generated deterministically from the local structured record; it is not an AI interpretation.',
            'Only confirmed, patient-applicable evidence is presented as patient fact.',
            'Candidate, rejected, entered-in-error, negated, hypothetical, and non-patient assertions are excluded.',
            'Unknown or partial clinical dates remain unknown or partial.',
            'Original source quantities remain authoritative; normalized values are secondary views.',
            'The summary does not diagnose, prescribe, determine medication safety, or prove that the record is complete.',
        ],
    };
};

export const renderDeterministicPatientSummaryMarkdown = (
    summary: DeterministicPatientSummary,
): string => {
    const lines: string[] = [
        '# Confirmed record summary',
        '',
        `Generated locally: ${summary.generatedAt}`,
        `Pending candidates excluded from facts: ${summary.pendingCandidateCount}`,
        `Retained rejected or entered-in-error records: ${summary.retainedErrorOrRejectedCount}`,
        `Diagnostic graph or unit conflicts: ${summary.diagnosticConflictCount}`,
        '',
    ];

    summary.sections.forEach(currentSection => {
        lines.push(`## ${currentSection.title}`, '');
        if (currentSection.items.length === 0) {
            lines.push(currentSection.emptyState, '');
            return;
        }
        currentSection.items.forEach(item => {
            lines.push(
                `- ${item.statement} [${item.evidenceId}]`,
                `  - Date: ${item.dateLabel}`,
                `  - Source: ${item.sourceLabel}`,
            );
        });
        lines.push('');
    });

    lines.push('## Missing or incomplete information', '');
    if (summary.missingInformation.length === 0) {
        lines.push('- No tracked summary gap was detected. The record may still be incomplete.');
    } else {
        summary.missingInformation.forEach(item => lines.push(`- ${item}`));
    }
    lines.push('', '## Limitations', '');
    summary.limitations.forEach(item => lines.push(`- ${item}`));

    return lines.join('\n');
};
