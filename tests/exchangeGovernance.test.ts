import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    createClinicalProvenance,
    createPatientClinicalRecord,
    createRecordSource,
    type PatientClinicalRecord,
} from '../features/clinical-record';
import {
    appendExchangeGovernanceAuditEntry,
    buildIpsDocument,
    DEFAULT_EXCHANGE_RETRY_POLICY,
    evaluateExchangeGovernance,
    exchangeEvidenceDigest,
    exchangeRetryDelayMs,
    GENERIC_IPS_RECEIVER_PROFILE,
    HAPI_PUBLIC_R4_RECEIVER_PROFILE,
    isReceiverSpecificExchangeProfile,
    NON_RECEIVER_SPECIFIC_EXCHANGE_PROFILE_IDS,
    REVIEWED_CODING_IPS_RECEIVER_PROFILE,
    reviewExchangeReceipt,
    validateExchangeRetryPolicy,
    validateIpsForReceiver,
    verifyExchangeGovernanceAuditChain,
    type DisclosureAuthorizationRecord,
    type ExchangeGovernanceAuditEntry,
    type ReceiverExchangeProfile,
    type ReceiverTrustRecord,
} from '../features/fhir';

const NOW = '2026-08-15T12:00:00.000Z';
const LATER = '2026-08-15T13:00:00.000Z';
const PATIENT_ID = 'synthetic-governance-patient';
const DIGEST = (character: string): string =>
    `sha256:${character.repeat(64)}`;

const PRODUCTION_RECEIVER_PROFILE: ReceiverExchangeProfile = {
    ...GENERIC_IPS_RECEIVER_PROFILE,
    id: 'synthetic-production-ips-receiver',
    name: 'Synthetic production IPS receiver contract',
    version: '2026.1',
    sourceReference: 'urn:receiver-contract:synthetic-production-2026.1',
    capabilityWarnings: [],
    limitations: [
        'Synthetic receiver-specific contract used only by the P1.6 test suite.',
    ],
};

const syntheticRecord = (): PatientClinicalRecord => {
    const record = createPatientClinicalRecord({
        patientId: PATIENT_ID,
        displayName: 'Synthetic Governance Patient',
        dateOfBirth: { value: '1990-01-01', precision: 'day' },
        administrativeSex: 'unknown',
        preferredLanguage: 'en',
        now: NOW,
    });
    record.resources.conditions.push({
        id: 'governance-condition',
        patientId: PATIENT_ID,
        resourceType: 'Condition',
        verificationStatus: 'confirmed',
        recordedAt: NOW,
        provenance: createClinicalProvenance({
            source: createRecordSource({
                kind: 'manual',
                description: 'Synthetic P1.6 fixture',
            }),
            now: NOW,
            actor: 'test-suite',
        }),
        amendments: [],
        code: {
            text: 'Essential hypertension',
            coding: [{
                system: 'http://snomed.info/sct',
                version:
                    'http://snomed.info/sct/900000000000207008/version/20250701',
                code: '59621000',
                display: 'Essential hypertension',
            }],
        },
        clinicalStatus: 'active',
        onset: { value: '2024', precision: 'year' },
    });
    record.updatedAt = NOW;
    return record;
};

const trustRecord = (
    profile: ReceiverExchangeProfile = PRODUCTION_RECEIVER_PROFILE,
    updates: Partial<ReceiverTrustRecord> = {},
): ReceiverTrustRecord => ({
    schemaVersion: '1',
    id: 'trusted-receiver-1',
    version: '2026.1',
    status: 'active',
    receiverProfileId: profile.id,
    receiverProfileVersion: profile.version,
    organization: {
        identifier: 'urn:organization:trusted-receiver-1',
        display: 'Synthetic Trusted Receiver',
        jurisdiction: 'IQ-BG',
    },
    environment: 'production',
    endpoint: 'https://receiver.example/fhir',
    authentication: {
        method: 'smart-backend-private-key-jwt',
        registrationEstablished: true,
        registrationEvidenceDigest: DIGEST('a'),
        authorizedScopes: ['system/Bundle.cu'],
        tokenEndpoint: 'https://receiver.example/oauth/token',
    },
    policyUri: 'urn:policy:synthetic-disclosure-v1',
    capabilityEvidenceDigest: DIGEST('b'),
    organizationTrustEvidenceDigest: DIGEST('c'),
    allowedPurposes: ['treatment', 'patient-request'],
    allowedDataClasses: ['ips-summary'],
    approvedBy: {
        actorId: 'privacy-officer-1',
        role: 'privacy-officer',
    },
    approvedAt: '2026-08-14T09:00:00.000Z',
    expiresAt: '2027-08-14T09:00:00.000Z',
    ...updates,
});

const authorizationRecord = (
    trust: ReceiverTrustRecord,
    updates: Partial<DisclosureAuthorizationRecord> = {},
): DisclosureAuthorizationRecord => ({
    schemaVersion: '1',
    id: 'disclosure-authorization-1',
    version: '1',
    status: 'active',
    patientId: PATIENT_ID,
    receiverTrustId: trust.id,
    receiverTrustVersion: trust.version,
    receiverOrganizationIdentifier: trust.organization.identifier,
    action: 'disclose',
    purposeOfUse: 'treatment',
    dataClasses: ['ips-summary'],
    legalBasisUri: 'urn:legal-basis:synthetic-treatment',
    policyUri: trust.policyUri,
    validFrom: '2026-08-15T00:00:00.000Z',
    validUntil: '2026-08-16T00:00:00.000Z',
    authorizationSource: {
        kind: 'fhir-consent',
        reference: 'Consent/synthetic-consent-1',
        digest: DIGEST('d'),
    },
    authorizer: {
        actorType: 'patient',
        actorId: 'Patient/local-consenter',
    },
    verification: {
        verified: true,
        verifiedAt: '2026-08-15T08:00:00.000Z',
        verifierId: 'consent-verifier-1',
        method: 'digital-signature',
        evidenceDigest: DIGEST('e'),
    },
    ...updates,
});

const setup = async (
    profile: ReceiverExchangeProfile = PRODUCTION_RECEIVER_PROFILE,
) => {
    const document = buildIpsDocument(syntheticRecord(), NOW).bundle;
    const receiverValidationReport = await validateIpsForReceiver({
        bundle: document,
        receiver: profile,
        generatedAt: NOW,
    });
    const trust = trustRecord(profile);
    const authorization = authorizationRecord(trust);
    return { document, receiverValidationReport, trust, authorization };
};

describe('P1.6 receiver-specific local exchange governance', () => {
    it('can reach review readiness only for an explicit receiver-specific contract', async () => {
        const context = await setup();
        const first = await evaluateExchangeGovernance({
            patientId: PATIENT_ID,
            document: context.document,
            receiverValidationReport: context.receiverValidationReport,
            receiverTrustRecord: context.trust,
            disclosureAuthorization: context.authorization,
            purposeOfUse: 'treatment',
            generatedAt: NOW,
        });
        const second = await evaluateExchangeGovernance({
            patientId: PATIENT_ID,
            document: context.document,
            receiverValidationReport: context.receiverValidationReport,
            receiverTrustRecord: context.trust,
            disclosureAuthorization: context.authorization,
            purposeOfUse: 'treatment',
            generatedAt: LATER,
        });

        expect(isReceiverSpecificExchangeProfile(
            PRODUCTION_RECEIVER_PROFILE.id,
        )).toBe(true);
        expect(first.state).toBe('ready-for-transport-review');
        expect(first.readyForIndependentTransportReview).toBe(true);
        expect(first.idempotencyKey).toBe(second.idempotencyKey);
        expect(first.decisionDigest).not.toBe(second.decisionDigest);
        expect(first.transportAdapterAvailable).toBe(false);
        expect(first.transportAuthorized).toBe(false);
        expect(first.transmissionAttempted).toBe(false);
        expect(first.receiverAcceptanceEstablished).toBe(false);
        expect(first.patientIdentityMatchEstablished).toBe(false);
        expect(first.clinicalValidationEstablished).toBe(false);
        expect(first.networkActivity).toBe('none');
        expect(first.retryExecutionImplemented).toBe(false);
        expect(Object.isFrozen(first)).toBe(true);
        expect(Object.isFrozen(first.auditEntry)).toBe(true);

        const serialized = JSON.stringify(first);
        expect(serialized).not.toContain(PATIENT_ID);
        expect(serialized).not.toContain('Synthetic Governance Patient');
        expect(serialized).not.toContain('Consent/synthetic-consent-1');
        expect(serialized).not.toContain('Essential hypertension');
        expect(serialized).not.toContain('privateKey');
        expect(serialized).not.toContain('accessToken');
    });

    it.each([
        ['generic IPS baseline', GENERIC_IPS_RECEIVER_PROFILE],
        ['strict terminology baseline', REVIEWED_CODING_IPS_RECEIVER_PROFILE],
        ['HAPI public R4 test server', HAPI_PUBLIC_R4_RECEIVER_PROFILE],
    ] as const)('blocks the %s even with self-asserted production trust', async (
        _label,
        profile,
    ) => {
        const context = await setup(profile);
        const decision = await evaluateExchangeGovernance({
            patientId: PATIENT_ID,
            document: context.document,
            receiverValidationReport: context.receiverValidationReport,
            receiverTrustRecord: context.trust,
            disclosureAuthorization: context.authorization,
            purposeOfUse: 'treatment',
            generatedAt: LATER,
        });

        expect(NON_RECEIVER_SPECIFIC_EXCHANGE_PROFILE_IDS)
            .toContain(profile.id as typeof NON_RECEIVER_SPECIFIC_EXCHANGE_PROFILE_IDS[number]);
        expect(isReceiverSpecificExchangeProfile(profile.id)).toBe(false);
        expect(decision.state).toBe('blocked');
        expect(decision.readyForIndependentTransportReview).toBe(false);
        expect(decision.checks.some(check =>
            check.code === 'receiver-profile-not-specific'
            || check.code === 'receiver-profile-non-production')).toBe(true);
        expect(decision.transportAuthorized).toBe(false);
        expect(decision.transmissionAttempted).toBe(false);
        expect(decision.auditEntry.outcome).toBe('fail');
    });

    it('fails closed for mismatched, stale, revoked, unverified, and secret-bearing evidence', async () => {
        const context = await setup();
        const brokenTrust = {
            ...context.trust,
            environment: 'test',
            clientSecret: 'must-never-be-retained',
            authentication: {
                ...context.trust.authentication,
                method: 'none',
                registrationEstablished: false,
            },
            expiresAt: '2026-08-15T11:00:00.000Z',
        } as ReceiverTrustRecord;
        const brokenAuthorization = {
            ...authorizationRecord(brokenTrust),
            patientId: 'another-patient',
            receiverOrganizationIdentifier: 'another-organization',
            purposeOfUse: 'research',
            status: 'revoked',
            revokedAt: '2026-08-15T10:00:00.000Z',
            note: 'The source document must never be copied here.',
            verification: {
                ...context.authorization.verification,
                verified: false,
            },
        } as DisclosureAuthorizationRecord;
        const staleAndMismatched = {
            ...context.receiverValidationReport,
            generatedAt: '2026-08-01T00:00:00.000Z',
            summary: {
                ...context.receiverValidationReport.summary,
                bundleEntries:
                    context.receiverValidationReport.summary.bundleEntries + 1,
            },
        };
        const decision = await evaluateExchangeGovernance({
            patientId: PATIENT_ID,
            document: context.document,
            receiverValidationReport: staleAndMismatched,
            receiverTrustRecord: brokenTrust,
            disclosureAuthorization: brokenAuthorization,
            purposeOfUse: 'treatment',
            generatedAt: LATER,
            receiverValidationMaxAgeMs: 60 * 60_000,
        });

        expect(decision.state).toBe('blocked');
        for (const code of [
            'trust-not-production',
            'authentication-missing',
            'registration-not-established',
            'trust-expired',
            'authorization-not-active',
            'authorization-patient-mismatch',
            'authorization-recipient-mismatch',
            'authorization-purpose-mismatch',
            'authorization-revoked',
            'authorization-not-verified',
            'receiver-validation-stale',
            'receiver-report-document-mismatch',
            'forbidden-field',
        ]) {
            expect(decision.checks.some(check => check.code === code), code)
                .toBe(true);
        }
        const serialized = JSON.stringify(decision);
        expect(serialized).not.toContain('must-never-be-retained');
        expect(serialized).not.toContain('source document');
    });
});

describe('P1.6 audit, retry, receipt, and transport boundaries', () => {
    it('detects audit tampering and keeps retry planning finite', async () => {
        const context = await setup();
        const patientReferenceDigest = await exchangeEvidenceDigest({
            kind: 'local-patient-reference',
            value: PATIENT_ID,
        });
        const receiverTrustDigest = await exchangeEvidenceDigest(context.trust);
        const authorizationDigest = await exchangeEvidenceDigest(
            context.authorization,
        );
        const contentDigest = await exchangeEvidenceDigest(context.document);
        const first = await appendExchangeGovernanceAuditEntry({
            eventType: 'receiver-trust-reviewed',
            recordedAt: NOW,
            outcome: 'pass',
            patientReferenceDigest,
            receiverTrustDigest,
            authorizationDigest,
            contentDigest,
            decisionDigest: DIGEST('f'),
        });
        const second = await appendExchangeGovernanceAuditEntry({
            eventType: 'disclosure-authorization-reviewed',
            recordedAt: LATER,
            outcome: 'pass',
            patientReferenceDigest,
            receiverTrustDigest,
            authorizationDigest,
            contentDigest,
            decisionDigest: DIGEST('f'),
            previousAuditEntry: first,
        });
        expect(await verifyExchangeGovernanceAuditChain([first, second]))
            .toEqual({ valid: true, errors: [] });

        const tampered = [{ ...first }, { ...second }];
        (tampered[1] as ExchangeGovernanceAuditEntry).outcome = 'fail';
        expect((await verifyExchangeGovernanceAuditChain(tampered)).valid)
            .toBe(false);
        expect(JSON.stringify([first, second])).not.toContain(PATIENT_ID);

        expect(validateExchangeRetryPolicy(DEFAULT_EXCHANGE_RETRY_POLICY)
            .some(check => check.severity === 'error')).toBe(false);
        expect(exchangeRetryDelayMs(DEFAULT_EXCHANGE_RETRY_POLICY, 2))
            .toBe(30_000);
        expect(exchangeRetryDelayMs(DEFAULT_EXCHANGE_RETRY_POLICY, 3))
            .toBe(60_000);
        expect(validateExchangeRetryPolicy({
            ...DEFAULT_EXCHANGE_RETRY_POLICY,
            maxAttempts: 999,
        }).some(check => check.code === 'retry-attempts-invalid')).toBe(true);
    });

    it('matches receipt metadata without establishing identity, authenticity, or delivery', async () => {
        const context = await setup();
        const decision = await evaluateExchangeGovernance({
            patientId: PATIENT_ID,
            document: context.document,
            receiverValidationReport: context.receiverValidationReport,
            receiverTrustRecord: context.trust,
            disclosureAuthorization: context.authorization,
            purposeOfUse: 'treatment',
            generatedAt: NOW,
        });
        const review = await reviewExchangeReceipt({
            decision,
            reviewedAt: LATER,
            receipt: {
                schemaVersion: '1',
                idempotencyKey: decision.idempotencyKey,
                receiverTrustDigest: decision.receiver.trustRecordDigest,
                receivedAt: '2026-08-15T12:30:00.000Z',
                outcome: 'accepted',
                responseDigest: DIGEST('1'),
                evidenceDigest: DIGEST('2'),
                serverAssignedReference: 'Bundle/receiver-assigned-id',
            },
        });

        expect(review.matchedToIntent).toBe(true);
        expect(review.receiverIdentityEstablished).toBe(false);
        expect(review.deliveryEstablished).toBe(false);
        expect(review.authenticityVerificationImplemented).toBe(false);
        expect(review.networkActivity).toBe('none');
        expect(review.checks.some(check =>
            check.code === 'receipt-authenticity-not-verified')).toBe(true);
    });

    it('contains no transport primitive or credential-bearing request surface', () => {
        const core = readFileSync(new URL(
            '../features/fhir/exchangeGovernance.ts',
            import.meta.url,
        ), 'utf8');
        const policy = readFileSync(new URL(
            '../features/fhir/exchangeGovernancePolicy.ts',
            import.meta.url,
        ), 'utf8');
        const index = readFileSync(new URL(
            '../features/fhir/index.ts',
            import.meta.url,
        ), 'utf8');

        for (const source of [core, policy]) {
            for (const forbidden of [
                'fetch(',
                'XMLHttpRequest',
                'WebSocket',
                'sendBeacon',
                'Authorization:',
                'access_token',
                'client_assertion',
            ]) {
                expect(source).not.toContain(forbidden);
            }
        }
        expect(index).toContain(
            "evaluateExchangeGovernance,\n    isReceiverSpecificExchangeProfile",
        );
        expect(policy).toContain("state: 'blocked' as const");
        expect(policy).toContain("outcome: 'fail'");
    });
});
