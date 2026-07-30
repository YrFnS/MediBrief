# MediBrief Clinical Rebuild Plan

> Living implementation plan for turning MediBrief from a polished medical-AI prototype into a dependable local personal medical-record and document-assistance application.
>
> **Branch:** `agent/phase-1-clinical-foundation`  
> **Started:** 2026-07-30  
> **Current phase:** Phase 1 — Clinical Foundation  
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

- [x] Create a dedicated Phase 1 branch.
- [x] Add this living roadmap.
- [x] Record the current clinical-data limitations.
- [ ] Add an architecture note describing the old and new record flows.
- [ ] Add a compatibility inventory of components consuming the current stores.

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

Status: `[-] In progress`

### Foundation contracts

- [ ] Add versioned record-schema constants.
- [ ] Add common identifiers and timestamps.
- [ ] Add `RecordSource` and source-document references.
- [ ] Add `ClinicalProvenance` metadata.
- [ ] Add `VerificationStatus`:
  - `candidate`
  - `confirmed`
  - `rejected`
  - `entered-in-error`
- [ ] Add assertion context:
  - polarity/negation
  - certainty
  - temporality
  - experiencer
- [ ] Add amendment and correction metadata.
- [ ] Add original-versus-normalized value contracts.

### Core resources

- [ ] Expand the patient profile with date of birth and optional identifiers.
- [ ] Add `EncounterRecord`.
- [ ] Add `ConditionRecord`.
- [ ] Add `AllergyIntoleranceRecord`.
- [ ] Add `MedicationRecord`.
- [ ] Add `ObservationRecord`.
- [ ] Add `DiagnosticReportRecord`.
- [ ] Add `SpecimenRecord`.
- [ ] Add `ProcedureRecord`.
- [ ] Add `ImmunizationRecord`.
- [ ] Add `AppointmentRecord`.
- [ ] Add `ClinicalTaskRecord`.
- [ ] Add `CarePlanRecord`.
- [ ] Expand `DocumentReferenceRecord`.
- [ ] Add `ClinicalNoteRecord` with draft/final/amended status.

### Design requirements

- [ ] No model should require an AI-generated interpretation to be useful.
- [ ] Resources must support manual entry without a source document.
- [ ] Extracted resources must preserve source document, page/section, and text offsets when available.
- [ ] Date fields must support unknown or partial dates without substituting the current date.
- [ ] Resource types must be serializable and schema-validated.

## P1.2 — Versioned clinical record store

Status: `[ ] Not started`

- [ ] Introduce a new patient-scoped clinical record aggregate.
- [ ] Keep clinical resources separate from UI-only alerts.
- [ ] Add typed CRUD actions for every resource collection.
- [ ] Add candidate confirmation/rejection actions.
- [ ] Add correction/amendment actions without overwriting history.
- [ ] Add resource lookup by patient, source, type, status, and date.
- [ ] Add stable sorting for patient timelines.
- [ ] Add duplicate-candidate detection that does not merge unrelated records.
- [ ] Add versioned persistence and hydration.
- [ ] Preserve the existing security-gate hydration flow.

## P1.3 — Candidate review and provenance workflow

Status: `[ ] Not started`

- [ ] Create a generic `ClinicalCandidate` contract.
- [ ] Store candidate resources separately from confirmed resources or clearly distinguish them by verification status.
- [ ] Add source preview metadata.
- [ ] Require explicit confirmation before candidates affect the patient summary.
- [ ] Support edit-before-confirm.
- [ ] Support reject with an optional reason.
- [ ] Support later correction of a confirmed resource.
- [ ] Record extraction engine and version.
- [ ] Record confidence without treating it as clinical certainty.

## P1.4 — Migration, backup, and compatibility

Status: `[ ] Not started`

- [ ] Define a new backup format version.
- [ ] Build a migration from the current patient metadata and observation store.
- [ ] Convert legacy diagnosis/allergy strings into clearly marked legacy records.
- [ ] Preserve legacy chat history and uploaded document references.
- [ ] Preserve existing observations and identify their limited provenance.
- [ ] Never silently mark migrated AI-extracted facts as fully verified.
- [ ] Add strict import validation for the new format.
- [ ] Continue importing the previous backup format.
- [ ] Export all clinical resources, provenance, candidates, and amendments.
- [ ] Add migration failure reporting with no partial destructive write.

## P1.5 — Correct misleading clinical semantics

Status: `[ ] Not started`

- [ ] Replace `ACTION EXECUTED` language when no real action record is created.
- [ ] Represent suggested actions as suggestions.
- [ ] Represent acknowledgements as acknowledgements.
- [ ] Create durable tasks/appointments instead of chat-only confirmations.
- [ ] Rename the current image viewer from PACS terminology unless DICOM support is implemented.
- [ ] Replace `Verified Safe` medication language with an accurate coverage statement.
- [ ] Separate FDA-label retrieval from medication-regimen validation.
- [ ] Remove or disable overclaiming deterministic clinical rules pending validation.
- [ ] Ensure unknown report dates remain unknown.

## P1.6 — Tests and acceptance evidence

Status: `[ ] Not started`

- [ ] Add a test runner and test scripts.
- [ ] Add schema validation tests.
- [ ] Add store CRUD tests.
- [ ] Add persistence migration tests.
- [ ] Add unknown-date tests.
- [ ] Add provenance-preservation tests.
- [ ] Add candidate confirmation/rejection tests.
- [ ] Add legacy backup import tests.
- [ ] Add no-silent-data-loss migration tests.
- [ ] Add terminology/label tests for suggestion versus execution states.
- [ ] Add build and type-check validation to each Phase 1 implementation slice.

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

Status: `[-] In progress`

## Slice 2 — New clinical record store

- Add patient-scoped resource collections.
- Add typed CRUD and verification actions.
- Add persistence versioning.

Status: `[ ] Not started`

## Slice 3 — Legacy migration and backup v2

- Migrate old patient metadata and observations.
- Add backward-compatible import.
- Export the new aggregate.

Status: `[ ] Not started`

## Slice 4 — Connect current UI to the new record

- Read confirmed allergies, conditions, observations, and demographics from the new record.
- Keep compatibility adapters during transition.

Status: `[ ] Not started`

## Slice 5 — Durable notes, tasks, and appointments

- Save scribe output as notes.
- Save appointment requests as appointment records.
- Save suggested/acknowledged actions without claiming execution.

Status: `[ ] Not started`

## Slice 6 — Disable misleading safety behavior and add tests

- Correct rule and medication labels.
- Disable unsupported automatic conclusions.
- Add focused regression coverage.

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
| 2026-07-30 | Keep security work outside this clinical rebuild roadmap. | The current project request is focused on medical completeness and correctness for a local personal application. |

---

# Progress log

| Date | Phase / slice | Work completed | Validation | Commit |
|---|---|---|---|---|
| 2026-07-30 | P1.0 | Created `agent/phase-1-clinical-foundation` and added the living clinical rebuild plan. | Repository file created on the dedicated branch. | `docs: add MediBrief clinical rebuild plan` |

---

# Open questions and deferred choices

These do not block Slice 1 and can be resolved while implementation progresses.

- Whether the internal resource aggregate should remain in Zustand or use a repository/service abstraction around IndexedDB.
- Whether to adopt the official FHIR TypeScript definitions later or keep a smaller application-owned subset.
- Whether partial dates should use a dedicated structured type or ISO-like strings plus precision metadata.
- Whether OpenMed will run through a local FastAPI sidecar first or a browser/WebGPU path.
- Whether the existing alert store should be replaced with tasks and advisories or retained as a separate transient UI layer.
- Whether terminology coding will initially be optional free text plus coding suggestions or require a local terminology bundle.
