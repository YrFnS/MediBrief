import { useClinicalRecordStore } from '../clinical-record';
import {
    buildDiagnosticReportCandidateGraph,
    confirmDiagnosticReportGraph,
    diagnosticReportGraphId,
    insertDiagnosticReportCandidateGraph,
    rejectDiagnosticReportGraph,
    updateDiagnosticReportCandidateGraph,
} from './graph';
import { validateDiagnosticReportDraft } from './schemas';
import type {
    DiagnosticReportDraft,
    DiagnosticReportGraphResult,
    DiagnosticReportGraphReviewInput,
} from './types';

const invalidResult = (
    issues: DiagnosticReportGraphResult['issues'],
    message: string,
): DiagnosticReportGraphResult => ({
    ok: false,
    status: 'invalid',
    issues,
    message,
});

export const createDiagnosticReportDraftCandidates = (
    input: DiagnosticReportDraft,
): DiagnosticReportGraphResult => {
    const validation = validateDiagnosticReportDraft(input);
    if (!validation.ok || !validation.draft) {
        return invalidResult(
            validation.issues,
            'The diagnostic report draft contains invalid or incomplete data.',
        );
    }

    const actions = useClinicalRecordStore.getState().actions;
    const record = actions.getPatientRecord(validation.draft.patientId);
    if (!record) {
        return {
            ok: false,
            status: 'patient-not-found',
            issues: [],
            message: 'The patient clinical record does not exist.',
        };
    }

    try {
        const graph = buildDiagnosticReportCandidateGraph(validation.draft);
        const inserted = insertDiagnosticReportCandidateGraph(record, graph);
        if (inserted.duplicate) {
            return {
                ok: true,
                status: 'duplicate',
                graphId: graph.graphId,
                reportId: graph.report.id,
                issues: [],
                message:
                    'The same source report graph already exists; no duplicate candidates were created.',
            };
        }
        if (!inserted.record) {
            return invalidResult(
                inserted.issues,
                'The diagnostic report graph failed relationship validation.',
            );
        }
        actions.replacePatientRecord(inserted.record);
        return {
            ok: true,
            status: 'created',
            graphId: graph.graphId,
            reportId: graph.report.id,
            issues: [],
            message: `Created one report candidate, ${graph.observations.length} result candidate${graph.observations.length === 1 ? '' : 's'}, and ${graph.specimens.length} specimen candidate${graph.specimens.length === 1 ? '' : 's'}.`,
        };
    } catch (error) {
        return invalidResult(
            [{
                path: 'graph',
                message: error instanceof Error
                    ? error.message
                    : 'Unknown report graph validation failure.',
            }],
            'The diagnostic report candidates were not created.',
        );
    }
};

export const replaceDiagnosticReportDraftCandidates = (
    input: DiagnosticReportDraft,
): DiagnosticReportGraphResult => {
    const validation = validateDiagnosticReportDraft(input);
    if (!validation.ok || !validation.draft) {
        return invalidResult(
            validation.issues,
            'The edited diagnostic report draft contains invalid data.',
        );
    }
    const actions = useClinicalRecordStore.getState().actions;
    const record = actions.getPatientRecord(validation.draft.patientId);
    if (!record) {
        return {
            ok: false,
            status: 'patient-not-found',
            issues: [],
            message: 'The patient clinical record does not exist.',
        };
    }

    try {
        const graph = buildDiagnosticReportCandidateGraph(validation.draft);
        const updated = updateDiagnosticReportCandidateGraph(record, graph);
        if (!updated.record) {
            return {
                ok: false,
                status: updated.issues.some(issue =>
                    issue.message.includes('does not exist'))
                    ? 'not-found'
                    : 'conflict',
                graphId: graph.graphId,
                reportId: graph.report.id,
                issues: updated.issues,
                message: 'The report graph could not be replaced atomically.',
            };
        }
        actions.replacePatientRecord(updated.record);
        return {
            ok: true,
            status: 'updated',
            graphId: graph.graphId,
            reportId: graph.report.id,
            issues: [],
            message: 'The complete candidate report graph was updated.',
        };
    } catch (error) {
        return invalidResult(
            [{
                path: 'graph',
                message: error instanceof Error
                    ? error.message
                    : 'Unknown report graph update failure.',
            }],
            'The candidate report graph was not changed.',
        );
    }
};

const reviewDiagnosticReportGraph = (
    patientId: string,
    graphId: string,
    target: 'confirmed' | 'rejected',
    review: DiagnosticReportGraphReviewInput,
): DiagnosticReportGraphResult => {
    const actions = useClinicalRecordStore.getState().actions;
    const record = actions.getPatientRecord(patientId);
    if (!record) {
        return {
            ok: false,
            status: 'patient-not-found',
            graphId,
            issues: [],
            message: 'The patient clinical record does not exist.',
        };
    }

    try {
        const transition = target === 'confirmed'
            ? confirmDiagnosticReportGraph(record, graphId, review)
            : rejectDiagnosticReportGraph(record, graphId, review);
        if (!transition.record) {
            return {
                ok: false,
                status: transition.issues.some(issue =>
                    issue.message.includes('not found'))
                    ? 'not-found'
                    : transition.issues.some(issue =>
                        issue.path === 'reason')
                        ? 'invalid'
                        : 'conflict',
                graphId,
                issues: transition.issues,
                message: `The report graph could not be ${target}.`,
            };
        }
        if (transition.unchanged) {
            return {
                ok: true,
                status: 'unchanged',
                graphId,
                issues: [],
                message: `The report graph is already ${target}.`,
            };
        }
        actions.replacePatientRecord(transition.record);
        return {
            ok: true,
            status: target,
            graphId,
            issues: [],
            message: target === 'confirmed'
                ? 'The report, linked results, and linked specimens were confirmed together.'
                : 'The report, linked results, and linked specimens were rejected together.',
        };
    } catch (error) {
        return invalidResult(
            [{
                path: 'graph',
                message: error instanceof Error
                    ? error.message
                    : 'Unknown report review failure.',
            }],
            `The report graph was not ${target}.`,
        );
    }
};

export const confirmDiagnosticReportCandidateGraph = (
    patientId: string,
    graphId: string,
    review: DiagnosticReportGraphReviewInput = {},
): DiagnosticReportGraphResult => reviewDiagnosticReportGraph(
    patientId,
    graphId,
    'confirmed',
    review,
);

export const rejectDiagnosticReportCandidateGraph = (
    patientId: string,
    graphId: string,
    review: DiagnosticReportGraphReviewInput,
): DiagnosticReportGraphResult => reviewDiagnosticReportGraph(
    patientId,
    graphId,
    'rejected',
    review,
);

export const getDiagnosticReportGraphIdForDraft = (
    draft: Pick<DiagnosticReportDraft, 'patientId' | 'documentId' | 'draftId'>,
): string => diagnosticReportGraphId(
    draft.patientId,
    draft.documentId,
    draft.draftId,
);
