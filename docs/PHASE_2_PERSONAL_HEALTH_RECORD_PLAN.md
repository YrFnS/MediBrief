# MediBrief Phase 2 — Personal Health Record Interface

> Living implementation plan for turning the validated Phase 1 clinical foundation into a complete, usable local personal health record.
>
> **Branch:** `agent/phase-2-personal-health-record`  
> **Base:** `agent/phase-1-clinical-foundation`  
> **Started:** 2026-07-31  
> **Current focus:** Slice 1 — record navigation, overview, emergency summary, and longitudinal timeline

## Product goal

Phase 2 makes the structured clinical record understandable and useful without requiring the AI assistant. Patient-facing views must use confirmed, patient-applicable resources by default and clearly label unknown or incomplete data.

## Principles

- The personal record must remain usable without an AI API key.
- Confirmed facts, pending candidates, rejected assertions, and entered-in-error records must never be visually conflated.
- An empty section means no confirmed information is available; it does not prove the absence of a condition, allergy, medication, procedure, or immunization.
- Unknown event dates remain unknown and appear in a separate undated timeline group.
- Emergency summaries are generated deterministically from confirmed structured data.
- Chat remains an assistant surface, not the primary navigation model or medical record.
- Every view should work with sparse records and grow naturally as more resources are added.

---

# Phase 2 workstreams

## P2.0 — Personal-record shell and navigation

Status: `[-] In progress`

- [x] Create the dedicated Phase 2 branch from the accepted Phase 1 head.
- [x] Add this living Phase 2 plan.
- [ ] Add top-level record navigation for Overview, Timeline, Emergency Summary, and Assistant.
- [ ] Make Overview the default application destination.
- [ ] Keep assistant-specific controls out of record-only views.
- [ ] Allow the local record to open and remain usable without an AI API key.
- [ ] Preserve the current patient roster, HUD, candidate review, settings, and assistant flows.

## P2.1 — Patient overview

Status: `[ ] Not started`

- [ ] Add a patient identity and record-completeness summary.
- [ ] Show confirmed active conditions, allergies, and medications.
- [ ] Show confirmed vital snapshots only when a clinical date is known.
- [ ] Show pending appointments and follow-up tasks without calling proposals bookings or orders.
- [ ] Show recent confirmed timeline events.
- [ ] Show clear data-gap states instead of unsafe negative assumptions.
- [ ] Surface the pending candidate count and route users to the existing review workflow.

## P2.2 — Longitudinal timeline

Status: `[ ] Not started`

- [ ] Build one deterministic timeline across every structured clinical resource type.
- [ ] Use clinical dates when known.
- [ ] Group unknown-date resources separately rather than positioning them as clinical events on their storage date.
- [ ] Add resource-type filters.
- [ ] Add text search over resource labels and details.
- [ ] Preserve source type and verification context in timeline entries.
- [ ] Support sparse and empty records.

## P2.3 — Emergency summary

Status: `[ ] Not started`

- [ ] Build a deterministic confirmed-only emergency summary.
- [ ] Include identity, identifiers, date of birth, sex, blood type, language, and contact details when available.
- [ ] Include active allergies, medications, conditions, code status, and recent dated vitals.
- [ ] Label missing allergy, medication, condition, and code-status data as unknown or unavailable.
- [ ] Add a clean printable representation.
- [ ] State that the summary reflects locally confirmed records and may be incomplete.

## P2.4 — First-class clinical modules

Status: `[ ] Not started`

- [ ] Conditions
- [ ] Allergies and intolerances
- [ ] Medications and medication history
- [ ] Labs and diagnostic reports
- [ ] Visits, encounters, and notes
- [ ] Procedures and devices
- [ ] Immunizations
- [ ] Documents
- [ ] Appointments
- [ ] Tasks and reminders
- [ ] Care plans

## P2.5 — Manual entry and correction

Status: `[ ] Not started`

- [ ] Add safe manual-entry forms for supported resource types.
- [ ] Add amendment flows for confirmed records.
- [ ] Add entered-in-error flows with required reasons.
- [ ] Preserve prior values and provenance.
- [ ] Validate dates, quantities, and required clinical fields before persistence.

## P2.6 — Search, export, accessibility, and acceptance evidence

Status: `[ ] Not started`

- [ ] Add cross-record search and filters.
- [ ] Add patient-summary export.
- [ ] Add keyboard and screen-reader navigation checks.
- [ ] Add responsive layout regression coverage.
- [ ] Add view-model and confirmed-only UI tests.
- [ ] Run repository type-check, automated tests, and production build.
- [ ] Record final Phase 2 acceptance evidence.

---

# Implementation slices

## Slice 1 — Record home

Status: `[-] In progress`

- Personal-record navigation
- Patient overview
- Longitudinal timeline
- Emergency summary
- Assistant as a secondary workspace
- Local record access without an AI key
- Focused regression coverage

## Slice 2 — Core clinical lists

Status: `[ ] Not started`

- Conditions
- Allergies
- Medications
- Labs and diagnostic reports

## Slice 3 — Visits and longitudinal documentation

Status: `[ ] Not started`

- Encounters
- Notes
- Procedures
- Immunizations
- Documents

## Slice 4 — Planning and follow-up

Status: `[ ] Not started`

- Appointments
- Tasks
- Care plans
- Reminders

## Slice 5 — Manual entry and amendments

Status: `[ ] Not started`

- Resource forms
- Corrections
- Entered-in-error handling
- Provenance review

## Slice 6 — Search, export, and final validation

Status: `[ ] Not started`

- Cross-record search
- Patient summary export
- Accessibility and responsive validation
- Phase 2 acceptance suite

---

# Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-07-31 | Build Phase 2 as a stacked branch based on the completed Phase 1 head. | Phase 2 depends directly on the new structured record while keeping the completed Phase 1 PR independently reviewable. |
| 2026-07-31 | Make the record overview the default destination and keep the assistant as one workspace. | A local personal health record must remain useful without AI access and should not make chat the primary medical-record interface. |
| 2026-07-31 | Use deterministic view models over confirmed resources. | Overview, timeline, and emergency information should not require AI generation or introduce new clinical assertions. |
| 2026-07-31 | Separate clinically undated events from dated timeline entries. | Sorting an unknown clinical event by its storage timestamp could falsely imply when it occurred. |

---

# Progress log

| Date | Slice | Work completed | Validation | Commit label |
|---|---|---|---|---|
| 2026-07-31 | P2.0 / Slice 1 | Created the Phase 2 branch and living implementation plan. | Branch created from the accepted Phase 1 head. | `docs: add Phase 2 personal health record plan` |
