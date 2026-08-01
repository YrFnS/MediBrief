# Phase 5 — Grounded assistance and validated rules

> Branch: `agent/phase-5-grounded-assistance`  
> Base: accepted Phase 4 head `7dcc74d61bc4aec3bcc7effd6bd9496ccff83e88`  
> Status: in progress  
> Current focus: Slice 3 — medication reconciliation  
> Product boundary: local personal health-record assistance, not autonomous diagnosis, prescribing, triage, or treatment execution

## Goal

Reintroduce useful summaries, medication review, trend explanations, reminders, and narrowly validated advisories on top of MediBrief's confirmed, source-linked clinical record.

Phase 5 must not restore the old pattern of sending loose patient strings and chat history to a model and treating the response as clinical truth. Patient-specific assistance must be selected from a patient-scoped confirmed-record evidence bundle. Deterministic rules must fail closed unless their population, inputs, exclusions, evidence, version, validation state, and regression package are complete.

## Non-negotiable boundaries

- Chat is not the medical record.
- Candidates, rejected assertions, entered-in-error resources, negated assertions, hypothetical assertions, and non-patient experiencers do not become patient facts.
- Superseded diagnostic reports and results remain historical by default.
- Unknown dates, values, units, medication directions, and source relationships remain unknown.
- Original source quantities remain authoritative; normalized values are secondary views.
- Patient-record model answers may be displayed only after local citation identifiers pass validation.
- Citation membership proves that a record item was selected for the request; it does not prove sentence-level entailment, clinical correctness, completeness, or real-world validation.
- A reminder or task is not an order, booking, completed action, or treatment.
- No deterministic rule runs merely because its code exists.
- Phase 5 acceptance evidence must distinguish software-contract fixtures from measured clinical performance.

---

# P5.0 — Planning, inventory, and release gate

Status: `[x] Complete`

- [x] Preserve the stacked PR sequence and promote accepted Phase 4 to ready for review without merging out of order.
- [x] Create the Phase 5 branch from the immutable accepted Phase 4 head.
- [x] Create draft PR #5 against the Phase 4 branch.
- [x] Define the Phase 5 roadmap and safety boundaries.
- [x] Wire the repository validation workflow to Phase 5 branch and PR updates.
- [x] Inventory current assistant prompts, chat-history context, briefing/export behavior, medication paths, Phase 4 trends, reminders, and disabled CDSS compatibility entry points.
- [x] Record the unsupported baseline before re-enabling any assistance.

### Baseline retained

- `evaluateClinicalSafety()` remains disabled and returns no alerts.
- The advisory UI renders only records marked `validationStatus: validated`.
- The default validated-rule registry remains empty.
- General chat and source-document analysis remain separate from patient-record grounding.

---

# P5.1 — Confirmed-record grounding and citation boundary

Status: `[x] Complete`

- [x] Add versioned patient grounding-bundle contracts.
- [x] Flatten the complete patient record through one confirmed, patient-applicable eligibility boundary.
- [x] Exclude candidates, rejected and entered-in-error resources, negated and hypothetical assertions, and family/other-person evidence.
- [x] Classify evidence as current, planning, or history.
- [x] Reuse Phase 4 intelligence so superseded diagnostic evidence remains historical.
- [x] Generate stable local evidence identifiers: `MB:<ClinicalResourceType>:<resourceId>`.
- [x] Produce deterministic structured evidence statements without treating record content as instructions.
- [x] Preserve original quantities, secondary normalized views, source pages, and unknown or partial dates.
- [x] Add deterministic query/resource selection and evidence limits.
- [x] Validate local citation syntax and selected-bundle membership.
- [x] Reject invented local evidence identifiers.
- [x] Add fail-closed validated-rule contracts and executor.
- [x] Keep the validated-rule registry empty until individual review packages exist.
- [x] Add regression tests and architecture documentation.

### Accepted boundary

The current citation checker validates identifier syntax and membership in the exact evidence bundle selected for the request. It does not claim semantic fact-checking or clinical validation.

---

# P5.2 — Deterministic summaries and grounded Assistant integration

Status: `[x] Complete`

## Deterministic summary

- [x] Build the summary before any model call using the same confirmed-record evidence boundary.
- [x] Separate patient profile, current problems, allergies, active medications, recent results/reports, visits, plans/appointments, tasks/reminders, selected history, and missing information.
- [x] Preserve stable local citations, source labels, clinical-date precision, original values, and secondary normalized views.
- [x] Count pending candidates and diagnostic graph/unit conflicts without presenting candidate content as fact.
- [x] Use cautious empty states for allergies, medications, and conditions.
- [x] Keep unknown dates explicitly unknown.
- [x] Provide readable Markdown and a no-AI summary panel.
- [x] Keep the no-AI summary available on the Assistant screen when no provider key is configured.

## Grounded Assistant

- [x] Add deterministic classification for explicit summary commands and patient-record questions.
- [x] Route recognized patient-record questions through fresh patient-scoped evidence rather than prior chat messages.
- [x] Select relevant resource types and include history only when explicitly requested.
- [x] Require exact local citations after patient-specific statements.
- [x] Require `INSUFFICIENT_CONFIRMED_EVIDENCE` when selected evidence cannot answer the question.
- [x] Buffer patient-record responses instead of streaming unvalidated text into the visible chat.
- [x] Withhold the entire generated answer when local citations are missing or invented.
- [x] Keep general educational chat and uploaded-document analysis on their separate existing paths.
- [x] Prevent grounded patient-record output from entering legacy lab-extraction handling.
- [x] Add audit events for summary generation, evidence selection, successful grounded answers, and rejected answers.
- [x] Add source-level and behavioral regression coverage.
- [x] Document the architecture and limitations.

### Slice 2 validation

Final validated head: `dd880f138e39f4d7fdaaf8ba9b7125ab8b40e56e`

GitHub Actions run **630** (`30675265526`) passed:

- Python OpenMed bridge tests: **24 / 24**
- TypeScript type-check: passed
- TypeScript test files: **46 / 46**
- TypeScript tests: **203 / 203**
- New summary and grounded-Assistant tests: **6 / 6**
- Existing Phase 5 foundation tests: **6 / 6**
- Production build: passed
- Modules transformed: **1062**
- Main application chunk: approximately **2.10 MB minified / 569 kB gzip**

The test fixtures validate code contracts and routing behavior; they do not establish real-world clinical accuracy or sentence-level entailment.

---

# P5.3 — Medication reconciliation

Status: `[ ] Not started — next`

- [ ] Build a dedicated human-review workspace rather than hiding reconciliation inside general chat.
- [ ] Compare confirmed medication statements, requests, and administrations without declaring one automatically authoritative.
- [ ] Detect exact duplicates, status conflicts, direction conflicts, missing directions, missing dates, uncertain active status, and source disagreements.
- [ ] Preserve every source and amendment history.
- [ ] Name the exact records and sources being compared.
- [ ] Require a reviewed decision and reason before changing a confirmed medication record.
- [ ] Keep FDA-label retrieval separate from patient-specific regimen conclusions.
- [ ] Do not infer adherence, prescribing intent, discontinuation, dose appropriateness, interaction safety, kidney/liver adjustment, pregnancy suitability, or indication from incomplete records.

## Acceptance criteria

- Reconciliation produces evidence-backed review questions and proposals, not automatic medication changes.
- No medication is marked safe, verified, active, stopped, or duplicate solely from model output.
- Conflicting records remain independently source-reviewable until the user resolves them.
- Failed or cancelled reconciliation creates no record mutation.

---

# P5.4 — Conservative trend explanations and reminders

Status: `[ ] Not started`

## Trend explanations

- [ ] Consume Phase 4's conservative trend series and exclusion reasons.
- [ ] Generate deterministic date/value descriptions before optional model wording.
- [ ] Cite every plotted point or report group used.
- [ ] State unit, normalization basis, specimen context, date precision, and exclusions.
- [ ] Avoid diagnosis, causality, prognosis, treatment recommendation, and clinical-significance claims.

## Reminders

- [ ] Derive reminders only from explicit appointments, tasks, care plans, medication dates, and reviewed rule outputs.
- [ ] Distinguish due, overdue, completed, cancelled, unknown-date, and unscheduled states.
- [ ] Never manufacture a due date from `recordedAt`, upload time, extraction time, or model output.
- [ ] Create local proposal tasks only after explicit user action.

---

# P5.5 — Validated low-risk rules, workspace integration, and final acceptance

Status: `[-] Foundation complete; pilots and final integration pending`

## Completed foundation

- [x] Add versioned rule definitions with owner, population, required inputs, exclusions, allowed levels, evidence citations, validation status, and validation date.
- [x] Fail closed for draft, retired, incomplete, evaluator-error, and disallowed-severity rules.
- [x] Stamp successful advisories with rule ID/version, validation state, and citations.
- [x] Convert legacy `order` actions into local `create-task` proposals.
- [x] Keep the registry empty by default.

## Remaining

- [ ] Add only low-risk data-quality or workflow pilot rules with complete review packages.
- [ ] Add an evidence drawer with local citations and source preview.
- [ ] Add medication-reconciliation and reminder review workspaces.
- [ ] Add visible grounded, insufficient-evidence, citation-rejected, and provider-error states where needed.
- [ ] Add audit review UI for grounding, reconciliation, reminders, rule evaluation, and advisory actions.
- [ ] Add PHI-free contract corpora for reconciliation, trends, reminders, and pilot rules.
- [ ] Run the complete final repository gate and record the immutable accepted head.

Diagnosis, prescribing, treatment, dose adjustment, emergency triage, drug-interaction safety, and protocol-state claims remain disabled unless separately validated with appropriate evidence and domain review.

---

# Implementation order

1. **Slice 1 — complete:** grounding bundle, stable citations, citation assessment, fail-closed rule executor, tests, and CI.
2. **Slice 2 — complete:** deterministic summaries, no-AI summary UI, citation-gated Assistant integration, audit, and tests.
3. **Slice 3 — next:** medication reconciliation workspace and reviewed decisions.
4. **Slice 4:** conservative trend explanations and explicit reminders.
5. **Slice 5:** low-risk validated rule pilots, evidence UI, audit review, and final acceptance.

The order is intentional: no reconciliation decision, explanation, reminder, or advisory should be exposed before its evidence boundary, human-review behavior, and fail-closed tests exist.
