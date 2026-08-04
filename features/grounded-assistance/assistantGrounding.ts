import type {
    ClinicalResourceType,
    PatientClinicalRecord,
} from '../clinical-record/types';
import {
    assessGroundedAnswer,
    buildPatientGroundingBundle,
    renderPatientGroundingContext,
} from './grounding';
import {
    buildDeterministicPatientSummary,
    renderDeterministicPatientSummaryMarkdown,
    type DeterministicPatientSummary,
} from './summary';
import type {
    GroundedAnswerAssessment,
    PatientGroundingBundle,
} from './types';

export type PreparedAssistantTurn =
    | {
        kind: 'general';
    }
    | {
        kind: 'deterministic-summary';
        summary: DeterministicPatientSummary;
        response: string;
    }
    | {
        kind: 'patient-record';
        bundle: PatientGroundingBundle;
        modelPrompt?: string;
        immediateResponse?: string;
        includeHistory: boolean;
        resourceTypes?: ClinicalResourceType[];
    };

export type GroundedAssistantFinalStatus =
    | 'grounded'
    | 'insufficient-evidence'
    | 'citation-rejected';

export interface GroundedAssistantFinalization {
    accepted: boolean;
    status: GroundedAssistantFinalStatus;
    displayText: string;
    citedEvidenceCount: number;
    assessment?: GroundedAnswerAssessment;
}

export interface PrepareAssistantTurnOptions {
    generatedAt?: string;
    maxEvidence?: number;
}

const SUMMARY_COMMAND = /^\/(?:summary|record-summary|patient-summary|brief|patient|record)(?:\s|$)/i;
const PATIENT_SUBJECT = /\b(?:my|me|this patient|the patient|patient's|patient record|their record)\b/i;
const CLINICAL_TOPIC = /\b(?:condition|diagnos|problem|allerg|medication|medicine|drug|dose|lab|result|report|visit|encounter|procedure|vaccine|immunization|appointment|task|care plan|history|record|summary|blood type)\w*/i;
const SHORT_RECORD_QUERY = /^(?:current|active|recent|latest|past|previous)\s+(?:conditions?|problems?|allergies?|medications?|medicines?|labs?|results?|reports?|visits?|appointments?|tasks?)\b/i;
const KNOWLEDGE_QUERY = /^(?:what|which|when|where|show|list|summarize|review)\b.*\b(?:recorded|confirmed|in (?:my|the) record|for (?:me|this patient|the patient))\b/i;

const HISTORY_MARKERS = /\b(?:history|historical|past|previous|prior|resolved|completed|stopped|superseded|old|over time|ever)\b/i;

const RESOURCE_PATTERNS: Array<{
    types: ClinicalResourceType[];
    pattern: RegExp;
}> = [
    { types: ['Medication'], pattern: /\b(?:medication|medicine|drug|dose|prescription)\w*/i },
    { types: ['AllergyIntolerance'], pattern: /\b(?:allerg|intolerance|reaction)\w*/i },
    { types: ['Condition'], pattern: /\b(?:condition|diagnos|problem)\w*/i },
    { types: ['Observation', 'DiagnosticReport', 'Specimen'], pattern: /\b(?:lab|result|observation|diagnostic report|specimen|test)\w*/i },
    { types: ['Encounter'], pattern: /\b(?:visit|encounter|admission|consultation)\w*/i },
    { types: ['Procedure'], pattern: /\b(?:procedure|surgery|operation|implant)\w*/i },
    { types: ['Immunization'], pattern: /\b(?:immunization|vaccin)\w*/i },
    { types: ['Appointment'], pattern: /\b(?:appointment|booking|schedule)\w*/i },
    { types: ['ClinicalTask'], pattern: /\b(?:task|reminder|follow-up|follow up)\w*/i },
    { types: ['CarePlan'], pattern: /\b(?:care plan|plan of care)\w*/i },
    { types: ['ClinicalNote'], pattern: /\b(?:clinical note|soap note|progress note|discharge summary)\w*/i },
    { types: ['DocumentReference'], pattern: /\b(?:document|file|source report)\w*/i },
];

export const isDeterministicSummaryCommand = (prompt: string): boolean =>
    SUMMARY_COMMAND.test(prompt.trim());

export const isPatientRecordQuestion = (prompt: string): boolean => {
    const trimmed = prompt.trim();
    if (!trimmed) return false;
    if (/^\/(?:help|export|drugs?)\b/i.test(trimmed)) return false;
    if (SUMMARY_COMMAND.test(trimmed)) return true;
    return SHORT_RECORD_QUERY.test(trimmed)
        || KNOWLEDGE_QUERY.test(trimmed)
        || (PATIENT_SUBJECT.test(trimmed) && CLINICAL_TOPIC.test(trimmed));
};

export const inferPatientRecordResourceTypes = (
    prompt: string,
): ClinicalResourceType[] | undefined => {
    const types = RESOURCE_PATTERNS
        .filter(item => item.pattern.test(prompt))
        .flatMap(item => item.types);
    return types.length > 0 ? [...new Set(types)] : undefined;
};

const groundedPrompt = ({
    question,
    bundle,
}: {
    question: string;
    bundle: PatientGroundingBundle;
}): string => [
    'MEDIBRIEF_GROUNDED_PATIENT_ANSWER_V1',
    '',
    'USER QUESTION:',
    question,
    '',
    renderPatientGroundingContext(bundle),
    '',
    'RESPONSE CONTRACT:',
    '- Answer only from the selected local evidence for patient-specific claims.',
    '- Put the exact local citation token after every patient-specific sentence or bullet.',
    '- Do not cite a record item that does not support the sentence.',
    '- If the selected bundle lacks evidence needed to answer, respond exactly with: INSUFFICIENT_CONFIRMED_EVIDENCE',
    '- Preserve unknown dates, uncertainty, source wording, original values, and planning-versus-completed status.',
    '- Do not use prior chat messages as patient facts.',
    '- Do not diagnose, prescribe, recommend dose changes, claim medication safety, perform triage, or claim an external action occurred.',
    '- General educational context must be clearly separated from patient-record facts and must not be presented as applying to this patient.',
].join('\n');

export const prepareAssistantTurn = (
    record: PatientClinicalRecord | undefined,
    prompt: string,
    options: PrepareAssistantTurnOptions = {},
): PreparedAssistantTurn => {
    const trimmed = prompt.trim();
    if (isDeterministicSummaryCommand(trimmed)) {
        if (!record) {
            return {
                kind: 'patient-record',
                bundle: {
                    schemaVersion: 1,
                    patientId: 'unknown',
                    generatedAt: options.generatedAt || new Date().toISOString(),
                    evidence: [],
                    excludedCounts: {},
                    selection: {
                        eligibleBeforeSelection: 0,
                        selected: 0,
                        includeHistory: true,
                        maxEvidence: options.maxEvidence || 60,
                    },
                    boundaries: [],
                },
                immediateResponse:
                    'A deterministic summary is unavailable because the selected patient record has not initialized.',
                includeHistory: true,
            };
        }
        const summary = buildDeterministicPatientSummary(record, {
            generatedAt: options.generatedAt,
        });
        return {
            kind: 'deterministic-summary',
            summary,
            response: renderDeterministicPatientSummaryMarkdown(summary),
        };
    }

    if (!isPatientRecordQuestion(trimmed)) return { kind: 'general' };
    const includeHistory = HISTORY_MARKERS.test(trimmed);
    const resourceTypes = inferPatientRecordResourceTypes(trimmed);
    if (!record) {
        return {
            kind: 'patient-record',
            bundle: {
                schemaVersion: 1,
                patientId: 'unknown',
                generatedAt: options.generatedAt || new Date().toISOString(),
                query: trimmed,
                evidence: [],
                excludedCounts: {},
                selection: {
                    eligibleBeforeSelection: 0,
                    selected: 0,
                    includeHistory,
                    maxEvidence: options.maxEvidence || 60,
                    ...(resourceTypes ? { resourceTypes } : {}),
                },
                boundaries: [],
            },
            immediateResponse:
                'The selected patient record is unavailable, so no patient-specific answer was generated.',
            includeHistory,
            ...(resourceTypes ? { resourceTypes } : {}),
        };
    }

    let bundle = buildPatientGroundingBundle(record, {
        ...(resourceTypes ? { resourceTypes } : { query: trimmed }),
        includeHistory,
        maxEvidence: options.maxEvidence || 60,
        generatedAt: options.generatedAt,
    });
    if (!resourceTypes && bundle.evidence.length === 0) {
        bundle = buildPatientGroundingBundle(record, {
            includeHistory,
            maxEvidence: options.maxEvidence || 60,
            generatedAt: options.generatedAt,
        });
    }

    if (bundle.evidence.length === 0) {
        return {
            kind: 'patient-record',
            bundle,
            immediateResponse:
                'No confirmed, patient-applicable record evidence matched this question. Candidate, rejected, historical, or entered-in-error content was not substituted as current fact.',
            includeHistory,
            ...(resourceTypes ? { resourceTypes } : {}),
        };
    }

    return {
        kind: 'patient-record',
        bundle,
        modelPrompt: groundedPrompt({ question: trimmed, bundle }),
        includeHistory,
        ...(resourceTypes ? { resourceTypes } : {}),
    };
};

export const finalizeGroundedAssistantAnswer = (
    answer: string,
    bundle: PatientGroundingBundle,
): GroundedAssistantFinalization => {
    const trimmed = answer.trim();
    if (/^INSUFFICIENT_CONFIRMED_EVIDENCE\b/i.test(trimmed)) {
        return {
            accepted: true,
            status: 'insufficient-evidence',
            displayText:
                'The selected confirmed record evidence is insufficient to answer this patient-specific question. Candidate, rejected, entered-in-error, or unrelated historical content was not substituted as fact.',
            citedEvidenceCount: 0,
        };
    }

    const assessment = assessGroundedAnswer(trimmed, bundle, {
        requireCitation: true,
    });
    if (!assessment.valid) {
        return {
            accepted: false,
            status: 'citation-rejected',
            displayText: [
                '⚠️ **Grounded answer withheld**',
                '',
                'The model response did not pass the local MediBrief citation check, so its patient-specific wording was not displayed.',
                ...assessment.warnings.map(warning => `- ${warning}`),
                '',
                'No clinical record was changed. Use `/summary` for the deterministic confirmed-record summary.',
            ].join('\n'),
            citedEvidenceCount: assessment.supportedEvidence.length,
            assessment,
        };
    }

    return {
        accepted: true,
        status: 'grounded',
        displayText: [
            trimmed,
            '',
            '---',
            `Local record grounding: ${assessment.supportedEvidence.length} cited evidence item${assessment.supportedEvidence.length === 1 ? '' : 's'}. Citation membership does not prove semantic or clinical correctness.`,
        ].join('\n'),
        citedEvidenceCount: assessment.supportedEvidence.length,
        assessment,
    };
};
