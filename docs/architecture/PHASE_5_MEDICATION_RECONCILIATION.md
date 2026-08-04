# Phase 5 Slice 3 — Medication reconciliation

## Purpose

Medication reconciliation is a source-comparison and human-review workflow. It is not a medication-safety verdict, an adherence assessment, a prescribing decision, or an instruction to start, stop, or change treatment.

The implementation follows the general reconciliation pattern described by AHRQ's MATCH toolkit: assemble medication evidence, compare it, identify discrepancies, and document their resolution. It also preserves the transition-of-care caution emphasized by WHO: discrepancies and miscommunication are common enough that source context must remain visible.

Reference material:

- AHRQ MATCH toolkit: https://www.ahrq.gov/patient-safety/settings/hospital/match/index.html
- AHRQ MATCH introduction: https://www.ahrq.gov/patient-safety/settings/hospital/match/chapter-1.html
- AHRQ medication reconciliation process design: https://www.ahrq.gov/patient-safety/settings/hospital/match/chapter-3.html
- WHO medication safety in transitions of care: https://www.who.int/publications/i/item/WHO-UHC-SDS-2019.9

These sources inform workflow design only. MediBrief does not claim that this local implementation has been clinically validated against real-world reconciliation outcomes.

## Record boundary

The workspace reads confirmed, patient-applicable `MedicationRecord` resources only.

It excludes:

- candidates;
- rejected records;
- entered-in-error records;
- negated medication assertions;
- hypothetical assertions;
- family or other-person evidence.

Candidate medication counts remain visible and link back to the existing candidate-review workflow, but candidate content is not compared as confirmed patient fact.

## Medication kinds remain distinct

MediBrief preserves the schema distinction between:

```text
statement
request
administration
```

A medication statement may describe reported or ongoing use. A medication request may describe prescribing intent. A medication administration may describe a discrete administration event. The workspace does not select one kind as automatically authoritative and does not compare cross-kind status values as though they meant the same thing.

When multiple kinds exist for one medication identity, MediBrief presents an informational context item rather than a duplicate or status-conflict conclusion.

## Conservative identity grouping

Grouping uses exact normalized medication text and available reviewed coding.

When a record contains a code and another otherwise similar record is uncoded, they remain separate until their coding identity is confirmed. Text similarity alone does not prove product, formulation, strength, or coding equivalence.

No fuzzy medication-name merge is performed.

## Detected review items

The deterministic engine can produce:

- possible duplicate medication records;
- status conflicts within the same record kind and overlapping or date-uncertain periods;
- direction conflicts within statement or request records;
- missing directions;
- missing clinical dates;
- unknown active status;
- cross-kind context information.

A possible duplicate is not automatically deleted or marked entered in error. A status or direction conflict is not automatically resolved. Detection creates a review question only.

## Date semantics

Known start, end, and effective dates are preserved with their recorded precision.

If no clinical date is supported by the record, the workspace displays:

```text
Clinical date unknown
```

Recorded, upload, extraction, review, and storage timestamps are never substituted as medication start, stop, administration, or list dates.

## Evidence preservation

Every reconciliation record view preserves:

- resource ID and local `MB:Medication:<id>` evidence ID;
- medication name and reviewed coding identity;
- record kind and status;
- complete dosage text and structured dose details;
- start, end, and effective dates;
- reason or indication;
- prescriber;
- note;
- source label;
- original source document and page when available;
- amendment count.

The original confirmed medication resources remain unchanged while the workspace is calculating discrepancies.

## Durable review decisions

A reviewer can record one of these workflow decisions:

```text
keep records separate
a likely duplicate requires correction
one or more records require correction
insufficient evidence — no record change
reviewed — no change needed
```

Every decision requires a reason. The audit event records:

- stable issue ID and fingerprint;
- issue type;
- decision and reason;
- medication name;
- record IDs;
- source labels;
- reviewer and review time;
- optional follow-up task ID.

The issue fingerprint includes the compared record snapshots. If a medication record is later amended, the discrepancy receives a new fingerprint instead of inheriting a stale review decision.

## No automatic clinical mutation

Saving a reconciliation decision does not call:

```text
amendResource
markResourceEnteredInError
confirmCandidate
rejectCandidate
```

Medication status, directions, dates, sources, and other confirmed facts change only through the existing human correction workflow in **Manage Records**.

A decision that correction is needed remains `action-pending` until the source-backed record correction is performed separately.

## Optional follow-up task

After an explicit user action, the workspace can create a local `ClinicalTask` with:

```text
status: requested
intent: proposal
due date: unknown
```

The task links to every medication record involved in the discrepancy. It is tagged `not-an-order` and states that it is not a prescription, medication order, regimen change, or proof that any action was performed.

## Audit events

```text
MEDICATION_RECONCILIATION_REVIEWED
MEDICATION_RECONCILIATION_TASK_CREATED
```

These events represent workflow review only. They do not establish medication safety, adherence, prescribing intent, or clinical correctness.

## Explicit limitations

The workspace does not determine:

- whether the patient is taking a medication;
- whether a prescription is current;
- whether a medication should be stopped or resumed;
- whether directions are clinically appropriate;
- interaction, allergy, kidney, liver, pregnancy, age, or weight safety;
- therapeutic duplication;
- formulary equivalence;
- product, formulation, or strength equivalence from text similarity;
- clinician intent;
- real-world medication reconciliation accuracy.

It organizes source-linked discrepancies for human review and durable correction.
