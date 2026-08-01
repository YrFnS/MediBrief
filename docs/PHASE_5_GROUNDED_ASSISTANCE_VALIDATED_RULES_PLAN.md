# Phase 5 — Grounded assistance and validated rules

> Branch: `agent/phase-5-grounded-assistance`  
> Base: accepted Phase 4 head `7dcc74d61bc4aec3bcc7effd6bd9496ccff83e88`  
> Status: in progress  
> Current focus: Slice 3 — medication reconciliation  
> Product boundary: local personal health-record assistance, not autonomous diagnosis, prescribing, triage, or treatment execution

## Goal

Reintroduce useful summaries, medication review, trend explanations, reminders, and narrowly validated advisories on top of MediBrief's confirmed, source-linked clinical record.

Patient-specific assistance must use a patient-scoped confirmed-record evidence bundle rather than loose strings or prior chat history. Deterministic rules fail closed unless their population, inputs, exclusions, evidence, version, validation state, and regression package are complete.

## Non-negotiable boundaries

- Chat is not the medical record.
- Candidates, rejected assertions, entered-in-error resources, negated assertions, hypothetical assertions, and non-patient experiencers do not become patient facts.
- Superseded diagnostic evidence remains historical by default.
- Unknown dates, values, units, directions, and source relationships remain unknown.
- Original source quantities remain authoritative; normalized values are secondary.
- Patient-record model answers are displayed only after local citation IDs pass validation.
- Citation membership is not sentence-level entailment, completeness, clinical correctness, or real-world validation.
- Reminders and tasks are not orders, bookings, completed actions, or treatment.
- No deterministic rule runs merely because its code exists.

## P5.0 — Planning, inventory, and release gate

Status: `[x] Complete`

- [x] Preserve the stacked PR sequence.
- [x] Create Phase 5 from accepted Phase 4.
- [x] Open draft PR #5.
- [x] Define boundaries and implementation order.
- [x] Wire repository validation.
- [x] Inventory assistant, briefing, medication, trend, reminder, and CDSS paths.

## P5.1 — Confirmed-record grounding and citation boundary

Status: `[x] Complete`

- [x] Versioned patient grounding bundles.
- [x] One confirmed, patient-applicable eligibility boundary.
- [x] Current, planning, and history scopes.
- [x] Superseded diagnostic evidence kept historical.
- [x] Stable `MB:<ClinicalResourceType>:<resourceId>` citations.
- [x] Original and normalized values kept separate.
- [x] Source pages and unknown/partial dates preserved.
- [x] Deterministic evidence selection and limits.
- [x] Citation syntax and selected-bundle membership validation.
- [x] Fail-closed validated-rule executor.
- [x] Empty validated-rule registry by default.

## P5.2 — Deterministic summaries and grounded Assistant integration

Status: `[x] Complete`

### Deterministic summary

- [x] No-AI summary built from the grounding bundle.
- [x] Separate profile, current problems, allergies, medications, recent results/reports, visits, plans, tasks, history, and missing information.
- [x] Stable citations, sources, date precision, original values, and normalized views.
- [x] Pending candidate and diagnostic conflict counts without presenting candidate content as fact.
- [x] Cautious empty states and explicit unknown dates.
- [x] Markdown output and no-key Assistant panel.

### Grounded Assistant

- [x] Deterministic routing for summary commands and patient-record questions.
- [x] Fresh patient evidence with no prior chat used as patient fact.
- [x] Relevant resource selection and explicit history opt-in.
- [x] Required exact local citations.
- [x] Standard insufficient-evidence response.
- [x] Buffered output; no visible patient wording before validation.
- [x] Complete withholding for missing or invented citations.
- [x] Separate general chat and document-analysis paths.
- [x] Grounded output excluded from legacy lab ingestion.
- [x] Audit events and regression coverage.

### Validation

Implementation validated at `dd880f138e39f4d7fdaaf8ba9b7125ab8b40e56e` by GitHub Actions run **630** (`30675265526`):

- OpenMed Python tests: **24 / 24**
- TypeScript type-check: passed
- Test files: **46 / 46**
- Tests: **203 / 203**
- Slice 2 tests: **6 / 6**
- Phase 5 foundation tests: **6 / 6**
- Production build: passed
- Modules transformed: **1062**
- Main chunk: approximately **2.10 MB minified / 569 kB gzip**

Synthetic fixtures validate software contracts and routing; they do not establish clinical accuracy or semantic entailment.

## P5.3 — Medication reconciliation

Status: `[ ] Not started — next`

- [ ] Dedicated human-review workspace.
- [ ] Compare statements, requests, and administrations without automatic authority.
- [ ] Detect exact duplicates, status/direction conflicts, missing directions/dates, uncertain active status, and source disagreements.
- [ ] Preserve all sources and amendment history.
- [ ] Name every compared record and source.
- [ ] Require reviewed decisions and reasons before record changes.
- [ ] Keep label retrieval separate from regimen conclusions.
- [ ] Do not infer adherence, intent, discontinuation, appropriateness, interaction safety, organ adjustment, pregnancy suitability, or indication.

Acceptance requires evidence-backed review questions rather than automatic medication changes. No medication is marked safe, verified, active, stopped, or duplicate solely from model output.

## P5.4 — Conservative trend explanations and reminders

Status: `[ ] Not started`

- [ ] Use only Phase 4-eligible trend points and exclusions.
- [ ] Generate deterministic descriptions before optional model wording.
- [ ] Cite every used point/report group.
- [ ] Preserve units, normalization basis, specimen, date precision, and exclusions.
- [ ] Avoid diagnosis, causality, prognosis, treatment, and significance claims.
- [ ] Derive reminders only from explicit durable records and known dates.
- [ ] Never manufacture due dates.
- [ ] Create proposal tasks only after explicit user action.

## P5.5 — Validated low-risk rules, workspace integration, and final acceptance

Status: `[-] Foundation complete; pilots and final integration pending`

Completed:

- [x] Versioned rule metadata and evidence contracts.
- [x] Fail-closed execution.
- [x] Validated advisory stamping.
- [x] Legacy order actions converted to task proposals.
- [x] Empty registry by default.

Remaining:

- [ ] Low-risk data-quality/workflow pilot rules with full review packages.
- [ ] Evidence drawer and source preview.
- [ ] Reconciliation and reminder workspaces.
- [ ] Grounded/error state UI refinements.
- [ ] Audit review UI and PHI-free contract corpora.
- [ ] Final immutable release gate and acceptance evidence.

Diagnosis, prescribing, treatment, dose adjustment, emergency triage, drug-interaction safety, and protocol-state rules remain disabled unless separately validated.

## Implementation order

1. Slice 1 — grounding and fail-closed rules: complete.
2. Slice 2 — deterministic summaries and citation-gated Assistant: complete.
3. Slice 3 — medication reconciliation: next.
4. Slice 4 — trend explanations and reminders.
5. Slice 5 — low-risk rule pilots, evidence UI, audit, and final acceptance.
