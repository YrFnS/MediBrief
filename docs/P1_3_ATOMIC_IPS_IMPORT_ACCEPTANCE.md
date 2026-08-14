# P1.3 Atomic, Source-Preserving FHIR IPS Import

## Status

**Accepted, merged, and post-merge validated.**

- Implementation pull request: `#12`
- Final reviewed head: `3d9be9c5ce8608f89eecf6f3c014abf5150083ab`
- Squash merge on `main`: `3369b0753e1efa662688005a8dc95d2b076c314b`
- Validated merge/production source tree: `c5ec158b59aaca4833b797a7a76560da2207c220`

## Scope

P1.3 replaces MediBrief's former per-resource IPS import action with a staged,
fail-closed import transaction for FHIR R4 International Patient Summary
2.0.1 document Bundles.

The implementation preserves the exact UTF-8 source text presented to the
parser, derives a SHA-256 evidence identifier, limits candidate mapping to the
document graph reachable from the first Composition, verifies that supported
patient-scoped resources resolve to the Composition patient, requires explicit
human identity acknowledgement, and produces one fully validated replacement
patient record.

All imported clinical resources remain `candidate`. P1.3 does not establish
patient identity, source authenticity, clinical truth, consent, transfer
authorization, regulatory clearance, or receiver acceptance.

## Standards basis

The implementation follows the FHIR R4 document rules used by IPS:

- a document Bundle uses `Bundle.type = document`;
- the first Bundle entry is the Composition;
- the document consists of the Composition plus the resources directly or
  indirectly referenced from that Composition;
- document-local references must resolve unambiguously inside the Bundle;
- the Composition subject identifies the patient represented by the document.

The supported profile target remains FHIR R4 `4.0.1` with
`hl7.fhir.uv.ips#2.0.1`.

## P1.3.1 Exact source evidence

- [x] Preserve the exact decoded UTF-8 source text selected by the user rather
  than reserializing the parsed Bundle.
- [x] Record the UTF-8 byte length and SHA-256 digest before commit.
- [x] Limit protected source evidence to 2 MiB per import.
- [x] Recompute byte length and SHA-256 immediately before encryption.
- [x] Encrypt the complete source envelope with the active AES-GCM vault key.
- [x] Keep source text, file name, MIME type, digest, length, and timestamp
  inside the encrypted envelope.
- [x] Use an opaque SHA-256-derived IndexedDB key rather than a patient-linked
  plaintext database key.
- [x] Recompute and verify source length and digest after decryption.
- [x] Link every created candidate to one candidate `DocumentReference` source
  record.
- [x] Store the import receipt, source digest, graph evidence, identity-review
  evidence, and related candidate IDs in the source `DocumentReference`.
- [x] Route encrypted IPS sources through the existing portable backup asset
  contract.
- [x] Re-encrypt a restored IPS source under the currently unlocked local vault
  key.
- [x] Keep transient asset pruning away from durable encrypted IPS evidence.

### Source preservation boundary

The browser `File.text()` path preserves the exact decoded UTF-8 text presented
to the parser and hashes its UTF-8 representation. It does not claim to retain
an original non-UTF-8 encoding, filesystem metadata, detached signature, or the
original byte sequence before browser decoding.

## P1.3.2 Composition-reachable document graph

- [x] Require the first Bundle entry to be the Composition.
- [x] Index entries by exact `fullUrl` and FHIR resource type/ID.
- [x] Resolve direct, relative, absolute, and version-history references without
  guessing a target.
- [x] Traverse references from the Composition to build the reachable document
  graph.
- [x] Reject ambiguous reference resolution.
- [x] Require Composition subject to resolve to exactly one Patient entry.
- [x] Exclude unrelated Bundle entries from candidate mapping.
- [x] Retain excluded entries only inside the encrypted original source.
- [x] Report source entry count, reachable entry count, dropped entry count,
  and dropped supported resource types.
- [x] Preserve the existing structural IPS validator as the first gate.

## P1.3.3 Patient ownership and identity review

- [x] Validate the patient reference used by Condition, AllergyIntolerance,
  MedicationStatement, MedicationRequest, Procedure, Immunization,
  Observation, DiagnosticReport, and Specimen resources.
- [x] Reject a reachable supported resource whose patient reference resolves to
  a different Bundle patient.
- [x] Never overwrite the selected local patient profile from the IPS Patient.
- [x] Compare normalized display name, birth date, and identifiers.
- [x] Report identity evidence as `matched`, `mismatch`, or `insufficient`.
- [x] Require an explicit human acknowledgement for every import, including an
  apparent match.
- [x] Bind acknowledgement to the exact target patient and exact source SHA-256.
- [x] Invalidate the preview when the target clinical record changes before
  commit.
- [x] Record the acknowledgement timestamp and comparison state in the import
  receipt.

A `matched` comparison is not automatic identity proof. A `mismatch` or
`insufficient` comparison is visible to the user and can proceed only after the
same explicit acknowledgement; MediBrief does not silently merge identities.

## P1.3.4 Supporting-resource relationships

- [x] Resolve referenced Medication content to a coded Medication entry when a
  MedicationStatement or MedicationRequest uses `medicationReference`.
- [x] Reject unresolved, ambiguous, or uncoded referenced Medication content.
- [x] Do not perform medication-name search, fuzzy matching, or concept choice.
- [x] Preserve DiagnosticReport result and specimen references when both sides
  are included in the reachable graph.
- [x] Restore the reverse Observation-to-DiagnosticReport navigation link.
- [x] Preserve Procedure report references when supported report candidates are
  included.
- [x] Remap relationship IDs when a staged candidate is equivalent to an
  existing local candidate.
- [x] Validate the final relationship-bearing record with the clinical-record
  schema before replacement.

## P1.3.5 Candidate-only atomic record replacement

- [x] Build the complete candidate graph before changing the patient record.
- [x] Require every staged clinical resource to remain `candidate` and belong to
  the selected local patient.
- [x] Reject candidate and source-document ID collisions.
- [x] Detect equivalent local candidates before replacement.
- [x] Link a textually different source to existing equivalent candidates
  rather than duplicating the clinical graph.
- [x] Treat an identical source SHA-256 as an idempotent no-op.
- [x] Build one source `DocumentReference` and one complete replacement record.
- [x] Parse the complete replacement through the strict clinical-record schema.
- [x] Publish the clinical graph with one `replacePatientRecord` action.
- [x] Attempt one audit event for the complete import transaction; report audit
  failure without removing source evidence after record publication.
- [x] Never call the former per-candidate `addResource` loop from the user
  import path.

### Atomicity boundary

The clinical record graph is all-or-nothing: no candidate is published until
the complete replacement record validates. The encrypted source is written
first, then the single record replacement is performed. A synchronous
replacement failure triggers source cleanup. These are separate IndexedDB and
state-persistence systems, not one browser database transaction; an unexpected
process termination between the two operations can leave an unreferenced
encrypted source, but cannot leave a partially imported clinical graph.

Once the patient record is published, a later audit-write failure is reported
but cannot delete the preserved source or roll back only part of the graph.

## P1.3.6 User interface

- [x] Show source and reachable entry counts.
- [x] Show unrelated supported entries excluded from mapping.
- [x] Show the received and selected patient identity evidence side by side.
- [x] Show source byte length and SHA-256 before import.
- [x] Show graph safety errors and warnings.
- [x] Keep the import button disabled until the preview is commit-ready.
- [x] Keep the import button disabled until identity comparison is explicitly
  acknowledged.
- [x] Show that candidates remain unconfirmed after import.
- [x] Allow the preserved source to be reopened only after decryption and
  integrity verification.

## P1.3.7 Automated validation

- [x] Test Composition-reachable mapping and unrelated-entry exclusion.
- [x] Test exact source text, byte length, digest, and source links.
- [x] Test identity acknowledgement bound to patient and source.
- [x] Test one validated replacement record and unchanged original input
  record.
- [x] Test cross-patient reachable-resource rejection.
- [x] Test referenced Medication resolution without concept guessing.
- [x] Test stale-preview rejection.
- [x] Test identical-source idempotency.
- [x] Test textually different equivalent-source deduplication and relationship
  remapping.
- [x] Test the protected source-size limit.
- [x] Test ciphertext-only source-vault storage, integrity-checked recovery,
  backup export, deletion, restore, and re-encryption.
- [x] Test source substitution rejection after preview evidence is computed.
- [x] Add Chromium acceptance for graph exclusion, identity acknowledgement,
  one-record commit, and candidate-only status.
- [x] Inspect the source IndexedDB boundary in Chromium and require an opaque
  key plus ciphertext-only record shape.
- [x] Prove the source database row does not expose the file name, patient name,
  diagnosis, or source digest as plaintext fields.
- [x] Add a permanent P1.3 GitHub Actions workflow.
- [x] Pass the permanent P1.3 branch and pull-request workflows.
- [x] Pass full MediBrief clinical regression at the final implementation head.
- [x] Pass official FHIR R4 / IPS 2.0.1 validation on the pull-request merge
  reference.
- [x] Pass Chromium safety-boundary acceptance on the pull-request merge
  reference.
- [x] Pass P1.4 receiver/terminology, P1.5 named-receiver, P2 multilingual, and
  P3 prospective-validation regressions on the combined current-main merge
  reference.
- [x] Review and merge through pull request `#12`.
- [x] Pass all push-triggered post-merge validation on `main`.

## Final validation and merge evidence

The exact final implementation head
`3d9be9c5ce8608f89eecf6f3c014abf5150083ab` passed the pull-request gate matrix
against the then-current `main` line:

- `P1.3 Atomic Source-Preserving IPS Import`;
- `MediBrief Clinical Validation`;
- `P1 FHIR IPS Validation`, including the official FHIR R4 / IPS 2.0.1
  validator;
- `P1.4 Receiver and Terminology Validation`;
- `P1.5 HAPI Named Receiver Validation`;
- `P2 Terminology and Multilingual Validation`;
- `P3 Prospective Validation Foundation`;
- `P0 Browser Acceptance`, including encrypted source-database inspection,
  identity gating, Composition-reachable mapping, one-record commit, and live
  deployment-header/service-worker checks.

Pull request `#12` was squash-merged as
`3369b0753e1efa662688005a8dc95d2b076c314b`. The successful generated merge
reference and the squash merge resolve to the identical Git tree
`c5ec158b59aaca4833b797a7a76560da2207c220`.

The merge commit then passed every push-triggered workflow on `main`:

- `MediBrief Clinical Validation`;
- `P1.3 Atomic Source-Preserving IPS Import`;
- `P1 FHIR IPS Validation`;
- `P1.4 Receiver and Terminology Validation`;
- `P1.5 HAPI Named Receiver Validation`;
- `P2 Terminology and Multilingual Validation`;
- `P3 Prospective Validation Foundation`.

`P0 Browser Acceptance` is intentionally pull-request-only. Its successful
merge-reference evidence applies to the merged commit because the Git tree is
identical.

## Deployment boundary at acceptance closure

P1.3 is merged and fully validated but was not promoted to production during
this acceptance closure:

- the Vercel production target remained on prior `main` commit
  `3d56c3c56b7b97b4aad5a45758b02b27dac7b876`;
- Vercel rejected the final P1.3 head and squash merge because the account hit
  its deployment build-rate limit;
- Netlify skipped the exact final preview because account build usage was
  exceeded.

These are hosting-account limits, not application build, test, FHIR conformance,
or browser-acceptance failures. Production promotion remains an operational
step after hosting capacity is available.

## Deliberately deferred

- FHIR XML import.
- Arbitrary non-IPS FHIR transaction or collection Bundles.
- Automatic patient creation or automatic identity merge.
- Importing unsupported clinical resource types.
- Clinical confirmation without source review.
- Digital signatures, certificate trust, and source-authenticity verification.
- Consent, disclosure authorization, and receiver transport.
- Sources larger than the protected 2 MiB browser limit.
- Preservation of a pre-decoding non-UTF-8 byte stream.
- A single physical transaction spanning both the encrypted source database and
  the encrypted clinical-record persistence layer.

## Evidence boundary

Passing P1.3 validation means that MediBrief can preserve the reviewed UTF-8
source, compute and verify local evidence, restrict mapping to a deterministic
document graph, reject known patient-reference conflicts, stage supported
resources as candidates, and publish one schema-valid replacement record.

It does not prove that the document came from the claimed organization, that a
FHIR identifier belongs to the selected person, that every referenced fact is
complete or clinically correct, that terminology is appropriate in context,
that the user has permission to retain or disclose the document, or that any
receiving organization will accept it.
