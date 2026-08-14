# P1.5 HAPI Public R4 Named Receiver Onboarding

## Status

Complete and merged through pull request #11 at main commit
`0fa690d8eb52ea9b57f844ee07128c504efac653`.

The exact merge commit passed post-merge P1.5, clinical, official FHIR/IPS,
terminology/multilingual, P1.4, and P3 validation. A live synthetic-only probe
then completed successfully against the HAPI FHIR Public R4 Test Server. The
probe created one nonclinical `Basic` resource in a transaction and confirmed
its deletion. No patient record or IPS document was transmitted.

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
- Live probe file: `evidence/hapi-public-r4-live-probe-2026-08-15.json`.
- Public endpoint authentication: none observed; this is not a production
  security model.
- IPS consumer profile: not advertised in either the reviewed or live evidence.
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
- [x] Bound response headers and streamed response bodies within the configured
  byte and time limits.
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

## P1.5.4 Automation and merge validation

- [x] Add unit tests for the pinned receiver and evidence snapshot.
- [x] Prove local validation remains `indeterminate` and network-free.
- [x] Prove disabled probing makes no network request.
- [x] Prove capability drift blocks the write.
- [x] Prove invalid timeout configuration blocks network use.
- [x] Prove oversized capability evidence blocks the write.
- [x] Prove oversized or malformed transaction responses still trigger cleanup.
- [x] Prove the successful mocked flow performs discovery, one Basic write, and
  cleanup only.
- [x] Add a permanent P1.5 GitHub Actions workflow.
- [x] Keep the normal live public probe behind explicit `workflow_dispatch`
  input.
- [x] Pass P1.5 branch validation.
- [x] Pass the existing MediBrief clinical, IPS, terminology, P3, and browser
  regressions on the pull-request merge reference.
- [x] Review and merge through pull request #11.
- [x] Pass post-merge P1.5 validation on `main`.

## P1.5.5 Live synthetic evidence

- [x] Pin the probe implementation to reviewed main commit
  `0fa690d8eb52ea9b57f844ee07128c504efac653`.
- [x] Confirm the live endpoint declares FHIR `4.0.1`, JSON, transaction,
  `Basic` update, and `Basic` delete support.
- [x] Confirm the live endpoint does not advertise an IPS consumer profile.
- [x] Receive `201 Created` for the single synthetic `Basic` transaction.
- [x] Receive cleanup status `200` for deletion of the probe resource.
- [x] Retain the PHI-free report in the repository and as a digest-addressed
  GitHub Actions artifact.
- [x] Remove the one-time trigger workflow after evidence capture; it is not
  present on `main`.

Live evidence identifiers:

- Workflow run: `31847229065`.
- Job: `94916024978`.
- Artifact: `9236312941`.
- Artifact digest:
  `sha256:e74f5843c337125af98e1cc492b9903012a9f0cf3257144a9cd0d4eb63290c89`.
- Probe generated at: `2026-08-14T22:36:01.916Z`.

## Explicitly not implemented

- Sending the selected patient or any locally generated IPS document.
- Receiver authentication, OAuth, SMART on FHIR, mTLS, or signed requests.
- Patient identity matching or MPI integration.
- Consent, disclosure authorization, purpose-of-use, or recipient approval.
- Audit-event delivery to a trusted external system.
- Retry queues, idempotent clinical delivery, delivery receipts, or
  reconciliation with a receiving EHR.
- Source signatures, provenance verification, or nonrepudiation.
- Receiver-side IPS rendering or clinical usability validation.
- Production receiver configuration.

## Safety and evidence boundary

A passing local HAPI profile report means only that a MediBrief IPS document
matches the computable local contract under the recorded evidence. Because the
public server does not advertise an IPS consumer profile, the result remains
`indeterminate`.

The successful live probe establishes only that the public test endpoint exposed
FHIR R4 discovery, accepted one nonclinical `Basic` transaction, and allowed the
probe resource to be removed at the recorded time. It does not establish IPS
ingestion, clinical rendering, durable storage, receiver identity, consent,
disclosure permission, patient matching, clinical truth, regulatory clearance,
or production readiness.
