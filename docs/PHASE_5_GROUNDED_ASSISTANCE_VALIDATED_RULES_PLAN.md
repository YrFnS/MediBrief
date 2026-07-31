# Phase 5 — Grounded assistance and validated rules

> Branch: `agent/phase-5-grounded-assistance`  
> Base: accepted Phase 4 head `7dcc74d61bc4aec3bcc7effd6bd9496ccff83e88`  
> Status: in progress  
> Product boundary: local personal health-record assistance, not autonomous diagnosis, prescribing, triage, or treatment execution

## Goal

Reintroduce useful summaries, medication review, trend explanations, reminders, and narrowly validated advisories on top of MediBrief's confirmed, source-linked clinical record.

Phase 5 must not restore the old pattern of sending loose patient strings and chat history to a model and treating the response as clinical truth. Every patient-specific statement must be traceable to confirmed record evidence, and every executable deterministic rule must have an explicit population, input contract, version, evidence record, validation state, and regression suite.

## Non-negotiable boundaries

- Chat is not the medical record.
- Candidates, rejected assertions, entered-in-error resources, negated assertions, hypothetical assertions, and non-patient experiencers do not become patient facts.
- Superseded diagnostic results remain historical and do not silently become current evidence.
- Unknown dates, values, units, medication directions, and source relationships remain unknown.
- Normalized values never replace original source values.
- Assistant output may summarize or explain recorded evidence, but it may not create confirmed facts.
- Model-generated citations are checked against a local evidence bundle; invented evidence identifiers are rejected.
- A citation proves only that a record item supports the statement shown. It does not prove clinical correctness or real-world guideline validity.
- A reminder or task is not an order, booking, completed action, or treatment.
- No deterministic rule runs merely because its code exists.
- No rule may produce a validated advisory without reviewed validation metadata and source citations.
- Phase 5 acceptance evidence must distinguish synthetic contract tests from real-world clinical validation.

---

# P5.0 — Planning, inventory, and release gate

Status: `[-] In progress`

- [x] Preserve the stacked PR sequence and promote Phase 4 to ready-for-review without merging the top of the stack out of order.
- [x] Create the Phase 5 branch from the immutable accepted Phase 4 head.
- [x] Define the Phase 5 roadmap and safety boundaries.
- [ ] Extend CI triggers to the Phase 5 branch and stacked PR base.
- [ ] Inventory every current assistant prompt, record-context path, briefing/export path, medication-review path, trend component, reminder path, and CDSS compatibility entry point.
- [ ] Record the current unsupported or disabled behavior before re-enabling anything.

### Baseline observations

- `evaluateClinicalSafety()` intentionally returns no alerts.
- The CDSS UI renders only advisories marked `validationStatus: validated`.
- Existing model calls still depend primarily on chat prompts/history and provider grounding rather than a patient-scoped confirmed-record evidence contract.
- Existing web grounding credibility checks do not replace local patient-record provenance.
- The Phase 4 diagnostic layer already provides conservative panel membership, original-versus-normalized quantities, current-versus-superseded results, and trend exclusions. Phase 5 must consume those boundaries rather than reimplement weaker logic.

---

# P5.1 — Confirmed-record grounding and citation boundary

Status: `[-] In progress`

## Deliverables

- [ ] Add versioned patient grounding-bundle contracts.
- [ ] Flatten the patient record through a single confirmed, patient-applicable eligibility boundary.
- [ ] Classify evidence as current, planning, or historical.
- [ ] Keep superseded diagnostic reports and results historical.
- [ ] Generate stable local evidence identifiers tied to resource type and resource ID.
- [ ] Produce deterministic, structured evidence statements without embedding raw source-document instructions.
- [ ] Preserve original quantities and show normalized values only as secondary views.
- [ ] Preserve unknown and partial clinical dates.
- [ ] Record source-document, page, manual-entry, import, and extraction provenance labels.
- [ ] Render a model context that explicitly treats record values as untrusted data rather than instructions.
- [ ] Add deterministic query-based evidence selection and prompt-size limits.
- [ ] Validate answer citation syntax and reject unknown local evidence IDs.
- [ ] Audit grounded-answer generation, evidence selection, and citation failures.

## Acceptance criteria

- Candidate, rejected, entered-in-error, negated, hypothetical, family, and other-person evidence never appears as an ordinary patient fact.
- The grounding bundle is useful without an AI provider.
- Reordering unrelated resources does not change evidence identity.
- An answer containing an invented local citation is not presented as grounded.
- No upload, extraction, review, or storage timestamp is substituted for a missing clinical date.
- The implementation states clearly that citation validation is not semantic fact-checking.

---

# P5.2 — Grounded summaries and medication reconciliation

Status: `[ ] Not started`

## Record summaries

- [ ] Build deterministic confirmed-record summary sections before invoking a model.
- [ ] Separate current problems, history, allergies, active medications, recent results, visits, plans, tasks, and missing information.
- [ ] Require local evidence citations for every patient-specific model statement.
- [ ] Keep candidate and conflict counts visible without presenting candidate content as confirmed fact.
- [ ] Provide a no-AI readable summary using the same evidence bundle.

## Medication reconciliation

- [ ] Compare confirmed medication statements, requests, and administrations without claiming that one is automatically authoritative.
- [ ] Detect exact duplicates, status conflicts, direction conflicts, missing directions, missing dates, and uncertain active status.
- [ ] Preserve each source and reviewed amendment history.
- [ ] Require human resolution before changing the confirmed medication record.
- [ ] Keep FDA-label retrieval separate from patient-specific regimen conclusions.
- [ ] Do not infer adherence, prescribing intent, discontinuation, dose appropriateness, interaction safety, renal adjustment, or pregnancy suitability from incomplete records.

## Acceptance criteria

- Medication reconciliation produces a review workspace and evidence-backed questions, not automatic medication changes.
- No medication is marked safe, verified, active, stopped, or duplicate solely from model output.
- Every proposed reconciliation decision names the records and sources being compared.

---

# P5.3 — Conservative trend explanations and reminders

Status: `[ ] Not started`

## Trend explanations

- [ ] Consume Phase 4's existing conservative trend series and exclusion reasons.
- [ ] Generate deterministic descriptive statistics and date/value summaries first.
- [ ] Allow an optional model explanation only over the selected trend evidence.
- [ ] Cite every plotted point or report group used in the explanation.
- [ ] State unit, normalization basis, specimen context, date precision, and exclusions.
- [ ] Avoid diagnosis, causality, prognosis, treatment recommendations, and clinical significance claims.

## Reminders

- [ ] Build reminders only from explicit appointments, tasks, care plans, medication dates, and reviewed rule outputs.
- [ ] Distinguish due, overdue, completed, cancelled, unknown-date, and unscheduled states.
- [ ] Never manufacture a due date from `recordedAt`, upload time, or model output.
- [ ] Create local proposal tasks only after an explicit user action.

## Acceptance criteria

- A trend explanation cannot include a superseded, comparator, qualitative, unknown-date, partial-date, incompatible-unit, or otherwise excluded point.
- Reminder text never claims an external booking, order, notification delivery, or completed care action.

---

# P5.4 — Validated deterministic rule framework

Status: `[-] In progress`

## Rule contract

Every rule definition must include:

- stable rule ID and semantic version;
- owner and review status;
- intended population;
- explicit required inputs;
- exclusions and contraindicated use contexts;
- output class and allowed severity;
- evidence citations and evidence version/date;
- validation status and validation date;
- PHI-free regression fixtures;
- evaluator function with no hidden network dependency;
- failure behavior when data is missing or ambiguous.

## Execution boundary

- [ ] Add a fail-closed validated-rule executor.
- [ ] Draft, incomplete, retired, or unvalidated rules return no advisory.
- [ ] Executed advisories are stamped with rule ID, version, validation status, and source citation.
- [ ] Missing required inputs produce no conclusion.
- [ ] Rules may recommend review or create a proposal task; they may not execute care.
- [ ] Preserve the disabled legacy rule engine as a compatibility boundary until callers migrate.

## Pilot rule policy

The first enabled rules should be low-risk data-quality or workflow rules, such as:

- missing source for a confirmed record;
- unresolved candidate or diagnostic conflict requiring review;
- explicit task or appointment overdue based on a known recorded date;
- incompatible data preventing a requested trend explanation.

Diagnosis, treatment, dose adjustment, emergency triage, drug-interaction safety, and protocol-state claims remain disabled until separately validated with appropriate domain review and evidence.

## Acceptance criteria

- Merely setting `validationStatus: validated` is insufficient if required metadata or citations are absent.
- A rule cannot elevate its own validation state at runtime.
- Regression fixtures test positive, negative, missing-input, ambiguous-input, and boundary cases.
- Rule evaluation is deterministic and patient-scoped.

---

# P5.5 — Workspace integration, audit, evaluation, and final acceptance

Status: `[ ] Not started`

- [ ] Add a grounded-answer evidence drawer with local record citations and original-source preview.
- [ ] Add visible states for grounded, partially grounded, unsupported citation, no confirmed evidence, and provider unavailable.
- [ ] Add medication-reconciliation and reminder review workspaces.
- [ ] Add validated-advisory metadata and evidence presentation.
- [ ] Add audit events for evidence-bundle generation, grounded answer completion/failure, reconciliation decisions, reminder-task creation, rule evaluation, and advisory actions.
- [ ] Add PHI-free contract corpora for grounding selection, citation validation, summaries, reconciliation, trends, reminders, and rules.
- [ ] Run TypeScript type-check, all Vitest suites, Python bridge tests, evaluation-contract gates, and the production build.
- [ ] Record exact final head, workflow run, test totals, bundle observations, and accepted limitations.

## Final Phase 5 acceptance criteria

- Assistant patient-specific statements are generated from a patient-scoped confirmed-record evidence bundle.
- Local evidence identifiers are stable and source-reviewable.
- Unknown or invented citations are visibly rejected.
- Deterministic summaries remain available without AI.
- Medication reconciliation never silently changes the record.
- Trend explanations consume only Phase 4-eligible current points.
- Reminders derive only from explicit known dates and durable records.
- Only complete, reviewed, versioned rules can generate validated advisories.
- No Phase 5 feature claims autonomous diagnosis, treatment, prescribing, emergency triage, external execution, or real-world validation that has not been measured.
- Complete repository validation passes on the immutable final head.

---

# Proposed implementation order

1. **Slice 1:** grounding bundle, stable citations, citation assessment, tests, and CI wiring.
2. **Slice 2:** deterministic summaries and grounded assistant integration.
3. **Slice 3:** medication reconciliation workspace and reviewed decisions.
4. **Slice 4:** conservative trend explanations and explicit reminders.
5. **Slice 5:** validated rule registry, low-risk pilot rules, advisory UI, audit, and final acceptance.

The order is intentional: no summary, explanation, reminder, or rule should be exposed before its evidence boundary and fail-closed validation behavior exist.