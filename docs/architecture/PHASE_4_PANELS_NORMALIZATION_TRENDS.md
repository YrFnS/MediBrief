# Phase 4 Slice 3 — Panels, Normalization, and Trends

## Scope

Slice 3 adds a conservative diagnostic-results intelligence layer over the reviewed, connected records established by Slices 1 and 2.

It does not weaken the existing authority boundary:

- the original report remains authoritative;
- `DiagnosticReport.resultIds` defines report membership;
- normalization never replaces the source quantity;
- charts never invent clinical dates or exact values;
- coding suggestions remain review-only;
- a displayed flag, range, or change is not a diagnosis.

## Explicit report membership

MediBrief does not reconstruct a panel by flattening observations or guessing from test names.

The durable relationship is:

```text
DiagnosticReport.resultIds[] → Observation.id
```

For every confirmed report, the Results workspace resolves those identifiers in their stored order and displays:

- the report status and clinical date;
- the report-level source document;
- each resolved member observation;
- member values, interpretation, range, specimen, code, and source evidence;
- missing or non-confirmed result references as integrity warnings.

A report containing multiple members may be presented as a panel, but membership always comes from the stored relationship. Unlinked confirmed observations remain visible in a separate section; MediBrief does not assign them to a panel automatically.

Report titles are used only for bounded, review-only coding suggestions when an exact curated alias matches. A title does not create, remove, or reorder panel members.

## Result presentation

The Results workspace treats different value families separately:

- exact numeric quantities;
- comparator quantities such as `<5` or `>100`;
- qualitative or coded results;
- narrative text;
- explicit absent results;
- other supported structured values.

Original values are always shown. When a normalized quantity exists, it is shown as a secondary view beside the source value.

Recorded interpretation flags and reference ranges are displayed as source context. They are not converted into diagnoses or treatment decisions.

## Conservative normalization

Slice 3 uses the existing clinical quantity contract:

```text
quantity.original
quantity.normalized?
quantity.normalizationWarning?
```

`original` is never modified.

During reviewed report construction, MediBrief may add `normalized` only for bounded, analyte-independent linear conversions whose dimensional relationship is explicit. The current table covers selected:

- mass-concentration units, normalized to `g/L`;
- amount-concentration units, normalized to `mmol/L`;
- common litre/microlitre blood-cell count notations;
- percentages.

The normalizer deliberately does not perform:

- molecular-weight conversions such as glucose `mg/dL` to `mmol/L`;
- temperature offset conversions;
- estimated or context-dependent conversions;
- arbitrary-unit equivalence;
- conversion of comparator results into exact points.

Comparator quantities retain the comparator and receive a warning rather than a normalized exact value. Missing or unsupported units preserve the source value and receive an explicit normalization warning.

These warnings are persisted with the quantity and also surfaced during report review.

## Trend eligibility

A numeric point is trend-eligible only when all applicable gates pass:

1. the observation is confirmed;
2. its assertion applies to the patient rather than being negated, hypothetical, family, or other-person evidence;
3. status is `final`, `amended`, or `corrected`;
4. the value is a quantity;
5. the source value has no comparator;
6. no unresolved normalization warning exists;
7. an exact day-precision clinical date is present;
8. a comparable unit is recorded;
9. identity is established by a confirmed LOINC code, or by the same exact reviewed name plus the same known specimen.

A chart requires at least two comparable points.

The following remain visible in the record but outside numeric charts:

- candidate or rejected observations;
- non-patient assertions;
- registered, preliminary, cancelled, entered-in-error, or unknown statuses;
- qualitative, narrative, absent, boolean, coded, and non-quantity results;
- comparator values;
- explicitly unknown dates;
- month- or year-precision dates;
- missing units;
- unresolved normalization warnings;
- identities without enough evidence;
- single-point groups.

Recorded time, upload time, extraction time, and review time are never substituted for a missing clinical result date.

## Unit conflicts

Results with the same analyte identity but different non-normalized unit groups are not silently combined.

The workspace surfaces a unit conflict and keeps the groups separate. This protects against unsupported assumptions about molecular conversion, method compatibility, specimen differences, or reporting scales.

When a trusted normalized value is present, trend calculations use it while continuing to display the original source value beside the trend value.

## Review-only LOINC suggestions

Slice 3 contains a small bounded exact-match catalog for selected result and panel codes.

Result suggestions require:

- an exact reviewed test-name alias;
- a compatible recorded unit where required;
- supporting specimen context where required.

Panel suggestions require an exact curated report-title alias.

Every suggestion is advisory. The UI labels it **Review-only coding suggestion**, explains its matching basis, and warns the reviewer to confirm specimen, method, scale, source wording, and panel definition before changing the record.

The suggestion functions do not mutate the observation, report, patient record, or extraction settings.

## Results workspace

The Labs & Reports workspace now provides:

- overview metrics for confirmed reports, results, trends, and source flags;
- searchable report and result content;
- explicit report/panel cards with member results;
- source-linked original-value cards;
- original-versus-normalized quantity display;
- conservative trend charts and point tables;
- transparent trend-exclusion reasons;
- incompatible-unit warnings;
- comparator, qualitative, narrative, absent, and unlinked-result sections;
- review-only LOINC suggestions;
- direct access to the original local source.

The workspace remains read-only for confirmed diagnostic facts. Candidate confirmation and report correction remain separate reviewed workflows.

## Failure behavior

- Missing report members are shown as unresolved links.
- Unsupported or missing units remain source values with warnings.
- Incompatible unit groups are separated rather than converted.
- Comparator and undated results are excluded rather than approximated.
- A single eligible result does not create a misleading line chart.
- Unlinked results remain unlinked rather than receiving a guessed panel.
- Coding suggestions never write automatically.

## Acceptance criteria

Slice 3 acceptance requires evidence that:

- report result identifiers remain the grouping authority;
- unresolved member references remain visible;
- qualitative, narrative, absent, and comparator values stay outside numeric trends;
- trends require confirmed, patient-applicable, exact-date, compatible quantities;
- candidates, unknown dates, warnings, and incompatible units fail closed;
- safe normalization preserves original values;
- molecular conversions are not performed;
- original and normalized values are distinguishable in the UI;
- review-only coding suggestions cannot mutate the record;
- TypeScript, the complete automated suite, and the production build pass.
