import type { PatientClinicalRecord } from '../clinical-record/types';
import {
    finalizeGroundedAssistantAnswer,
} from '../grounded-assistance/assistantGrounding';
import {
    buildPatientGroundingBundle,
    renderPatientGroundingContext,
} from '../grounded-assistance/grounding';
import type { PatientGroundingBundle } from '../grounded-assistance/types';
import type {
    DeterministicTrendExplanation,
    TrendGroundingRequest,
    TrendModelExplanationResult,
} from './types';

const trendBundle = (
    record: PatientClinicalRecord,
    explanation: DeterministicTrendExplanation,
    generatedAt = new Date().toISOString(),
): PatientGroundingBundle => {
    const pointIds = new Set(explanation.points.map(point => point.observationId));
    const base = buildPatientGroundingBundle(record, {
        includeHistory: false,
        resourceTypes: ['Observation'],
        maxEvidence: 200,
        generatedAt,
    });
    const order = new Map(explanation.points.map((point, index) => [
        point.observationId,
        index,
    ]));
    const evidence = base.evidence
        .filter(item => pointIds.has(item.resourceId))
        .sort((left, right) =>
            (order.get(left.resourceId) || 0) - (order.get(right.resourceId) || 0));

    if (evidence.length !== explanation.points.length) {
        throw new Error(
            'The selected trend contains a point that is unavailable to the confirmed-record grounding boundary.',
        );
    }

    return {
        ...base,
        query: `Explain the recorded ${explanation.name} series`,
        evidence,
        selection: {
            ...base.selection,
            eligibleBeforeSelection: evidence.length,
            selected: evidence.length,
            includeHistory: false,
            maxEvidence: evidence.length,
            resourceTypes: ['Observation'],
        },
        boundaries: [
            ...base.boundaries,
            'This request is restricted to the exact Phase 4-eligible plotted points listed in the bundle.',
            'Do not use excluded, superseded, comparator, qualitative, undated, partial-date, single-point, or incompatible-unit observations.',
            'Describe recorded arithmetic only. Do not infer clinical significance, improvement, worsening, cause, prognosis, treatment effect, or a recommended action.',
            'Every selected plotted point must be cited at least once in the response.',
        ],
    };
};

export const buildTrendGroundingRequest = ({
    record,
    explanation,
    question,
    generatedAt,
}: {
    record: PatientClinicalRecord;
    explanation: DeterministicTrendExplanation;
    question?: string;
    generatedAt?: string;
}): TrendGroundingRequest => {
    const bundle = trendBundle(record, explanation, generatedAt);
    const compactTrend = {
        name: explanation.name,
        unit: explanation.unit,
        specimen: explanation.specimenLabel || null,
        groupingBasis: explanation.groupingBasis,
        loincCode: explanation.loincCode || null,
        normalizationBasis: explanation.normalizationBasis,
        pointCount: explanation.pointCount,
        first: {
            date: explanation.firstPoint.date,
            value: explanation.firstPoint.value,
            evidenceId: explanation.firstPoint.evidenceId,
        },
        last: {
            date: explanation.lastPoint.date,
            value: explanation.lastPoint.value,
            evidenceId: explanation.lastPoint.evidenceId,
        },
        minimum: {
            date: explanation.minimumPoint.date,
            value: explanation.minimumPoint.value,
            evidenceId: explanation.minimumPoint.evidenceId,
        },
        maximum: {
            date: explanation.maximumPoint.date,
            value: explanation.maximumPoint.value,
            evidenceId: explanation.maximumPoint.evidenceId,
        },
        absoluteChange: explanation.absoluteChange,
        recordedDirection: explanation.direction,
        elapsedDays: explanation.elapsedDays,
        points: explanation.points.map(point => ({
            date: point.date,
            plottedValue: point.value,
            unit: point.unit,
            originalValue: point.originalValueLabel,
            normalizedView: point.normalizedValueLabel || null,
            reportNames: point.reportNames,
            evidenceId: point.evidenceId,
        })),
        exclusions: explanation.matchingExclusions,
        unitConflictMessages: explanation.unitConflictMessages,
        qualityNotices: explanation.qualityNotices,
    };

    const prompt = [
        'MEDIBRIEF_RECORDED_TREND_EXPLANATION_V1',
        '',
        'USER REQUEST:',
        question?.trim() || `Explain the recorded ${explanation.name} values over time.`,
        '',
        'DETERMINISTIC TREND DATA:',
        JSON.stringify(compactTrend, null, 2),
        '',
        renderPatientGroundingContext(bundle),
        '',
        'RESPONSE CONTRACT:',
        '- Use only the selected plotted points and deterministic arithmetic above.',
        '- State the test name, unit, specimen context when recorded, exact date span, first and last values, and recorded higher/lower/unchanged direction.',
        '- State whether plotted values use original quantities, normalized quantities, or a mixture. Original source values remain authoritative.',
        '- Mention relevant exclusions and unit conflicts without treating excluded evidence as absent.',
        '- Cite every selected plotted point at least once using its exact local evidence token.',
        '- Put one or more exact local citations after every patient-specific sentence or bullet.',
        '- Do not use web search, general medical knowledge, prior chat, or unselected record content.',
        '- Do not call the change improved, worsened, normal, abnormal, significant, safe, dangerous, or caused by anything.',
        '- Do not diagnose, predict, recommend treatment, suggest a dose change, or claim clinical significance.',
        '- When evidence is insufficient, respond exactly with INSUFFICIENT_CONFIRMED_EVIDENCE.',
    ].join('\n');

    return { explanation, bundle, prompt };
};

export const finalizeTrendModelExplanation = (
    answer: string,
    request: TrendGroundingRequest,
): TrendModelExplanationResult => {
    const base = finalizeGroundedAssistantAnswer(answer, request.bundle);
    if (!base.accepted || base.status !== 'grounded') {
        return { rawText: answer, finalization: base };
    }

    const referenced = new Set(
        base.assessment?.referencedEvidenceIds || [],
    );
    const missing = request.explanation.points
        .map(point => point.evidenceId)
        .filter(evidenceId => !referenced.has(evidenceId));
    if (missing.length === 0) {
        return { rawText: answer, finalization: base };
    }

    return {
        rawText: answer,
        finalization: {
            accepted: false,
            status: 'citation-rejected',
            citedEvidenceCount: base.citedEvidenceCount,
            assessment: base.assessment,
            displayText: [
                '⚠️ **Trend explanation withheld**',
                '',
                'The generated wording did not cite every plotted point, so MediBrief did not display it as a complete explanation of the selected series.',
                `Missing plotted-point citations: ${missing.join(', ')}`,
                '',
                'The deterministic trend description remains available above and no clinical record was changed.',
            ].join('\n'),
        },
    };
};
