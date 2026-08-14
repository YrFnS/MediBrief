import type {
    DisclosureAuthorizationRecord,
    EvaluateExchangeGovernanceInput,
    ExchangeAuditChainVerification,
    ExchangeDataClass,
    ExchangeGovernanceAuditEntry,
    ExchangeGovernanceAuditEventType,
    ExchangeGovernanceCheck,
    ExchangeGovernanceCheckSeverity,
    ExchangePreflightDecision,
    ExchangePurposeOfUse,
    ExchangeReceiptEvidence,
    ExchangeReceiptReview,
    ExchangeRetryPolicy,
    ReceiverTrustRecord,
} from './exchangeGovernanceTypes';

export const DEFAULT_EXCHANGE_RETRY_POLICY: ExchangeRetryPolicy = {
    schemaVersion: '1',
    maxAttempts: 3,
    initialDelayMs: 30_000,
    maxDelayMs: 15 * 60_000,
    backoffMultiplier: 2,
    jitter: 'none',
};

const DEFAULT_RECEIVER_VALIDATION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_RECEIVER_VALIDATION_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const NON_PRODUCTION_RECEIVER_PROFILE_IDS = new Set([
    'hapi-public-r4-test-server',
]);
const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const IDEMPOTENCY_PATTERN = /^mbx-[a-f0-9]{48}$/;
const SAFE_ID_PATTERN = /^[^\s\u0000-\u001f\u007f]{1,128}$/;
const BLOCKED_SECRET_KEYS = new Set([
    'secret',
    'clientsecret',
    'password',
    'privatekey',
    'accesstoken',
    'refreshtoken',
    'authorizationheader',
    'bearertoken',
    'credential',
    'credentials',
    'pkcs8',
]);
const BLOCKED_AUTHORIZATION_CONTENT_KEYS = new Set([
    'attachment',
    'sourceattachment',
    'document',
    'documenttext',
    'text',
    'narrative',
    'note',
    'clinicaldata',
    'bundle',
    'ipsdocument',
    'patientname',
    'birthdate',
    'address',
    'telecom',
]);

const isObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeKey = (value: string): string =>
    value.toLowerCase().replace(/[^a-z0-9]/g, '');

const deepFreeze = <T>(value: T): T => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    }
    return value;
};

/**
 * Canonical JSON for local evidence hashing. Object keys are sorted and
 * undefined object members are omitted, matching JSON serialization semantics.
 */
export const canonicalExchangeJson = (value: unknown): string => {
    const serialize = (input: unknown, path: string): string => {
        if (input === null) return 'null';
        if (typeof input === 'string' || typeof input === 'boolean') {
            return JSON.stringify(input);
        }
        if (typeof input === 'number') {
            if (!Number.isFinite(input)) {
                throw new Error(`${path} contains a non-finite number.`);
            }
            return JSON.stringify(input);
        }
        if (Array.isArray(input)) {
            return `[${input.map((item, index) =>
                item === undefined
                    ? 'null'
                    : serialize(item, `${path}[${index}]`)).join(',')}]`;
        }
        if (isObject(input)) {
            const entries = Object.keys(input)
                .filter(key => input[key] !== undefined)
                .sort()
                .map(key => `${JSON.stringify(key)}:${serialize(
                    input[key],
                    `${path}.${key}`,
                )}`);
            return `{${entries.join(',')}}`;
        }
        throw new Error(`${path} contains a non-JSON value.`);
    };
    return serialize(value, '$');
};

export const exchangeEvidenceDigest = async (
    value: unknown,
): Promise<string> => {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) {
        throw new Error('Web Crypto SHA-256 is required for exchange evidence.');
    }
    const bytes = new TextEncoder().encode(canonicalExchangeJson(value));
    const digest = await subtle.digest('SHA-256', bytes);
    const hex = [...new Uint8Array(digest)]
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
    return `sha256:${hex}`;
};

const addCheck = (
    checks: ExchangeGovernanceCheck[],
    severity: ExchangeGovernanceCheckSeverity,
    code: string,
    path: string,
    message: string,
): void => {
    checks.push({ severity, code, path, message });
};

const validId = (value: unknown): value is string =>
    typeof value === 'string' && SAFE_ID_PATTERN.test(value);

const validDigest = (value: unknown): value is string =>
    typeof value === 'string' && DIGEST_PATTERN.test(value);

const validInstant = (value: unknown): value is string => {
    if (typeof value !== 'string'
        || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
        return false;
    }
    return Number.isFinite(Date.parse(value));
};

const validPolicyUri = (value: unknown): value is string => {
    if (typeof value !== 'string' || value.length > 2048) return false;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' || url.protocol === 'urn:';
    } catch {
        return false;
    }
};

const validateHttpsEndpoint = (
    value: unknown,
    path: string,
    checks: ExchangeGovernanceCheck[],
): URL | null => {
    if (typeof value !== 'string' || value.length > 2048) {
        addCheck(checks, 'error', 'endpoint-invalid', path,
            'A bounded HTTPS endpoint is required.');
        return null;
    }
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:') {
            addCheck(checks, 'error', 'endpoint-not-https', path,
                'The receiver endpoint must use HTTPS.');
        }
        if (url.username || url.password) {
            addCheck(checks, 'error', 'endpoint-credentials', path,
                'The receiver endpoint must not contain credentials.');
        }
        if (url.search || url.hash) {
            addCheck(checks, 'error', 'endpoint-query-or-fragment', path,
                'The receiver endpoint must not contain a query or fragment.');
        }
        return url;
    } catch {
        addCheck(checks, 'error', 'endpoint-invalid', path,
            'The receiver endpoint is not a valid absolute URL.');
        return null;
    }
};

const scanForbiddenMaterial = (
    value: unknown,
    path: string,
    checks: ExchangeGovernanceCheck[],
    blockedKeys: Set<string>,
): void => {
    if (Array.isArray(value)) {
        value.forEach((item, index) => scanForbiddenMaterial(
            item,
            `${path}[${index}]`,
            checks,
            blockedKeys,
        ));
        return;
    }
    if (!isObject(value)) {
        if (typeof value === 'string'
            && (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value)
                || /^Bearer\s/i.test(value))) {
            addCheck(checks, 'error', 'secret-material-present', path,
                'Secret or private-key material is not permitted in governance evidence.');
        }
        return;
    }
    Object.entries(value).forEach(([key, child]) => {
        const childPath = `${path}.${key}`;
        if (blockedKeys.has(normalizeKey(key))) {
            addCheck(checks, 'error', 'forbidden-field', childPath,
                'This field is not permitted in the PHI-minimized governance contract.');
        }
        scanForbiddenMaterial(child, childPath, checks, blockedKeys);
    });
};

const uniqueSorted = <T extends string>(values: T[]): T[] =>
    [...new Set(values)].sort() as T[];

const compareStringSets = (left: string[], right: string[]): boolean =>
    JSON.stringify(uniqueSorted(left)) === JSON.stringify(uniqueSorted(right));

const validateBoundedText = (
    value: unknown,
    path: string,
    checks: ExchangeGovernanceCheck[],
    maximum: number,
): void => {
    if (typeof value !== 'string'
        || !value.trim()
        || value.length > maximum
        || /[\u0000-\u001f\u007f]/.test(value)) {
        addCheck(checks, 'error', 'bounded-text-invalid', path,
            `A non-empty value of at most ${maximum} characters is required.`);
    }
};

export const validateReceiverTrustRecord = (
    record: ReceiverTrustRecord,
    receiverProfileId: string,
    receiverProfileVersion: string,
    purposeOfUse: ExchangePurposeOfUse,
    dataClasses: ExchangeDataClass[],
    generatedAt: string,
): ExchangeGovernanceCheck[] => {
    const checks: ExchangeGovernanceCheck[] = [];
    scanForbiddenMaterial(record, 'receiverTrustRecord', checks,
        BLOCKED_SECRET_KEYS);

    if (record.schemaVersion !== '1') {
        addCheck(checks, 'error', 'trust-schema-version',
            'receiverTrustRecord.schemaVersion',
            'Receiver trust evidence must use schema version 1.');
    }
    if (!validId(record.id)) {
        addCheck(checks, 'error', 'trust-id-invalid',
            'receiverTrustRecord.id', 'A stable receiver trust ID is required.');
    }
    if (!validId(record.version)) {
        addCheck(checks, 'error', 'trust-version-invalid',
            'receiverTrustRecord.version', 'A stable trust-record version is required.');
    }
    if (record.status !== 'active') {
        addCheck(checks, 'error', 'trust-not-active',
            'receiverTrustRecord.status',
            'The receiver trust record must be active.');
    }
    if (record.environment !== 'production') {
        addCheck(checks, 'error', 'trust-not-production',
            'receiverTrustRecord.environment',
            'Only an independently approved production receiver may advance to transport review.');
    }
    if (record.receiverProfileId !== receiverProfileId
        || record.receiverProfileVersion !== receiverProfileVersion) {
        addCheck(checks, 'error', 'trust-profile-mismatch',
            'receiverTrustRecord.receiverProfileId',
            'The trust record is not bound to the validated receiver profile and version.');
    }

    validateBoundedText(record.organization?.identifier,
        'receiverTrustRecord.organization.identifier', checks, 200);
    validateBoundedText(record.organization?.display,
        'receiverTrustRecord.organization.display', checks, 200);
    if (record.organization?.jurisdiction !== undefined) {
        validateBoundedText(record.organization.jurisdiction,
            'receiverTrustRecord.organization.jurisdiction', checks, 100);
    }
    validateHttpsEndpoint(record.endpoint,
        'receiverTrustRecord.endpoint', checks);

    if (record.authentication.method === 'none') {
        addCheck(checks, 'error', 'authentication-missing',
            'receiverTrustRecord.authentication.method',
            'A production receiver must use a reviewed authentication method.');
    }
    if (!record.authentication.registrationEstablished) {
        addCheck(checks, 'error', 'registration-not-established',
            'receiverTrustRecord.authentication.registrationEstablished',
            'Out-of-band receiver registration and organizational trust are not established.');
    }
    if (!validDigest(record.authentication.registrationEvidenceDigest)) {
        addCheck(checks, 'error', 'registration-evidence-invalid',
            'receiverTrustRecord.authentication.registrationEvidenceDigest',
            'A SHA-256 digest of the registration evidence is required.');
    }
    if (!Array.isArray(record.authentication.authorizedScopes)
        || record.authentication.authorizedScopes.length === 0) {
        addCheck(checks, 'error', 'authorization-scopes-missing',
            'receiverTrustRecord.authentication.authorizedScopes',
            'At least one reviewed authorization scope is required.');
    } else {
        record.authentication.authorizedScopes.forEach((scope, index) =>
            validateBoundedText(scope,
                `receiverTrustRecord.authentication.authorizedScopes[${index}]`,
                checks,
                300));
    }
    if (record.authentication.method === 'smart-backend-private-key-jwt') {
        validateHttpsEndpoint(record.authentication.tokenEndpoint,
            'receiverTrustRecord.authentication.tokenEndpoint', checks);
    }
    if (record.authentication.method === 'mutual-tls'
        && !validDigest(record.authentication.certificateEvidenceDigest)) {
        addCheck(checks, 'error', 'certificate-evidence-invalid',
            'receiverTrustRecord.authentication.certificateEvidenceDigest',
            'Mutual TLS requires a SHA-256 digest of the reviewed certificate evidence.');
    }

    if (!validPolicyUri(record.policyUri)) {
        addCheck(checks, 'error', 'trust-policy-invalid',
            'receiverTrustRecord.policyUri',
            'A stable HTTPS or URN policy identifier is required.');
    }
    [
        ['capabilityEvidenceDigest', record.capabilityEvidenceDigest],
        ['organizationTrustEvidenceDigest',
            record.organizationTrustEvidenceDigest],
    ].forEach(([field, value]) => {
        if (!validDigest(value)) {
            addCheck(checks, 'error', 'trust-evidence-invalid',
                `receiverTrustRecord.${field}`,
                'A SHA-256 evidence digest is required.');
        }
    });

    if (!record.allowedPurposes.includes(purposeOfUse)) {
        addCheck(checks, 'error', 'purpose-not-trusted',
            'receiverTrustRecord.allowedPurposes',
            'The requested purpose of use is not approved by the receiver trust record.');
    }
    const untrustedClasses = dataClasses.filter(dataClass =>
        !record.allowedDataClasses.includes(dataClass));
    if (untrustedClasses.length > 0) {
        addCheck(checks, 'error', 'data-class-not-trusted',
            'receiverTrustRecord.allowedDataClasses',
            'The receiver trust record does not approve every requested data class.');
    }

    validateBoundedText(record.approvedBy?.actorId,
        'receiverTrustRecord.approvedBy.actorId', checks, 128);
    validateBoundedText(record.approvedBy?.role,
        'receiverTrustRecord.approvedBy.role', checks, 128);
    if (!validInstant(record.approvedAt) || !validInstant(record.expiresAt)) {
        addCheck(checks, 'error', 'trust-period-invalid',
            'receiverTrustRecord.approvedAt',
            'The trust approval and expiry must be valid timezone-qualified instants.');
    } else {
        const now = Date.parse(generatedAt);
        const approvedAt = Date.parse(record.approvedAt);
        const expiresAt = Date.parse(record.expiresAt);
        if (approvedAt > now) {
            addCheck(checks, 'error', 'trust-not-yet-effective',
                'receiverTrustRecord.approvedAt',
                'The receiver trust approval is not yet effective.');
        }
        if (expiresAt <= now || expiresAt <= approvedAt) {
            addCheck(checks, 'error', 'trust-expired',
                'receiverTrustRecord.expiresAt',
                'The receiver trust approval is expired or has an invalid period.');
        }
    }

    if (!checks.some(check => check.severity === 'error')) {
        addCheck(checks, 'information', 'trust-record-active',
            'receiverTrustRecord',
            'The receiver trust record is active, production-scoped, and bound to the validated receiver profile.');
    }
    return checks;
};

export const validateDisclosureAuthorizationRecord = (
    authorization: DisclosureAuthorizationRecord,
    trustRecord: ReceiverTrustRecord,
    patientId: string,
    purposeOfUse: ExchangePurposeOfUse,
    dataClasses: ExchangeDataClass[],
    generatedAt: string,
): ExchangeGovernanceCheck[] => {
    const checks: ExchangeGovernanceCheck[] = [];
    scanForbiddenMaterial(authorization, 'disclosureAuthorization', checks,
        new Set([...BLOCKED_SECRET_KEYS, ...BLOCKED_AUTHORIZATION_CONTENT_KEYS]));

    if (authorization.schemaVersion !== '1') {
        addCheck(checks, 'error', 'authorization-schema-version',
            'disclosureAuthorization.schemaVersion',
            'Disclosure authorization must use schema version 1.');
    }
    if (!validId(authorization.id) || !validId(authorization.version)) {
        addCheck(checks, 'error', 'authorization-identity-invalid',
            'disclosureAuthorization.id',
            'A stable authorization ID and version are required.');
    }
    if (authorization.status !== 'active') {
        addCheck(checks, 'error', 'authorization-not-active',
            'disclosureAuthorization.status',
            'The disclosure authorization must be active.');
    }
    if (authorization.patientId !== patientId) {
        addCheck(checks, 'error', 'authorization-patient-mismatch',
            'disclosureAuthorization.patientId',
            'The disclosure authorization is not bound to the selected local patient.');
    }
    if (authorization.receiverTrustId !== trustRecord.id
        || authorization.receiverTrustVersion !== trustRecord.version) {
        addCheck(checks, 'error', 'authorization-trust-mismatch',
            'disclosureAuthorization.receiverTrustId',
            'The disclosure authorization is not bound to this trust-record version.');
    }
    if (authorization.receiverOrganizationIdentifier
        !== trustRecord.organization.identifier) {
        addCheck(checks, 'error', 'authorization-recipient-mismatch',
            'disclosureAuthorization.receiverOrganizationIdentifier',
            'The authorized recipient does not match the trusted organization.');
    }
    if (authorization.action !== 'disclose') {
        addCheck(checks, 'error', 'authorization-action-invalid',
            'disclosureAuthorization.action',
            'The authorization must explicitly permit disclosure.');
    }
    if (authorization.purposeOfUse !== purposeOfUse) {
        addCheck(checks, 'error', 'authorization-purpose-mismatch',
            'disclosureAuthorization.purposeOfUse',
            'The requested purpose does not match the authorization.');
    }
    if (!compareStringSets(authorization.dataClasses, dataClasses)) {
        addCheck(checks, 'error', 'authorization-data-class-mismatch',
            'disclosureAuthorization.dataClasses',
            'The authorization must exactly cover the requested data classes.');
    }
    if (!validPolicyUri(authorization.legalBasisUri)
        || !validPolicyUri(authorization.policyUri)) {
        addCheck(checks, 'error', 'authorization-policy-invalid',
            'disclosureAuthorization.policyUri',
            'Stable HTTPS or URN identifiers are required for the legal basis and policy.');
    }

    if (!validInstant(authorization.validFrom)
        || !validInstant(authorization.validUntil)) {
        addCheck(checks, 'error', 'authorization-period-invalid',
            'disclosureAuthorization.validFrom',
            'The authorization period must use valid timezone-qualified instants.');
    } else {
        const now = Date.parse(generatedAt);
        const validFrom = Date.parse(authorization.validFrom);
        const validUntil = Date.parse(authorization.validUntil);
        if (validFrom > now) {
            addCheck(checks, 'error', 'authorization-not-yet-effective',
                'disclosureAuthorization.validFrom',
                'The disclosure authorization is not yet effective.');
        }
        if (validUntil <= now || validUntil <= validFrom) {
            addCheck(checks, 'error', 'authorization-expired',
                'disclosureAuthorization.validUntil',
                'The disclosure authorization is expired or has an invalid period.');
        }
    }
    if (authorization.revokedAt !== undefined) {
        addCheck(checks, 'error', 'authorization-revoked',
            'disclosureAuthorization.revokedAt',
            'A revoked disclosure authorization cannot advance to transport review.');
    }

    validateBoundedText(authorization.authorizationSource?.reference,
        'disclosureAuthorization.authorizationSource.reference', checks, 500);
    if (!validDigest(authorization.authorizationSource?.digest)) {
        addCheck(checks, 'error', 'authorization-source-digest-invalid',
            'disclosureAuthorization.authorizationSource.digest',
            'A SHA-256 digest of the authorization source is required.');
    }
    validateBoundedText(authorization.authorizer?.actorId,
        'disclosureAuthorization.authorizer.actorId', checks, 128);
    if (authorization.authorizer?.role !== undefined) {
        validateBoundedText(authorization.authorizer.role,
            'disclosureAuthorization.authorizer.role', checks, 128);
    }

    if (!authorization.verification?.verified) {
        addCheck(checks, 'error', 'authorization-not-verified',
            'disclosureAuthorization.verification.verified',
            'The authorization source must be independently verified.');
    }
    if (!validInstant(authorization.verification?.verifiedAt)
        || Date.parse(authorization.verification.verifiedAt)
            > Date.parse(generatedAt)) {
        addCheck(checks, 'error', 'authorization-verification-time-invalid',
            'disclosureAuthorization.verification.verifiedAt',
            'The verification time is missing, invalid, or in the future.');
    }
    validateBoundedText(authorization.verification?.verifierId,
        'disclosureAuthorization.verification.verifierId', checks, 128);
    if (!validDigest(authorization.verification?.evidenceDigest)) {
        addCheck(checks, 'error', 'authorization-verification-digest-invalid',
            'disclosureAuthorization.verification.evidenceDigest',
            'A SHA-256 digest of the verification evidence is required.');
    }

    if (!checks.some(check => check.severity === 'error')) {
        addCheck(checks, 'information', 'authorization-active',
            'disclosureAuthorization',
            'The authorization is active, recipient-bound, purpose-bound, data-bound, and independently verified.');
    }
    return checks;
};

export const validateExchangeRetryPolicy = (
    policy: ExchangeRetryPolicy,
): ExchangeGovernanceCheck[] => {
    const checks: ExchangeGovernanceCheck[] = [];
    if (policy.schemaVersion !== '1') {
        addCheck(checks, 'error', 'retry-schema-version',
            'retryPolicy.schemaVersion',
            'The retry policy must use schema version 1.');
    }
    if (!Number.isInteger(policy.maxAttempts)
        || policy.maxAttempts < 1
        || policy.maxAttempts > 5) {
        addCheck(checks, 'error', 'retry-attempts-invalid',
            'retryPolicy.maxAttempts',
            'Retry attempts must be an integer between 1 and 5.');
    }
    if (!Number.isInteger(policy.initialDelayMs)
        || policy.initialDelayMs < 1_000
        || policy.initialDelayMs > 60 * 60_000) {
        addCheck(checks, 'error', 'retry-initial-delay-invalid',
            'retryPolicy.initialDelayMs',
            'The initial retry delay must be between 1 second and 1 hour.');
    }
    if (!Number.isInteger(policy.maxDelayMs)
        || policy.maxDelayMs < policy.initialDelayMs
        || policy.maxDelayMs > 24 * 60 * 60_000) {
        addCheck(checks, 'error', 'retry-max-delay-invalid',
            'retryPolicy.maxDelayMs',
            'The maximum retry delay must be bounded between the initial delay and 24 hours.');
    }
    if (!Number.isFinite(policy.backoffMultiplier)
        || policy.backoffMultiplier < 1
        || policy.backoffMultiplier > 4) {
        addCheck(checks, 'error', 'retry-multiplier-invalid',
            'retryPolicy.backoffMultiplier',
            'The retry backoff multiplier must be between 1 and 4.');
    }
    if (policy.jitter !== 'none') {
        addCheck(checks, 'error', 'retry-jitter-invalid',
            'retryPolicy.jitter',
            'P1.6 permits deterministic no-jitter planning only.');
    }
    if (!checks.some(check => check.severity === 'error')) {
        addCheck(checks, 'information', 'retry-policy-bounded',
            'retryPolicy',
            'The retry contract is finite and deterministic; no retry executor is implemented.');
    }
    return checks;
};

export const exchangeRetryDelayMs = (
    policy: ExchangeRetryPolicy,
    attemptNumber: number,
): number => {
    const validation = validateExchangeRetryPolicy(policy);
    if (validation.some(check => check.severity === 'error')) {
        throw new Error('The retry policy is invalid.');
    }
    if (!Number.isInteger(attemptNumber)
        || attemptNumber < 2
        || attemptNumber > policy.maxAttempts) {
        throw new Error(
            'Retry attempt number must be between 2 and maxAttempts.',
        );
    }
    return Math.min(
        policy.maxDelayMs,
        Math.round(
            policy.initialDelayMs
            * (policy.backoffMultiplier ** (attemptNumber - 2)),
        ),
    );
};

export const appendExchangeGovernanceAuditEntry = async ({
    eventType,
    recordedAt,
    outcome,
    patientReferenceDigest,
    receiverTrustDigest,
    authorizationDigest,
    contentDigest,
    decisionDigest,
    previousAuditEntry,
}: {
    eventType: ExchangeGovernanceAuditEventType;
    recordedAt: string;
    outcome: 'pass' | 'fail';
    patientReferenceDigest: string;
    receiverTrustDigest: string;
    authorizationDigest: string;
    contentDigest: string;
    decisionDigest: string;
    previousAuditEntry?: ExchangeGovernanceAuditEntry;
}): Promise<ExchangeGovernanceAuditEntry> => {
    if (!validInstant(recordedAt)) {
        throw new Error('Audit recordedAt must be a timezone-qualified instant.');
    }
    const digestFields = {
        patientReferenceDigest,
        receiverTrustDigest,
        authorizationDigest,
        contentDigest,
        decisionDigest,
    };
    Object.entries(digestFields).forEach(([field, value]) => {
        if (!validDigest(value)) {
            throw new Error(`Audit ${field} must be a SHA-256 digest.`);
        }
    });
    if (previousAuditEntry) {
        const { entryDigest: _entryDigest, ...previousCore } = previousAuditEntry;
        const expectedPreviousDigest = await exchangeEvidenceDigest(previousCore);
        if (expectedPreviousDigest !== previousAuditEntry.entryDigest) {
            throw new Error('The previous audit entry digest is invalid.');
        }
    }
    const core = {
        schemaVersion: '1' as const,
        sequence: (previousAuditEntry?.sequence || 0) + 1,
        eventType,
        recordedAt,
        outcome,
        patientReferenceDigest,
        receiverTrustDigest,
        authorizationDigest,
        contentDigest,
        decisionDigest,
        ...(previousAuditEntry
            ? { previousEntryDigest: previousAuditEntry.entryDigest }
            : {}),
    };
    return deepFreeze({
        ...core,
        entryDigest: await exchangeEvidenceDigest(core),
    });
};

export const verifyExchangeGovernanceAuditChain = async (
    entries: ExchangeGovernanceAuditEntry[],
): Promise<ExchangeAuditChainVerification> => {
    const errors: string[] = [];
    let previousDigest: string | undefined;
    for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        if (entry.sequence !== index + 1) {
            errors.push(`Audit entry ${index} has an invalid sequence.`);
        }
        if (entry.previousEntryDigest !== previousDigest) {
            errors.push(`Audit entry ${index} does not link to the previous digest.`);
        }
        if (!validDigest(entry.entryDigest)) {
            errors.push(`Audit entry ${index} has an invalid digest format.`);
        } else {
            const { entryDigest: _entryDigest, ...core } = entry;
            const expected = await exchangeEvidenceDigest(core);
            if (expected !== entry.entryDigest) {
                errors.push(`Audit entry ${index} digest verification failed.`);
            }
        }
        previousDigest = entry.entryDigest;
    }
    return { valid: errors.length === 0, errors };
};

const documentResourceCounts = (
    document: EvaluateExchangeGovernanceInput['document'],
): Record<string, number> => {
    const counts: Record<string, number> = {};
    document.entry.forEach(entry => {
        const resourceType = entry.resource.resourceType;
        counts[resourceType] = (counts[resourceType] || 0) + 1;
    });
    return counts;
};

export const evaluateExchangeGovernance = async ({
    patientId,
    document,
    receiverValidationReport,
    receiverTrustRecord,
    disclosureAuthorization,
    purposeOfUse,
    dataClasses = ['ips-summary'],
    retryPolicy = DEFAULT_EXCHANGE_RETRY_POLICY,
    previousAuditEntry,
    generatedAt = new Date().toISOString(),
    receiverValidationMaxAgeMs = DEFAULT_RECEIVER_VALIDATION_MAX_AGE_MS,
}: EvaluateExchangeGovernanceInput): Promise<ExchangePreflightDecision> => {
    const checks: ExchangeGovernanceCheck[] = [];
    if (!validInstant(generatedAt)) {
        throw new Error('generatedAt must be a timezone-qualified instant.');
    }
    if (!validId(patientId)) {
        addCheck(checks, 'error', 'patient-reference-invalid', 'patientId',
            'A bounded local patient reference is required.');
    }
    const requestedDataClasses = uniqueSorted(dataClasses);
    if (requestedDataClasses.length !== 1
        || requestedDataClasses[0] !== 'ips-summary') {
        addCheck(checks, 'error', 'data-class-invalid', 'dataClasses',
            'P1.6 supports only the complete IPS summary data class.');
    }

    if (!isObject(document)
        || document.resourceType !== 'Bundle'
        || document.type !== 'document'
        || !Array.isArray(document.entry)
        || document.entry.length === 0) {
        addCheck(checks, 'error', 'document-invalid', 'document',
            'A non-empty FHIR document Bundle is required.');
    }

    const documentJson = canonicalExchangeJson(document);
    const bundleBytes = new TextEncoder().encode(documentJson).byteLength;
    const documentDigest = await exchangeEvidenceDigest(document);
    const receiverValidationDigest = await exchangeEvidenceDigest(
        receiverValidationReport,
    );
    const receiverTrustDigest = await exchangeEvidenceDigest(
        receiverTrustRecord,
    );
    const authorizationDigest = await exchangeEvidenceDigest(
        disclosureAuthorization,
    );
    const patientReferenceDigest = await exchangeEvidenceDigest({
        kind: 'local-patient-reference',
        value: patientId,
    });

    checks.push(...validateReceiverTrustRecord(
        receiverTrustRecord,
        receiverValidationReport.receiver.id,
        receiverValidationReport.receiver.version,
        purposeOfUse,
        requestedDataClasses,
        generatedAt,
    ));
    checks.push(...validateDisclosureAuthorizationRecord(
        disclosureAuthorization,
        receiverTrustRecord,
        patientId,
        purposeOfUse,
        requestedDataClasses,
        generatedAt,
    ));
    checks.push(...validateExchangeRetryPolicy(retryPolicy));

    if (NON_PRODUCTION_RECEIVER_PROFILE_IDS.has(
        receiverValidationReport.receiver.id,
    )) {
        addCheck(checks, 'error', 'receiver-profile-non-production',
            'receiverValidationReport.receiver.id',
            'This receiver profile is explicitly synthetic or non-production and cannot advance to transport review.');
    }

    if (receiverValidationReport.state !== 'ready'
        && receiverValidationReport.state !== 'ready-with-warnings') {
        addCheck(checks, 'error', 'receiver-validation-not-ready',
            'receiverValidationReport.state',
            'Receiver compatibility must be ready or ready-with-warnings before transport review.');
    }
    if (!receiverValidationReport.readyForManualTransfer) {
        addCheck(checks, 'error', 'receiver-manual-review-not-ready',
            'receiverValidationReport.readyForManualTransfer',
            'The receiver report is not ready for manual transfer review.');
    }
    if (receiverValidationReport.transferAuthorized !== false
        || receiverValidationReport.receiverAcceptanceEstablished !== false
        || receiverValidationReport.clinicalValidationEstablished !== false) {
        addCheck(checks, 'error', 'receiver-report-boundary-invalid',
            'receiverValidationReport',
            'The receiver report does not preserve the required non-authorizing boundary.');
    }

    if (!Number.isInteger(receiverValidationMaxAgeMs)
        || receiverValidationMaxAgeMs < 60_000
        || receiverValidationMaxAgeMs > MAX_RECEIVER_VALIDATION_AGE_MS) {
        addCheck(checks, 'error', 'receiver-validation-age-policy-invalid',
            'receiverValidationMaxAgeMs',
            'Receiver validation age must be between 1 minute and 30 days.');
    } else if (!validInstant(receiverValidationReport.generatedAt)) {
        addCheck(checks, 'error', 'receiver-validation-time-invalid',
            'receiverValidationReport.generatedAt',
            'The receiver validation time is invalid.');
    } else {
        const age = Date.parse(generatedAt)
            - Date.parse(receiverValidationReport.generatedAt);
        if (age < -5 * 60_000) {
            addCheck(checks, 'error', 'receiver-validation-in-future',
                'receiverValidationReport.generatedAt',
                'The receiver validation report is dated in the future.');
        }
        if (age > receiverValidationMaxAgeMs) {
            addCheck(checks, 'error', 'receiver-validation-stale',
                'receiverValidationReport.generatedAt',
                'The receiver validation report is older than the permitted review window.');
        }
    }

    if (receiverValidationReport.summary.bundleEntries
        !== document.entry.length
        || receiverValidationReport.summary.bundleBytes !== bundleBytes
        || canonicalExchangeJson(receiverValidationReport.summary.resourceTypes)
            !== canonicalExchangeJson(documentResourceCounts(document))) {
        addCheck(checks, 'error', 'receiver-report-document-mismatch',
            'receiverValidationReport.summary',
            'The receiver report summary does not match the current IPS document.');
    } else {
        addCheck(checks, 'information', 'receiver-report-document-bound',
            'receiverValidationReport.summary',
            'The receiver report entry, byte, and resource counts match the current IPS document.');
    }

    const idempotencyDigest = await exchangeEvidenceDigest({
        schemaVersion: '1',
        kind: 'exchange-intent',
        patientReferenceDigest,
        documentDigest,
        receiverValidationDigest,
        receiverTrustDigest,
        authorizationDigest,
        purposeOfUse,
        dataClasses: requestedDataClasses,
    });
    const idempotencyKey = `mbx-${idempotencyDigest.slice(7, 55)}`;
    const state = checks.some(check => check.severity === 'error')
        ? 'blocked' as const
        : 'ready-for-transport-review' as const;

    addCheck(checks, 'information', 'transport-not-implemented',
        'transportAdapterAvailable',
        'No transport adapter, token exchange, network queue, retry executor, or send action exists in P1.6.');

    const decisionCore = {
        schemaVersion: '1' as const,
        generatedAt,
        state,
        patientReferenceDigest,
        receiver: {
            profileId: receiverValidationReport.receiver.id,
            profileVersion: receiverValidationReport.receiver.version,
            trustRecordId: receiverTrustRecord.id,
            trustRecordVersion: receiverTrustRecord.version,
            trustRecordDigest: receiverTrustDigest,
            organizationIdentifier:
                receiverTrustRecord.organization.identifier,
            environment: receiverTrustRecord.environment,
        },
        authorization: {
            id: disclosureAuthorization.id,
            version: disclosureAuthorization.version,
            digest: authorizationDigest,
            purposeOfUse,
            dataClasses: requestedDataClasses,
        },
        content: {
            documentDigest,
            receiverValidationDigest,
            bundleBytes,
            bundleEntries: document.entry.length,
        },
        checks,
        idempotencyKey,
        retryPolicy,
        retryExecutionImplemented: false as const,
        receiptContract: {
            required: true as const,
            authenticityVerificationImplemented: false as const,
            receiverIdentityEstablishedByReceipt: false as const,
            deliveryEstablishedByReceipt: false as const,
        },
        readyForIndependentTransportReview:
            state === 'ready-for-transport-review',
        transportAdapterAvailable: false as const,
        transportAuthorized: false as const,
        transmissionAttempted: false as const,
        receiverAcceptanceEstablished: false as const,
        patientIdentityMatchEstablished: false as const,
        clinicalValidationEstablished: false as const,
        networkActivity: 'none' as const,
        limitations: [
            'This decision evaluates local recipient trust, disclosure authorization, receiver compatibility, content binding, and finite retry/receipt contracts only.',
            'Ready for transport review is not permission to disclose and is not an instruction to transmit.',
            'No authentication token, credential, clinical document, consent source, receiver response body, or free-text patient data is retained in this report.',
            'Receiver identity, patient matching, consent enforceability, delivery, receipt authenticity, clinical rendering, and production readiness remain unestablished.',
        ],
    };
    const decisionDigest = await exchangeEvidenceDigest(decisionCore);
    const auditEntry = await appendExchangeGovernanceAuditEntry({
        eventType: 'exchange-preflight-evaluated',
        recordedAt: generatedAt,
        outcome: state === 'ready-for-transport-review' ? 'pass' : 'fail',
        patientReferenceDigest,
        receiverTrustDigest,
        authorizationDigest,
        contentDigest: documentDigest,
        decisionDigest,
        previousAuditEntry,
    });

    return deepFreeze({
        ...decisionCore,
        decisionId: `exchange-preflight-${decisionDigest.slice(7, 31)}`,
        decisionDigest,
        auditEntry,
    });
};

export const reviewExchangeReceipt = async ({
    receipt,
    decision,
    reviewedAt = new Date().toISOString(),
}: {
    receipt: ExchangeReceiptEvidence;
    decision: ExchangePreflightDecision;
    reviewedAt?: string;
}): Promise<ExchangeReceiptReview> => {
    if (!validInstant(reviewedAt)) {
        throw new Error('reviewedAt must be a timezone-qualified instant.');
    }
    const checks: ExchangeGovernanceCheck[] = [];
    scanForbiddenMaterial(receipt, 'receipt', checks, BLOCKED_SECRET_KEYS);
    if (decision.state !== 'ready-for-transport-review') {
        addCheck(checks, 'error', 'receipt-decision-not-ready',
            'decision.state',
            'Receipt metadata cannot establish delivery for a blocked preflight decision.');
    }
    if (!['accepted', 'rejected', 'indeterminate'].includes(receipt.outcome)) {
        addCheck(checks, 'error', 'receipt-outcome-invalid',
            'receipt.outcome', 'The receipt outcome is not recognized.');
    }
    if (receipt.schemaVersion !== '1') {
        addCheck(checks, 'error', 'receipt-schema-version',
            'receipt.schemaVersion', 'Receipt evidence must use schema version 1.');
    }
    if (!IDEMPOTENCY_PATTERN.test(receipt.idempotencyKey)
        || receipt.idempotencyKey !== decision.idempotencyKey) {
        addCheck(checks, 'error', 'receipt-idempotency-mismatch',
            'receipt.idempotencyKey',
            'The receipt is not bound to this exchange intent.');
    }
    if (receipt.receiverTrustDigest
        !== decision.receiver.trustRecordDigest) {
        addCheck(checks, 'error', 'receipt-receiver-mismatch',
            'receipt.receiverTrustDigest',
            'The receipt is not bound to the reviewed receiver trust record.');
    }
    if (!validInstant(receipt.receivedAt)
        || Date.parse(receipt.receivedAt) < Date.parse(decision.generatedAt)
        || Date.parse(receipt.receivedAt) > Date.parse(reviewedAt)) {
        addCheck(checks, 'error', 'receipt-time-invalid',
            'receipt.receivedAt',
            'The receipt time is invalid or outside the review interval.');
    }
    if (!validDigest(receipt.responseDigest)
        || !validDigest(receipt.evidenceDigest)) {
        addCheck(checks, 'error', 'receipt-evidence-invalid',
            'receipt.responseDigest',
            'SHA-256 digests are required for the response and retained receipt evidence.');
    }
    if (receipt.serverAssignedReference !== undefined) {
        validateBoundedText(receipt.serverAssignedReference,
            'receipt.serverAssignedReference', checks, 500);
    }
    addCheck(checks, 'warning', 'receipt-authenticity-not-verified',
        'receipt',
        'P1.6 can match receipt metadata to an intent but does not verify a receiver signature or establish delivery.');

    return deepFreeze({
        schemaVersion: '1',
        reviewedAt,
        matchedToIntent: !checks.some(check => check.severity === 'error'),
        checks,
        receiverIdentityEstablished: false,
        deliveryEstablished: false,
        authenticityVerificationImplemented: false,
        networkActivity: 'none',
    });
};
