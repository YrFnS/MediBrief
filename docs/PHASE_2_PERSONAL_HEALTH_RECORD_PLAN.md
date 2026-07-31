# MediBrief Phase 2 — Personal Health Record Interface

> Consolidated living implementation record for the completed Phase 2 rebuild.
>
> **Branch:** `agent/phase-2-personal-health-record`  
> **Base:** `agent/phase-1-clinical-foundation`  
> **Started:** 2026-07-31  
> **Status:** `[x] Accepted and complete`  
> **Next top-level phase:** Phase 3 — OpenMed extraction integration

## Product goal

Phase 2 turns the validated Phase 1 clinical foundation into a complete, usable, local personal health record.

The record remains useful without AI access. Patient-facing clinical views use confirmed, patient-applicable resources by default, preserve provenance and uncertainty, and never convert missing data into unsafe negative claims.

## Core principles

- The personal record remains usable without an AI API key and while offline.
- Overview—not chat—is the default destination.
- Confirmed facts, candidates, rejected assertions, and entered-in-error history remain distinct.
- An empty section means no confirmed local information is available; it does not prove absence.
- Unknown event dates remain unknown.
- Storage, issue, import, review, and upload timestamps never replace an unknown clinical date.
- Original clinical values remain visible even when normalized values exist.
- Corrections retain previous values, reasons, actors, and timestamps.
- Reviewed clinical history is never hard-deleted.
- Device-related text is evidence, not a fabricated device inventory.
- Appointment dates do not establish bookings.
- Reminders do not transmit orders or prove completed care.
- Proposal, plan, option, and order intents do not imply external execution.
- Search defaults to confirmed records.
- Complete patient-summary exports contain confirmed patient-applicable records only.
- Emergency and complete summaries are deterministic and do not call AI.
- Chat is an optional assistant surface, not the medical record.

---

# Top-level roadmap context

| Top-level phase | Status |
|---|---|
| Phase 1 — Clinical foundation | Complete and validated |
| **Phase 2 — Personal health record interface** | **Complete and accepted** |
| Phase 3 — OpenMed extraction integration | Next |
| Phase 4 — Laboratory and diagnostic-report pipeline | Pending |
| Phase 5 — Grounded assistance and validated rules | Pending |

---

# Phase 2 workstreams

## P2.0 — Personal-record shell and navigation

Status: `[x] Complete`

- [x] Create a dedicated stacked Phase 2 branch from the accepted Phase 1 head.
- [x] Add top-level Overview, Health Data, Timeline, Search & Export, Emergency Summary, and Assistant destinations.
- [x] Make Overview the default destination.
- [x] Keep assistant-specific controls out of record-only views.
- [x] Keep the record usable without an AI key.
- [x] Keep the record usable while offline.
- [x] Preserve the patient roster, HUD, candidate review, settings, advisories, backup, and assistant workflows.
- [x] Update application and PWA language to a local personal health record.
- [x] Add keyboard-operable primary navigation and a labelled content panel.

## P2.1 — Patient overview

Status: `[x] Complete`

- [x] Add patient identity and record-completeness information.
- [x] Show confirmed active conditions, allergies, and medications.
- [x] Show confirmed dated vital snapshots.
- [x] Show appointment proposals and follow-up tasks without calling them bookings or orders.
- [x] Show deterministic record metrics and recent history.
- [x] Show explicit data gaps.
- [x] Surface pending candidates and the existing review workflow.
- [x] Keep allergy status unknown when no current allergy is confirmed.
- [x] Keep empty condition and medication sections clinically honest.

## P2.2 — Longitudinal timeline

Status: `[x] Complete`

- [x] Build one deterministic timeline across structured clinical resources.
- [x] Order dated entries by clinical date.
- [x] Separate unknown-date history.
- [x] Add resource-type filtering.
- [x] Add text search.
- [x] Preserve source and verification context.
- [x] Add original-source preview.
- [x] Support sparse and empty records.

## P2.3 — Emergency summary

Status: `[x] Complete`

- [x] Build a deterministic confirmed-only emergency summary.
- [x] Include identity, contacts, code status, allergies, medications, conditions, and dated vitals when available.
- [x] Label missing data as unknown or unavailable.
- [x] Exclude candidates.
- [x] Add a local print representation.
- [x] State that the local summary may be incomplete.

## P2.4 — First-class clinical modules

Status: `[x] Complete for the current versioned schema`

Completed modules:

- [x] Conditions
- [x] Allergies and intolerances
- [x] Medications and medication history
- [x] Labs and diagnostic reports
- [x] Visits and encounters
- [x] Clinical notes
- [x] Procedures and device-related evidence
- [x] Immunizations
- [x] Documents
- [x] Appointments
- [x] Tasks and reminders
- [x] Care plans

Completed shared behavior:

- [x] Scalable Health Data navigation.
- [x] Current and history scopes where appropriate.
- [x] Domain-specific search and filters.
- [x] Detailed clinical fields and relationships.
- [x] Provenance, amendments, tags, confidence, and source preview.
- [x] Candidate counts and reuse of the existing review queue.
- [x] Original result values beside optional normalized values.
- [x] Unknown-date preservation.
- [x] Explicit broken-reference display.
- [x] Clinically honest empty states.

Completed semantic boundaries:

- [x] Medication records do not validate patient-specific safety.
- [x] Result flags are recorded data, not diagnoses.
- [x] Device keyword matches are evidence, not proof of a current implant.
- [x] Appointment status—not date presence—controls booking meaning.
- [x] Local reminders do not notify clinics or transmit orders.
- [x] Task and care-plan intent remains separate from execution.

Deferred schema extension:

- [!] Standalone versioned Device resource and implant inventory.

## P2.5 — Manual entry and correction

Status: `[x] Complete`

- [x] Add guided manual-entry forms for 13 structured resource types.
- [x] Save successful entries as confirmed user-entered resources with manual provenance.
- [x] Keep documents in the upload workflow so binary assets and metadata remain connected.
- [x] Validate required fields, statuses, intents, priorities, dates, date-times, quantities, value types, ownership, and schemas.
- [x] Validate patient-scoped relationships before persistence.
- [x] Prevent notes from amending themselves.
- [x] Add confirmed-record corrections.
- [x] Require a correction reason.
- [x] Preserve stable IDs, changed fields, previous values, actors, timestamps, and reasons.
- [x] Preserve nested structures that compact forms cannot safely replace.
- [x] Add entered-in-error handling with required reason and explicit acknowledgement.
- [x] Keep invalid records in protected history while excluding them from confirmed views.
- [x] Add searchable confirmed, candidate, rejected, and entered-in-error history.
- [x] Add source preview and explicit audit events.

## P2.6 — Search, export, accessibility, and acceptance evidence

Status: `[x] Complete`

### Cross-record search

- [x] Add a top-level Search & Export destination.
- [x] Index every structured resource in the active patient record.
- [x] Search labels, statuses, values, note text, report text, sources, tags, relationships, and amendment history.
- [x] Require every query term to match.
- [x] Rank exact and prefix labels above general text matches.
- [x] Default to confirmed resources.
- [x] Add explicit candidate, rejected, entered-in-error, and all-history filters.
- [x] Add resource-type filtering.
- [x] Add known-versus-unknown clinical-date filtering.
- [x] Keep unknown dates explicit.
- [x] Add provenance and source preview.

### Complete patient-summary export

- [x] Add complete confirmed-record JSON export.
- [x] Add self-contained readable and printable HTML export.
- [x] Include the patient profile and every confirmed patient-applicable resource.
- [x] Preserve full structured resources, provenance, original values, dates, tags, and amendment counts.
- [x] Exclude candidates, rejected assertions, entered-in-error records, negated assertions, hypothetical assertions, and family-attributed assertions from the clinical summary.
- [x] Preserve excluded history in the record and backup.
- [x] Escape HTML content.
- [x] Generate exports locally without AI or upload.
- [x] Add a `PATIENT_SUMMARY_EXPORTED` audit event.

### Accessibility and responsive contracts

- [x] Add a skip link and labelled patient-record content panel.
- [x] Add arrow, Home, and End navigation to primary tabs.
- [x] Add the same keyboard contract to Health Data and shared scope tabs.
- [x] Add accessible names for search, select, source, and feedback controls.
- [x] Add live result and export announcements.
- [x] Allow browser and mobile zoom.
- [x] Add visible focus indicators.
- [x] Honor reduced-motion preferences.
- [x] Preserve horizontal access to navigation at narrow widths.
- [x] Stack export actions and filters responsively.
- [x] Add source-level responsive regression contracts.

### Final acceptance

- [x] Add Slice 6 architecture documentation.
- [x] Add final Phase 2 acceptance evidence.
- [x] Run repository type-check, all tests, and the production build.
- [x] Accept Phase 2 as complete.

---

# Implementation slices and validation

## Slice 1 — Record home

Status: `[x] Complete`

Delivered:

- record-first shell;
- overview;
- timeline;
- emergency summary;
- optional assistant;
- offline and no-key record access.

Validation:

- TypeScript passed.
- **16 / 16** test files passed.
- **64 / 64** tests passed.
- Production build passed with **998** modules transformed.

Documentation: `docs/architecture/PHASE_2_RECORD_HOME.md`

## Slice 2 — Core clinical modules

Status: `[x] Complete`

Delivered:

- Conditions;
- Allergies;
- Medications;
- Labs & Reports;
- Health Data navigation;
- search, filters, provenance, and source review.

Validation:

- TypeScript passed.
- **18 / 18** test files passed.
- **72 / 72** tests passed.
- Production build passed with **1006** modules transformed.

Documentation: `docs/architecture/PHASE_2_CORE_CLINICAL_MODULES.md`

## Slice 3 — Longitudinal documentation

Status: `[x] Complete`

Delivered:

- Visits;
- Clinical Notes;
- Procedures and device evidence;
- Immunizations;
- Documents;
- cross-resource links and unknown-date preservation.

Validation:

- TypeScript passed.
- **20 / 20** test files passed.
- **82 / 82** tests passed.
- Production build passed with **1012** modules transformed.

Documentation: `docs/architecture/PHASE_2_LONGITUDINAL_RECORD_MODULES.md`

## Slice 4 — Planning and follow-up

Status: `[x] Complete`

Delivered:

- Appointments;
- Tasks and local reminders;
- Care Plans;
- booking, reminder, intent, and execution boundaries.

Validation:

- TypeScript passed.
- **22 / 22** test files passed.
- **91 / 91** tests passed.
- Production build passed with **1017** modules transformed.

Documentation: `docs/architecture/PHASE_2_PLANNING_FOLLOW_UP.md`

## Slice 5 — Manual entry and amendments

Status: `[x] Complete`

Delivered:

- guided forms;
- schema and relationship validation;
- confirmed manual provenance;
- corrections with reasons;
- previous-value retention;
- entered-in-error handling;
- searchable history;
- audit events.

Validation:

- TypeScript passed.
- **24 / 24** test files passed.
- **100 / 100** tests passed.
- Production build passed with **1019** modules transformed.

Documentation: `docs/architecture/PHASE_2_MANUAL_RECORD_MANAGEMENT.md`

## Slice 6 — Search, export, and final acceptance

Status: `[x] Complete`

Delivered:

- record-wide search;
- confirmed-only default and explicit history filters;
- complete JSON and HTML summaries;
- export audit event;
- keyboard navigation;
- screen-reader-oriented landmarks and announcements;
- zoom, focus, reduced-motion, and responsive contracts;
- acceptance evidence.

Validation:

- TypeScript passed.
- **26 / 26** test files passed.
- **111 / 111** tests passed.
- Production build passed with **1021** modules transformed.

Documentation:

- `docs/architecture/PHASE_2_SEARCH_EXPORT_ACCESSIBILITY.md`
- `docs/architecture/PHASE_2_ACCEPTANCE_EVIDENCE.md`

---

# Final acceptance criteria

- [x] The app opens as a personal health record.
- [x] The record works without AI access.
- [x] Confirmed facts are distinct from review and error history.
- [x] Every current structured resource has a usable first-class interface.
- [x] Users can add, correct, invalidate, search, and export records safely.
- [x] Unknown dates remain unknown.
- [x] Prior values and provenance remain inspectable.
- [x] Search defaults to confirmed records.
- [x] Complete summaries exclude non-confirmed history.
- [x] Keyboard and responsive contracts are regression-tested.
- [x] Phase 1 behavior remains covered.
- [x] TypeScript, all automated tests, and production build pass.

**Phase 2 overall status: `[x] Accepted and complete`.**

---

# Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-07-31 | Build Phase 2 as a stacked branch on the accepted Phase 1 head. | Keep the clinical foundation independently reviewable while building directly on it. |
| 2026-07-31 | Make Overview the default and Assistant optional. | A personal record must remain useful without AI. |
| 2026-07-31 | Use deterministic view models over confirmed resources. | Record views must not introduce new AI assertions. |
| 2026-07-31 | Separate unknown-date history. | Storage timestamps cannot become clinical event dates. |
| 2026-07-31 | Group domain modules under Health Data. | Keep top-level navigation understandable while allowing domain depth. |
| 2026-07-31 | Expose device-related evidence without inventing a Device resource. | The versioned schema has no standalone Device model yet. |
| 2026-07-31 | Keep document authored date separate from upload date. | Upload time is provenance, not clinical timing. |
| 2026-07-31 | Treat appointment status as the booking state. | Requested times can exist without clinic acceptance. |
| 2026-07-31 | Derive reminders from confirmed tasks only. | Local reminders should not imply notifications or orders. |
| 2026-07-31 | Require reasons for corrections and entered-in-error transitions. | Medical history must remain traceable and non-destructive. |
| 2026-07-31 | Keep document creation in the upload workflow. | Binary assets and stable storage metadata must stay connected. |
| 2026-07-31 | Default record-wide search to confirmed resources. | Review and error history must require explicit user intent. |
| 2026-07-31 | Export complete confirmed resources in JSON and self-contained HTML. | Preserve machine-readable detail and provide a readable local format without AI. |
| 2026-07-31 | Treat accessibility evidence as regression coverage, not certification. | Semantic tests improve quality but do not replace assistive-technology and external audits. |

---

# Known non-blocking observations

The final build passes but reports:

- a primary JavaScript chunk above the default 500 kB warning threshold;
- mixed static and dynamic imports for some modules;
- runtime resolution of `/index.css`.

At the final Slice 6 implementation head, the primary bundle is approximately **1.89 MB minified** and **511 kB gzip**.

These remain a dedicated frontend-performance workstream and do not invalidate Phase 2 clinical-record correctness.

# Deferred work

- Standalone versioned Device resource and migration.
- OpenMed integration.
- Expanded diagnostic-report pipeline.
- Grounded assistance and validated clinical rules.
- Optional browser reminder notifications.
- Terminology bundle and coding workflow.
- Playwright visual-regression tests.
- Real assistive-technology and external accessibility audits.
- Bundle splitting and import cleanup.
- Legacy observation dual-write removal after compatibility evidence.
