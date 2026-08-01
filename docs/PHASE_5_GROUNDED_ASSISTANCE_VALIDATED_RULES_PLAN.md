# Phase 5 — Grounded assistance and validated rules

Branch: `agent/phase-5-grounded-assistance`  
Base: accepted Phase 4 head `7dcc74d61bc4aec3bcc7effd6bd9496ccff83e88`  
Status: in progress  
Next: conservative trend explanations and explicit reminders

## Safety boundary

Patient-specific assistance uses confirmed, patient-applicable, source-linked evidence. Candidates, rejected or entered-in-error resources, negated or hypothetical assertions, non-patient evidence, and superseded diagnostic evidence do not silently become current patient facts. Original values remain authoritative, unknown dates remain unknown, and citation membership is not semantic or clinical validation.

Medication reconciliation compares source-linked records and records human workflow decisions. It does not establish adherence, prescribing intent, regimen safety, or permission to start, stop, or change treatment.

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

Slice 3 final validation is recorded in PR #5 after the complete repository gate passes on the immutable final head.

## Next — Slice 4 trend explanations and reminders

### Conservative trend explanations

- [ ] Consume only Phase 4 trend-eligible current points.
- [ ] Generate deterministic values, dates, ranges, change, and descriptive statistics first.
- [ ] Cite every point used by an optional model explanation.
- [ ] State unit, normalization basis, specimen context, date precision, and exclusion reasons.
- [ ] Exclude superseded, comparator, qualitative, unknown-date, partial-date, incompatible-unit, and otherwise ineligible points.
- [ ] Avoid diagnosis, causality, prognosis, treatment recommendations, and unsupported clinical-significance claims.

### Explicit reminders

- [ ] Derive reminders only from durable appointments, tasks, care plans, medication dates, or reviewed rule outputs.
- [ ] Distinguish due, overdue, completed, cancelled, unknown-date, and unscheduled states.
- [ ] Never manufacture a due date from `recordedAt`, upload time, extraction time, review time, or model output.
- [ ] Create local proposal tasks only after explicit user action.
- [ ] Never claim external booking, order transmission, notification delivery, or completed care.

## Later — Slice 5 low-risk rules and final acceptance

- [ ] Add only reviewed low-risk workflow/data-quality pilot rules with complete metadata and PHI-free regression packages.
- [ ] Add an evidence drawer and source preview for grounded answers and validated advisories.
- [ ] Add audit review for grounding, reconciliation, reminders, rule evaluation, and advisory actions.
- [ ] Complete PHI-free contract corpora and final acceptance evidence.
- [ ] Run the complete Python, TypeScript, Vitest, evaluation-contract, and production-build gates on the immutable final head.

Diagnosis, prescribing, treatment, dose adjustment, emergency triage, drug-interaction safety, and protocol-state rules remain disabled unless separately validated.
