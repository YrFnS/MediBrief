# Phase 5 Slice 2 — Deterministic summaries and grounded Assistant integration

This slice adds a deterministic no-AI confirmed-record summary and a patient-record Assistant route that uses a fresh patient-scoped evidence bundle.

## Summary behavior

The summary separates profile, current problems, allergies, active medications, recent results/reports, visits, plans/appointments, tasks/reminders, selected history, and missing information. Stable `MB:<ResourceType>:<resourceId>` citations, source labels, original values, normalized secondary views, and clinical-date precision are retained. Candidate content is counted but not shown as fact. Unknown dates stay unknown, and empty allergy/medication/condition states remain cautious.

The same local summary is visible without an AI provider key and is returned by `/summary`, `/brief`, `/patient`, and `/record` without a model call.

## Grounded Assistant behavior

A deterministic classifier routes recognizable patient-record questions. Relevant resource types are selected, and history is included only when explicitly requested. Patient-record model requests use an empty conversation history so old chat cannot become patient fact.

The model contract requires exact local citations, preserves source wording and unknowns, and requires `INSUFFICIENT_CONFIRMED_EVIDENCE` when the selected evidence cannot answer. It forbids diagnosis, prescribing, dose changes, safety verdicts, triage, and external-action claims.

Patient-record output is buffered. Missing or invented citations cause the complete generated answer to be withheld. Passing citation membership does not prove sentence-level entailment, completeness, clinical correctness, or real-world validation.

General educational chat and uploaded-document analysis remain separate. Grounded patient output cannot enter the legacy lab-ingestion path.

## Audit

Separate events record deterministic summary generation, evidence-bundle generation, grounded completion, and citation rejection. No event implies clinical validation.

## Validation

Implementation head `dd880f138e39f4d7fdaaf8ba9b7125ab8b40e56e` passed GitHub Actions run **630** (`30675265526`):

- Python OpenMed tests: **24 / 24**
- TypeScript type-check: passed
- Test files: **46 / 46**
- Tests: **203 / 203**
- New Slice 2 tests: **6 / 6**
- Existing Phase 5 foundation tests: **6 / 6**
- Production build: passed
- Modules transformed: **1062**
- Main chunk: approximately **2.10 MB minified / 569 kB gzip**

Medication reconciliation, trend explanations, reminders, pilot rules, semantic entailment, diagnosis, prescribing, and treatment recommendations remain outside this slice.
