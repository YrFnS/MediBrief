import type { ReceiverValidationReport } from './receiverValidationTypes';
import type { FhirDocumentBundle } from './ipsTypes';

export type ExchangePurposeOfUse =
    | 'treatment'
    | 'payment'
    | 'healthcare-operations'
    | 'patient-request'
    | 'public-health'
    | 'research'
    | 'legal';

export type ExchangeDataClass = 'ips-summary';

export type ReceiverTrustStatus =
    | 'draft'
    | 'active'
    | 'suspended'
    | 'revoked'
    | 'entered-in-error';

export type ReceiverEnvironment = 'test' | 'production';

export type ReceiverAuthenticationMethod =
    | 'smart-backend-private-key-jwt'
    | 'mutual-tls'
    | 'signed-request'
    | 'none';

export interface ReceiverTrustRecord {
    schemaVersion: '1';
    id: string;
    version: string;
    status: ReceiverTrustStatus;
    receiverProfileId: string;
    receiverProfileVersion: string;
    organization: {
        identifier: string;
        display: string;
        jurisdiction?: string;
    };
    environment: ReceiverEnvironment;
    endpoint: string;
    authentication: {
        method: ReceiverAuthenticationMethod;
        registrationEstablished: boolean;
        registrationEvidenceDigest: string;
        authorizedScopes: string[];
        tokenEndpoint?: string;
        certificateEvidenceDigest?: string;
    };
    policyUri: string;
    capabilityEvidenceDigest: string;
    organizationTrustEvidenceDigest: string;
    allowedPurposes: ExchangePurposeOfUse[];
    allowedDataClasses: ExchangeDataClass[];
    approvedBy: {
        actorId: string;
        role: string;
    };
    approvedAt: string;
    expiresAt: string;
}

export type DisclosureAuthorizationStatus =
    | 'draft'
    | 'active'
    | 'revoked'
    | 'expired'
    | 'entered-in-error';

export type DisclosureAuthorizationSourceKind =
    | 'fhir-consent'
    | 'signed-document'
    | 'policy-rule'
    | 'patient-request';

export type DisclosureAuthorizerType =
    | 'patient'
    | 'representative'
    | 'policy-authority';

export type DisclosureVerificationMethod =
    | 'digital-signature'
    | 'wet-signature-attestation'
    | 'policy-evaluation'
    | 'direct-patient-request';

export interface DisclosureAuthorizationRecord {
    schemaVersion: '1';
    id: string;
    version: string;
    status: DisclosureAuthorizationStatus;
    patientId: string;
    receiverTrustId: string;
    receiverTrustVersion: string;
    receiverOrganizationIdentifier: string;
    action: 'disclose';
    purposeOfUse: ExchangePurposeOfUse;
    dataClasses: ExchangeDataClass[];
    legalBasisUri: string;
    policyUri: string;
    validFrom: string;
    validUntil: string;
    authorizationSource: {
        kind: DisclosureAuthorizationSourceKind;
        reference: string;
        digest: string;
    };
    authorizer: {
        actorType: DisclosureAuthorizerType;
        actorId: string;
        role?: string;
    };
    verification: {
        verified: boolean;
        verifiedAt: string;
        verifierId: string;
        method: DisclosureVerificationMethod;
        evidenceDigest: string;
    };
    revokedAt?: string;
}

export interface ExchangeRetryPolicy {
    schemaVersion: '1';
    maxAttempts: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    jitter: 'none';
}

export interface ExchangeReceiptEvidence {
    schemaVersion: '1';
    idempotencyKey: string;
    receiverTrustDigest: string;
    receivedAt: string;
    outcome: 'accepted' | 'rejected' | 'indeterminate';
    responseDigest: string;
    evidenceDigest: string;
    serverAssignedReference?: string;
}

export type ExchangeGovernanceCheckSeverity =
    | 'error'
    | 'warning'
    | 'information';

export interface ExchangeGovernanceCheck {
    severity: ExchangeGovernanceCheckSeverity;
    code: string;
    path: string;
    message: string;
}

export type ExchangePreflightState =
    | 'blocked'
    | 'ready-for-transport-review';

export type ExchangeGovernanceAuditEventType =
    | 'receiver-trust-reviewed'
    | 'disclosure-authorization-reviewed'
    | 'exchange-preflight-evaluated'
    | 'delivery-receipt-reviewed';

export interface ExchangeGovernanceAuditEntry {
    schemaVersion: '1';
    sequence: number;
    eventType: ExchangeGovernanceAuditEventType;
    recordedAt: string;
    outcome: 'pass' | 'fail';
    patientReferenceDigest: string;
    receiverTrustDigest: string;
    authorizationDigest: string;
    contentDigest: string;
    decisionDigest: string;
    previousEntryDigest?: string;
    entryDigest: string;
}

export interface ExchangeAuditChainVerification {
    valid: boolean;
    errors: string[];
}

export interface ExchangeReceiptReview {
    schemaVersion: '1';
    reviewedAt: string;
    matchedToIntent: boolean;
    checks: ExchangeGovernanceCheck[];
    receiverIdentityEstablished: false;
    deliveryEstablished: false;
    authenticityVerificationImplemented: false;
    networkActivity: 'none';
}

export interface ExchangePreflightDecision {
    schemaVersion: '1';
    generatedAt: string;
    state: ExchangePreflightState;
    decisionId: string;
    decisionDigest: string;
    patientReferenceDigest: string;
    receiver: {
        profileId: string;
        profileVersion: string;
        trustRecordId: string;
        trustRecordVersion: string;
        trustRecordDigest: string;
        organizationIdentifier: string;
        environment: ReceiverEnvironment;
    };
    authorization: {
        id: string;
        version: string;
        digest: string;
        purposeOfUse: ExchangePurposeOfUse;
        dataClasses: ExchangeDataClass[];
    };
    content: {
        documentDigest: string;
        receiverValidationDigest: string;
        bundleBytes: number;
        bundleEntries: number;
    };
    checks: ExchangeGovernanceCheck[];
    idempotencyKey: string;
    retryPolicy: ExchangeRetryPolicy;
    retryExecutionImplemented: false;
    receiptContract: {
        required: true;
        authenticityVerificationImplemented: false;
        receiverIdentityEstablishedByReceipt: false;
        deliveryEstablishedByReceipt: false;
    };
    auditEntry: ExchangeGovernanceAuditEntry;
    readyForIndependentTransportReview: boolean;
    transportAdapterAvailable: false;
    transportAuthorized: false;
    transmissionAttempted: false;
    receiverAcceptanceEstablished: false;
    patientIdentityMatchEstablished: false;
    clinicalValidationEstablished: false;
    networkActivity: 'none';
    limitations: string[];
}

export interface EvaluateExchangeGovernanceInput {
    patientId: string;
    document: FhirDocumentBundle;
    receiverValidationReport: ReceiverValidationReport;
    receiverTrustRecord: ReceiverTrustRecord;
    disclosureAuthorization: DisclosureAuthorizationRecord;
    purposeOfUse: ExchangePurposeOfUse;
    dataClasses?: ExchangeDataClass[];
    retryPolicy?: ExchangeRetryPolicy;
    previousAuditEntry?: ExchangeGovernanceAuditEntry;
    generatedAt?: string;
    receiverValidationMaxAgeMs?: number;
}
