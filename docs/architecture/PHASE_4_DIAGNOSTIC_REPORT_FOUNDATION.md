# Phase 4 Slice 1 — Diagnostic Report Graph Foundation

## Purpose

This slice establishes a source-linked, atomic diagnostic graph before MediBrief replaces its existing row-oriented laboratory review experience.

The graph contains:

```text
DocumentReference
        ↓
DiagnosticReport
   ↙            ↘
Specimen(s)   Observation(s)
```

The report owns the clinical and workflow context. Observations hold atomic results. Specimens preserve collection context. The original uploaded document remains the authoritative source.

## Why a graph is required

Saving independent laboratory rows loses important context:

- which report the results came from;
- which specimen produced a result;
- whether the report was preliminary, final, amended, or corrected;
- which source page supports a result;
- which results were reviewed together;
- whether a retry created a duplicate report;
- whether a report was partially written after an error.

Slice 1 therefore builds and validates the complete graph before making one patient-record replacement.

## Reviewed draft boundary

`ReviewedDiagnosticReportDraft` is an application-owned input contract. It is intentionally independent from Gemini, OpenMed, OCR engines, or a future manual-entry form.

A draft can preserve:

- report title, status, categories, effective date, issue timestamp, performer, conclusion, identifiers, and accession;
- one or more specimen drafts;
- one or more result drafts;
- result-level source page, section, offsets, and excerpt;
- candidate or explicitly reviewed/confirmed status.

The draft schema requires:

- one patient;
- one source document;
- unique result local IDs;
- unique specimen local IDs;
- every result to have a value or an absent-result reason;
- every specimen reference to resolve inside the draft;
- valid source-offset ordering.

## Source truth and value parsing

### Numeric results

The parser recognizes unambiguous numeric values and preserves these comparators:

```text
<
<=
>
>=
≤
≥
```

The normalized comparator is stored structurally, while the source value remains represented by the resulting original quantity.

### Decimal commas

A value such as:

```text
5,4
```

is not guessed to be either `5.4` or `54`. It remains a text result with a review warning.

### Qualitative results

Recognized qualitative values include:

- positive;
- negative;
- reactive;
- non-reactive;
- detected;
- not detected;
- trace;
- equivocal;
- indeterminate;
- present;
- absent.

These are represented as codeable-concept observations rather than numeric values.

### Absent results

A missing value and an explicit absent-result reason are different from a negative result.

The current core Observation contract does not yet have a dedicated `dataAbsentReason` field, so Slice 1:

- leaves `value` unset;
- adds the `data-absent` tag;
- preserves the reason in the observation note;
- records this limitation in the Phase 4 tracker for a later backward-compatible core-model extension.

### Reference ranges

The parser supports:

- bounded ranges such as `4.0 – 10.0`;
- one-sided ranges such as `<5`, `<=5`, `>10`, and `>=10`;
- qualitative or narrative ranges such as `Negative`;
- unparsed numeric range text without discarding it.

The original range string is always retained.

## Unit policy

Slice 1 recognizes only a small, conservative UCUM alias set.

When a safe alias is recognized:

- the original printed unit remains in `unit`;
- the UCUM system and code are added.

When an alias is not recognized:

- the original unit remains unchanged;
- no UCUM code is invented;
- a warning is attached to the bundle.

No value conversion occurs in this slice.

## Date policy

Accepted clinical-date precision is inherited from the existing clinical record:

```text
YYYY-MM-DD
YYYY-MM
YYYY
unknown
```

A valid ISO date-time can contribute its date portion while preserving the full source string in `sourceText`.

Ambiguous or unsupported dates remain explicit unknown dates with a warning. Upload, extraction, review, and storage timestamps never become clinical event dates.

`issuedAt` accepts only an unambiguous ISO date-time. A date-only or ambiguous value remains source evidence and is not promoted to an issue timestamp.

## Identifier limitation

The current core `DiagnosticReportRecord` and `SpecimenRecord` contracts do not yet expose dedicated identifier arrays.

Slice 1 preserves:

- the accession or first report identifier as source `externalId`;
- all report identifiers in provenance description;
- specimen identifiers in the specimen note;
- explicit warnings that the identifiers are temporarily preserved outside dedicated fields.

A later Phase 4 schema extension can migrate these values into first-class identifier fields without losing them.

## Graph validation

Before persistence, the validator checks:

- exactly one report exists;
- every resource belongs to the same patient;
- resource IDs are unique;
- report `resultIds` exactly match bundle observations;
- report `specimenIds` match bundle specimens;
- every observation points back to the report;
- every observation specimen link resolves;
- the original source document exists in the patient record;
- no resource ID conflicts with existing records;
- no equivalent report from the same source already exists.

## Duplicate policy

An existing report is considered equivalent when either:

1. source system and external ID match; or
2. source document, normalized report title, and effective date match.

A duplicate is reported explicitly. The second graph is not written.

Reports from different source documents remain separate even when their names and values are similar.

## Atomic persistence

`commitDiagnosticReportBundle` performs these steps synchronously:

1. Load the current patient record.
2. Detect an equivalent source report.
3. Validate the complete graph against the current record.
4. Link the source document to the report with amendment history.
5. Append specimens, observations, and the report to a cloned patient record.
6. Validate the complete resulting patient record.
7. Replace the patient record once.

If validation fails, no report, specimen, observation, or document link is written.

## Confirmation semantics

A draft may produce candidate or confirmed resources.

Confirmed output requires an explicit reviewed draft and receives confirmation metadata explaining that report metadata and included rows were reviewed before saving.

This builder does not automatically confirm OCR or model output. The future report-level review UI will be responsible for constructing the reviewed draft.

## Accepted limitations for Slice 1

- Dedicated report/specimen identifier fields are pending.
- Dedicated `dataAbsentReason`, method, body-site, panel-member, and richer reference-range fields are pending.
- Precise specimen collection date-time requires a core-model extension.
- Decimal-comma interpretation is intentionally deferred.
- Unit conversion is not implemented.
- The existing row-oriented review UI is not replaced in this slice.
- Panel grouping, trends, corrected-report lineage, and conflict presentation remain later slices.

These limitations are explicit and source-preserving; none require inventing clinical facts.
