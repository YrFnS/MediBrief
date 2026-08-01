# Phase 5 Slice 5 — Low-risk validated rules, evidence review, and audit

## Status

Implementation target: `agent/phase-5-grounded-assistance`

Slice 5 closes Phase 5 with a deliberately narrow rule registry and one patient-scoped review workspace. It does not broaden MediBrief into autonomous clinical decision-making.

## Non-negotiable safety boundary

The registered pilots may report only a local workflow or structured-data-quality gap. They must not:

- diagnose or classify a disease;
- determine normality, abnormality, clinical significance, deterioration, improvement, cause, prognosis, or treatment effect;
- recommend treatment, prescribing, medication start/stop, dose adjustment, interaction safety, renal/liver adjustment, or pregnancy suitability;
- perform emergency triage or assign clinical urgency;
- infer a protocol state or permission to proceed;
- manufacture a clinical date, deadline, appointment, order, prescription, or external action;
- automatically mutate a confirmed clinical resource.

Every registered pilot is `Info` only. `Critical` and `Warning` output is outside the reviewed contract and fails closed.

## Registered pilot rules

### 1. Confirmed record clinical-date review

The rule identifies confirmed, patient-applicable clinical facts whose resource-specific clinical fields contain no usable date. It checks explicit fields such as condition onset/abatement, observation effective date, report effective period, specimen collection/receipt, procedure performed date, and immunization occurrence.

It deliberately ignores `recordedAt`, report issuance, upload time, extraction time, review time, and storage time. Those timestamps are never accepted or presented as the missing clinical event date.

Planning records are outside this pilot because appointments, tasks, care plans, and medication timing already have the explicit reminder workflow introduced in Slice 4.

### 2. Active medication direction completeness review

The rule identifies current confirmed medication statements, requests, or administrations whose structured dosage-instruction list contains no non-empty source wording.

It does not infer a missing dose, route, frequency, duration, indication, adherence state, prescribing intent, or regimen safety. A missing structured field does not prove that an external document or clinician has no instructions.

### 3. Open task due-date completeness review

The rule identifies confirmed open local `ClinicalTask` resources with no explicit usable due date or period. It excludes completed/closed tasks and the intentional `not-an-order` proposal tasks produced by review workflows, preventing the rule from recursively advising on its own follow-up tasks.

The task remains unscheduled. The rule does not turn record creation or review time into a deadline and does not classify the task as overdue or urgent.

## Stronger validated-rule contract

The Slice 1 executor remains backward-compatible for its contract tests, but rules that opt into a low-risk `riskClass` must provide all of the following:

- a named owner and reviewer;
- semantic rule version;
- intended population;
- explicit required inputs and exclusions;
- `Info` in the allowed output set;
- reviewed evidence citations;
- explicit safety boundaries;
- a validation date;
- a PHI-free regression package with fixture path, test path, case count, reviewer, and review date.

The executor fails closed when:

- the rule is draft or retired;
- required metadata is missing;
- the evaluator throws;
- the output severity is outside the reviewed contract;
- the output kind does not match the rule risk class;
- the advisory contains no exact local evidence identifiers;
- an emitted evidence identifier does not use the `MB:<ResourceType>:<resourceId>` syntax.

Legacy `order` actions continue to be converted to `create-task` proposals.

## Exact evidence snapshots

Every matched pilot advisory contains:

- a stable rule/version identifier;
- a deterministic fingerprint over the affected resource snapshots;
- exact local evidence IDs;
- validation package ID;
- reviewer and review date;
- reviewed source citations;
- advisory limitations and safety boundaries.

The fingerprint includes resource identity, verification state, source update time, amendment count, and the fields relevant to the rule. A later amendment produces a new fingerprint, so an acknowledgment or task decision does not silently apply to changed evidence.

The evidence drawer resolves IDs through the same confirmed, patient-applicable grounding boundary used by the Assistant. It displays source wording, clinical-date precision, provenance label, qualifiers, local citation, and the original source document/page when available.

Evidence-ID membership is not sentence-level entailment, completeness, clinical correctness, or real-world validation. The UI states this limitation directly.

## Human review and durable actions

A matched advisory supports two explicit actions:

1. **Acknowledge the current evidence snapshot**
2. **Create a local review task**

Both require a non-empty reason.

Acknowledgment records audit evidence only. It does not edit the triggering resources.

A created task is always:

```text
resourceType: ClinicalTask
verificationStatus: confirmed
status: requested
intent: proposal
priority: routine
due date: unknown unless separately added through an explicit source-backed edit
```

The task links the exact triggering resources and is tagged `not-an-order`. Its note states that no notification, booking, order, prescription, treatment instruction, urgency assignment, or external action was sent.

Source-backed corrections remain in **Manage Records**.

## Patient-scoped review workspace

The global **Rules & audit** control opens one patient-scoped workspace with three views:

- **Current advisories** — matched low-risk pilots, exact evidence, durable review decisions, and proposal-task creation.
- **Reviewed registry** — owner, population, inputs, exclusions, evidence citations, safety boundaries, regression package, and current execution result.
- **Phase 5 audit** — grounding, deterministic summaries, grounded Assistant decisions, medication reconciliation, trends, reminders, validated-rule evaluation, advisory generation, evidence review, acknowledgment, and task creation.

Grounded Assistant completion events already record the exact referenced local evidence IDs. The audit view uses those IDs to open the same evidence drawer and source preview used by validated advisories.

## New audit events

```text
VALIDATED_RULE_SET_EVALUATED
VALIDATED_ADVISORY_GENERATED
VALIDATED_ADVISORY_ACKNOWLEDGED
VALIDATED_ADVISORY_TASK_CREATED
VALIDATED_ADVISORY_EVIDENCE_REVIEWED
GROUNDED_EVIDENCE_REVIEWED
AUDIT_REVIEW_EXPORTED
```

These events describe local application workflow only. They do not establish medical correctness, treatment safety, urgency, notification delivery, booking, prescribing, or completed care.

## PHI-free regression package

Package ID:

```text
medibrief-phase5-low-risk-rule-pilots-v1
```

Files:

```text
evaluation/phase5/low_risk_rule_pilots_v1.json
tests/validatedLowRiskRules.test.ts
tests/phase5FinalWorkspace.test.ts
```

The corpus contains 12 synthetic cases covering:

- confirmed missing date match;
- exact date no-match;
- candidate and negated date exclusions;
- missing medication directions match;
- recorded directions no-match;
- completed and candidate medication exclusions;
- open unscheduled task match;
- scheduled task no-match;
- completed task exclusion;
- explicitly unknown task due date remaining unscheduled.

The tests also cover fail-closed metadata, exact evidence resolution, snapshot-sensitive human decisions, required reasons, routine proposal-task semantics, source review, and audit integration.

These fixtures validate software contracts only. They are not claims of clinical accuracy, medical safety, or real-world outcome benefit.
