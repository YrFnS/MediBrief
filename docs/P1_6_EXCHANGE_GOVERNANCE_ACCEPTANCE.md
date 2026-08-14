# P1.6 Local Exchange Governance and Disclosure Preflight

## Status

Implementation is present on the P1.6 feature branch. Branch validation,
pull-request review, merge-reference validation, merge, and post-merge
validation remain required.

## Objective

Add the fail-closed governance layer that must exist before a future transport
implementation can even be reviewed. P1.6 evaluates recipient trust,
disclosure authorization, receiver-validation freshness, current-document
binding, idempotency, append-only audit evidence, finite retry planning, and
receipt metadata entirely on the local device.

P1.6 does not authenticate a receiver, request a token, open a network
connection, queue a document, retry a delivery, receive a callback, or transmit
patient information. Its strongest result is `ready-for-transport-review`, not
permission to disclose and not permission to send.

## Standards boundary

The contracts are informed by the following standards while preserving their
limits:

- FHIR R4 Consent: `https://hl7.org/fhir/R4/consent.html`.
- FHIR R4 AuditEvent: `https://hl7.org/fhir/R4/auditevent.html`.
- FHIR R4 Provenance: `https://hl7.org/fhir/R4/provenance.html`.
- SMART Backend Services: `https://hl7.org/fhir/smart-app-launch/backend-services.html`.

A Consent record can describe permitted or denied recipients, actions,
purposes, data, and periods, but legal validity, source authenticity, and
policy enforcement remain domain-specific. AuditEvent and Provenance provide
models for accountability and evidence lineage, but P1.6 does not claim to
replace a trusted external audit repository or signature-verification service.
SMART backend access assumes prior organizational trust, registration, and
scoped authorization; P1.6 records derivative evidence of those prerequisites
but never stores or creates credentials.

## P1.6.1 Receiver trust contract

- [x] Define a stable receiver trust ID and explicit version.
- [x] Require active status and a production environment.
- [x] Bind trust to the exact receiver-profile ID and version used by local IPS
  validation.
- [x] Require a bounded organization identifier and display name.
- [x] Require a reviewed HTTPS endpoint without embedded credentials, query, or
  fragment.
- [x] Require a non-`none` authentication method.
- [x] Require out-of-band registration to be recorded as established.
- [x] Retain only SHA-256 digests of registration, capability, organization, and
  certificate evidence.
- [x] Require reviewed authorization scopes.
- [x] Require explicit allowed purposes of use and data classes.
- [x] Require an approver, approval time, and bounded expiry period.
- [x] Reject token, password, private-key, credential, and authorization-header
  material recursively.
- [x] Require an explicit receiver-specific production profile before any result
  can advance to transport review.
- [x] Block the generic IPS baseline, the strict terminology baseline, and the
  HAPI public R4 test profile even when a caller supplies self-asserted
  production-looking trust evidence.
- [x] Recompute the blocked decision digest and append-only audit evidence after
  the receiver-specific policy gate is applied.

## P1.6.2 Disclosure authorization contract

- [x] Define a stable authorization ID and explicit version.
- [x] Require active status and the explicit action `disclose`.
- [x] Bind the authorization to the selected local patient.
- [x] Bind it to the exact receiver-trust ID and version.
- [x] Bind it to the trusted organization identifier.
- [x] Require an exact purpose-of-use match.
- [x] Require an exact requested-data-class match.
- [x] Require stable policy and legal-basis identifiers.
- [x] Require a valid effective period and reject future, expired, or revoked
  evidence.
- [x] Retain only the source kind, bounded reference, and SHA-256 source digest;
  do not retain the Consent body or signed document.
- [x] Require an identified authorizer and independent verification record.
- [x] Retain only a digest of the verification evidence.
- [x] Reject embedded attachment, document, narrative, note, IPS Bundle,
  patient-demographic, and clinical-data fields recursively.

## P1.6.3 Current-document and receiver-report binding

- [x] Hash the current FHIR IPS Bundle locally with canonical JSON and SHA-256.
- [x] Hash the complete receiver-validation report locally.
- [x] Hash the receiver trust and disclosure authorization records locally.
- [x] Represent the local patient reference in derived reports only by digest.
- [x] Require receiver validation to be `ready` or `ready-with-warnings` and
  ready for manual transfer review.
- [x] Preserve the P1.4 non-authorizing receiver-report flags.
- [x] Require receiver validation to fall inside a bounded freshness window.
- [x] Compare Bundle bytes, entry count, and resource-type counts with the
  current document to detect report/document drift.
- [x] Generate a deterministic idempotency key from the governed exchange
  intent, excluding decision time.
- [x] Route the exported P1.6 evaluator through the receiver-specific policy
  gate rather than exposing the lower-level evidence evaluator as the product
  decision boundary.
- [x] Ensure the returned decision contains no IPS Bundle, clinical text,
  patient identifier, authorization source content, credentials, or receiver
  response body.

## P1.6.4 Append-only governance audit evidence

- [x] Add a separate PHI-minimized exchange-governance audit type instead of
  treating the existing mutable application audit store as disclosure-grade
  evidence.
- [x] Record only sequence, event type, time, outcome, and evidence digests.
- [x] Link each entry to the digest of the previous entry.
- [x] Recompute and verify every entry digest and chain link.
- [x] Reject a new entry when the supplied previous entry fails verification.
- [x] Freeze returned entries and decisions recursively in memory.
- [x] Detect changed outcomes, sequence drift, broken links, and digest
  tampering.

## P1.6.5 Retry and receipt contracts

- [x] Define a finite deterministic retry policy.
- [x] Limit attempts to one through five.
- [x] Bound initial delay, maximum delay, and backoff multiplier.
- [x] Calculate retry delays without executing retries.
- [x] Set `retryExecutionImplemented=false` in every decision.
- [x] Define PHI-free receipt metadata bound to the idempotency key and receiver
  trust digest.
- [x] Validate receipt time and SHA-256 evidence digests locally.
- [x] Match receipt metadata to an intent without treating it as authenticated
  delivery.
- [x] Set receiver identity, receipt authenticity, and delivery establishment
  to `false` in every receipt review.

## P1.6.6 Decision boundary

Every preflight returns only:

- `blocked`; or
- `ready-for-transport-review`.

Every result hard-codes:

```text
transportAdapterAvailable = false
transportAuthorized = false
transmissionAttempted = false
receiverAcceptanceEstablished = false
patientIdentityMatchEstablished = false
clinicalValidationEstablished = false
networkActivity = none
```

`ready-for-transport-review` requires an explicit receiver-specific production
contract plus the local evidence checks above. Generic IPS contracts, stricter
baseline contracts, and public test receivers can never produce that result.
Even for an explicit receiver-specific contract, the result does not mean that
disclosure is lawful, that the recipient is authentic, that patient identity
matches, or that a transport implementation may send the document.

## P1.6.7 Automation

- [x] Add tests for a valid local-only preflight using an explicit synthetic
  receiver-specific production contract.
- [x] Prove deterministic idempotency across decision times.
- [x] Prove the generic IPS baseline cannot advance.
- [x] Prove the strict terminology baseline cannot advance.
- [x] Prove the HAPI public test receiver cannot advance.
- [x] Prove the exported evaluator uses the receiver-specific policy gate and
  records a failed audit outcome for rejected baseline/test profiles.
- [x] Prove test, unauthenticated, unregistered, expired, recipient-mismatched,
  purpose-mismatched, revoked, and unverified evidence fails closed.
- [x] Prove embedded secrets and authorization-source content fail closed and
  are absent from the derived decision.
- [x] Prove stale receiver reports and report/document drift fail closed.
- [x] Prove audit-chain tampering is detected.
- [x] Prove retry planning is finite and executor-free.
- [x] Prove receipt matching never establishes authenticity or delivery.
- [x] Add a static test and CI check proving both the core evaluator and public
  receiver-specific policy layer have no fetch, XMLHttpRequest, WebSocket,
  beacon, authorization-header, token, or client assertion surface.
- [x] Add a permanent P1.6 GitHub Actions workflow.
- [ ] Pass P1.6 branch validation after the receiver-specific policy correction.
- [ ] Pass the existing MediBrief clinical, P1.3 atomic import, FHIR/IPS,
  terminology, P1.4, P1.5, P3, and browser regressions on the final
  pull-request merge reference.
- [ ] Review and merge through a pull request.
- [ ] Pass post-merge validation on `main`.

## Explicitly deferred

- Receiver authentication and credential custody.
- SMART token acquisition, private-key signing, mTLS handshakes, and certificate
  rotation.
- Patient matching, MPI lookup, or destination-side identity confirmation.
- Legal interpretation or enforcement of consent and policy.
- Digital-signature, certificate-chain, timestamp-authority, or source-document
  verification.
- A transport adapter, HTTP client, queue, worker, retry executor, callback, or
  send button.
- External AuditEvent or Provenance delivery.
- Receiver-signed acknowledgements and nonrepudiation.
- Delivery receipts, clinical rendering, reconciliation, or durable receiver
  storage.
- Production exchange with any healthcare organization.

## Safety and evidence boundary

P1.6 is a prerequisite evaluator, not a transfer subsystem. A passing preflight
means only that an explicit receiver-specific contract and local derivative
evidence are internally consistent under the recorded rules and current
document digest. It does not establish recipient identity, authorization
enforceability, patient matching, source authenticity, clinical truth,
successful delivery, regulatory compliance, or production readiness.
