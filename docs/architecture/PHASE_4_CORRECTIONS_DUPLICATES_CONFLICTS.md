# Phase 4 Slice 4 — Corrections, duplicates, and conflicts

## Decision boundary

MediBrief never overwrites a reviewed diagnostic report or result when a later source corrects, amends, or replaces it. The later graph is stored as a new `DiagnosticReport` and new `Observation` resources. Explicit relationships point backward to the prior report and result versions.

```text
prior DiagnosticReport  ← corrects / amends / replaces — new DiagnosticReport
prior Observation       ← superseded by lineage          — new Observation
```

Reverse “superseded by” views are derived from the new resources. Historical source values therefore remain immutable and independently reviewable.

## Duplicate and conflict classes

The detector compares only reviewed structured evidence and reports why a match was raised:

- **Exact duplicate** — a shared source document or accession identity with identical structured results. Confirmation is blocked until the reviewer chooses “duplicate”; no new clinical resource is written.
- **Same-event conflict** — shared source/accession identity with differing result content. Confirmation is blocked until the reviewer records `corrects`, `amends`, `replaces`, or an explicit distinct-report decision.
- **Possible duplicate** — same reviewed title/date with meaningful or even identical result content but no strong event identifier. This is advisory because two legitimate reports may share those characteristics.

No fuzzy title match alone can delete or merge data.

## Reviewed resolution

A resolution records:

- the selected related report;
- one explicit decision;
- a required human reason;
- the reviewer and timestamp through report relationship metadata and audit events.

Status and relationship must agree: `amends` requires an amended report, while `corrects` requires a corrected report.

## Result lineage

For corrected, amended, and replacement reports, member results are paired deterministically by confirmed LOINC identity or exact reviewed name plus specimen context. Matched new observations point to one predecessor observation. Unmatched rows remain legitimate additions. Prior rows omitted from the new report remain preserved in the older report and become superseded through report lineage even when no one-to-one successor row exists.

A predecessor cannot be superseded by multiple observations in the same version.

## Trends and presentation

Superseded results:

- remain visible with original values, provenance, and source preview;
- appear in the Version history workspace;
- are excluded from current numeric trends with the explicit reason `superseded-result`.

Current report panels are shown separately from superseded report panels. The UI never hides history by mutating old records to entered-in-error.

## Atomicity

For a created version, the new report, observations, specimens, document link, relationship metadata, and result lineage are validated before one patient-record replacement. Validation failure writes nothing.

A reviewed duplicate resolution also writes no clinical resource and returns `resolved-duplicate` so the audit trail can distinguish an intentional skip from a failed save.

## Accepted limitations

- Matching is conservative and local to one patient record.
- Identifier extraction still relies partly on preserved accession tags and source provenance until dedicated identifier fields are introduced.
- Result pairing does not claim method equivalence.
- Possible-duplicate warnings are advisory to avoid collapsing legitimate same-day reports.
- No report is deleted automatically.
