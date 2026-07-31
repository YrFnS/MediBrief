# Phase 4 Slice 2 — Report-Level Diagnostic Review Workspace

## Status

Implemented on `agent/phase-4-diagnostic-report-pipeline`.

This slice replaces the legacy row-only lab verification modal with one source-linked review workflow for a complete diagnostic graph.

## Why the legacy flow was retired

The previous lab dialog edited a flat table and then saved only rows that could be parsed as numbers. That behavior could not faithfully represent a medical report because it:

- created no `DiagnosticReport` resource;
- created no `Specimen` resource;
- did not connect observations to their report or source document;
- discarded qualitative, narrative, comparator, and absent results;
- treated review/storage time as the issue time;
- used a narrow range parser;
- preserved no report-level correction or exclusion history;
- wrote the compatibility observation store separately from the structured record.

The old modal and its numeric-row writer have been removed.

## New review boundary

A legacy lab JSON response is now placed into `PendingLegacyLabReview` together with the uploaded source context:

```text
LabReport extraction
        +
DocumentReference identity
        +
filename / MIME type / page when available
        ↓
PendingLegacyLabReview
        ↓
DiagnosticReportReviewWorkspace
```

Creating this pending object changes no clinical fact.

When an uploaded file has a stable storage ID, the pending source uses the same deterministic document identity as the Phase 3 extraction workflow:

```text
document-{storageId}
```

A report response without a linked source may still be inspected, but confirmation is blocked.

## Source-first layout

The workspace displays the original local report beside the review form.

`DiagnosticReportSourcePane` resolves the patient-scoped `DocumentReference`, loads its encrypted local asset, and supports:

- PDF preview with page navigation;
- image preview;
- UTF-8 text and JSON/XML source preview;
- local download for unsupported inline formats;
- explicit missing-record and missing-binary states.

The source file remains authoritative. AI output, OCR text, structured parsing, and entered edits are secondary review evidence.

## Report-level review

The reviewer can correct:

- report title;
- report status;
- report clinical date;
- issued timestamp;
- performer;
- accession identifier;
- conclusion or report comment.

Unknown dates remain blank and are converted to explicit unknown clinical dates by the Slice 1 parser. The workspace does not substitute upload, extraction, detection, review, or storage time.

## Specimen review

Specimens are separate resources. The reviewer can add, edit, or remove:

- specimen type;
- status;
- identifier;
- collection date;
- received date;
- collector;
- body site;
- collection method;
- notes.

Removing a specimen also clears result references to that specimen before graph validation.

No specimen is created merely because a report is a laboratory report.

## Result review

Each extracted result can be:

- included;
- edited;
- excluded;
- used as the basis for source-page navigation.

The reviewer may also add a result that was visible in the source but missed by extraction.

Editable result fields include:

- test name;
- optional LOINC code;
- result status;
- value text;
- unit text;
- reference range text;
- recorded interpretation flag;
- absent-result reason;
- clinical date;
- issue timestamp;
- specimen relationship;
- source page and section;
- method;
- body site;
- source excerpt;
- notes.

Values are not restricted to numbers. The Slice 1 parser remains responsible for preserving numeric comparators, qualitative values, textual values, and absent-result states.

## Review evidence and amendments

The workspace compares the extracted seed with the final reviewed draft.

`buildDiagnosticReviewEvidence()` records:

- report fields that changed;
- result fields that changed;
- specimen fields that changed;
- extracted rows excluded by the reviewer;
- a review or correction reason.

`applyDiagnosticReviewEvidence()` converts that evidence into clinical amendments:

- changed report fields and excluded rows are retained on the report amendment;
- changed result fields are retained on each observation amendment;
- changed specimen fields are retained on each specimen amendment.

Excluded rows do not create observations, but their original extracted values remain in report history. They are not silently deleted.

## Live graph validation

Before enabling confirmation, the workspace builds a preview bundle and validates it against the current patient record.

Confirmation remains blocked when any of these are true:

- no result remains included;
- a draft fails schema validation;
- patient ownership is inconsistent;
- result or specimen local IDs are invalid;
- a result references a missing specimen;
- the source document is missing;
- the source document belongs to another patient;
- graph resource IDs conflict;
- an equivalent report already exists from the same source;
- report/result/specimen links are incomplete.

Parsing warnings remain visible but do not become diagnoses or automatic corrections.

## Atomic confirmation

The final action calls:

```text
buildAndCommitReviewedDiagnosticReport()
```

The workflow:

1. Validates the reviewed draft.
2. Builds one report/specimen/result bundle.
3. Applies review amendments.
4. Validates the complete graph against the patient record.
5. Links the source document to the report.
6. Replaces the patient aggregate once.

If validation or parsing fails, no report, observation, specimen, or source relationship is written.

A successful save creates one connected graph; it does not diagnose the patient, interpret a flag as a disease, contact a laboratory, place an order, or perform treatment.

## Audit events

Slice 2 adds three distinct audit events:

```text
DIAGNOSTIC_REPORT_REVIEW_STARTED
DIAGNOSTIC_REPORT_REVIEW_CONFIRMED
DIAGNOSTIC_REPORT_REVIEW_CANCELLED
```

Confirmation metadata includes the report ID, created resource IDs, source document, included result count, specimen count, excluded-row count, review evidence, and parser warnings.

## Compatibility behavior

The legacy AI response schema remains supported only as an intake adapter. It no longer owns persistence.

The legacy compatibility observation store is not written by the new review workflow. Confirmed diagnostic data lives in the versioned structured record as connected `DiagnosticReport`, `Observation`, and `Specimen` resources.

## Safety boundaries

- Extraction remains unconfirmed until source review.
- The source document is required for confirmation.
- Unknown dates remain unknown.
- Original values, units, ranges, and excerpts remain available.
- A recorded interpretation flag is not a diagnosis.
- LOINC and UCUM remain optional evidence rather than inferred authority.
- Excluded rows remain in review history.
- Confirmation is atomic.
- No automatic treatment or clinical-rule execution is triggered.

## Regression coverage

Slice 2 tests cover:

- source-linked pending review state;
- candidate-only seed creation;
- report metadata correction;
- result correction and prior-value retention;
- per-result exclusion and retained exclusion evidence;
- specimen creation and result relationships;
- absent-result preservation;
- atomic report/specimen/result confirmation;
- source-document linking;
- missing-source rejection with no partial writes;
- retirement of the old numeric-only modal and writer;
- source-pane, graph-validation, audit, and UI contracts.

Final integrated test counts are recorded in the Phase 4 plan and PR after GitHub Actions passes.
