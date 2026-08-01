# Phase 5 Slice 2 — Deterministic summaries and grounded Assistant integration

## Purpose

This slice replaces loose patient-context chat behavior with two explicit paths:

1. a deterministic, no-AI confirmed-record summary;
2. a patient-record Assistant path that receives a fresh patient-scoped evidence bundle and is withheld unless local citation identifiers validate.

General educational chat and source-document analysis remain separate from patient-record grounding.

## Deterministic summary

`buildDeterministicPatientSummary()` consumes the same `PatientGroundingBundle` used by the Assistant. It never invokes an AI provider.

The summary separates:

- patient profile;
- current problems;
- allergies and intolerances;
- active medications;
- recent results and reports;
- visits and encounters;
- plans and appointments;
- tasks and reminders;
- selected confirmed history;
- missing or incomplete information.

Every included record item retains its stable `MB:<ResourceType>:<resourceId>` evidence ID, clinical-date precision, and source label. Candidate content is counted but not rendered as fact. Diagnostic graph and unit-comparability conflicts are counted and described as review issues, not diagnoses.

Unknown dates remain `Clinical date unknown`. Empty allergy, medication, and condition sections use cautious wording and never assert NKDA, no medications, or no conditions.

## Assistant routing

The Assistant uses a deterministic request classifier for explicit record commands and patient-record questions. It does not ask a model to decide whether the model itself should receive patient data.

Recognized record questions are mapped to relevant resource types where possible. Historical evidence is included only when the question explicitly asks for history, prior, past, resolved, completed, or superseded information.

A patient-record request uses a fresh evidence bundle and an empty model conversation history. Previous chat messages therefore cannot become patient facts.

The prompt contract requires:

- exact local citations after patient-specific statements;
- no invented local evidence IDs;
- no substitution of candidate, rejected, entered-in-error, negated, hypothetical, or non-patient evidence;
- preservation of unknown dates, uncertainty, original values, and planning/completion states;
- `INSUFFICIENT_CONFIRMED_EVIDENCE` when the selected bundle cannot answer the question;
- no diagnosis, prescribing, dose changes, medication-safety verdict, triage, or external-action claims.

## Buffered validation

Patient-record answers are buffered instead of streamed into the visible chat. After generation:

- an exact insufficient-evidence response becomes a standardized local message;
- valid local citation IDs allow the answer to be displayed with a limitation footer;
- missing or invented citations cause the complete generated answer to be withheld.

The current validator proves only citation syntax and membership in the selected evidence bundle. It does not prove sentence-level entailment, completeness, clinical correctness, or real-world guideline validity.

## No-AI availability

The Assistant access screen displays the deterministic summary even when no AI provider key is configured. The `/summary`, `/patient`, `/record`, and `/brief` commands also produce the same deterministic summary without a model call when the Assistant is available.

## Audit boundary

The integration records separate events for deterministic summary generation, grounding-bundle selection, successful grounded answers, and citation-rejected answers. No event implies that an answer was clinically validated.

## Validation

Final Slice 2 head: `e288967f529dcc83765b56c7a6c22d9b84e8e884`

GitHub Actions run **628** (`30675197979`) passed:

- Python OpenMed bridge tests: **24 / 24**;
- TypeScript type-check;
- **46 / 46** Vitest files;
- **203 / 203** TypeScript tests;
- **6 / 6** deterministic-summary and grounded-Assistant tests;
- production Vite build;
- **1062** transformed modules.

The main application chunk is approximately **2.10 MB minified / 569 kB gzip**. Existing bundle-size, mixed-import, runtime stylesheet, dependency-maintenance, and action-runtime warnings remain separate performance/dependency workstreams.

## Out of scope

This slice does not implement medication reconciliation, trend interpretation, reminders, validated pilot rules, statement-level semantic entailment, autonomous record changes, diagnosis, prescribing, or treatment recommendations.
