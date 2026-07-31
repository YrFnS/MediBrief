import { useClinicalRecordStore } from '../clinical-record';
import { updateDiagnosticReportCandidateGraph } from './graph';
import type {
    DiagnosticReportCandidateGraph,
    DiagnosticReportGraphResult,
} from './types';

export const replaceDiagnosticReportCandidateGraphResources = (
    graph: DiagnosticReportCandidateGraph,
): DiagnosticReportGraphResult => {
    const actions = useClinicalRecordStore.getState().actions;
    const record = actions.getPatientRecord(graph.patientId);
    if (!record) {
        return {
            ok: false,
            status: 'patient-not-found',
            graphId: graph.graphId,
            reportId: graph.report.id,
            issues: [],
            message: 'The patient clinical record does not exist.',
        };
    }

    try {
        const result = updateDiagnosticReportCandidateGraph(record, graph);
        if (!result.record) {
            return {
                ok: false,
                status: result.issues.some(issue =>
                    issue.message.includes('does not exist'))
                    ? 'not-found'
                    : 'conflict',
                graphId: graph.graphId,
                reportId: graph.report.id,
                issues: result.issues,
                message:
                    'The candidate report graph was not changed because the complete graph did not pass validation.',
            };
        }
        actions.replacePatientRecord(result.record);
        return {
            ok: true,
            status: 'updated',
            graphId: graph.graphId,
            reportId: graph.report.id,
            issues: [],
            message:
                'The report, linked results, and linked specimens were updated together.',
        };
    } catch (error) {
        return {
            ok: false,
            status: 'invalid',
            graphId: graph.graphId,
            reportId: graph.report.id,
            issues: [{
                path: 'graph',
                message: error instanceof Error
                    ? error.message
                    : 'Unknown report graph update failure.',
            }],
            message: 'The candidate report graph was not changed.',
        };
    }
};
