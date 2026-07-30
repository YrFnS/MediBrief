# MediBrief Clinical Rebuild Plan

> Living implementation plan for turning MediBrief from a polished medical-AI prototype into a dependable local personal medical-record and document-assistance application.
>
> **Branch:** `agent/phase-1-clinical-foundation`  
> **Started:** 2026-07-30  
> **Current phase:** Phase 1 — Clinical Foundation  
> **Current implementation focus:** P1.6 — repository-integrated tests and acceptance evidence  
> **Primary focus:** Clinical correctness, durable structured records, traceability, and safe human review  
> **Explicitly outside this roadmap:** Security hardening and regulatory certification

## How to use this file

- Update this document with every meaningful implementation slice.
- Mark work complete only when its acceptance criteria are met.
- Preserve completed tasks and architectural decisions so the history remains reviewable.
- Keep validation evidence separate from assumptions.
- Do not treat a successful UI build as a substitute for clinical regression tests.

### Status legend

- `[ ]` Not started
- `[-]` In progress
- `[x]` Complete
- `[!]` Blocked or intentionally deferred

---

# Product direction

MediBrief is being repositioned as a **local personal health record and medical-document assistant**, not a simulated hospital order-entry system or autonomous clinical decision maker.

The target product should provide:

1. A durable longitudinal health record.
2. Source-linked extraction from medical documents.
3. Human confirmation before extracted facts enter the confirmed record.
4. Clear separation between facts, candidates, advisories, tasks, appointments, orders, and completed actions.
5. AI assistance grounded in confirmed patient data.
6. Exportable and interoperable clinical information.
7. Explicit uncertainty when dates, values, provenance, or patient context are missing.

---

# Roadmap overview

## Phase 1 — Clinical Foundation

**Goal:** Replace the observation-only and string-based patient model with a versioned, traceable clinical record while preserving the current application shell.

Status: `[-] In progress`

## Phase 2 — Personal Health Record Interface

**Goal:** Build first-class screens for overview, timeline, conditions, medications, allergies, labs, visits, procedures, immunizations, documents, appointments, notes, tasks, and emergency summary.

Status: `[ ] Not started`

## Phase 3 — OpenMed Extraction Integration

**Goal:** Use OpenMed as a local candidate-extraction and clinical-context layer with negation, certainty, temporality, experiencer, terminology suggestions, relations, and source offsets.

Status: `[ ] Not started`

## Phase 4 — Laboratory and Diagnostic Report Pipeline

**Goal:** Represent complete reports, panels, specimens, qualitative results, comparators, original and normalized units, corrected results, and source-linked verification.

Status: `[ ] Not started`

## Phase 5 — Grounded Assistance and Validated Rules

**Goal:** Reintroduce summaries, medication reconciliation, trend explanations, reminders, and carefully validated decision-support rules on top of the confirmed record.

Status: `[ ] Not started`

---

# Phase 1 — Clinical Foundation

## Phase 1 principles

- Chat is not the medical record.
- AI output is never automatically a confirmed clinical fact.
- Unknown values remain unknown; they are not replaced with convenient defaults.
- Original values and normalized values are both preserved.
- Every imported or extracted fact records where it came from.
- Clinical status and verification status are separate concepts.
- A suggestion is not an order.
- An acknowledgement is not treatment.
- A task is not a completed action.
- A local appointment proposal is not a clinic booking.
- Existing user data must migrate without silently disappearing.
- Internal models should be FHIR-inspired without requiring a FHIR server.

## P1.0 — Planning and baseline

Status: `[x] Complete`

- [x] Create a dedicated Phase 1 branch.
- [x] Add this living roadmap.
- [x] Record the original clinical-data limitations.
- [x] Add an architecture note describing the old and target record flows.
- [x] Add a compatibility inventory of components consuming the original stores.

### Original baseline limitations

- The structured store primarily persisted `Observation[]` plus alerts.
- Diagnoses, allergies, and code status were unverified strings on patient metadata.
- Age was persisted directly instead of being derived from date of birth.
- Weight was static demographics rather than a dated observation.
- Documents had minimal metadata and weak links to extracted facts.
- Appointments and actions were represented mainly as chat messages.
- The scribe committed formatted chat text rather than a durable clinical note.
- Import/export was permissive and tied to the legacy composite shape.
- Deterministic rules overstated what isolated measurements could prove.

## P1.1 — Shared clinical domain model

Status: `[x] Complete`

### Foundation contracts

- [x] Add versioned record-schema constants.
- [x] Add stable identifiers and timestamps.
- [x] Add `RecordSource` and source-document references.
- [x] Add `ClinicalProvenance` metadata.
- [x] Add verification states:
  - `candidate`
  - `confirmed`
  - `rejected`
  - `entered-in-error`
- [x] Add assertion context:
  - polarity and negation
  - certainty
  - temporality
  - experiencer
- [x] Add amendment and correction metadata.
- [x] Add original-versus-normalized value contracts.
- [x] Add known, partial, and explicitly unknown clinical dates.

### Core resources

- [x] Add `PatientProfileRecord` with date of birth and identifiers.
- [x] Add `EncounterRecord`.
- [x] Add `ConditionRecord`.
- [x] Add `AllergyIntoleranceRecord`.
- [x] Add `MedicationRecord`.
- [x] Add `ObservationRecord`.
- [x] Add `DiagnosticReportRecord`.
- [x] Add `SpecimenRecord`.
- [x] Add `ProcedureRecord`.
- [x] Add `ImmunizationRecord`.
- [x] Add `AppointmentRecord`.
- [x] Add `ClinicalTaskRecord`.
- [x] Add `CarePlanRecord`.
- [x] Add expanded `DocumentReferenceRecord`.
- [x] Add `ClinicalNoteRecord` with draft, final, amended, and entered-in-error states.

### Design requirements

- [x] No resource requires an AI interpretation to remain useful.
- [x] Resources support manual entry without a source document.
- [x] Extracted resources preserve document, page, section, excerpt, and text offsets when available.
- [x] Missing event dates are never replaced with the current date.
- [x] Resource types are serializable and schema-validated.

## P1.2 — Versioned clinical-record store

Status: `[x] Complete`

- [x] Introduce a patient-scoped clinical-record aggregate.
- [x] Keep durable clinical resources separate from transient alerts.
- [x] Add typed CRUD actions for every resource collection.
- [x] Add candidate confirmation and rejection actions.
- [x] Add correction and amendment actions without overwriting history.
- [x] Add lookup by patient, source, type, verification status, and date.
- [x] Add deterministic timeline sorting.
- [x] Add conservative candidate duplicate detection.
- [x] Add versioned persistence and strict hydration validation.
- [x] Join the existing encrypted post-unlock hydration flow.
- [x] Protect confirmed, rejected, and entered-in-error history from hard deletion.
- [x] Require a reason before marking a resource entered in error.

### P1.2 implementation notes

- The store uses `records: Record<patientId, PatientClinicalRecord>`.
- Timelines default to confirmed resources.
- Unknown dates are not placed into clinical date ranges using `recordedAt`.
- Candidate deduplication requires stable source identity.
- Similar facts from independent documents remain separate assertions.
- Writes validate the resulting resource and complete patient aggregate.
- Persistence uses the existing encrypted IndexedDB adapter.

## P1.3 — Candidate review and confirmed-only views

Status: `[x] Complete`

- [x] Use the shared clinical-resource shape as the generic candidate contract.
- [x] Distinguish candidates through `verificationStatus`.
- [x] Add source preview metadata.
- [x] Add confirm and reject lifecycle actions.
- [x] Support edit-before-confirm.
- [x] Support rejection comments.
- [x] Support later corrections without destroying history.
- [x] Record extraction engine, model, prompt version, timestamp, and confidence.
- [x] Keep model confidence separate from clinical certainty.
- [x] Exclude candidates from confirmed timelines and summaries.
- [x] Add a reusable patient-scoped candidate-review interface.
- [x] Make the HUD read confirmed structured resources only.
- [x] Add source-document preview navigation.
- [x] Stop entity extraction from directly merging facts into legacy strings.
- [x] Register uploaded files as confirmed document references while keeping extracted claims as candidates.
- [x] Add audit events for candidate edits, confirmation, rejection, and source viewing.
- [x] Dual-write reviewed numeric lab rows to the structured record during compatibility migration.

### P1.3 implementation notes

- `features/clinical-record/selectors.ts` centralizes confirmed-only eligibility.
- Negated, family-history, and hypothetical assertions do not appear as current patient facts.
- Empty allergy data displays `Allergy status unknown`, not `NKDA`.
- Images, PDFs, text, and JSON sources can be previewed from the local asset vault.
- Missing source files remain explicit rather than being fabricated.
- See `docs/architecture/CANDIDATE_REVIEW_AND_CONFIRMED_VIEWS.md`.

## P1.4 — Migration, backup, and compatibility

Status: `[x] Complete`

- [x] Define clinical-record and export-format versions.
- [x] Define and validate portable MediBrief backup v2.
- [x] Build deterministic migration from legacy patient metadata and observations.
- [x] Convert legacy diagnoses and allergies into reviewable candidates.
- [x] Preserve chat history and uploaded document references.
- [x] Preserve existing observations with original values and limited provenance.
- [x] Preserve age as a snapshot and weight as an undated observation.
- [x] Never silently mark migrated AI-derived facts as confirmed.
- [x] Continue importing legacy v4.2 backups.
- [x] Export clinical resources, provenance, candidates, amendments, chats, and compatibility state.
- [x] Embed available uploaded-file payloads and list missing payloads.
- [x] Strip temporary object URLs while retaining stable file references.
- [x] Add pre-apply validation, snapshots, and rollback on restore failure.
- [x] Run idempotent migration after encrypted stores rehydrate.
- [x] Keep legacy stores intact during the dual-read period.

### P1.4 implementation notes

- Migrated clinical assertions use `verificationStatus: candidate`.
- Uploaded-document existence can be confirmed while its clinical content remains unconfirmed.
- Deterministic migrated IDs prevent repeated unlock-time duplicates.
- Legacy backups are converted and validated in memory before live state changes.
- Backup restore never invents unavailable file contents.
- See `docs/architecture/BACKUP_V2_AND_LEGACY_MIGRATION.md`.

## P1.5 — Durable actions and accurate clinical semantics

Status: `[x] Complete`

- [x] Remove `ACTION EXECUTED` language where no completed action exists.
- [x] Represent suggestions as suggestions.
- [x] Represent acknowledgements as acknowledgements.
- [x] Save appointment requests as durable `AppointmentRecord` proposals.
- [x] State clearly that local appointment proposals are not clinic bookings.
- [x] Save advisory follow-up items as durable proposal tasks, not orders.
- [x] Save reviewed ambient-scribe output as durable `ClinicalNoteRecord` resources.
- [x] Keep chat notifications secondary to the durable note, task, or appointment record.
- [x] Rename the simple image viewer and state that it is not a DICOM/PACS workstation.
- [x] Stop describing color inversion as a diagnostic bone window.
- [x] Replace medication safe/verified language with limited FDA-label lookup language.
- [x] Separate FDA-label retrieval from patient-specific regimen validation.
- [x] Remove the unvalidated hard-coded medication dose-limit table.
- [x] Disable the original deterministic clinical-rule conclusions pending validation.
- [x] Hide unvalidated legacy advisories from blocking UI.
- [x] Require future generated advisories to carry validation status and source citation.
- [x] Align AI prompts and tool descriptions with local personal-record semantics.
- [x] Preserve unknown dates in appointment and lab workflows.

### P1.5 implementation notes

- Appointment tooling creates `status: proposed` records tagged `not-booked`.
- Follow-up tasks use `intent: proposal`; legacy `order` actions are interpreted as task creation only.
- Advisory acknowledgement never implies resolution or treatment.
- `evaluateClinicalSafety()` remains as a compatibility entry point but returns no alerts.
- The advisory UI renders only items marked `validationStatus: validated`.
- `medicationLabelReviewService.ts` performs label lookup without dose arithmetic or a binary safety verdict.
- `dosageVerifier.ts` remains only as a deprecated compatibility wrapper.
- The ambient scribe requires explicit user save and writes a durable reviewed SOAP note.
- The image viewer now says `Medical Image Viewer` and explicitly describes its limited controls.
- See `docs/architecture/DURABLE_ACTIONS_AND_SAFE_SEMANTICS.md`.

## P1.6 — Tests and acceptance evidence

Status: `[-] In progress`

- [ ] Add a repository test runner and test scripts.
- [ ] Add domain-schema validation tests.
- [ ] Add clinical-record store CRUD tests.
- [ ] Add persistence-version and hydration tests.
- [ ] Add unknown and partial date tests.
- [ ] Add provenance and amendment-preservation tests.
- [ ] Add candidate confirmation and rejection tests.
- [ ] Add confirmed-only selector tests.
- [ ] Add legacy migration and v4.2 import tests.
- [ ] Add backup-v2 round-trip and rollback tests.
- [ ] Add no-silent-data-loss migration tests.
- [ ] Add source-document resolution and missing-asset tests.
- [ ] Add durable appointment, task, and note tests.
- [ ] Add semantic-label tests for proposed versus booked, task versus order, and acknowledged versus completed.
- [ ] Add medication label-review limitation tests.
- [ ] Add disabled-rule regression tests.
- [ ] Add image-viewer terminology tests.
- [ ] Run full repository `tsc --noEmit`.
- [ ] Run the production build and automated suite from the repository test runner.
- [ ] Resolve any remaining compatibility defects discovered by the tests.
- [ ] Update this roadmap and the architecture notes with final acceptance evidence.

### Validation evidence already collected

#### P1.2

- Isolated strict TypeScript compilation of the clinical-record module.
- Lifecycle smoke tests for initialization, creation, review transitions, amendment history, protected records, unknown dates, queries, and timeline sorting.

#### P1.3

- Netlify deploy-preview build passed after confirmed-only selectors, candidate review, source preview, extraction routing, HUD integration, and reviewed-observation writes.
- The HUD no longer reads legacy strings as confirmed facts.
- The review queue removes resources after confirmation or rejection while preserving history.

#### P1.4

- Netlify deploy-preview build passed after migration, backup, asset, security-gate, and roster integration.
- Backup validation cross-checks patient ownership, active identity, patient-scoped maps, and asset accounting.
- Restore validates again before mutation and restores snapshots on synchronous apply failure.

#### P1.5

- Netlify deploy-preview build passed after durable notes, appointment proposals, advisory tasks, disabled rules, medication label-only review, image-viewer terminology, and prompt-boundary changes.
- Existing unvalidated legacy advisories no longer render in the active advisory UI.
- Reviewed lab rows no longer trigger the disabled deterministic rules.
- The hard-coded medication dose-limit file was removed.

These checks are implementation evidence, but they do not replace the repository-integrated automated suite required to finish P1.6.

---

# Phase 1 acceptance criteria

Phase 1 is complete only when all of the following are true:

1. MediBrief persists structured conditions, allergies, medications, encounters, observations, reports, procedures, immunizations, appointments, documents, notes, tasks, and care plans.
2. Extracted facts can remain candidates until confirmed or rejected.
3. Confirmed resources preserve provenance and amendment history.
4. Unknown dates remain explicitly unknown.
5. Legacy data migrates without silent loss.
6. Backup and restore use strict versioned validation.
7. Chat is no longer the only durable representation of notes, appointments, tasks, or actions.
8. Proposed, booked, ordered, acknowledged, and completed states are not conflated.
9. Misleading `executed`, `PACS`, and medication `safe/verified` claims are removed where unsupported.
10. Unvalidated clinical-rule conclusions remain disabled.
11. The repository type-check, production build, and Phase 1 automated test suite pass.
12. The roadmap and architecture documentation match the implemented system.

---

# Implementation slices

## Slice 1 — Domain contracts and schema versioning

Status: `[x] Complete`

- Common clinical types
- Resource interfaces
- Zod schemas
- Versioned contracts

## Slice 2 — Versioned clinical-record store

Status: `[x] Complete`

- Patient-scoped aggregate
- Typed lifecycle actions
- Persistence and hydration
- Query and timeline helpers

## Slice 3 — Legacy migration and backup v2

Status: `[x] Complete`

- Legacy migration
- Backward-compatible import
- Portable asset-aware backup
- Transactional restore

## Slice 4 — Confirmed views and candidate review

Status: `[x] Complete`

- Confirmed-only selectors and HUD
- Candidate review queue
- Source preview
- Candidate extraction routing

## Slice 5 — Durable notes, tasks, and appointments

Status: `[x] Complete`

- Reviewed SOAP note records
- Appointment proposal records
- Advisory follow-up task records
- Accurate acknowledgement semantics

## Slice 6 — Safe semantics and acceptance tests

Status: `[-] In progress`

Completed:

- [x] Remove execution and booking overclaims.
- [x] Disable unsupported deterministic conclusions.
- [x] Replace medication safety claims with label lookup boundaries.
- [x] Correct image-viewer terminology.
- [x] Align AI prompts with the local personal-record product.

Remaining:

- [ ] Add repository-integrated regression coverage.
- [ ] Run full type-check and build validation.
- [ ] Resolve test-discovered defects.
- [ ] Produce final Phase 1 acceptance evidence.

---

# Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-07-30 | Keep the existing repository and application shell. | The UI, local persistence, chat infrastructure, document storage, and modular feature structure are useful foundations. |
| 2026-07-30 | Build a local personal health record rather than a simulated hospital command system. | Durable records and grounded assistance fit the intended use better than order-entry semantics. |
| 2026-07-30 | Use FHIR-inspired application-owned models without requiring a FHIR server. | This supports consistency and future interoperability while keeping the local app lightweight. |
| 2026-07-30 | Treat OpenMed as a future candidate-extraction layer, not the medical record or autonomous decision maker. | Extracted assertions still require application-owned review and storage. |
| 2026-07-30 | Preserve original values beside normalized values. | Normalization must never destroy source truth. |
| 2026-07-30 | Represent partial and unknown dates explicitly. | This prevents manufactured dates. |
| 2026-07-30 | Use resource-level verification status. | Candidates and confirmed facts retain one consistent schema. |
| 2026-07-30 | Use a patient-scoped Zustand aggregate backed by encrypted IndexedDB. | It fits the current local architecture and can later be wrapped by a repository service. |
| 2026-07-30 | Keep advisories outside the durable fact aggregate. | A warning is not automatically a patient fact. |
| 2026-07-30 | Deduplicate only with stable source identity. | Similar facts from separate documents may represent independent assertions. |
| 2026-07-30 | Protect reviewed history from hard deletion. | Corrections require amendments or entered-in-error handling. |
| 2026-07-30 | Fail on unsupported persistence versions. | Medical data migrations must be explicit and testable. |
| 2026-07-30 | Migrate legacy AI-derived facts as candidates. | The legacy model lacks sufficient review and assertion provenance. |
| 2026-07-30 | Preserve age as a snapshot and weight as an undated observation. | Inferring birth or measurement dates would manufacture information. |
| 2026-07-30 | Include available binary assets in backup v2 and list missing ones. | Portable backups must not silently lose or fabricate documents. |
| 2026-07-30 | Validate a complete restore before mutating live state. | This reduces destructive partial restores. |
| 2026-07-30 | Confirm uploaded-document existence separately from document-derived claims. | The upload is known; clinical assertions still require review. |
| 2026-07-30 | Centralize confirmed-only summary rules. | Every patient-facing view must apply the same eligibility policy. |
| 2026-07-30 | Never infer `NKDA` from an empty allergy list. | Missing information means unknown, not no known allergies. |
| 2026-07-30 | Store appointment requests as `proposed`, not `booked`. | MediBrief does not contact an external scheduling system. |
| 2026-07-30 | Store advisory follow-up as proposal tasks, not orders. | A local reminder cannot represent a clinical order. |
| 2026-07-30 | Store reviewed scribe output as durable notes. | Chat must not be the note of record. |
| 2026-07-30 | Disable deterministic clinical conclusions until each rule is validated. | Predictable logic is not clinically correct merely because it is deterministic. |
| 2026-07-30 | Treat openFDA as label retrieval only. | Label presence or absence of a boxed-warning field cannot validate a patient regimen. |
| 2026-07-30 | Remove the hard-coded medication dose-limit table. | It lacked frequency, route, indication, formulation, and patient context. |
| 2026-07-30 | Label the current viewer as a basic medical-image viewer, not PACS. | It does not parse DICOM studies, series, metadata, or clinical windowing. |
| 2026-07-30 | Keep security work outside this clinical rebuild roadmap. | The requested work is medical completeness and correctness for a local personal app. |

---

# Progress log

| Date | Phase / slice | Work completed | Validation | Commit label |
|---|---|---|---|---|
| 2026-07-30 | P1.0 | Added the living rebuild plan and dedicated branch. | Repository files created on the Phase 1 branch. | `docs: add MediBrief clinical rebuild plan` |
| 2026-07-30 | P1.0 | Added target flows, lifecycle, invariants, and compatibility inventory. | Branch diff inspected. | `docs: describe clinical record foundation architecture` |
| 2026-07-30 | P1.1 / Slice 1 | Added the full clinical-resource domain, provenance, assertion context, dates, quantities, schemas, and factories. | Isolated module validation performed. | `feat: add clinical record foundation` |
| 2026-07-30 | P1.2 / Slice 2 | Added the versioned clinical-record store, typed actions, history protection, queries, timeline, and persistence. | Isolated compilation and lifecycle smoke tests passed. | `feat: add versioned clinical record store` |
| 2026-07-30 | P1.4 / Slice 3 | Added deterministic migration, backup v2, legacy import, assets, rollback, and roster integration. | Deploy preview passed; schema and transaction paths reviewed. | `feat: add legacy migration and backup v2` |
| 2026-07-30 | P1.3 / Slice 4 | Added confirmed-only views, candidate review, source preview, candidate extraction routing, and reviewed lab writes. | Deploy preview passed. | `feat: add candidate review and confirmed views` |
| 2026-07-30 | P1.5 / Slice 5 | Added durable reviewed notes, appointment proposals, advisory tasks, and acknowledgement semantics. | Deploy preview passed. | `feat: add durable clinical actions` |
| 2026-07-30 | P1.5 / Slice 6 semantics | Disabled unvalidated rules, removed dose limits, changed medication review to label-only, corrected viewer and AI semantics. | Deploy preview passed. | `fix: correct clinical semantics` |

---

# Current open questions and deferred choices

These do not block the P1.6 test work:

- Whether to adopt official FHIR TypeScript definitions later or retain the smaller application-owned subset.
- Whether OpenMed will first run through a local FastAPI sidecar or browser/WebGPU runtime.
- Whether transient advisories should eventually move to a dedicated advisory store.
- Whether terminology coding initially remains optional free text plus suggestions or ships with a local terminology bundle.
- Whether a global review inbox should complement the patient-scoped review queue.
- When to remove the dual-written legacy observation store after compatibility tests pass.
