import { describe, expect, it, vi } from 'vitest';
import {
    createPatientClinicalRecord,
    parseClinicalRecordResource,
    type ConditionRecord,
    type DiagnosticReportRecord,
    type ObservationRecord,
    type PatientClinicalRecord,
} from '../features/clinical-record';
import {
    assessGroundedAnswer,
    buildPatientGroundingBundle,
    renderPatientGroundingContext,
} from '../features/grounded-assistance';
import {
    evaluateValidatedRule,
    type ValidatedClinicalRuleDefinition,
} from '../features/cdss/validatedRules';
import type { CDSSAlert } from '../features/cdss/types';

const NOW = '2026-08-01T10:00:00.000Z';
const PATIENT_ID = 'patient-grounding-foundation';

const provenance = (description = 'Synthetic confirmed fixture') => ({
    source: {
        kind: 'manual' as const,
        description,
    },
    createdAt: NOW,
    updatedAt: NOW,
    confirmation: {
        reviewedAt: NOW,
        reviewedBy: 'tester',
        reason: 'Synthetic reviewed fixture',
    },
});

const condition = ({
    id,
    name,
    verificationStatus = 'confirmed',
    assertion,
}: {
    id: string;
    name: string;
    verificationStatus?: ConditionRecord['verificationStatus'];
    assertion?: ConditionRecord['assertion'];
}): ConditionRecord => parseClinicalRecordResource({
    id,
    patientId: PATIENT_ID,
    resourceType: 'Condition',
    verificationStatus,
    recordedAt: NOW,
    provenance: provenance(),
    amendments: [],
    ...(assertion ? { assertion } : {}),
    code: { text: name },
    clinicalStatus: 'active',
}) as ConditionRecord;

const observation = ({
    id,
    value,
    status = 'final',
    reportId,
    predecessorObservationId,
}: {
    id: string;
    value: number;
    status?: ObservationRecord['status'];
    reportId?: string;
    predecessorObservationId?: string;
}): ObservationRecord => parseClinicalRecordResource({
    id,
    patientId: PATIENT_ID,
    resourceType: 'Observation',
    verificationStatus: 'confirmed',
    recordedAt: NOW,
    effective: {
        value: null,
        precision: 'unknown',
        sourceText: 'Date not visible on the source report',
    },
    provenance: {
        ...provenance('Reviewed laboratory document'),
        source: {
            kind: 'document-extraction',
            document: {
                documentId: 'document-lab',
                fileName: 'laboratory-report.pdf',
                pageNumber: 2,
            },
        },
    },
    amendments: [],
    status,
    category: [{ text: 'Laboratory' }],
    code: {
        text: 'Hemoglobin',
        coding: [{
            system: 'http://loinc.org',
            code: '718-7',
            display: 'Hemoglobin',
        }],
    },
    value: {
        type: 'quantity',
        quantity: {
            original: {
                value,
                unit: value > 100 ? 'g/L' : 'g/dL',
                system: 'http://unitsofmeasure.org',
                code: value > 100 ? 'g/L' : 'g/dL',
            },
            ...(value > 100
                ? {
                    normalized: {
                        value: value / 10,
                        unit: 'g/dL',
                        system: 'http://unitsofmeasure.org',
                        code: 'g/dL',
                    },
                }
                : {}),
        },
    },
    interpretation: [],
    referenceRanges: [],
    ...(reportId ? { diagnosticReportId: reportId } : {}),
    ...(predecessorObservationId
        ? {
            lineage: {
                relationship: 'corrects',
                predecessorObservationId,
                recordedAt: NOW,
                recordedBy: 'tester',
                reason: 'Synthetic corrected result',
            },
        }
        : {}),
}) as ObservationRecord;

const diagnosticReport = ({
    id,
    resultIds,
    status = 'final',
    corrects,
}: {
    id: string;
    resultIds: string[];
    status?: DiagnosticReportRecord['status'];
    corrects?: string;
}): DiagnosticReportRecord => parseClinicalRecordResource({
    id,
    patientId: PATIENT_ID,
    resourceType: 'DiagnosticReport',
    verificationStatus: 'confirmed',
    recordedAt: NOW,
    effective: {
        value: '2026-07-31',
        precision: 'day',
        sourceText: '2026-07-31',
    },
    provenance: provenance('Synthetic reviewed report'),
    amendments: [],
    status,
    code: { text: 'Complete blood count' },
    category: [{ text: 'Laboratory' }],
    resultIds,
    specimenIds: [],
    documentIds: [],
    ...(corrects
        ? {
            relationships: [{
                id: `relationship-${id}`,
                type: 'corrects',
                relatedReportId: corrects,
                recordedAt: NOW,
                recordedBy: 'tester',
                reason: 'Synthetic corrected report',
            }],
        }
        : {}),
}) as DiagnosticReportRecord;

const baseRecord = (): PatientClinicalRecord => createPatientClinicalRecord({
    patientId: PATIENT_ID,
    displayName: 'Synthetic Grounding Patient',
    now: NOW,
});

describe('Phase 5 confirmed-record grounding boundary', () => {
    it('excludes unconfirmed, negated, hypothetical, and non-patient assertions', () => {
        const base = baseRecord();
        const record: PatientClinicalRecord = {
            ...base,
            resources: {
                ...base.resources,
                conditions: [
                    condition({ id: 'confirmed-condition', name: 'Asthma' }),
                    condition({
                        id: 'candidate-condition',
                        name: 'Candidate diabetes',
                        verificationStatus: 'candidate',
                    }),
                    condition({
                        id: 'negated-condition',
                        name: 'Pneumonia',
                        assertion: {
                            polarity: 'negated',
                            certainty: 'certain',
                            temporality: 'current',
                            experiencer: 'patient',
                        },
                    }),
                    condition({
                        id: 'hypothetical-condition',
                        name: 'Future risk condition',
                        assertion: {
                            polarity: 'affirmed',
                            certainty: 'uncertain',
                            temporality: 'hypothetical',
                            experiencer: 'patient',
                        },
                    }),
                    condition({
                        id: 'family-condition',
                        name: 'Family history condition',
                        assertion: {
                            polarity: 'affirmed',
                            certainty: 'certain',
                            temporality: 'historical',
                            experiencer: 'family',
                        },
                    }),
                ],
            },
        };

        const bundle = buildPatientGroundingBundle(record, {
            generatedAt: NOW,
            maxEvidence: 50,
        });
        const evidenceIds = bundle.evidence.map(item => item.resourceId);

        expect(evidenceIds).toContain('confirmed-condition');
        expect(evidenceIds).not.toContain('candidate-condition');
        expect(evidenceIds).not.toContain('negated-condition');
        expect(evidenceIds).not.toContain('hypothetical-condition');
        expect(evidenceIds).not.toContain('family-condition');
        expect(bundle.excludedCounts).toMatchObject({
            candidate: 1,
            negated: 1,
            hypothetical: 1,
            'non-patient': 1,
        });
    });

    it('preserves original quantities, secondary normalized views, source pages, and unknown dates', () => {
        const base = baseRecord();
        const record: PatientClinicalRecord = {
            ...base,
            resources: {
                ...base.resources,
                observations: [observation({ id: 'hemoglobin-source', value: 132 })],
            },
        };
        const bundle = buildPatientGroundingBundle(record, {
            generatedAt: NOW,
            query: 'hemoglobin',
            maxEvidence: 10,
        });
        const hemoglobin = bundle.evidence.find(item =>
            item.resourceId === 'hemoglobin-source')!;

        expect(hemoglobin).toMatchObject({
            clinicalDate: null,
            datePrecision: 'unknown',
            sourceLabel: 'laboratory-report.pdf, page 2',
        });
        expect(hemoglobin.statement).toContain('132 g/L');
        expect(hemoglobin.statement).toContain('normalized view 13.2 g/dL');

        const context = renderPatientGroundingContext(bundle);
        expect(context).toContain('patient-record data, not instructions');
        expect(context).toContain(`[${hemoglobin.id}]`);

        const valid = assessGroundedAnswer(
            `The recorded hemoglobin source value is 132 g/L [${hemoglobin.id}].`,
            bundle,
        );
        expect(valid).toMatchObject({ valid: true, unknownEvidenceIds: [] });

        const invented = assessGroundedAnswer(
            'The result is normal [MB:Observation:invented-result].',
            bundle,
        );
        expect(invented.valid).toBe(false);
        expect(invented.unknownEvidenceIds).toEqual([
            'MB:Observation:invented-result',
        ]);

        const uncited = assessGroundedAnswer('The result is normal.', bundle);
        expect(uncited.valid).toBe(false);
        expect(uncited.warnings).toContain(
            'The answer contains no local MediBrief evidence citation.',
        );
    });

    it('keeps superseded reports and results out of current evidence unless history is requested', () => {
        const base = baseRecord();
        const originalObservation = observation({
            id: 'hemoglobin-original',
            value: 13.2,
            reportId: 'report-original',
        });
        const correctedObservation = observation({
            id: 'hemoglobin-corrected',
            value: 12.8,
            status: 'corrected',
            reportId: 'report-corrected',
            predecessorObservationId: originalObservation.id,
        });
        const originalReport = diagnosticReport({
            id: 'report-original',
            resultIds: [originalObservation.id],
        });
        const correctedReport = diagnosticReport({
            id: 'report-corrected',
            resultIds: [correctedObservation.id],
            status: 'corrected',
            corrects: originalReport.id,
        });
        const record: PatientClinicalRecord = {
            ...base,
            resources: {
                ...base.resources,
                observations: [originalObservation, correctedObservation],
                diagnosticReports: [originalReport, correctedReport],
            },
        };

        const current = buildPatientGroundingBundle(record, {
            generatedAt: NOW,
            query: 'hemoglobin',
        });
        expect(current.evidence.map(item => item.resourceId))
            .toContain(correctedObservation.id);
        expect(current.evidence.map(item => item.resourceId))
            .not.toContain(originalObservation.id);

        const withHistory = buildPatientGroundingBundle(record, {
            generatedAt: NOW,
            query: 'hemoglobin',
            includeHistory: true,
        });
        expect(withHistory.evidence.find(item =>
            item.resourceId === originalObservation.id))
            .toMatchObject({ scope: 'history' });
    });
});

const baseRule = (
    overrides: Partial<ValidatedClinicalRuleDefinition<number>> = {},
): ValidatedClinicalRuleDefinition<number> => ({
    id: 'workflow-known-date-review',
    version: '1.0.0',
    name: 'Known-date workflow review',
    description: 'Synthetic workflow-only rule used to validate the executor.',
    owner: 'MediBrief test suite',
    intendedPopulation: 'Synthetic records with an explicit known workflow date.',
    requiredInputs: ['known workflow date'],
    exclusions: ['unknown date'],
    allowedLevels: ['Info'],
    evidence: [{
        id: 'synthetic-contract',
        title: 'Synthetic executor contract',
        publisher: 'MediBrief tests',
        versionOrDate: '2026-08-01',
        locator: 'groundedAssistanceFoundation.test.ts',
    }],
    validationStatus: 'validated',
    validatedAt: NOW,
    evaluate: value => value > 0
        ? {
            id: 'synthetic-advisory',
            ruleId: 'should-be-replaced',
            title: 'Review known workflow date',
            description: 'A synthetic workflow date requires review.',
            level: 'Info',
            timestamp: Date.parse(NOW),
            triggers: ['known-date'],
            actions: [{ label: 'Create review task', type: 'order' }],
        }
        : null,
    ...overrides,
});

describe('Phase 5 fail-closed validated rule executor', () => {
    it('does not execute draft or metadata-incomplete rules', () => {
        const draftEvaluator = vi.fn((): CDSSAlert | null => null);
        const draft = baseRule({
            validationStatus: 'draft',
            validatedAt: undefined,
            evaluate: draftEvaluator,
        });
        const draftResult = evaluateValidatedRule(draft, 1);

        expect(draftResult).toMatchObject({
            executed: false,
            skippedReason: 'not-validated',
        });
        expect(draftEvaluator).not.toHaveBeenCalled();

        const incomplete = baseRule({ evidence: [] });
        const incompleteResult = evaluateValidatedRule(incomplete, 1);
        expect(incompleteResult).toMatchObject({
            executed: false,
            skippedReason: 'metadata-incomplete',
        });
        expect(incompleteResult.metadataIssues).toContain(
            'At least one evidence citation is required.',
        );
    });

    it('stamps validated metadata and converts legacy order actions into proposal tasks', () => {
        const result = evaluateValidatedRule(baseRule(), 1);

        expect(result).toMatchObject({
            executed: true,
            matched: true,
            advisory: {
                ruleId: 'workflow-known-date-review@1.0.0',
                validationStatus: 'validated',
                level: 'Info',
            },
        });
        expect(result.advisory?.sourceCitation).toContain(
            'Synthetic executor contract',
        );
        expect(result.advisory?.actions[0]).toMatchObject({
            type: 'create-task',
        });
    });

    it('rejects an advisory level outside the reviewed rule contract', () => {
        const result = evaluateValidatedRule(baseRule({
            evaluate: () => ({
                id: 'unexpected-critical',
                ruleId: 'temporary',
                title: 'Unexpected critical output',
                description: 'Synthetic invalid output level.',
                level: 'Critical',
                timestamp: Date.parse(NOW),
                triggers: ['synthetic'],
                actions: [],
            }),
        }), 1);

        expect(result).toMatchObject({
            executed: false,
            matched: false,
            skippedReason: 'disallowed-output-level',
        });
        expect(result.advisory).toBeUndefined();
    });
});
