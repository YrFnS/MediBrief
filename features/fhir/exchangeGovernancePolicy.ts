import {
    appendExchangeGovernanceAuditEntry,
    evaluateExchangeGovernance as evaluateExchangeGovernanceCore,
    exchangeEvidenceDigest,
} from './exchangeGovernance';
import type {
    EvaluateExchangeGovernanceInput,
    ExchangeGovernanceCheck,
    ExchangePreflightDecision,
} from './exchangeGovernanceTypes';

/**
 * Profiles that are useful for structural engineering checks but do not name
 * an independently governed production receiver contract.
 */
export const NON_RECEIVER_SPECIFIC_EXCHANGE_PROFILE_IDS = Object.freeze([
    'generic-ips-2.0.1-consumer',
    'reviewed-coding-ips-2.0.1-consumer',
    'hapi-public-r4-test-server',
] as const);

const nonReceiverSpecificIds = new Set<string>(
    NON_RECEIVER_SPECIFIC_EXCHANGE_PROFILE_IDS,
);

const deepFreeze = <T>(value: T): T => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    }
    return value;
};

export const isReceiverSpecificExchangeProfile = (
    profileId: string,
): boolean => !nonReceiverSpecificIds.has(profileId);

/**
 * Public P1.6 entry point.
 *
 * The core evaluator validates the supplied evidence. This policy layer adds
 * the product-level rule that generic IPS baselines, strict terminology
 * baselines, and public test servers can never represent a production
 * recipient. When that rule applies, the decision and append-only audit entry
 * are recomputed as blocked; no network or transport capability is introduced.
 */
export const evaluateExchangeGovernance = async (
    input: EvaluateExchangeGovernanceInput,
): Promise<ExchangePreflightDecision> => {
    const decision = await evaluateExchangeGovernanceCore(input);
    const profileId = input.receiverValidationReport.receiver.id;
    if (isReceiverSpecificExchangeProfile(profileId)) {
        return decision;
    }

    const profileCheck: ExchangeGovernanceCheck = {
        severity: 'error',
        code: 'receiver-profile-not-specific',
        path: 'receiverValidationReport.receiver.id',
        message:
            'A generic, strict-baseline, or public-test receiver profile cannot advance to transport review. An explicit receiver-specific production contract is required.',
    };
    const checks = decision.checks.some(check =>
        check.code === profileCheck.code
        || check.code === 'receiver-profile-non-production')
        ? decision.checks
        : [...decision.checks, profileCheck];

    const {
        decisionId: _decisionId,
        decisionDigest: _decisionDigest,
        auditEntry: _auditEntry,
        ...decisionWithoutDerivedEvidence
    } = decision;
    const blockedCore = {
        ...decisionWithoutDerivedEvidence,
        state: 'blocked' as const,
        checks,
        readyForIndependentTransportReview: false,
    };
    const decisionDigest = await exchangeEvidenceDigest(blockedCore);
    const auditEntry = await appendExchangeGovernanceAuditEntry({
        eventType: 'exchange-preflight-evaluated',
        recordedAt: decision.generatedAt,
        outcome: 'fail',
        patientReferenceDigest: decision.patientReferenceDigest,
        receiverTrustDigest: decision.receiver.trustRecordDigest,
        authorizationDigest: decision.authorization.digest,
        contentDigest: decision.content.documentDigest,
        decisionDigest,
        previousAuditEntry: input.previousAuditEntry,
    });

    return deepFreeze({
        ...blockedCore,
        decisionId: `exchange-preflight-${decisionDigest.slice(7, 31)}`,
        decisionDigest,
        auditEntry,
    });
};
