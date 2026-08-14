# P1.4 Receiver-Specific Exchange Validation and Terminology Adapters

## Scope

P1.4 adds a fail-closed engineering comparison between a generated MediBrief
FHIR R4 IPS 2.0.1 document and a named receiver contract. It also defines
terminology-validation adapters whose public request type accepts coded tuples
only.

This slice does not transmit an IPS document, authenticate a destination,
authorize disclosure, match patient identity, or establish clinical truth.

## Repository dependency note

This implementation is based on the actual GitHub `main` branch at merge commit
`ab1ebe4d6abd2eff9206609e25e661509ef4c263`.

A previously described P1.3 atomic/source-preserving import completion is not
present on GitHub `main`, and the existing
`agent/p1-3-fhir-import-candidates` reference contains no implementation
changes. P1.4 therefore does not claim or depend on those missing changes.

## P1.4.1 Receiver contracts

- [x] Define versioned receiver contracts separately from the IPS publisher.
- [x] Pin the built-in contracts to FHIR R4 `4.0.1` and
  `hl7.fhir.uv.ips#2.0.1`.
- [x] Define accepted Bundle and Composition profiles.
- [x] Support required profiles by resource type.
- [x] Support optional Bundle byte and entry limits.
- [x] Support receiver terminology dispositions for unknown, invalid, and
  indeterminate code evidence.
- [x] Apply the receiver unknown-system policy before invoking a terminology
  adapter.
- [x] Keep receiver acceptance and transfer authorization outside the profile.

## P1.4.2 CapabilityStatement intake

- [x] Parse an uploaded FHIR CapabilityStatement locally.
- [x] Require `fhirVersion` and at least one declared format.
- [x] Recognize JSON and `application/fhir+json` support.
- [x] Read consumer document profiles.
- [x] Read server resource profile and `supportedProfile` declarations.
- [x] Record the canonical or implementation URL as evidence only.
- [x] Never contact an endpoint declared by an uploaded CapabilityStatement.
- [x] Report missing document/profile declarations as uncertainty rather than
  silently assuming support.

## P1.4.3 Deterministic receiver validation

- [x] Reuse the existing IPS structural validator.
- [x] Compare FHIR and IPS package versions.
- [x] Compare Bundle and Composition profiles.
- [x] Compare required and advertised resource profiles.
- [x] Report unadvertised resource types without treating absence as proof of
  rejection unless the receiver contract explicitly enforces it.
- [x] Enforce configured Bundle byte and entry limits.
- [x] Return only `ready`, `ready-with-warnings`, `indeterminate`, or
  `not-ready`.
- [x] Base reported network activity on actual adapter results rather than the
  adapter’s theoretical remote capability.
- [x] Set `transferAuthorized=false` in every report.
- [x] Set `receiverAcceptanceEstablished=false` in every report.
- [x] Set `clinicalValidationEstablished=false` in every report.

## P1.4.4 Governed terminology adapters

- [x] Define a coded-only request containing system, code, optional version,
  optional display, and optional value-set URL.
- [x] Exclude patient identifiers, notes, documents, source excerpts, free-text
  records, and clinical-resource objects from the adapter API.
- [x] Add a local reviewed-subset adapter for bounded LOINC and UCUM evidence.
- [x] Keep source-provided RxNorm and SNOMED CT evidence indeterminate when
  active content cannot be established locally.
- [x] Add a configured FHIR `CodeSystem/$validate-code` and
  `ValueSet/$validate-code` adapter.
- [x] Use FHIR R4 `version` for CodeSystem validation and `systemVersion` for
  the code-system version inside ValueSet validation.
- [x] Require HTTPS except for localhost development endpoints.
- [x] Reject endpoint credentials, query strings, and fragments.
- [x] Omit browser credentials and referrer information.
- [x] Reject redirects and redirected responses.
- [x] Bound timeout and response-body size configuration.
- [x] Require JSON-compatible responses and fail closed on oversized or
  malformed payloads.
- [x] Treat a positive FHIR response with a different system, code, or supplied
  version as indeterminate rather than valid.
- [x] Fail closed to `indeterminate` on timeout, network failure, non-success
  status, malformed JSON, oversized responses, or a response without a boolean
  result.
- [x] Add an NLM RxNorm properties adapter that sends only a numeric RxCUI in
  the URL path.
- [x] Require the returned RxCUI to match and keep version-specific historical
  validation indeterminate when only current active-content evidence is
  available.
- [x] Do not add medication-name search or fuzzy concept selection.
- [x] Include the requested NLM attribution boundary.

## P1.4.5 User interface

- [x] Add a receiver-validation center inside the unlocked application.
- [x] Select a built-in receiver contract.
- [x] Upload a CapabilityStatement for local comparison.
- [x] Generate the IPS document in memory and validate it locally.
- [x] Show receiver readiness, document size, entry count, terminology counts,
  and detailed findings.
- [x] Show `Network activity: None` for the shipped UI path.
- [x] State that validation is not transfer authorization.
- [x] Download a derived validation report without source documents.
- [x] Do not change the deployment CSP or add an active remote terminology UI.

## P1.4.6 Automated validation

- [x] Add unit tests for receiver profile, format, size, and terminology gates.
- [x] Add unit tests proving terminology requests omit unexpected patient and
  source fields.
- [x] Add endpoint-hardening and network-failure tests.
- [x] Add FHIR operation-version, response-identity, content-type, and
  response-size failure tests.
- [x] Add RxNorm identifier-only, current-active, historical-version, and
  response-size tests.
- [x] Add Chromium acceptance for local validation and CapabilityStatement
  intake.
- [x] Add a permanent P1.4 GitHub Actions workflow.
- [x] Add bounded retry handling for transient Playwright system-package mirror
  synchronization failures without skipping browser dependencies.
- [x] Pass focused P1.4 type-check, tests, regressions, and production build on
  the hardened branch implementation.
- [x] Pass the full MediBrief clinical regression on the hardened branch
  implementation.
- [x] Pass official FHIR R4 / IPS 2.0.1 validation on the hardened branch
  implementation.
- [x] Pass P2 terminology/multilingual and P3 prospective-foundation
  regressions on the hardened branch implementation.
- [ ] Pass Chromium safety-boundary acceptance on the final pull-request head.
- [ ] Review and merge through pull request #10.
- [ ] Pass post-merge validation on `main`.

## Deliberately deferred

- Receiver endpoint authentication and transport.
- Patient consent and disclosure authorization workflows.
- End-to-end testing with a real receiving organization.
- Persisted receiver-profile administration and signed trust records.
- Active remote terminology configuration in the production UI.
- Authenticated production terminology-server integration.
- Terminology expansion, subsumption, translation, and mapping operations.
- Receiver-specific national IPS derivatives.
- Digital signatures and source-authenticity verification.
- Reimplementation and validation of the missing P1.3 source-preserving atomic
  import slice.

## Evidence boundary

A `ready` or `ready-with-warnings` result means only that the generated document
matches the computable rules in the selected receiver contract under the
recorded terminology evidence. A CapabilityStatement is a declaration of
capabilities, not a guarantee of acceptance.

P1.4 does not prove that the destination is authentic, that the selected patient
matches the receiving record, that disclosure is permitted, that every clinical
fact is true, that terminology is used appropriately in context, or that a real
receiver will ingest and display the document correctly.
