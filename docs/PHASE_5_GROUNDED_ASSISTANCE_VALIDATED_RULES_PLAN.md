# Phase 5 — Grounded assistance and validated rules

Branch: `agent/phase-5-grounded-assistance`  
Base: accepted Phase 4 head `7dcc74d61bc4aec3bcc7effd6bd9496ccff83e88`  
Status: complete  
Acceptance evidence: `docs/PHASE_5_FINAL_ACCEPTANCE.md`

## Safety boundary

Phase 5 adds useful patient-record assistance only through confirmed, patient-applicable, source-linked evidence and explicit fail-closed contracts.

It does not enable autonomous diagnosis, treatment recommendations, prescribing, dose changes, medication-safety verdicts, emergency triage, clinical-urgency assignment, protocol-state decisions, automatic clinical-record mutation, or claims that an external action occurred.

Original values remain authoritative, normalized values remain secondary views, unknown dates remain unknown, and local citation membership is not sentence-level entailment or clinical validation.

## Completed slices

### Slice 1 — Grounding and fail-closed rule foundation

- [x] Versioned patient grounding bundles.
- [x] One confirmed, patient-applicable eligibility boundary.
- [x] Current, planning, and historical evidence scopes.
- [x] Stable `MB:<ResourceType>:<resourceId>` evidence identifiers.
- [x] Source labels, pages, original values, normalized secondary views, and date precision.
- [x] Citation syntax and selected-bundle membership validation.
- [x] Fail-closed versioned rule executor.
- [x] Draft, retired, incomplete, evaluator-error, disallowed-level, and unsafe legacy actions withheld or converted to local proposals.

### Slice 2 — Deterministic summaries and citation-gated Assistant

- [x] No-AI confirmed-record summary.
- [x] Separate profile, conditions, allergies, medications, results/reports, visits, plans, tasks, history, and missing information.
- [x] Candidate and conflict counts without presenting candidates as patient facts.
- [x] Cautious empty states and explicit unknown dates.
- [x] Deterministic routing for summary commands and recognizable patient-record questions.
- [x] Fresh patient evidence with no prior chat treated as patient fact.
- [x] Explicit history opt-in.
- [x] Exact local citations and standardized insufficient-evidence response.
- [x] Buffered patient-record model output.
- [x] Complete output withholding for missing or invented citations.
- [x] Exact referenced evidence IDs recorded in audit history.

Validated Slice 2 head: `999f0f9f9a881b30673364e044ee616b4f4eb32d`  
GitHub Actions run **640** (`30675435938`) passed with **46 / 46** TypeScript test files and **203 / 203** tests.

### Slice 3 — Medication reconciliation

- [x] Dedicated Health Data reconciliation workspace.
- [x] Confirmed medication statements, requests, and administrations compared without selecting one kind as automatically authoritative.
- [x] Candidate, rejected, entered-in-error, negated, hypothetical, family, and other-person evidence excluded from confirmed comparison.
- [x] Conservative same-kind duplicate and status-conflict review questions.
- [x] Statement/request direction conflicts, missing directions, unknown dates, and uncertain status surfaced without automatic conclusions.
- [x] Coded and uncoded identities kept separate until reviewed coding identity is confirmed.
- [x] Original source text, dates, directions, prescriber, reasons, notes, document/page, and amendments preserved.
- [x] Human reason required for durable decisions.
- [x] Snapshot-sensitive fingerprints prevent stale decisions from following later amendments.
- [x] Optional local routine proposal task with unknown due date and `not-an-order` wording.
- [x] No automatic medication mutation.

Validated Slice 3 head: `1a68db1abd7d5977bf58fd5d23530965d1b94f78`  
GitHub Actions run **670** (`30677222206`) passed with **48 / 48** TypeScript test files and **213 / 213** tests.

### Slice 4 — Conservative trend explanations and explicit reminders

#### Trend explanations

- [x] Consume only Phase 4-eligible current plotted observations.
- [x] Preserve original values, optional normalized views, exact dates, reports, documents/pages, and `MB:Observation:<id>` evidence IDs.
- [x] Deterministically calculate point count, date span, first/last values, recorded direction, absolute change, minimum, maximum, and elapsed days before any model call.
- [x] State grouping basis, LOINC when confirmed, specimen context, unit, normalization basis, exclusions, and unit conflicts.
- [x] Keep candidate, superseded, comparator, qualitative, narrative, absent, unknown-date, partial-date, single-point, warning, insufficient-identity, missing-unit, and incompatible-unit evidence outside explanations.
- [x] Optional model wording receives only exact plotted points, no prior chat, and no web tools.
- [x] Entire optional wording withheld unless every plotted point has valid citation coverage.
- [x] No diagnosis, causality, prognosis, treatment recommendation, dose change, or clinical-significance claim.

#### Explicit reminders

- [x] Derive reminders only from confirmed appointments, tasks, care plans, medication dates, and durable reviewed-advisory tasks.
- [x] Use only explicit appointment, task, care-plan, medication, or durable task date fields.
- [x] Never manufacture due dates from `recordedAt`, upload, extraction, review, storage, or model timestamps.
- [x] Distinguish passed, due-today, upcoming, later, completed, cancelled, unknown/imprecise-date, and unscheduled states.
- [x] Preserve source status, label, document/page, date precision, evidence ID, and action boundary.
- [x] Require explicit user action and a reason before creating a local routine proposal task.
- [x] State that no notification, booking, order, prescription, treatment instruction, or external action was sent.

Validated Slice 4 head: `b05866a3cf8dbfff96781190a43d5e8e75430b3d`  
GitHub Actions run **714** (`30678908743`) passed with **50 / 50** TypeScript test files and **222 / 222** tests.

### Slice 5 — Low-risk validated pilots, evidence review, and audit

#### Reviewed pilot registry

- [x] Register only three reviewed `Info`-level workflow/data-quality pilots:
  - confirmed record clinical-date completeness review;
  - current confirmed medication direction completeness review;
  - confirmed open task due-date completeness review.
- [x] Require owner, reviewer, semantic version, intended population, required inputs, exclusions, evidence citations, safety boundaries, validation date, and PHI-free regression package.
- [x] Fail closed for draft/retired rules, incomplete metadata, evaluator errors, disallowed severity, wrong risk class, missing evidence, and invalid local evidence IDs.
- [x] Keep diagnosis, treatment, prescribing, medication safety, dose adjustment, triage, urgency, and protocol-state rules disabled.
- [x] Prevent review-generated `not-an-order` proposal tasks from recursively triggering the open-task pilot.
- [x] Never substitute report issuance, `recordedAt`, upload, extraction, review, or storage timestamps for a missing clinical event date.

#### Exact evidence and durable review

- [x] Attach exact local evidence IDs and a snapshot-sensitive fingerprint to every matched advisory.
- [x] Reuse the confirmed patient-grounding boundary for evidence resolution.
- [x] Add an evidence drawer with source wording, date precision, provenance label, local citation, and original document/page preview.
- [x] Require a non-empty reason for acknowledgment or local task creation.
- [x] Keep acknowledgment as audit evidence only.
- [x] Create only a confirmed, requested, routine `ClinicalTask` proposal with explicit unknown due date and `not-an-order` wording.
- [x] Keep source-backed corrections in Manage Records.

#### Rules and audit workspace

- [x] Add a patient-scoped global **Rules & audit** workspace.
- [x] Show current advisories, reviewed registry metadata, and Phase 5 audit history.
- [x] Link grounded Assistant, reconciliation, trend, reminder, and rule events back to local evidence when identifiers are available.
- [x] Add actor/type/search filtering.
- [x] Add explicit patient-scoped JSON export with a clear warning that the export is private and not PHI-free.
- [x] Add seven dedicated rule/evidence/audit events.

#### PHI-free regression package

- [x] Commit `evaluation/phase5/low_risk_rule_pilots_v1.json` with **12** synthetic cases.
- [x] Add **9** low-risk rule behavior tests.
- [x] Add **4** final workspace integration contract tests.
- [x] Cover exclusions, fail-closed output, exact evidence, snapshot invalidation, required reasons, proposal-task semantics, source review, audit integration, and the recursive-task guard.

Validated Slice 5 implementation head: `cb8192de5ee7481b948eb73537d39fbbcf8f4535`

GitHub Actions run **716** (`30682448473`) passed:

- Python OpenMed bridge tests: **24 / 24 passed**
- Synthetic assertion-context evaluation: **passed**
- Phase 3 extraction metric contracts: **passed**
- Separate OpenMed/Gemini comparison contract: **passed**
- TypeScript `tsc --noEmit`: **passed**
- TypeScript test files: **52 / 52 passed**
- TypeScript tests: **235 / 235 passed**
- Slice 5 low-risk rule tests: **9 / 9 passed**
- Slice 5 workspace integration tests: **4 / 4 passed**
- Production build: **passed**
- Production modules transformed: **1080**
- Main application chunk: approximately **2.24 MB minified / 603 kB gzip**

The Slice 5 fixtures validate software selection, exclusion, fail-closed, evidence-link, durable-decision, and audit contracts. They are not claims of real-world clinical accuracy, medical safety, urgency detection, or outcome benefit.

## Phase 5 acceptance status

- [x] Slice 1 — grounding and fail-closed rule foundation.
- [x] Slice 2 — deterministic summaries and citation-gated Assistant.
- [x] Slice 3 — medication reconciliation.
- [x] Slice 4 — conservative trend descriptions and explicit reminders.
- [x] Slice 5 — low-risk pilots, evidence UI, audit review, and acceptance package.
- [x] Complete implementation gate passed on the immutable Slice 5 implementation head.
- [ ] Complete repository gate on the final documentation/acceptance head; recorded in PR #5 after the run completes.

## Accepted limitations and follow-on workstreams

- Evidence-ID membership and point coverage are not semantic entailment or clinical correctness.
- Patient-record question routing remains deterministic but heuristic.
- Medication identity matching remains intentionally conservative and local to one patient record.
- Trend arithmetic is not clinical interpretation.
- Reminders and proposal tasks do not deliver background or external notifications.
- Patient-scoped audit JSON exports contain private application data and are not anonymous or PHI-free.
- Synthetic fixtures are contract evidence, not real-world clinical validation.
- The main application bundle remains above Vite's default warning threshold.
- Mixed UUID/blob-storage imports, runtime `/index.css`, Recharts 2.x maintenance, GitHub Actions runtime notices, and package install-script notices remain separate dependency/performance workstreams.

Diagnosis, prescribing, treatment, dose adjustment, emergency triage, drug-interaction safety, clinical-urgency, and protocol-state rules remain disabled unless separately reviewed and validated.
