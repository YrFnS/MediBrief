import { parseLocalEvidenceId } from '../grounded-assistance/evidenceReview';
import type {
    AlertLevel,
    CDSSAction,
    CDSSAlert,
} from './types';
import { LOW_RISK_VALIDATED_RULES } from './lowRiskPilotRules';

export type ClinicalRuleValidationStatus = 'draft' | 'validated' | 'retired';
export type ClinicalRuleRiskClass = 'workflow' | 'data-quality';

export interface ClinicalRuleEvidenceCitation {
    id: string;
    title: string;
    publisher: string;
    versionOrDate: string;
    locator?: string;
    note?: string;
}

export interface ClinicalRuleRegressionPackage {
    id: string;
    phiFree: boolean;
    caseCount: number;
    fixtureFile: string;
    testFile: string;
    reviewedBy: string;
    reviewedAt: string;
}

export interface ValidatedClinicalRuleDefinition<TInput = unknown> {
    id: string;
    version: string;
    name: string;
    description: string;
    owner: string;
    intendedPopulation: string;
    requiredInputs: string[];
    exclusions: string[];
    allowedLevels: AlertLevel[];
    evidence: ClinicalRuleEvidenceCitation[];
    validationStatus: ClinicalRuleValidationStatus;
    validatedAt?: string;
    riskClass?: ClinicalRuleRiskClass;
    reviewedBy?: string;
    reviewedAt?: string;
    safetyBoundaries?: string[];
    regressionPackage?: ClinicalRuleRegressionPackage;
    evaluate: (input: TInput) => CDSSAlert | null;
}

export type ValidatedRuleSkipReason =
    | 'not-validated'
    | 'retired'
    | 'metadata-incomplete'
    | 'evaluation-error'
    | 'disallowed-output-level'
    | 'risk-boundary-mismatch'
    | 'evidence-missing'
    | 'invalid-evidence-id';

export interface ValidatedRuleEvaluation {
    ruleId: string;
    version: string;
    executed: boolean;
    matched: boolean;
    advisory?: CDSSAlert;
    skippedReason?: ValidatedRuleSkipReason;
    metadataIssues: string[];
    error?: string;
}

export interface ValidatedRuleSetEvaluation {
    advisories: CDSSAlert[];
    evaluations: ValidatedRuleEvaluation[];
}

const SEMANTIC_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

const hasText = (value: string | undefined): boolean =>
    Boolean(value && value.trim());

const citationLabel = (citation: ClinicalRuleEvidenceCitation): string => [
    citation.title.trim(),
    citation.publisher.trim(),
    citation.versionOrDate.trim(),
    citation.locator?.trim(),
].filter(Boolean).join(' · ');

export const validatedRuleMetadataIssues = <TInput>(
    rule: ValidatedClinicalRuleDefinition<TInput>,
): string[] => {
    const issues: string[] = [];
    if (!hasText(rule.id)) issues.push('Rule ID is required.');
    if (!SEMANTIC_VERSION.test(rule.version.trim())) {
        issues.push('Rule version must use semantic versioning.');
    }
    if (!hasText(rule.name)) issues.push('Rule name is required.');
    if (!hasText(rule.description)) issues.push('Rule description is required.');
    if (!hasText(rule.owner)) issues.push('Rule owner is required.');
    if (!hasText(rule.intendedPopulation)) {
        issues.push('Intended population is required.');
    }
    if (rule.requiredInputs.length === 0
        || rule.requiredInputs.some(input => !hasText(input))) {
        issues.push('At least one explicit required input is required.');
    }
    if (rule.allowedLevels.length === 0) {
        issues.push('At least one allowed advisory level is required.');
    }
    if (rule.evidence.length === 0) {
        issues.push('At least one evidence citation is required.');
    }
    rule.evidence.forEach((citation, index) => {
        if (
            !hasText(citation.id)
            || !hasText(citation.title)
            || !hasText(citation.publisher)
            || !hasText(citation.versionOrDate)
        ) {
            issues.push(`Evidence citation ${index + 1} is incomplete.`);
        }
    });
    if (
        rule.validationStatus === 'validated'
        && !hasText(rule.validatedAt)
    ) {
        issues.push('A validated rule requires a validation date.');
    }

    // Slice 5 pilot rules opt into a stronger low-risk contract. Legacy test
    // definitions without a risk class continue to validate against the Slice 1
    // executor contract, while registered pilots fail closed unless every
    // review and PHI-free regression field is present.
    if (rule.riskClass) {
        if (rule.allowedLevels.length !== 1 || rule.allowedLevels[0] !== 'Info') {
            issues.push('A low-risk pilot rule must be Info-only.');
        }
        if (rule.exclusions.length === 0
            || rule.exclusions.some(exclusion => !hasText(exclusion))) {
            issues.push('A low-risk pilot rule requires explicit exclusions.');
        }
        if (!hasText(rule.reviewedBy)) {
            issues.push('A low-risk pilot rule requires a named reviewer.');
        }
        if (!hasText(rule.reviewedAt)) {
            issues.push('A low-risk pilot rule requires a review date.');
        }
        if (!rule.safetyBoundaries?.length
            || rule.safetyBoundaries.some(boundary => !hasText(boundary))) {
            issues.push('A low-risk pilot rule requires explicit safety boundaries.');
        }
        if (!rule.regressionPackage) {
            issues.push('A low-risk pilot rule requires a PHI-free regression package.');
        }
    }

    if (rule.regressionPackage) {
        const regression = rule.regressionPackage;
        if (!hasText(regression.id)) {
            issues.push('Regression package ID is required.');
        }
        if (!regression.phiFree) {
            issues.push('Regression package must be explicitly PHI-free.');
        }
        if (!Number.isInteger(regression.caseCount) || regression.caseCount < 1) {
            issues.push('Regression package requires at least one recorded case.');
        }
        if (!hasText(regression.fixtureFile) || !hasText(regression.testFile)) {
            issues.push('Regression package fixture and test files are required.');
        }
        if (!hasText(regression.reviewedBy) || !hasText(regression.reviewedAt)) {
            issues.push('Regression package review metadata is incomplete.');
        }
    }

    return issues;
};

export const canExecuteValidatedRule = <TInput>(
    rule: ValidatedClinicalRuleDefinition<TInput>,
): boolean => rule.validationStatus === 'validated'
    && validatedRuleMetadataIssues(rule).length === 0;

const safeActions = (actions: CDSSAction[]): CDSSAction[] => actions.map(action =>
    action.type === 'order'
        ? {
            ...action,
            type: 'create-task',
            label: action.label || 'Create follow-up task',
        }
        : action);

const skippedEvaluation = (
    rule: ValidatedClinicalRuleDefinition<unknown>,
    skippedReason: ValidatedRuleSkipReason,
    metadataIssues: string[] = [],
    error?: string,
): ValidatedRuleEvaluation => ({
    ruleId: rule.id,
    version: rule.version,
    executed: false,
    matched: false,
    skippedReason,
    metadataIssues,
    ...(error ? { error } : {}),
});

export const evaluateValidatedRule = <TInput>(
    rule: ValidatedClinicalRuleDefinition<TInput>,
    input: TInput,
): ValidatedRuleEvaluation => {
    if (rule.validationStatus === 'retired') {
        return skippedEvaluation(
            rule as ValidatedClinicalRuleDefinition<unknown>,
            'retired',
        );
    }
    if (rule.validationStatus !== 'validated') {
        return skippedEvaluation(
            rule as ValidatedClinicalRuleDefinition<unknown>,
            'not-validated',
        );
    }

    const metadataIssues = validatedRuleMetadataIssues(rule);
    if (metadataIssues.length > 0) {
        return skippedEvaluation(
            rule as ValidatedClinicalRuleDefinition<unknown>,
            'metadata-incomplete',
            metadataIssues,
        );
    }

    let result: CDSSAlert | null;
    try {
        result = rule.evaluate(input);
    } catch (error) {
        return skippedEvaluation(
            rule as ValidatedClinicalRuleDefinition<unknown>,
            'evaluation-error',
            [],
            error instanceof Error ? error.message : 'Rule evaluation failed.',
        );
    }

    if (!result) {
        return {
            ruleId: rule.id,
            version: rule.version,
            executed: true,
            matched: false,
            metadataIssues: [],
        };
    }
    if (!rule.allowedLevels.includes(result.level)) {
        return skippedEvaluation(
            rule as ValidatedClinicalRuleDefinition<unknown>,
            'disallowed-output-level',
            [],
            `Rule emitted ${result.level}, which is outside its reviewed output contract.`,
        );
    }
    if (rule.riskClass && result.advisoryKind !== rule.riskClass) {
        return skippedEvaluation(
            rule as ValidatedClinicalRuleDefinition<unknown>,
            'risk-boundary-mismatch',
            [],
            `Rule declared ${rule.riskClass} but emitted ${result.advisoryKind}.`,
        );
    }
    if (rule.riskClass && (!result.evidenceIds || result.evidenceIds.length === 0)) {
        return skippedEvaluation(
            rule as ValidatedClinicalRuleDefinition<unknown>,
            'evidence-missing',
            [],
            'A low-risk pilot advisory must identify the exact local evidence snapshot that triggered it.',
        );
    }
    const invalidEvidenceIds = (result.evidenceIds || [])
        .filter(id => parseLocalEvidenceId(id) === null);
    if (invalidEvidenceIds.length > 0) {
        return skippedEvaluation(
            rule as ValidatedClinicalRuleDefinition<unknown>,
            'invalid-evidence-id',
            [],
            `Rule emitted invalid local evidence identifiers: ${invalidEvidenceIds.join(', ')}.`,
        );
    }

    const sourceCitation = rule.evidence.map(citationLabel).join('; ');
    const advisory: CDSSAlert = {
        ...result,
        ruleId: `${rule.id}@${rule.version}`,
        actions: safeActions(result.actions),
        validationStatus: 'validated',
        sourceCitation,
        ...(rule.riskClass ? { advisoryKind: rule.riskClass } : {}),
        ...(rule.regressionPackage
            ? { validationPackageId: rule.regressionPackage.id }
            : {}),
        ...(rule.reviewedBy ? { reviewedBy: rule.reviewedBy } : {}),
        ...(rule.reviewedAt ? { reviewedAt: rule.reviewedAt } : {}),
        limitations: [
            ...(result.limitations || []),
            ...(rule.safetyBoundaries || []),
        ].filter((value, index, values) => values.indexOf(value) === index),
    };

    return {
        ruleId: rule.id,
        version: rule.version,
        executed: true,
        matched: true,
        advisory,
        metadataIssues: [],
    };
};

export const evaluateValidatedRuleSet = <TInput>(
    rules: ValidatedClinicalRuleDefinition<TInput>[],
    input: TInput,
): ValidatedRuleSetEvaluation => {
    const evaluations = rules.map(rule => evaluateValidatedRule(rule, input));
    return {
        advisories: evaluations
            .map(evaluation => evaluation.advisory)
            .filter((advisory): advisory is CDSSAlert => Boolean(advisory)),
        evaluations,
    };
};

/**
 * The registry is intentionally limited to reviewed workflow and data-quality
 * pilots. Diagnosis, treatment, prescribing, medication-safety, dose-adjustment,
 * emergency-triage, and protocol-state rules remain disabled.
 */
export const VALIDATED_RULE_REGISTRY: ValidatedClinicalRuleDefinition<any>[] = [
    ...LOW_RISK_VALIDATED_RULES,
];
