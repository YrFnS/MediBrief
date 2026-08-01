# Phase 5 Slice 4 — Conservative trend explanations and explicit reminders

## Purpose

This slice adds two deterministic, patient-scoped workflows on top of the confirmed clinical record:

1. recorded trend descriptions that consume only Phase 4-eligible points;
2. reminder views derived only from explicit durable record fields.

Neither workflow diagnoses, determines clinical significance, assigns urgency, recommends treatment, sends a notification, contacts a clinic, executes an order, or proves that an action occurred.

## Trend evidence boundary

`buildDeterministicTrendViewModel()` consumes `buildDiagnosticResultsIntelligence()` directly. It does not create a weaker second eligibility engine.

A plotted point is therefore already required by Phase 4 to be:

- confirmed;
- patient-applicable;
- current rather than superseded;
- final, amended, or corrected;
- an exact numeric quantity without a comparator;
- linked to an exact clinical day;
- free of unresolved normalization warnings;
- supported by sufficient test identity;
- grouped with a compatible unit;
- part of a series with at least two comparable points.

Comparator, qualitative, narrative, absent, candidate, superseded, unknown-date, partial-date, single-point, normalization-warning, insufficient-identity, missing-unit, and incompatible-unit observations remain outside the explanation. They remain visible through the existing diagnostic workspace and exclusion lists.

## Deterministic trend description

For each eligible series, MediBrief calculates only descriptive arithmetic:

- point count;
- exact date span;
- first and last plotted values;
- recorded higher, lower, or unchanged direction;
- absolute first-to-last difference;
- minimum and maximum plotted values;
- elapsed calendar days;
- original versus normalized plotting basis;
- specimen and grouping basis;
- matching exclusions and unit-conflict notices.

Every point retains:

```text
MB:Observation:<observation-id>
```

as well as its original source value, optional normalized view, report names, source document, and page.

The wording deliberately avoids improvement, worsening, significance, diagnosis, causality, prognosis, treatment effect, and recommended action.

## Optional model wording

Optional model wording is not required for the deterministic view.

When explicitly requested from a trend card:

1. MediBrief builds a fresh confirmed-record grounding bundle containing only the plotted observations for that one series.
2. Prior chat, excluded observations, superseded observations, and unrelated patient records are not supplied.
3. Gemini is invoked without tools; OpenRouter is invoked without tool declarations. Web search is unavailable in this route.
4. Output remains hidden until local citations validate.
5. Every plotted point must be cited at least once.
6. Missing, invented, or incomplete plotted-point citations cause the complete generated wording to be withheld.

Citation membership still does not prove sentence-level entailment, clinical correctness, completeness, or real-world accuracy.

## Reminder evidence boundary

`buildExplicitReminderViewModel()` considers confirmed, patient-applicable:

- appointments;
- clinical tasks;
- care plans;
- medication records;
- reviewed advisory follow-up tasks represented as durable `ClinicalTask` records.

It excludes candidates, rejected or entered-in-error resources, negated assertions, hypothetical assertions, and family or other-person evidence.

Candidate counts remain visible without presenting candidate content as confirmed reminder evidence.

## Date sources

Reminder timing may use only explicit source fields:

| Record | Permitted reminder date |
|---|---|
| Appointment | `start`, otherwise the first requested period |
| Clinical task | `due` |
| Care plan | period end, otherwise period start |
| Medication | explicit end date, otherwise an exact future start date |
| Reviewed advisory | the due field of its durable proposal task |

The reminder engine does not use:

- `recordedAt`;
- upload time;
- extraction time;
- review time;
- storage time;
- model output;
- a historical medication start date as a future reminder.

Month-only, year-only, and explicitly unknown dates remain imprecise and do not become exact-day reminders.

## Reminder states

The derived view distinguishes:

```text
overdue
due-today
upcoming
later
completed
cancelled
unknown-date
unscheduled
```

A passed date means only that the recorded date has passed. It does not prove that care was missed, that the item is clinically urgent, or that an external action should occur.

Completed and cancelled states come from the durable source status rather than date arithmetic.

## Explicit follow-up tasks

A non-task reminder may create a local follow-up task only after the user:

1. selects **Create local review task**;
2. enters a non-empty reason;
3. explicitly saves the task.

The new task always uses:

```text
resourceType: ClinicalTask
verificationStatus: confirmed
status: requested
intent: proposal
priority: routine
```

A future exact source date may be copied to the task. Overdue, imprecise, unknown, or unscheduled reminders produce a task whose due date remains unknown.

The task is tagged `not-an-order` and states that it is not a prescription, booking, notification delivery, treatment instruction, or proof of external execution.

## Audit events

```text
TREND_SUMMARY_GENERATED
TREND_GROUNDING_BUNDLE_GENERATED
TREND_ASSISTANT_COMPLETED
TREND_ASSISTANT_REJECTED
REMINDER_TASK_CREATED
```

These events document application workflow and evidence selection. They do not establish clinical validation or task completion.

## Accepted limitations

- Arithmetic direction is not clinical significance.
- Reference ranges and source flags are not interpreted automatically.
- Method compatibility can remain uncertain even when names, specimens, codes, and units match.
- Reminder timing uses UTC-day comparison for deterministic tests and browser behavior.
- The application does not provide background notifications or external delivery.
- The optional model citation gate checks evidence identity and complete point coverage, not semantic entailment.
- No treatment, diagnosis, emergency-triage, dose-adjustment, or drug-safety rule is enabled by this slice.
