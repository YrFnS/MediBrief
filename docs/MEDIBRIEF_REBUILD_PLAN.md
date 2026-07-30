# MediBrief Clinical Rebuild Plan

> Living implementation plan for turning MediBrief from a polished medical-AI prototype into a dependable local personal medical-record and document-assistance application.
>
> **Branch:** `agent/phase-1-clinical-foundation`  
> **Started:** 2026-07-30  
> **Current phase:** Phase 1 — Clinical Foundation  
> **Next implementation focus:** P1.5 — correct misleading clinical semantics and create durable actions  
> **Primary focus:** Clinical correctness, durable structured records, traceability, and safe human review.  
> **Explicitly out of scope for this roadmap:** Security hardening and regulatory certification.

## How to use this file

- Keep this document updated in the same commit as meaningful implementation work.
- Mark a task complete only when its acceptance criteria are met.
- Add important architectural choices to the Decision Log.
- Add every completed implementation slice to the Progress Log.
- Do not delete completed tasks; preserve history so future work can be understood.

### Status legend

- `[ ]` Not started
- `[-]` In progress
- `[x]` Complete
- `[!]` Blocked or intentionally deferred

---

## Product direction

MediBrief will be repositioned as a **local personal health record and medical-document assistant** rather than presenting itself as a hospital order-entry system or autonomous clinical decision maker.

The long-term product should provide:

1. A durable longitudinal health record.
2. Source-linked extraction from medical documents.
3. Human confirmation before extracted facts become part of the confirmed record.
4. Clear separation between facts, suggestions, alerts, tasks, and completed actions.
5. AI assistance grounded in confirmed patient data.
6. Exportable and interoperable clinical data.

---

# Roadmap overview

## Phase 1 — Clinical Foundation

**Goal:** Replace the observation-only/string-based patient model with a versioned, traceable clinical-record domain while preserving the current application shell.

Status: `[-] In progress`

## Phase 2 — Personal Health Record Interface

**Goal:** Build first-class record screens for overview, timeline, conditions, medications, allergies, labs, visits, procedures, immunizations, documents, appointments, and emergency summary.

Status: `[ ] Not started`

## Phase 3 — OpenMed Extraction Integration

**Goal:** Use OpenMed as a local candidate-extraction and clinical-context layer with negation, certainty, temporality, experiencer, terminology suggestions, and source offsets.

Status: `[ ] Not started`

## Phase 4 — Laboratory and Diagnostic Report Pipeline

**Goal:** Represent complete diagnostic reports, panels, specimens, qualitative results, comparators, original units, normalized units, corrected results, and source-linked verification.

Status: `[ ] Not started`

## Phase 5 — Grounded Assistance and Validated Rules

**Goal:** Reintroduce summaries, medication reconciliation, trend explanations, reminders, and carefully validated decision-support rules on top of the confirmed record.

Status: `[ ] Not started`

---

# Phase 1 — Clinical Foundation

## Phase 1 principles

- The chat transcript is not the medical record.
- AI output is never automatically a confirmed clinical fact.
- Unknown values remain unknown; they are not replaced with convenient defaults.
- Original values and normalized values are both preserved.
- Every imported or extracted fact records where it came from.
- Clinical status and verification status are separate concepts.
- Suggested actions are not represented as completed actions.
- Existing user data must migrate without silently disappearing.
- New models should be FHIR-inspired without requiring a full FHIR server.

## P1.0 — Planning and baseline

Status: `[x] Complete`

- [x] Create a dedicated Phase 1 branch.
- [x] Add this living roadmap.
- [x] Record the current clinical-data limitations.
- [x] Add an architecture note describing the old and new record flows.
- [x] Add a compatibility inventory of components consuming the current stores.

### Current baseline limitations

- The structured clinical store primarily persists `Observation[]` and alerts.
- Diagnoses, allergies, and code status are stored as unverified strings on patient metadata.
- Age is persisted directly rather than derived from date of birth.
- Weight is treated as static demographics rather than a dated measurement.
- Documents contain minimal metadata and are weakly linked to extracted facts.
- Appointments and clinical actions are represented as chat messages rather than durable records.
- The scribe commits formatted text into chat rather than a versioned encounter note.
- Import/export schemas are permissive and tied to the old composite patient shape.
- Existing deterministic rules can overstate what the available evidence proves.

## P1.1 — Shared clinical domain model

Status: `[x] Complete`

### Foundation contracts

- [x] Add versioned record-schema constants.
- [x] Add common identifiers and timestamps.
- [x] Add `RecordSource` and source-document references.
- [x] Add `ClinicalProvenance` metadata.
- [x] Add `VerificationStatus`:
  - `candidate`
  - `confirmed`
  - `rejected`
  - `entered-in-error`
- [x] Add assertion context:
  - polarity/negation
  - certainty
  - temporality
  - experiencer
- [x] Add amendment and correction metadata.
- [x] Add original-versus-normalized value contracts.

### Core resources

- [x] Expand the patient profile with date of birth and optional identifiers.
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
- [x] Expand `DocumentReferenceRecord`.
- [x] Add `ClinicalNoteRecord` with draft/final/amended status.

### Design requirements

- [x] No model requires an AI-generated interpretation to be useful.
- [x] Resources support manual entry without a source document.
- [x] Extracted resources preserve source document, page/section, and text offsets when available.
- [x] Date fields support unknown or partial dates without substituting the current date.
- [x] Resource types are serializable and schema-validated.

## P1.2 — Versioned clinical record store

Status: `[x] Complete`

- [x] Introduce a new patient-scoped clinical record aggregate.
- [x] Keep clinical resources separate from UI-only alerts.
- [x] Add typed CRUD actions for every resource collection.
- [x] Add candidate confirmation and rejection actions.
- [x] Add correction and amendment actions without overwriting history.
- [x] Add resource lookup by patient, source, type, verification status, and clinical date.
- [x] Add stable sorting for patient timelines.
- [x] Add conservative duplicate-candidate detection that does not merge unrelated records.
- [x] Add versioned persistence and strict hydration validation.
- [x] Preserve the existing security-gate hydration flow.
- [x] Protect confirmed, rejected, and entered-in-error history from hard deletion.
- [x] Require a reason before marking a resource entered in error.

### P1.2 implementation notes

- The store uses `records: Record<patientId, PatientClinicalRecord>`.
- Patient timelines default to confirmed resources.
- Unknown clinical dates remain unknown and are not placed inside date-range queries using `recordedAt`.
- Duplicate detection requires a stable source document location or external identifier.
- Similar facts from separate source documents remain separate assertions.
- Every write validates the resulting resource and complete patient aggregate.
- The store persists through the existing encrypted IndexedDB adapter and rehydrates only after setup or successful unlock.

## P1.3 — Candidate review and provenance workflow

Status: `[x] Complete`

- [x] Use the shared clinical-resource shape as the generic candidate contract.
- [x] Distinguish candidates from confirmed facts through `verificationStatus`.
- [x] Add source preview metadata.
- [x] Add explicit confirm and reject lifecycle actions.
- [x] Support edit-before-confirm through candidate amendments.
- [x] Support rejection with an optional review reason.
- [x] Support later correction of a confirmed resource without destroying history.
- [x] Record extraction engine and version.
- [x] Record confidence without treating it as clinical certainty.
- [x] Exclude candidates from the default confirmed timeline.
- [x] Add a reusable patient-scoped candidate-review interface.
- [x] Ensure the HUD and active-patient summary read confirmed resources only.
- [x] Add source-document preview navigation from the review interface.
- [x] Stop the current entity extractor from directly merging facts into legacy patient strings.
- [x] Register uploaded files as confirmed document references while keeping extracted clinical claims as candidates.
- [x] Add audit events for candidate edits, confirmation, rejection, and source viewing.

### P1.3 implementation notes

- `features/clinical-record/selectors.ts` centralizes confirmed-only summary rules.
- Negated, family-history, and hypothetical assertions do not appear as current patient facts.
- The HUD reads confirmed allergies, conditions, code status, and dated observations from the structured record.
- When no allergy is confirmed, the HUD displays `Allergy status unknown`; it does not infer `NKDA`.
- Candidate review supports resource-specific edits, review comments, confirmation, rejection, and source preview.
- Images, PDFs, text, and JSON sources can be previewed from the local asset vault; unsupported formats remain downloadable.
- Uploaded-document existence is confirmed because the user selected the file, but extracted diagnoses, allergies, and code status remain candidates.
- Reviewed numeric lab rows now also write confirmed `ObservationRecord` resources while the legacy observation store remains temporarily active for compatibility.
- See `docs/architecture/CANDIDATE_REVIEW_AND_CONFIRMED_VIEWS.md` for the full view and review contract.

## P1.4 — Migration, backup, and compatibility

Status: `[x] Complete`

- [x] Define the new clinical-record and export-format versions.
- [x] Define and validate portable MediBrief backup v2.
- [x] Build deterministic migration from current patient metadata and observation state.
- [x] Convert legacy diagnosis and allergy strings into clearly marked candidate records.
- [x] Preserve legacy chat history and uploaded document references.
- [x] Preserve existing observations with original values and explicit limited provenance.
- [x] Preserve age and weight without inventing date of birth or measurement dates.
- [x] Never silently mark migrated AI-extracted facts as fully verified.
- [x] Add strict validation schemas for the new record and backup formats.
- [x] Continue importing the previous v4.2 backup format.
- [x] Export all clinical resources, provenance, candidates, amendments, chats, and compatibility state.
- [x] Embed available uploaded-file payloads in backup v2 and explicitly list missing payloads.
- [x] Strip non-portable temporary object URLs while retaining stable file references.
- [x] Add pre-apply validation, state snapshots, asset snapshots, and rollback on restore failure.
- [x] Run idempotent legacy migration after encrypted stores rehydrate.
- [x] Keep old stores intact during the dual-read compatibility period.

### P1.4 implementation notes

- Migrated diagnosis, allergy, code-status, age, weight, and legacy observation records use `verificationStatus: candidate`.
- Uploaded-document existence metadata is confirmed, while the clinical content inside the document still requires review.
- Deterministic migrated IDs make repeated unlock-time migration idempotent.
- Legacy v4.2 backups are converted into a fully validated v2 envelope in memory before live state changes.
- A v4.2 backup cannot contain document blobs; matching local storage IDs are reused when present and unresolved assets are reported.
- Backup v2 includes all referenced assets that are still available in the local IndexedDB asset vault.
- The importer never deletes unrelated local assets during restore.
- See `docs/architecture/BACKUP_V2_AND_LEGACY_MIGRATION.md` for the complete format and transaction design.

## P1.5 — Correct misleading clinical semantics

Status: `[ ] Not started`

- [ ] Replace `ACTION EXECUTED` language when no real action record is created.
- [ ] Represent suggested actions as suggestions.
- [ ] Represent acknowledgements as acknowledgements.
- [ ] Create durable tasks and appointments instead of chat-only confirmations.
- [ ] Rename the current image viewer from PACS terminology unless DICOM support is implemented.
- [ ] Replace `Verified Safe` medication language with an accurate coverage statement.
- [ ] Separate FDA-label retrieval from medication-regimen validation.
- [ ] Remove or disable overclaiming deterministic clinical rules pending validation.
- [ ] Ensure unknown report dates remain unknown throughout every current ingestion and display path.

## P1.6 — Tests and acceptance evidence

Status: `[ ] Not started`

- [ ] Add a repository test runner and test scripts.
- [ ] Add schema validation tests.
- [ ] Add store CRUD tests.
- [ ] Add persistence migration tests.
- [ ] Add unknown-date tests.
- [ ] Add provenance-preservation tests.
- [ ] Add candidate confirmation/rejection tests.
- [ ] Add legacy backup import tests.
- [ ] Add no-silent-data-loss migration tests.
- [ ] Add confirmed-only selector tests.
- [ ] Add source-document resolution and missing-asset tests.
- [ ] Add terminology/label tests for suggestion versus execution states.
- [ ] Add full repository type-check validation to each Phase 1 implementation slice.

### Validation already performed

#### P1.2

- Isolated strict TypeScript compilation of the new clinical-record module.
- Lifecycle smoke tests for patient initialization and resource creation.
- Candidate duplicate detection from the same source.
- Protection against false deduplication across independent documents.
- Candidate confirmation and rejection transitions.
- Edit-before-confirm and confirmed-resource amendment history.
- Protection of reviewed history from hard deletion.
- Entered-in-error transition and reason requirement.
- Resource queries, unknown-date behavior, partial-date overlap, and deterministic timeline sorting.

#### P1.3 / Slice 4

- Netlify deploy-preview build completed successfully after adding confirmed-only selectors, the candidate review surface, source-document preview, extraction candidate routing, HUD integration, and reviewed-observation dual writes.
- The HUD no longer reads legacy allergy, diagnosis, code-status, or observation values as confirmed facts.
- The review queue is patient-scoped and excludes reviewed resources automatically after confirmation or rejection.
- Source preview retains metadata when the underlying local file is missing.
- Newly extracted facts no longer mutate legacy patient entity strings.

#### P1.4

- The branch deploy-preview build completed successfully after the migration, backup, asset, SecurityGate, and roster integration changes.
- Backup v2 schema cross-checks patient IDs, clinical-record ownership, active patient identity, patient-scoped map keys, and asset accounting.
- Migration is additive and deterministic; old stores are not deleted or rewritten.
- Restore validates the prepared object again immediately before mutation.
- Store and overwritten-asset snapshots are restored when a synchronous apply step fails.

These checks provide implementation evidence for the slices, but they do not replace the repository-integrated automated test runner and full `tsc --noEmit` validation required by P1.6.

---

# Phase 1 acceptance criteria

Phase 1 is complete only when all of the following are true:

1. MediBrief can persist structured conditions, allergies, medications, encounters, observations, reports, procedures, immunizations, appointments, documents, notes, and tasks.
2. Extracted facts can remain candidates until a person confirms or rejects them.
3. Confirmed resources preserve provenance and amendment history.
4. Unknown dates remain explicitly unknown.
5. Legacy data migrates into the new schema without silent loss.
6. Backup and restore use strict versioned validation.
7. Chat messages are no longer the only durable representation of appointments, notes, or actions.
8. Misleading labels such as executed, PACS, or verified safe are removed where the underlying capability does not support them.
9. The application builds and the Phase 1 test suite passes.
10. This roadmap and the architecture documentation reflect the final implementation.

---

# Proposed implementation slices

These slices are intentionally small enough to review and validate independently.

## Slice 1 — Domain contracts and schema versioning

- Add common clinical types.
- Add the new resource interfaces.
- Add Zod schemas for the domain.
- Do not change current UI behavior yet.

Status: `[x] Complete`

## Slice 2 — New clinical record store

- Add patient-scoped resource collections.
- Add typed CRUD and verification actions.
- Add persistence versioning.
- Add resource queries, timeline ordering, and conservative candidate deduplication.
- Join the existing post-unlock hydration flow.

Status: `[x] Complete`

## Slice 3 — Legacy migration and backup v2

- Migrate old patient metadata and observations.
- Add backward-compatible v4.2 import.
- Export the complete new aggregate and compatibility state.
- Include portable uploaded-file payloads when available.
- Fail without partial destructive writes when validation or apply cannot complete.

Status: `[x] Complete`

## Slice 4 — Connect current UI to the new record

- Read confirmed allergies, conditions, observations, and demographics from the new record.
- Keep compatibility adapters during transition.
- Introduce the generic candidate review interface.
- Add source-document preview and candidate audit events.
- Route new extraction output into candidates rather than legacy strings.

Status: `[x] Complete`

## Slice 5 — Durable notes, tasks, and appointments

- Save scribe output as notes.
- Save appointment requests as appointment records.
- Save suggested and acknowledged actions without claiming execution.

Status: `[ ] Not started`

## Slice 6 — Disable misleading safety behavior and add tests

- Correct rule and medication labels.
- Disable unsupported automatic conclusions.
- Add focused regression coverage and repository-integrated validation.

Status: `[ ] Not started`

---

# Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-07-30 | Keep the existing MediBrief repository and application shell. | The UI, local persistence approach, chat infrastructure, document storage, and modular feature structure are useful foundations. |
| 2026-07-30 | Build a local personal health record rather than a simulated hospital command system. | The intended local personal use is better served by durable records, document understanding, timeline views, and grounded assistance. |
| 2026-07-30 | Use FHIR-inspired internal models without requiring a FHIR server. | This improves consistency and future interoperability while keeping the local application lightweight. |
| 2026-07-30 | Treat OpenMed as a candidate-extraction layer, not the medical record or autonomous decision maker. | It provides useful local NLP and context extraction, but facts still require review and durable application-owned storage. |
| 2026-07-30 | Preserve original values alongside normalized values. | Normalization must never destroy source truth or prevent later correction. |
| 2026-07-30 | Represent partial and unknown clinical dates with a dedicated value-plus-precision type. | It prevents invented dates while supporting year-only, month-only, day, and unknown source values. |
| 2026-07-30 | Use resource-level `verificationStatus` instead of a parallel candidate data model. | Candidates and confirmed records keep one consistent structure while remaining easy to filter and validate. |
| 2026-07-30 | Use a patient-scoped Zustand aggregate backed by the existing encrypted IndexedDB adapter. | It fits the current local architecture while preserving a clear boundary that can later be wrapped by a repository service. |
| 2026-07-30 | Keep advisories and UI alerts outside the durable clinical-resource aggregate. | A warning or recommendation is not automatically a confirmed patient fact. |
| 2026-07-30 | Deduplicate candidates only when stable source identity is available. | Similar facts from different documents may represent separate events and must not be merged silently. |
| 2026-07-30 | Protect reviewed clinical history from hard deletion. | Confirmed records require amendment or entered-in-error handling, while rejected assertions remain useful provenance. |
| 2026-07-30 | Fail on unsupported clinical persistence versions. | Medical data must not be guessed through an implicit migration; version migrations must be explicit and testable. |
| 2026-07-30 | Migrate legacy AI-derived facts as candidates. | Legacy state does not preserve enough assertion or review provenance to call those facts confirmed. |
| 2026-07-30 | Preserve age as a snapshot and weight as an undated observation. | Deriving date of birth or measurement time would manufacture clinical information. |
| 2026-07-30 | Include available binary assets directly in backup v2. | A portable personal-health backup should restore the original uploaded documents, not only their metadata. |
| 2026-07-30 | Account explicitly for every referenced asset. | Missing files must be reported rather than silently represented as successfully backed up. |
| 2026-07-30 | Validate and prepare the complete restore before mutating live stores. | This prevents malformed or partially migrated backup content from destructively replacing working local state. |
| 2026-07-30 | Confirm uploaded-document existence separately from document-derived clinical claims. | The file upload is a user action, while extracted diagnoses, allergies, and other assertions still require clinical review. |
| 2026-07-30 | Centralize confirmed-only patient-summary rules in selectors. | HUDs and future record views must apply the same verification and assertion-context rules. |
| 2026-07-30 | Never infer `NKDA` from an empty confirmed allergy list. | Missing or unreviewed allergy information means unknown, not no known drug allergies. |
| 2026-07-30 | Use a patient-scoped review queue first. | It keeps source review tied to the active record while leaving a future global inbox possible. |
| 2026-07-30 | Keep security work outside this clinical rebuild roadmap. | The current project request is focused on medical completeness and correctness for a local personal application. |

---

# Progress log

| Date | Phase / slice | Work completed | Validation | Commit |
|---|---|---|---|---|
| 2026-07-30 | P1.0 | Created `agent/phase-1-clinical-foundation` and added the living clinical rebuild plan. | Repository file created on the dedicated branch. | `docs: add MediBrief clinical rebuild plan` |
| 2026-07-30 | P1.0 | Added the old/new data-flow architecture, resource lifecycle, invariants, transition strategy, and compatibility inventory. | Branch diff inspected against `main`. | `docs: describe clinical record foundation architecture` |
| 2026-07-30 | P1.1 / Slice 1 | Added schema/version constants, full clinical resource interfaces, provenance, assertion context, unknown/partial dates, original/normalized quantities, strict Zod schemas, factories, and barrel exports. | Files remained isolated from existing UI behavior; branch diff inspected. | `feat: add clinical record foundation` |
| 2026-07-30 | P1.2 / Slice 2 | Added the patient-scoped versioned store, typed lifecycle actions, amendment history, protected review states, strict persisted-record validation, source/date/status queries, timeline sorting, and conservative candidate deduplication. Connected the store to post-unlock hydration. | Isolated strict TypeScript compilation and lifecycle/query smoke tests passed. Full repository validation remains tracked in P1.6. | `feat: add versioned clinical record store` |
| 2026-07-30 | P1.4 / Slice 3 | Added deterministic legacy migration, candidate conversion, portable backup v2, legacy v4.2 import, binary asset export/restore, restore rollback, unlock-time migration, and roster backup integration. | Deploy-preview build succeeded; schema and transaction paths reviewed. Full automated migration tests remain tracked in P1.6. | `feat: add legacy migration and backup v2` |
| 2026-07-30 | P1.3 / Slice 4 | Added confirmed-only selectors and HUD, patient-scoped candidate review, source-file preview, candidate audit events, candidate-only entity extraction, uploaded-document registration, and confirmed structured writes from the current lab review flow. | Netlify deploy-preview build succeeded at the completed Slice 4 head. Repository-integrated tests remain tracked in P1.6. | `feat: add candidate review and confirmed views` |

---

# Open questions and deferred choices

These do not block the completed candidate-review and confirmed-view slice.

- Whether to adopt official FHIR TypeScript definitions later or keep the smaller application-owned subset.
- Whether OpenMed will run through a local FastAPI sidecar first or a browser/WebGPU path.
- Whether the existing alert store should become a dedicated advisory store or be replaced by tasks plus transient notices.
- Whether terminology coding will initially be optional free text plus coding suggestions or require a local terminology bundle.
- Whether a future global review inbox should complement the current patient-scoped queue.
