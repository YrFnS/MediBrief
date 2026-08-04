# Phase 5 — Grounded assistance and validated rules

Branch: `agent/phase-5-grounded-assistance`  
Base: accepted Phase 4 head `7dcc74d61bc4aec3bcc7effd6bd9496ccff83e88`  
Status: in progress  
Next: low-risk validated rule pilots and final acceptance

## Safety boundary

Patient-specific assistance uses confirmed, patient-applicable, source-linked evidence. Candidates, rejected or entered-in-error resources, negated or hypothetical assertions, non-patient evidence, and superseded diagnostic evidence do not silently become current patient facts. Original values remain authoritative, unknown dates remain unknown, and citation membership is not semantic or clinical validation.

Medication reconciliation compares source-linked records and records human workflow decisions. It does not establish adherence, prescribing intent, regimen safety, or permission to start, stop, or change treatment.

Trend descriptions report deterministic arithmetic over already eligible recorded points. They do not establish clinical significance, improvement, worsening, cause, prognosis, treatment effect, diagnosis, or a recommended action.

Reminder views derive only from explicit durable record fields. They do not send notifications, contact clinics, place orders, book appointments, or prove that an action occurred.

## Completed

### Slice 1 — Grounding and fail-closed rules

- [x] Versioned patient grounding bundles.
- [x] Current, planning, and historical evidence scopes.
- [x] Stable `MB:<ResourceType>:<resourceId>` citation IDs.
- [x] Source labels, pages, original values, normalized secondary views, and date precision.
- [x] Citation syntax and selected-bundle membership validation.
- [x] Fail-closed validated-rule executor.
- [x] Empty validated-rule registry by default.

### Slice 2 — Deterministic summaries and grounded Assistant

- [x] No-AI confirmed-record summary.
- [x] Separate profile, current problems, allergies, medications, recent results/reports, visits, plans, tasks, history, and missing information.
- [x] Candidate and conflict counts without presenting candidates as facts.
- [x] Cautious empty states and explicit unknown dates.
- [x] No-key summary panel.
- [x] Deterministic routing for summary commands and patient-record questions.
- [x] Fresh patient evidence with no prior chat used as patient fact.
- [x] Relevant resource selection and explicit history opt-in.
- [x] Required exact local citations and standardized insufficient-evidence response.
- [x] Buffered patient-record output.
- [x] Entire model answer withheld for missing or invented citations.
- [x] General chat and document analysis remain separate.
- [x] Grounded output excluded from legacy lab ingestion.
- [x] Audit events and regression coverage.

Validated Slice 2 head: `999f0f9f9a881b30673364e044ee616b4f4eb32d`

GitHub Actions run **640** (`30675435938`) passed:

- Python OpenMed tests: **24 / 24**
- TypeScript type-check
- Test files: **46 / 46**
- Tests: **203 / 203**
- Slice 2 tests: **6 / 6**
- Existing Phase 5 foundation tests: **6 / 6**
- Production build
- Modules transformed: **1062**
- Main chunk: approximately **2.10 MB minified / 569 kB gzip**

Synthetic fixtures validate software contracts and routing, not clinical accuracy or sentence-level entailment.

### Slice 3 — Medication reconciliation

- [x] Dedicated Health Data reconciliation workspace.
- [x] Compare confirmed medication statements, requests, and administrations without selecting one kind as automatically authoritative.
- [x] Keep candidate, rejected, entered-in-error, negated, hypothetical, family, and other-person medication evidence outside confirmed reconciliation.
- [x] Detect conservative possible duplicates within the same reviewed identity and record kind.
- [x] Detect overlapping or date-uncertain same-kind status conflicts.
- [x] Detect statement/request direction conflicts.
- [x] Detect missing directions, unknown clinical dates, and uncertain active status.
- [x] Preserve source labels, original documents/pages, dates, directions, prescriber, reasons, notes, record IDs, and amendment counts.
- [x] Keep coded and uncoded identities separate until reviewed coding identity is confirmed.
- [x] Keep statements, requests, and administrations separate and expose cross-kind context as informational evidence.
- [x] Require a human reason for every durable reconciliation decision.
- [x] Store review decisions in audit history without automatically amending medication facts.
- [x] Use snapshot-sensitive issue fingerprints so stale decisions do not follow later record corrections.
- [x] Offer an explicit local follow-up task with `intent: proposal`, unknown due date, linked medication records, and `not-an-order` wording.
- [x] Keep source-backed medication corrections in the existing Manage Records workflow.
- [x] Add regression coverage for selection, discrepancies, cross-kind boundaries, durable decisions, non-mutation, task semantics, source review, and UI integration.

Validated Slice 3 head: `1a68db1abd7d5977bf58fd5d23530965d1b94f78`

GitHub Actions run **670** (`30677222206`) passed:

- Python OpenMed tests: **24 / 24**
- TypeScript type-check
- Test files: **48 / 48**
- Tests: **213 / 213**
- Medication reconciliation behavior tests: **6 / 6**
- Medication reconciliation workspace tests: **4 / 4**
- Production build
- Modules transformed: **1067**
- Main chunk: approximately **2.14 MB minified / 578 kB gzip**

### Slice 4 — Conservative trend explanations and explicit reminders

#### Trend explanations

- [x] Consume the existing Phase 4 result-intelligence output rather than creating a weaker eligibility engine.
- [x] Include only confirmed, patient-applicable, current, exact numeric, non-comparator, exact-day, compatible-unit points from series containing at least two observations.
- [x] Preserve every plotted point's original value, optional normalized view, exact date, source report, source document, page, and stable `MB:Observation:<id>` evidence ID.
- [x] Generate deterministic point count, date span, first and last values, recorded higher/lower/unchanged direction, absolute change, minimum, maximum, and elapsed days before any model call.
- [x] State grouping basis, LOINC when confirmed, specimen context, unit, normalization basis, quality notices, matching exclusions, and unit conflicts.
- [x] Keep superseded, candidate, comparator, qualitative, narrative, absent, unknown-date, partial-date, single-point, normalization-warning, insufficient-identity, missing-unit, and incompatible-unit evidence outside the explanation.
- [x] Provide deterministic no-AI wording in a dedicated Health Data workspace.
- [x] Restrict optional model wording to the exact plotted observations with no web tools and no prior chat.
- [x] Buffer optional model wording and withhold it for missing, invented, or incomplete plotted-point citations.
- [x] Require every plotted point to be cited at least once.
- [x] Avoid diagnosis, causality, prognosis, treatment recommendations, dose changes, and unsupported clinical-significance claims.

#### Explicit reminders

- [x] Derive reminders only from confirmed, patient-applicable appointments, clinical tasks, care plans, medication dates, and durable reviewed-advisory tasks.
- [x] Exclude candidate, rejected, entered-in-error, negated, hypothetical, family, and other-person evidence from reminder content.
- [x] Use only appointment start/requested periods, task due fields, care-plan periods, medication end dates, and exact future medication start dates.
- [x] Never manufacture a due date from `recordedAt`, upload time, extraction time, review time, storage time, or model output.
- [x] Keep historical medication starts as context instead of turning them into future reminders.
- [x] Distinguish recorded-date-passed, due-today, upcoming, later, completed, cancelled, unknown/imprecise-date, and unscheduled states.
- [x] Preserve original source status, source label, document/page, date precision, evidence ID, and action boundary.
- [x] Create a routine local proposal task only after explicit user action and a required reason.
- [x] Copy a due date only when a future or same-day exact source date is safe; otherwise keep the task due date unknown.
- [x] State explicitly that proposal tasks do not send notifications, book appointments, place orders or prescriptions, deliver treatment instructions, or prove external execution.
- [x] Add source review, audit events, behavior tests, and workspace contract tests.

Validated Slice 4 implementation head: `94822d1dc8c7a37ce9abab9eeb7d49ec09f5187e`

GitHub Actions run **710** (`30678772175`) passed:

- Python OpenMed bridge tests: **24 / 24**
- Synthetic context, extraction-metric, and separate-provider comparison contracts: **passed**
- TypeScript type-check: **passed**
- Test files: **50 / 50 passed**
- Tests: **222 / 222 passed**
- Trend and reminder behavior tests: **4 / 4 passed**
- Trend and reminder workspace tests: **5 / 5 passed**
- Production build: **passed**
- Modules transformed: **1074**
- Main chunk: approximately **2.19 MB minified / 590 kB gzip**

Slice 4 is accepted. The deterministic and optional-model tests validate software evidence boundaries, citation coverage, date routing, and proposal-task semantics; they are not claims of clinical trend interpretation accuracy, real-world reminder delivery, or medical safety.

## Next — Slice 5 low-risk rules and final acceptance

- [ ] Add only reviewed low-risk workflow/data-quality pilot rules with complete metadata and PHI-free regression packages.
- [ ] Keep diagnosis, treatment, prescribing, medication-safety, dose-adjustment, emergency-triage, and protocol-state rules disabled.
- [ ] Add an evidence drawer and source preview for grounded answers and validated advisories.
- [ ] Add audit review for grounding, reconciliation, trends, reminders, rule evaluation, and advisory actions.
- [ ] Complete PHI-free contract corpora and final Phase 5 acceptance evidence.
- [ ] Run the complete Python, TypeScript, Vitest, evaluation-contract, and production-build gates on the immutable final head.

Diagnosis, prescribing, treatment, dose adjustment, emergency triage, drug-interaction safety, and protocol-state rules remain disabled unless separately validated.
