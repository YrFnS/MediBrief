# P1.5 HAPI Public R4 Named Receiver Onboarding

## Status

Implementation complete on the P1.5 feature branch. Merge and post-merge
validation remain required.

## Objective

Onboard one named, documented FHIR R4 receiver as a bounded engineering target
without enabling patient-record transmission. The selected target is the HAPI
FHIR Public R4 Test Server.

This server is used only because it exposes public FHIR R4 capability discovery
and transaction behavior suitable for synthetic interoperability checks. It is
not a healthcare organization, trusted destination, production endpoint, or
clinical receiver.

## Reviewed receiver evidence

- Receiver: HAPI FHIR Public R4 Test Server.
- FHIR base: `https://hapi.fhir.org/baseR4`.
- CapabilityStatement: `https://hapi.fhir.org/baseR4/metadata`.
- FHIR version: `4.0.1`.
- Reviewed evidence snapshot: `hapi-public-r4-2026-08-15`.
- Contract file: `evidence/hapi-public-r4-receiver-evidence.json`.
- Public endpoint authentication: none observed; this is not a production
  security model.
- IPS consumer profile: not advertised in the reviewed evidence.
- Receiver compatibility conclusion: `indeterminate`.

## P1.5.1 Pinned receiver profile

- [x] Add a named `HAPI_PUBLIC_R4_RECEIVER_PROFILE`.
- [x] Pin the MediBrief review version to `2026-08-15`.
- [x] Keep FHIR R4 `4.0.1` and IPS `2.0.1` explicit.
- [x] Record the reviewed capability URL as evidence.
- [x] Record IPS-relevant resource types observed in the public R4 endpoint.
- [x] Preserve capability uncertainty because no IPS consumer document profile
  or successful IPS rendering is established.
- [x] Add the receiver to the existing local receiver-validation selector.
- [x] Keep local validation non-authorizing and network-free.

## P1.5.2 Evidence and drift boundary

- [x] Retain a PHI-free reviewed evidence snapshot in the repository.
- [x] Distinguish authoritative project/server documentation from MediBrief
  engineering conclusions.
- [x] Record that the public server is mutable and regularly purged.
- [x] Require fresh live capability discovery before any synthetic write.
- [x] Fail closed on FHIR-version, JSON, transaction, Basic-update, or
  Basic-delete capability drift.
- [x] Do not infer receiver identity, durability, clinical rendering, consent,
  or authorization from a CapabilityStatement.

## P1.5.3 Synthetic-only live probe

- [x] Add a standalone Node.js probe with a fixed HAPI endpoint.
- [x] Disable live probing by default.
- [x] Require `MEDIBRIEF_ALLOW_PUBLIC_SYNTHETIC_PROBE=true`.
- [x] Accept no patient, file, clinical record, IPS Bundle, arbitrary endpoint,
  or arbitrary payload input.
- [x] Send exactly one hard-coded nonclinical `Basic` resource in a transaction
  Bundle.
- [x] Validate the payload recursively before network use.
- [x] Prohibit Patient, Composition, Observation, Condition, medication,
  diagnostic, document, and other clinical resource types.
- [x] Bound metadata and transaction response sizes.
- [x] Omit browser credentials and referrer information and reject redirects.
- [x] Delete the deterministic Basic resource after the transaction attempt.
- [x] Treat unconfirmed cleanup as probe failure.
- [x] Return a PHI-free report with all authorization and clinical claims set to
  `false`.

## P1.5.4 Automation

- [x] Add unit tests for the pinned receiver and evidence snapshot.
- [x] Prove local validation remains `indeterminate` and network-free.
- [x] Prove disabled probing makes no network request.
- [x] Prove capability drift blocks the write.
- [x] Prove the successful mocked flow performs discovery, one Basic write, and
  cleanup only.
- [x] Add a permanent P1.5 GitHub Actions workflow.
- [x] Keep the live public probe behind explicit `workflow_dispatch` input.
- [ ] Pass branch validation.
- [ ] Pass the existing MediBrief clinical, IPS, terminology, P3, and browser
  regressions on the pull-request merge reference.
- [ ] Review and merge through a pull request.
- [ ] Pass post-merge P1.5 validation on `main`.

## Explicitly not implemented

- Sending the selected patient or any locally generated IPS document.
- Receiver authentication, OAuth, SMART on FHIR, mTLS, or signed requests.
- Patient identity matching or MPI integration.
- Consent, disclosure authorization, purpose-of-use, or recipient approval.
- Audit-event delivery to a trusted external system.
- Retry queues, idempotent clinical delivery, delivery receipts, or
  reconciliation with a receiving EHR.
- Source signatures, provenance verification, or nonrepudiation.
- Production receiver configuration.

## Safety and evidence boundary

A passing local HAPI profile report means only that a MediBrief IPS document
matches the computable local contract under the recorded evidence. Because the
public server does not advertise an IPS consumer profile, the result remains
`indeterminate`.

A passing live probe means only that the public test endpoint currently exposes
FHIR R4 discovery, accepts one nonclinical Basic transaction, and allowed the
probe resource to be removed. It does not establish IPS ingestion, clinical
rendering, durable storage, receiver identity, consent, disclosure permission,
patient matching, clinical truth, regulatory clearance, or production
readiness.
