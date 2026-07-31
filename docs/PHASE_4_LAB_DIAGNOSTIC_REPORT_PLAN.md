# MediBrief Phase 4 — Laboratory and Diagnostic Report Pipeline

> Living implementation tracker for turning reviewed report content into connected, source-linked diagnostic records.
>
> **Branch:** `agent/phase-4-diagnostic-report-pipeline`  
> **Base:** `agent/phase-3-openmed-extraction`  
> **Started:** 2026-07-31  
> **Current focus:** Slice 4 — corrections, duplicates, conflicts, and final Phase 4 acceptance

## Phase 4 result so far

Slices 1, 2, and 3 are complete.

MediBrief now provides:

- connected `DiagnosticReport`, `Observation`, `Specimen`, and source-document graphs;
- report-level human review beside the original encrypted local file;
- atomic confirmation with retained corrections and excluded-row evidence;
- explicit report and panel membership through `DiagnosticReport.resultIds`;
- safe, source-preserving quantity normalization;
- conservative comparable-result trends;
- separate numeric, comparator, qualitative, narrative, absent, and other result views;
- transparent trend exclusions and unit conflicts;
- review-only LOINC suggestions;
- source-linked result and report review.

It does not provide autonomous interpretation, diagnosis, treatment advice, automatic coding, or unsupported unit conversion.

## Product goal

Phase 4 turns reviewed medical-report content into a dependable local diagnostic record while preserving source truth and uncertainty.

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

`DiagnosticReport` carries report-level context, `Observation` carries atomic results, and `Specimen` represents the collected sample. LOINC and UCUM remain supporting evidence rather than authority when the source does not establish them.

## Non-negotiable boundaries

- The original uploaded report remains authoritative.
- Report membership comes from stored report-result relationships, not test-name guessing.
- Report, specimen, result, and source links remain patient-scoped and internally consistent.
- Original result text, value, comparator, and unit are never overwritten by normalization.
- Unknown collection, result, authored, and issued dates remain unknown.
- Import, upload, extraction, and review times are not clinical dates.
- Qualitative, comparator, text, coded, boolean, and absent results are first-class data.
- A recorded flag, reference range, chart, or coding suggestion is not a diagnosis.
- Corrected and amended reports preserve prior values and history.
- Invalid graph writes leave no half-created diagnostic resources.
- AI/OCR output remains candidate evidence until a person reviews it.
- Excluded extracted rows remain in review history.
- Source-less extracted reports cannot be confirmed.
- Incompatible units are separated rather than silently converted.

---

# Overall status

| Workstream | Status |
|---|---|
| P4.0 — Baseline, branch, and architecture | Complete through Slice 3 |
| P4.1 — Diagnostic graph and model foundation | Complete for compatibility scope |
| P4.2 — Reviewed report draft and value parsing | Complete |
| P4.3 — Report-level human review | Complete |
| P4.4 — Panels, trends, and normalization | Complete |
| P4.5 — Corrections, duplicates, and conflicts | Next |
| P4.6 — Acceptance evidence | Complete through Slice 3 |
| **Phase 4** | **In progress — Slice 4 remains** |

---

# Workstreams

## P4.0 — Baseline, branch, and architecture

Status: `[x] Complete through Slice 3`

- [x] Create the Phase 4 branch from the accepted Phase 3 head.
- [x] Maintain this living tracker.
- [x] Inventory the diagnostic graph, Results module, confirmed selectors, and legacy row-only workflow.
- [x] Replace the legacy row-only confirmation path.
- [x] Add architecture notes for the diagnostic foundation, report review, and panels/trends.
- [x] Open and maintain stacked draft PR #4.
- [ ] Add the final corrections/conflicts and Phase 4 acceptance notes in Slice 4.

## P4.1 — Diagnostic graph and model foundation

Status: `[x] Complete for the current compatibility layer`

- [x] Add strict report, specimen, result, identifier, and source-location draft contracts.
- [x] Preserve report accession and identifiers in provenance where dedicated core fields are not yet available.
- [x] Preserve specimen identifiers, collection method, body site, collector, and notes.
- [x] Preserve absent-result reasons and result method/body-site evidence.
- [x] Preserve exact clinical dates and issue timestamps without inventing missing values.
- [x] Distinguish an omitted result date from an explicitly unknown date.
- [x] Keep graph output backward-compatible with Phase 1–3 records and backups.
- [x] Add strict Zod and cross-resource graph validation.
- [x] Add atomic bundle persistence.
- [x] Reject patient mismatches, duplicate IDs, broken links, missing source documents, resource conflicts, and duplicate same-source reports.
- [ ] Migrate compatibility-preserved metadata into dedicated backward-compatible core fields only after a tested schema migration exists.

## P4.2 — Reviewed report draft and value parsing

Status: `[x] Complete`

- [x] Define a reviewed report draft independent from any extraction provider.
- [x] Preserve report title, identifiers, performer, dates, conclusion, pages, sections, offsets, and excerpts.
- [x] Parse numeric values with `<`, `<=`, `>`, `>=`, `≤`, and `≥` comparators.
- [x] Preserve decimal, integer, string, coded, boolean, qualitative, and absent values.
- [x] Support common qualitative result terms without flattening them to numbers.
- [x] Parse bounded, one-sided, and textual reference ranges while retaining source text.
- [x] Map recorded interpretation flags conservatively.
- [x] Recognize safe UCUM aliases.
- [x] Fail closed on ambiguous decimal-comma values.
- [x] Produce one connected report/specimen/result bundle.
- [x] Adapt legacy lab JSON into a source-linked review seed without persistence authority.

## P4.3 — Report-level human review

Status: `[x] Complete`

- [x] Replace row-only confirmation with report-level review.
- [x] Show the original local report beside report metadata, specimens, and results.
- [x] Support PDF navigation, images, local text/JSON/XML, downloads, and explicit missing-asset states.
- [x] Allow include, edit, exclude, and manual-add decisions for every result.
- [x] Allow report title, status, date, issue time, performer, accession, and conclusion correction.
- [x] Allow specimen creation, editing, removal, and result relationships.
- [x] Preserve prior values and excluded rows as amendment evidence.
- [x] Require a review/correction reason and at least one included result.
- [x] Block confirmation for missing sources or invalid graph relationships.
- [x] Show parser and graph-validation warnings before confirmation.
- [x] Save the complete graph atomically.
- [x] Keep review usable after extraction without requiring an active AI provider.
- [x] Retire the numeric-only modal, direct observation writer, and duplicate legacy-store write.
- [x] Audit review started, confirmed, and cancelled separately.

## P4.4 — Panels, trends, and normalization

Status: `[x] Complete`

- [x] Use `DiagnosticReport.resultIds` as the grouping authority.
- [x] Preserve member order and surface unresolved result references.
- [x] Keep unlinked confirmed observations separate rather than guessing a panel.
- [x] Display report status, date, conclusion, specimens, codes, members, and source evidence.
- [x] Separate numeric, comparator, qualitative, narrative, absent, and other values.
- [x] Show original source values beside normalized values.
- [x] Add safe analyte-independent linear normalization while preserving originals.
- [x] Persist explicit warnings for comparator, missing-unit, and unsupported-unit cases.
- [x] Exclude molecular-weight, offset, arbitrary-unit, and context-dependent conversions.
- [x] Trend only confirmed, patient-applicable, stable-status, exact-day numeric quantities.
- [x] Exclude comparator, qualitative, absent, narrative, uncertain, undated, and incompatible values from numeric charts.
- [x] Require at least two comparable points.
- [x] Group by confirmed LOINC identity or exact reviewed name plus specimen and unit evidence.
- [x] Separate incompatible units and display conflicts.
- [x] Show trend points, original values, normalized values, report context, and transparent exclusion reasons.
- [x] Add bounded review-only LOINC suggestions that never mutate the record.
- [x] Add searchable overview, panels, trends, and other-values views.

## P4.5 — Corrections, duplicates, and conflicts

Status: `[ ] Next`

- [ ] Model preliminary, final, amended, corrected, cancelled, and entered-in-error transitions.
- [ ] Preserve superseded reports and result values.
- [ ] Link corrected reports and observations to prior versions.
- [ ] Expand duplicate detection across source identity, accession, dates, and hashes.
- [ ] Keep similar reports from different documents as separate assertions.
- [ ] Surface conflicting reports and results without silently choosing a winner.
- [ ] Define conflict resolution as a reviewed amendment workflow.

## P4.6 — Acceptance evidence

Status: `[-] Complete through Slice 3`

- [x] Add strict draft, value, date, range, unit, graph, patient, source, and atomic-write tests.
- [x] Add duplicate same-source and no-partial-mutation tests.
- [x] Add source-linked review, correction history, excluded-row, missing-source, audit, and retired-legacy-path tests.
- [x] Add explicit report membership and unresolved-link tests.
- [x] Add numeric/comparator/qualitative/narrative/absent presentation tests.
- [x] Add confirmed trend eligibility and exclusion tests.
- [x] Add incompatible-unit conflict tests.
- [x] Add source-preserving normalization tests.
- [x] Add no-molecular-conversion tests.
- [x] Add review-only coding suggestion non-mutation tests.
- [x] Run Python, TypeScript, all tests, and production build through Slice 3.
- [ ] Add corrections, lineage, expanded duplicate, conflict, and final Phase 4 acceptance tests.

---

# Implementation slices

## Slice 1 — Diagnostic graph and ingestion foundation

Status: `[x] Complete`

Delivered:

- reviewed report, specimen, result, identifier, and source-span contracts;
- numeric, comparator, qualitative, absent, text, date, range, interpretation, and conservative unit parsing;
- explicit omitted-versus-unknown date semantics;
- connected graph construction and validation;
- candidate or reviewed/confirmed output;
- duplicate same-source protection;
- atomic persistence and source-document relationships;
- compatibility-preserved metadata;
- architecture documentation and regression coverage.

Validation:

- Head: `0d18b2adeaafee91a3f93e42110bbcf5b6cc6c21`
- GitHub Actions run **463** (`30659686134`)
- Python: **24 / 24**
- TypeScript files: **38 / 38**
- TypeScript tests: **165 / 165**
- Phase 4 diagnostic tests: **11 / 11**
- Type-check and production build: passed
- Modules: **1046**
- Main bundle: approximately **1.99 MB / 536 kB gzip**

Documentation:

- `docs/architecture/PHASE_4_DIAGNOSTIC_REPORT_FOUNDATION.md`

## Slice 2 — Report-level review workspace

Status: `[x] Complete`

Delivered:

- source-linked pending review;
- side-by-side original report and editable graph;
- report, specimen, and result correction;
- include/exclude/manual-add controls;
- retained prior values and excluded-row history;
- live validation and atomic confirmation;
- audit boundaries;
- complete retirement of the numeric-only workflow.

Validation:

- Head: `1bd8ed30c710b2ea5113844b3ad8d69ddc89c4ff`
- GitHub Actions run **513** (`30663086413`)
- Python: **24 / 24**
- TypeScript files: **40 / 40**
- TypeScript tests: **174 / 174**
- Review behavior tests: **4 / 4**
- Review workspace tests: **5 / 5**
- Type-check and production build: passed
- Modules: **1053**
- Main bundle: approximately **2.03 MB / 548 kB gzip**

Documentation:

- `docs/architecture/PHASE_4_REPORT_REVIEW_WORKSPACE.md`

## Slice 3 — Panels, normalization, and trends

Status: `[x] Complete`

Delivered:

- report-owned member relationships;
- unresolved-link and unlinked-result visibility;
- source-linked report and result cards;
- separate result-family views;
- persisted original-versus-normalized quantity evidence;
- conservative normalization without molecular conversion;
- exact trend eligibility and transparent exclusions;
- incompatible-unit separation;
- interactive trend charts and source-value tables;
- bounded review-only LOINC suggestions;
- architecture documentation and regression coverage.

Validated implementation head:

```text
a9e6eb1ad181bd37d2f86ed98488220cf2e37ab8
```

GitHub Actions run **557** (`30667254333`) passed:

| Validation | Result |
|---|---:|
| Python bridge and evaluation tests | **24 / 24 passed** |
| TypeScript type-check | **Passed** |
| TypeScript test files | **42 / 42 passed** |
| TypeScript tests | **184 / 184 passed** |
| Panel and trend tests | **7 / 7 passed** |
| Diagnostic normalization tests | **3 / 3 passed** |
| Production build | **Passed** |
| Production modules transformed | **1055** |

Main application chunk:

```text
2.05 MB minified
555 kB gzip
```

Documentation:

- `docs/architecture/PHASE_4_PANELS_NORMALIZATION_TRENDS.md`

## Slice 4 — Corrections, duplicates, conflicts, and final acceptance

Status: `[ ] Next`

Planned delivery:

- report and result version lineage;
- corrected/amended transition rules;
- expanded duplicate and conflict detection;
- reviewed conflict resolution;
- final Phase 4 acceptance evidence;
- roadmap transition to Phase 5.

---

# Slice 3 acceptance evidence

| Criterion | Result |
|---|---|
| Report membership comes from `DiagnosticReport.resultIds` | Passed |
| Missing report members remain visible as integrity warnings | Passed |
| Unlinked observations are not assigned to guessed panels | Passed |
| Original source values remain visible | Passed |
| Normalized values remain separate and secondary | Passed |
| Safe linear normalization preserves the original quantity | Passed |
| Molecular-weight conversion is not performed | Passed |
| Comparator values are not treated as exact chart points | Passed |
| Qualitative, narrative, absent, and other values remain outside numeric trends | Passed |
| Candidate and non-patient assertions stay outside trends | Passed |
| Unknown or partial clinical dates stay outside exact-date charts | Passed |
| Recorded/upload time is never substituted for clinical date | Passed |
| Incompatible units remain separate and visible | Passed |
| A trend requires two comparable confirmed points | Passed |
| Coding suggestions remain review-only and non-mutating | Passed |
| Source review remains available from results and reports | Passed |
| Python, TypeScript, all tests, and production build pass | Passed |

---

# Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-07-31 | Build Phase 4 as a stacked branch from Phase 3. | Diagnostic intake depends on source-linked document/OCR evidence and candidate review. |
| 2026-07-31 | Treat `DiagnosticReport` as context and `Observation` as atomic results. | A report includes more than a flat value list. |
| 2026-07-31 | Keep `Specimen` separate. | Collection context belongs to the sample rather than every result row. |
| 2026-07-31 | Require atomic graph writes. | Partial report graphs are invalid clinical records. |
| 2026-07-31 | Preserve original result strings and units. | Parsing and normalization must not erase source truth. |
| 2026-07-31 | Treat explicit unknown dates differently from omitted dates. | A reviewed unknown must not inherit a convenient report date. |
| 2026-07-31 | Keep reference ranges contextual and non-diagnostic. | Ranges vary by laboratory, method, population, and specimen. |
| 2026-07-31 | Keep LOINC and UCUM optional evidence. | Coding and normalization cannot exceed the source evidence. |
| 2026-07-31 | Require the original patient-scoped source before confirmation. | Review must remain anchored to the authoritative report. |
| 2026-07-31 | Preserve excluded rows in amendment history. | Review decisions must not erase extraction evidence. |
| 2026-07-31 | Retire the duplicate legacy observation-store write. | A reviewed report needs one structured source of truth. |
| 2026-07-31 | Use `DiagnosticReport.resultIds` as panel membership authority. | Relationships are safer than reconstructing panels from names. |
| 2026-07-31 | Permit only analyte-independent linear normalization. | Molecular and context-dependent conversion requires additional evidence. |
| 2026-07-31 | Require exact clinical dates and exact numeric values for charts. | Trend convenience must not manufacture time or magnitude. |
| 2026-07-31 | Separate incompatible units instead of choosing a conversion. | Silent conversion can create clinically misleading series. |
| 2026-07-31 | Keep coding suggestions review-only. | A bounded match is not authoritative coding evidence. |

---

# Progress log

| Date | Slice | Work completed | Validation |
|---|---|---|---|
| 2026-07-31 | Slice 1 | Graph contracts, parsing, validation, atomic persistence, duplicate protection, source linking, date policy, tests, and architecture note. | 24 Python; 38 TS files; 165 TS tests; build passed; 1046 modules. |
| 2026-07-31 | Slice 2 | Source-linked review, original report pane, corrections, specimens, inclusion/exclusion, amendment evidence, validation, atomic confirmation, audits, legacy retirement, tests, and architecture note. | 24 Python; 40 TS files; 174 TS tests; build passed; 1053 modules. |
| 2026-07-31 | Slice 3 | Report membership, result-family views, safe normalization, trends, unit conflicts, source-linked UI, coding suggestions, tests, and architecture note. | 24 Python; 42 TS files; 184 TS tests; build passed; 1055 modules. |

---

# Retained limitations before Slice 4

- Real laboratory coding still requires human verification.
- Safe normalization covers a bounded table, not every unit.
- Molecular-weight and method-dependent conversions remain unsupported.
- Results with unknown or partial dates cannot appear on exact-date charts.
- Comparator results remain non-exact evidence.
- Different methods or specimen contexts may still require manual conflict review even when names and units match.
- Corrected/amended version lineage is not yet complete.
- Cross-document duplicate and conflict handling remains the Slice 4 focus.
- The main JavaScript chunk remains above the default Vite warning threshold.
- Mixed static/dynamic UUID and blob-storage imports, runtime `/index.css`, Actions runtime notices, and Recharts 2.x maintenance status remain separate dependency/performance workstreams.
