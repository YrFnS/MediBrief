# MediBrief Phase 4 — Laboratory and Diagnostic Report Pipeline

> Living implementation tracker for turning reviewed report content into connected, source-linked diagnostic records.
>
> **Branch:** `agent/phase-4-diagnostic-report-pipeline`  
> **Base:** `agent/phase-3-openmed-extraction`  
> **Started:** 2026-07-31  
> **Current focus:** Slice 1 — diagnostic graph and ingestion foundation

## Product goal

Phase 4 turns reviewed medical-report content into a dependable local diagnostic record while preserving source truth and uncertainty.

The intended graph is:

```text
DocumentReference
        ↓
DiagnosticReport
   ↙            ↘
Specimen(s)   Observation(s)
                    ↓
             original value/unit
             normalized value/unit
             reference-range context
             interpretation and quality warnings
```

## Non-negotiable boundaries

- The original uploaded report remains authoritative.
- A report is not a loose list of unrelated observations.
- Report, specimen, and result links must be patient-scoped and internally consistent.
- Original value text and original unit are never overwritten by normalization.
- Unknown collection, result, authored, and issued dates remain unknown.
- Import/upload time is not a clinical date.
- Qualitative values, comparators, text results, and absent results are first-class data.
- A recorded flag or reference range is not a diagnosis.
- Corrected and amended reports preserve prior values and history.
- Transactional bundle writes must not leave half-created diagnostic graphs.
- AI/OCR output remains candidate evidence until a person reviews it.

---

# Workstreams

## P4.0 — Baseline, branch, and architecture

Status: `[-] In progress`

- [x] Create the Phase 4 branch from the accepted Phase 3 head.
- [x] Add this living tracker.
- [x] Inventory the current `DiagnosticReport`, `Observation`, and `Specimen` contracts.
- [x] Inventory the current Results module and confirmed-only selectors.
- [ ] Inventory and replace the legacy row-only lab confirmation path.
- [ ] Add architecture notes for every accepted slice.
- [ ] Open and maintain stacked draft PR #4.

## P4.1 — Diagnostic graph and model foundation

Status: `[-] In progress — current slice`

- [ ] Add report identifiers and accession identifiers.
- [ ] Add precise observation/report/specimen date-time fields without inventing dates.
- [ ] Add absent-result reasons.
- [ ] Add observation methods, body sites, panel/member relationships, and source data-quality notes.
- [ ] Add richer reference-range context.
- [ ] Add specimen identifiers, collector, quantity, conditions, and container details.
- [ ] Keep all additions backward-compatible with existing Phase 1–3 records and backups.
- [ ] Add strict Zod validation for every new field.
- [ ] Add cross-resource diagnostic graph validation.
- [ ] Add atomic bundle persistence for connected resources.

## P4.2 — Reviewed report draft and value parsing

Status: `[ ] Not started`

- [ ] Define a reviewed report-draft contract independent from Gemini/OpenMed output.
- [ ] Preserve source report title, identifiers, performer, dates, conclusion, and pages.
- [ ] Parse numeric values with `<`, `<=`, `>`, `>=`, `≤`, and `≥` comparators.
- [ ] Preserve decimal, integer, string, coded, boolean, and qualitative values.
- [ ] Support positive, negative, reactive, non-reactive, detected, not detected, trace, equivocal, and indeterminate results.
- [ ] Support explicit absent-result reasons.
- [ ] Parse low/high, one-sided, and textual reference ranges without discarding source text.
- [ ] Map recorded interpretation flags conservatively.
- [ ] Recognize only safe UCUM aliases; do not perform unvalidated conversions.
- [ ] Produce one connected report/specimen/result bundle.

## P4.3 — Report-level human review

Status: `[ ] Not started`

- [ ] Replace row-only confirmation with report-level review.
- [ ] Display the original report beside extracted report metadata, specimens, panels, and results.
- [ ] Allow confirm, edit, reject, or exclude each result.
- [ ] Allow report-level status, date, performer, specimen, and accession corrections.
- [ ] Preserve every edit as provenance/amendment evidence.
- [ ] Prevent confirmation when graph references are broken.
- [ ] Save the reviewed graph atomically.

## P4.4 — Panels, trends, and normalization

Status: `[ ] Not started`

- [ ] Support panels and batteries without flattening away relationships.
- [ ] Group common reports such as CBC, renal, liver, thyroid, and lipid panels by report membership rather than name guessing alone.
- [ ] Trend only comparable confirmed observations.
- [ ] Keep original values visible beside normalized values.
- [ ] Make unit incompatibility and conversion uncertainty explicit.
- [ ] Keep qualitative and narrative results outside numeric trend charts.
- [ ] Add optional LOINC coding suggestions without making them authoritative.

## P4.5 — Corrections, duplicates, and conflicts

Status: `[ ] Not started`

- [ ] Model preliminary, final, amended, corrected, cancelled, and entered-in-error transitions.
- [ ] Preserve superseded values and report versions.
- [ ] Detect likely duplicate reports using source identity, accession, dates, and report hashes.
- [ ] Keep similar reports from different sources as separate assertions.
- [ ] Surface conflicts without silently choosing one result.
- [ ] Link corrected reports and observations to their prior versions.

## P4.6 — Acceptance evidence

Status: `[ ] Not started`

- [ ] Add schema and migration/backward-compatibility tests.
- [ ] Add numeric, comparator, qualitative, textual, and absent-result tests.
- [ ] Add reference-range and unit-preservation tests.
- [ ] Add specimen/report/result relationship tests.
- [ ] Add atomic-write rollback tests.
- [ ] Add report-review and correction-history tests.
- [ ] Add duplicate/conflict tests.
- [ ] Run TypeScript, all automated tests, and production build.
- [ ] Record final Phase 4 acceptance evidence.

---

# Implementation slices

## Slice 1 — Diagnostic graph and ingestion foundation

Status: `[-] In progress`

Planned delivery:

- backward-compatible clinical model extensions;
- precise date-time fields;
- report/specimen identifiers;
- richer result and reference-range context;
- atomic connected-resource bundle writes;
- a reviewed report-draft builder;
- strict graph validation;
- regression tests and architecture documentation.

## Slice 2 — Report-level review workspace

Status: `[ ] Pending`

Planned delivery:

- source document and page preview;
- report metadata review;
- specimen review;
- result inclusion/edit/rejection;
- connected graph preview;
- atomic confirmation.

## Slice 3 — Panels, normalization, and trends

Status: `[ ] Pending`

Planned delivery:

- panel relationships;
- safe UCUM aliases;
- comparable-result grouping;
- numeric trends with original/normalized distinction;
- qualitative and narrative result views.

## Slice 4 — Corrections, duplicates, conflicts, and final acceptance

Status: `[ ] Pending`

Planned delivery:

- corrected/amended report lineage;
- duplicate detection;
- conflict display;
- complete tests and acceptance evidence;
- roadmap transition to Phase 5.

---

# Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-07-31 | Build Phase 4 as a stacked branch from Phase 3. | The report pipeline depends on document/OCR provenance and the candidate-review foundation. |
| 2026-07-31 | Treat `DiagnosticReport` as the report context and `Observation` as atomic results. | A report is more than a flat list of values and may include specimens, conclusions, documents, and panels. |
| 2026-07-31 | Extend the existing record model backward-compatibly before replacing the UI. | Existing local records and backups must continue to hydrate. |
| 2026-07-31 | Require atomic diagnostic graph writes. | A report without its referenced results or specimens is an invalid partial record. |
| 2026-07-31 | Preserve original result strings even when a structured value can be parsed. | Source truth must survive parsing and normalization. |

---

# Progress log

| Date | Slice | Work completed | Validation |
|---|---|---|---|
| 2026-07-31 | Slice 1 | Branch, plan, current-schema inventory, and diagnostic graph design started. | Pending |
