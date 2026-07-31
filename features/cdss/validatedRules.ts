import type {
    AlertLevel,
    CDSSAction,
    CDSSAlert,
} from './types';

export type ClinicalRuleValidationStatus = 'draft' | 'validated' | 'retired';

export interface ClinicalRuleEvidenceCitation {
    id: string;
    title: string;
    publisher: string;
    versionOrDate: string;
    locator?: string;
    note?: string;
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
    evaluate: (input: TInput) => CDSSAlert | null;
}

export type ValidatedRuleSkipReason =
    | 'not-validated'
    | 'retired'
    | 'metadata-incomplete'
    | 'evaluation-error'
    | 'disallowed-output-level';

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

    const sourceCitation = rule.evidence.map(citationLabel).join('; ');
    const advisory: CDSSAlert = {
        ...result,
        ruleId: `${rule.id}@${rule.version}`,
        actions: safeActions(result.actions),
        validationStatus: 'validated',
        sourceCitation,
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
 * No clinical conclusion is enabled by the Phase 5 foundation itself.
 * Rules are added only after their metadata, evidence, review, and regression
 * package are complete.
 */
export const VALIDATED_RULE_REGISTRY: ValidatedClinicalRuleDefinition<unknown>[] = [];
