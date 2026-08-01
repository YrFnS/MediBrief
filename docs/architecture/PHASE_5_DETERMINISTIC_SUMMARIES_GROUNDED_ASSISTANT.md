# Phase 5 Slice 2 — Deterministic summaries and grounded Assistant integration

## Purpose

This slice replaces loose patient-context chat behavior with two explicit paths:

1. a deterministic, no-AI confirmed-record summary;
2. a patient-record Assistant path that receives a fresh patient-scoped evidence bundle and is withheld unless local citation identifiers validate.

General educational chat and source-document analysis remain separate from patient-record grounding.

## Deterministic summary

`buildDeterministicPatientSummary()` consumes the same `PatientGroundingBundle` used by the Assistant. It never invokes an AI provider.

The summary separates patient profile, current problems, allergies, active medications, recent results/reports, visits, plans/appointments, tasks/reminders, selected confirmed history, and missing information.

Each item retains its stable `MB:<ResourceType>:<resourceId>` evidence ID, date precision, and source label. Candidate content is counted but not rendered as fact. Diagnostic graph and unit-comparability conflicts are described as review issues rather than diagnoses.

Unknown dates remain `Clinical date unknown`. Empty allergy, medication, and condition sections never assert NKDA, no medications, or no conditions.

## Assistant routing

A deterministic classifier handles explicit summary commands and recognizable patient-record questions. It does not ask a model to decide whether the model should receive patient data.

Recognized questions are mapped to relevant resource types where possible. History is included only when the question explicitly asks for past, prior, resolved, completed, or superseded evidence.

A patient-record request uses a fresh evidence bundle and an empty model conversation history. Previous chat messages therefore cannot become patient facts.

The prompt contract requires exact local citations, preservation of unknowns and source wording, `INSUFFICIENT_CONFIRMED_EVIDENCE` when needed, and no diagnosis, prescribing, dose change, medication-safety verdict, triage, or external-action claim.

## Buffered validation

Patient-record answers are buffered instead of streamed visibly. Valid citation IDs allow display with a limitation footer. Missing or invented citations cause the entire generated answer to be withheld.

The validator proves citation syntax and selected-bundle membership only. It does not prove sentence-level entailment, completeness, clinical correctness, or guideline validity.

## No-AI availability

The Assistant access screen displays the deterministic summary without a provider key. `/summary`, `/patient`, `/record`, and `/brief` produce the same summary without a model call when the chat interface is available.

## Audit boundary

Separate events record deterministic summary generation, grounding selection, successful grounded responses, and citation rejection. No audit event implies clinical validation.

## Validation

The implementation was validated at head `dd880f138e39f4d7fdaaf8ba9b7125ab8b40e56e` by GitHub Actions run **630** (`30675265526`):

- Python OpenMed bridge tests: **24 / 24**;
- TypeScript type-check;
- **46 / 46** Vitest files;
- **203 / 203** TypeScript tests;
- **6 / 6** deterministic-summary and grounded-Assistant tests;
- production Vite build;
- **1062** transformed modules.

The main application chunk is approximately **2.10 MB minified / 569 kB gzip**. Existing bundle-size, mixed-import, runtime stylesheet, dependency-maintenance, and action-runtime warnings remain separate workstreams.

## Out of scope

Medication reconciliation, trend interpretation, reminders, validated pilot rules, statement-level semantic entailment, autonomous record changes, diagnosis, prescribing, and treatment recommendations remain out of scope for this slice.
