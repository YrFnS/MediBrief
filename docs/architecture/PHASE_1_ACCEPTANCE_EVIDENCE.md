# Phase 1 Acceptance Evidence

## Purpose

This document records the repository-integrated evidence used to close MediBrief Phase 1 — Clinical Foundation.

The validation target is the branch:

- `agent/phase-1-clinical-foundation`

The automated workflow is:

- `.github/workflows/phase1-validation.yml`

The workflow runs on Node.js 24 and performs, in order:

1. dependency installation;
2. repository-wide TypeScript validation with `tsc --noEmit`;
3. the complete Vitest regression suite;
4. the Vite production build.

A failure in any step prevents the job from succeeding.

## Final automated result

The final Phase 1 validation run completed successfully with:

- TypeScript type-check: passed;
- test files: 14 passed out of 14;
- tests: 56 passed out of 56;
- production build: passed;
- transformed production modules: 986;
- build output generated successfully.

## Regression coverage

### Domain schemas and ownership

Covered by `tests/clinicalSchemas.test.ts`:

- explicitly unknown dates remain `null`;
- year, month, and day precision are accepted;
- malformed precision values are rejected;
- document extraction requires source-document provenance;
- patient aggregates reject resources belonging to another patient.

### Clinical date behavior

Covered by `tests/clinicalDates.test.ts` and store tests:

- month precision spans the full calendar month;
- year precision spans the full calendar year;
- partial dates participate correctly in range-overlap queries;
- unknown dates are never inserted into a clinical range using `recordedAt`;
- unknown dates are included only when explicitly requested.

### Clinical-record lifecycle

Covered by `tests/clinicalRecordStore.test.ts`:

- patient record initialization;
- candidate creation;
- edit-before-confirm;
- confirmation metadata;
- rejection metadata;
- amendment history and previous values;
- protection of reviewed history from hard deletion;
- entered-in-error reason requirement;
- confirmed-only default timeline behavior.

### Conservative duplicate handling

Covered by `tests/candidateDeduplication.test.ts`:

- equivalent candidates from the same stable source span are deduplicated;
- equivalent statements from independent documents remain separate assertions.

### Confirmed-only patient views

Covered by `tests/confirmedSelectors.test.ts`:

- candidates are excluded from confirmed summaries;
- rejected, negated, family-history, and hypothetical assertions are excluded;
- stopped medications are not active medications;
- absence of confirmed allergy records is not treated as `NKDA`;
- latest dated vital observations are selected;
- undated vital snapshots are excluded from current vital displays.

### Persistence contract

Covered by `tests/persistenceContract.test.ts`:

- clinical persistence has an explicit schema version;
- hydration remains deferred until the encrypted post-unlock flow;
- unsupported persistence versions fail closed;
- persisted patient aggregates are validated before acceptance.

### Legacy migration

Covered by `tests/legacyMigration.test.ts`:

- name, MRN, sex, document metadata, observations, units, and ranges are preserved;
- diagnosis, allergy, code status, age, weight, and legacy observations become reviewable candidates;
- date of birth and measurement dates are not invented;
- duplicate legacy strings collapse deterministically;
- repeated migration is idempotent;
- orphaned observation state is preserved in a reviewable synthetic patient record.

### Backup v2 and legacy import

Covered by `tests/backupSchemas.test.ts`, `tests/backupRoundTrip.test.ts`, and `tests/missingAssets.test.ts`:

- patient ownership and active-patient identity are cross-checked;
- patient-scoped maps cannot reference missing roster patients;
- every referenced asset must be embedded or declared missing;
- legacy v4.2 backups are converted into a validated v2 envelope before mutation;
- available file assets round-trip through the local asset vault;
- store and overwritten-asset snapshots are restored when apply fails;
- missing assets retain metadata and produce explicit unresolved-asset warnings.

### Source-document review

Covered by `tests/sourceDocuments.test.ts`:

- sources resolve by durable document-resource ID;
- sources resolve by stable local storage ID;
- source metadata remains available when the binary file is missing;
- image, embedded document, and download-only preview behavior is deterministic.

### Durable notes, tasks, and appointments

Covered by `tests/durableActions.test.ts` and `tests/chatDurability.test.ts`:

- appointment requests are `proposed`, not `booked`;
- unparseable appointment dates remain unknown;
- advisory follow-up is a proposal task, not an order;
- reviewed SOAP content becomes a durable clinical note;
- empty notes are rejected;
- notes, tasks, and appointment proposals survive chat clearing.

### Safe clinical semantics

Covered by `tests/clinicalSemantics.test.ts`:

- the disabled rule-engine compatibility entry point returns no automated conclusions;
- medication review returns label fields and limitations without `isSafe` or equivalent clearance;
- missing boxed-warning fields are not presented as proof of safety;
- unsupported `ACTION EXECUTED` and tool-execution wording remains absent;
- the image viewer does not claim PACS/DICOM workstation functionality or bone-window controls;
- only advisories explicitly marked `validated` can render in the active advisory interface.

## Defects found and corrected during P1.6

The new pipeline found issues that the previous deploy-only checks did not expose:

1. Zod-derived backup types became overly optional under the repository TypeScript configuration.
   - The backup contracts now use explicit application interfaces while retaining runtime Zod validation.
   - Parsed backup and legacy envelopes pass through typed boundary helpers.

2. Backup alert schemas lagged behind the corrected advisory model.
   - Backup validation now supports `create-task`, validation status, and source citation.

3. Source-document resolution logic lived only inside a React component.
   - It was moved into testable pure helpers used by the preview interface.

4. A semantic regression test initially expected stale display wording.
   - The assertion was aligned with the actual, more accurate `FDA label information` language.

## Build observations

The production build succeeds. Vite reports non-blocking optimization warnings:

- the main JavaScript chunk is larger than the default 500 kB warning threshold;
- some modules are both statically and dynamically imported;
- `/index.css` is resolved at runtime rather than at build time.

These warnings do not invalidate Phase 1 clinical correctness or data-integrity acceptance. Bundle splitting and performance optimization should be tracked as a separate application-performance workstream.

## Phase 1 conclusion

Phase 1 acceptance criteria are satisfied:

- the clinical record is structured and versioned;
- candidate and confirmed facts are separated;
- provenance and amendments are preserved;
- unknown dates remain unknown;
- legacy data migrates without silent loss;
- backup and restore are versioned and validated;
- notes, tasks, and appointment proposals are durable outside chat;
- unsupported execution, PACS, medication-safety, and automated-rule claims are removed or disabled;
- repository type-check, automated tests, and production build pass in CI.

Phase 2 can now build the complete personal health-record interface on this validated foundation.
