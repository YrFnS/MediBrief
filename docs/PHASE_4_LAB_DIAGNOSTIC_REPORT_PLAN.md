# MediBrief Phase 4 — Laboratory and Diagnostic Report Pipeline

> Living implementation tracker for turning reviewed report content into connected, source-linked diagnostic records.
>
> **Branch:** `agent/phase-4-diagnostic-report-pipeline`  
> **Base:** `agent/phase-3-openmed-extraction`  
> **Started:** 2026-07-31  
> **Current focus:** Slice 3 — panels, normalization, and trends

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

The design follows the current FHIR diagnostic boundary: `DiagnosticReport` carries report-level context, `Observation` carries atomic results, and `Specimen` represents the collected sample. LOINC and UCUM may be used as coding or unit evidence, but neither is treated as authoritative when the source report does not support it.

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
- Excluded extracted rows remain in review history rather than being silently deleted.
- Source-less extracted reports cannot be confirmed.

---

# Workstreams

## P4.0 — Baseline, branch, and architecture

Status: `[-] In progress`

- [x] Create the Phase 4 branch from the accepted Phase 3 head.
- [x] Add this living tracker.
- [x] Inventory the current `DiagnosticReport`, `Observation`, and `Specimen` contracts.
- [x] Inventory the current Results module and confirmed-only selectors.
- [x] Inventory and replace the legacy row-only lab confirmation path.
- [x] Add the Slice 1 diagnostic-foundation architecture note.
- [x] Add the Slice 2 report-review architecture note.
- [x] Open and maintain stacked draft PR #4.
- [ ] Add architecture notes for the remaining accepted slices.

## P4.1 — Diagnostic graph and model foundation

Status: `[x] Complete for the current compatibility layer`

- [x] Add strict report, specimen, result, identifier, and source-location draft contracts.
- [x] Preserve report accession and identifiers in provenance when the current core record lacks dedicated fields.
- [x] Preserve specimen identifiers, collection method, body site, collector, and notes without discarding source evidence.
- [x] Preserve absent-result reasons and result method/body-site evidence.
- [x] Preserve exact clinical dates and issue timestamps without inventing missing values.
- [x] Distinguish an omitted result date from an explicitly unknown result date.
- [x] Keep all graph output backward-compatible with existing Phase 1–3 records and backups.
- [x] Add strict Zod validation for reviewed report drafts.
- [x] Add cross-resource diagnostic graph validation.
- [x] Add atomic bundle persistence for connected resources.
- [x] Reject patient mismatches, duplicate resource IDs, broken result/specimen links, missing source documents, resource conflicts, and duplicate same-source reports.
- [ ] Migrate compatibility-preserved identifiers and metadata into dedicated backward-compatible core fields only when the schema-extension migration is designed and tested.

## P4.2 — Reviewed report draft and value parsing

Status: `[x] Complete for the current scope`

- [x] Define a reviewed report-draft contract independent from Gemini/OpenMed output.
- [x] Preserve source report title, identifiers, performer, dates, conclusion, pages, sections, offsets, and excerpts.
- [x] Parse numeric values with `<`, `<=`, `>`, `>=`, `≤`, and `≥` comparators.
- [x] Preserve decimal, integer, string, coded, boolean, and qualitative values supported by the current record contract.
- [x] Support positive, negative, reactive, non-reactive, detected, not detected, trace, equivocal, and indeterminate results.
- [x] Support explicit absent-result reasons.
- [x] Parse low/high, one-sided, and textual reference ranges without discarding source text.
- [x] Map recorded interpretation flags conservatively.
- [x] Recognize only safe UCUM aliases and perform no unvalidated value conversion.
- [x] Fail closed on ambiguous decimal-comma values instead of guessing.
- [x] Produce one connected report/specimen/result bundle.
- [x] Adapt the legacy lab JSON shape into a source-linked candidate review seed without granting it persistence authority.

## P4.3 — Report-level human review

Status: `[x] Complete`

- [x] Replace row-only confirmation with report-level review.
- [x] Display the original local report beside report metadata, specimens, and results.
- [x] Support PDF page navigation, images, local text/JSON/XML preview, local download, and explicit missing-asset states.
- [x] Allow include, edit, or exclude decisions for every extracted result before confirmation.
- [x] Allow reviewers to add a result missed by extraction.
- [x] Allow report status, date, issue time, performer, accession, title, and conclusion correction.
- [x] Allow specimen creation, editing, removal, and result-to-specimen relationships.
- [x] Preserve report, result, and specimen edits as amendment evidence with prior values.
- [x] Preserve excluded rows in report amendment history.
- [x] Require a review/correction reason.
- [x] Prevent confirmation when no result remains included.
- [x] Prevent confirmation when the original source is missing or graph references are broken.
- [x] Show parser warnings and graph-validation feedback before confirmation.
- [x] Save the reviewed graph atomically.
- [x] Keep source preview and graph confirmation independent from an AI provider after extraction.
- [x] Retire the numeric-only lab modal and direct observation writer.
- [x] Stop writing the legacy compatibility observation store from the confirmed report workflow.
- [x] Add distinct started, confirmed, and cancelled audit events.

## P4.4 — Panels, trends, and normalization

Status: `[ ] Not started — next`

- [ ] Add explicit panel and battery relationships without flattening members.
- [ ] Group common reports such as CBC, renal, liver, thyroid, and lipid panels by report membership rather than name guessing alone.
- [ ] Define panel-level and member-level source evidence.
- [ ] Trend only comparable confirmed observations.
- [ ] Keep original values visible beside normalized values.
- [ ] Make unit incompatibility and conversion uncertainty explicit.
- [ ] Keep qualitative, absent, and narrative results outside numeric trend charts.
- [ ] Add optional LOINC coding suggestions without making them authoritative.
- [ ] Define conservative trend eligibility for comparator values and unknown dates.

## P4.5 — Corrections, duplicates, and conflicts

Status: `[ ] Not started`

- [ ] Model preliminary, final, amended, corrected, cancelled, and entered-in-error transitions.
- [ ] Preserve superseded values and report versions.
- [ ] Detect likely duplicate reports using source identity, accession, dates, and report hashes.
- [ ] Keep similar reports from different documents as separate assertions.
- [ ] Surface conflicts without silently choosing one result.
- [ ] Link corrected reports and observations to their prior versions.

## P4.6 — Acceptance evidence

Status: `[-] In progress`

- [x] Add strict draft-schema tests.
- [x] Add numeric, comparator, qualitative, textual, absent-result, and decimal-comma tests.
- [x] Add reference-range and unit-preservation tests.
- [x] Add specimen/report/result relationship tests.
- [x] Add patient, source-document, resource-conflict, and duplicate-report validation tests.
- [x] Add atomic-write and no-partial-mutation tests.
- [x] Add explicit-unknown versus inherited result-date tests.
- [x] Add source-linked pending-review tests.
- [x] Add report, result, and specimen correction-history tests.
- [x] Add per-result exclusion and retained-exclusion evidence tests.
- [x] Add missing-source rejection and no-partial-write tests for the review workflow.
- [x] Add source-pane, graph-validation, audit, and retired-legacy-path workspace contracts.
- [x] Run TypeScript, all automated tests, and production build for Slices 1 and 2.
- [ ] Add panel, trend, normalization, duplicate-lineage, and conflict tests.
- [ ] Record final Phase 4 acceptance evidence.

---

# Implementation slices

## Slice 1 — Diagnostic graph and ingestion foundation

Status: `[x] Complete`

Delivered:

- reviewed report, specimen, result, identifier, and source-span contracts;
- numeric, comparator, qualitative, absent, text, date, issue-time, reference-range, interpretation, and conservative unit parsing;
- explicit distinction between omitted dates and reviewed-as-unknown dates;
- connected `DiagnosticReport`, `Observation`, and `Specimen` construction;
- candidate or explicitly reviewed/confirmed output;
- strict graph validation;
- duplicate same-source report detection;
- atomic patient-record replacement;
- source-document relationship amendments;
- compatibility-preserved metadata where the current core schema lacks dedicated fields;
- architecture documentation and regression coverage.

Validation at the completed Slice 1 head:

- Validated branch head: `0d18b2adeaafee91a3f93e42110bbcf5b6cc6c21`.
- GitHub Actions run: **463** (`30659686134`).
- Python bridge and evaluation tests: **24 / 24 passed**.
- TypeScript: `tsc --noEmit` passed.
- TypeScript test files: **38 / 38 passed**.
- TypeScript tests: **165 / 165 passed**.
- Phase 4 diagnostic tests: **11 / 11 passed**.
- Production build: passed.
- Production modules transformed: **1046**.
- Main bundle: approximately **1.99 MB minified / 536 kB gzip**.

Documentation:

- `docs/architecture/PHASE_4_DIAGNOSTIC_REPORT_FOUNDATION.md`

## Slice 2 — Report-level review workspace

Status: `[x] Complete`

Delivered:

- source-linked pending review context for extracted lab JSON;
- side-by-side encrypted local source preview and report review;
- report metadata and accession correction;
- specimen creation, correction, removal, and result relationships;
- per-result include, edit, exclude, and manual-add controls;
- numeric, comparator, qualitative, textual, and absent-result review;
- source page, section, excerpt, method, and body-site correction;
- live connected-graph preview and validation feedback;
- retained prior values for report, result, and specimen edits;
- retained excluded-row evidence on the report amendment;
- required source document and required included result;
- atomic confirmation and source-document relationship update;
- distinct review-started, review-confirmed, and review-cancelled audit events;
- complete retirement of the numeric-only modal and direct observation writer;
- architecture documentation and regression coverage.

Validation at the completed Slice 2 head:

- Validated branch head: `1dae533c005f0219984cb5142597ed8a44d8882a`.
- GitHub Actions run: **511** (`30662767242`).
- Python bridge and evaluation tests: **24 / 24 passed**.
- TypeScript: `tsc --noEmit` passed.
- TypeScript test files: **40 / 40 passed**.
- TypeScript tests: **174 / 174 passed**.
- New report-review behavior tests: **4 / 4 passed**.
- New report-review workspace contract tests: **5 / 5 passed**.
- Production build: passed.
- Production modules transformed: **1053**.
- Main bundle: approximately **2.03 MB minified / 548 kB gzip**.

Documentation:

- `docs/architecture/PHASE_4_REPORT_REVIEW_WORKSPACE.md`

## Slice 3 — Panels, normalization, and trends

Status: `[ ] Next`

Planned delivery:

- explicit panel/member relationships;
- safe UCUM aliases and compatibility checks;
- comparable-result grouping;
- numeric trend eligibility rules;
- original/normalized value distinction;
- qualitative, comparator, absent, and narrative result views;
- optional LOINC suggestions with review-only semantics.

## Slice 4 — Corrections, duplicates, conflicts, and final acceptance

Status: `[ ] Pending`

Planned delivery:

- corrected/amended report lineage;
- duplicate detection;
- conflict display;
- complete tests and acceptance evidence;
- roadmap transition to Phase 5.

---

# Slice 1 acceptance evidence

| Criterion | Result |
|---|---|
| Report, observations, and specimens form one patient-scoped graph | Passed |
| Original source document remains authoritative and linked | Passed |
| Unknown clinical dates remain unknown | Passed |
| Explicitly unknown result dates do not inherit the report date | Passed |
| Omitted result dates may inherit known report context | Passed |
| Numeric comparators are preserved | Passed |
| Qualitative, textual, and absent results remain distinct | Passed |
| Reference-range source text is retained | Passed |
| Unit aliases do not trigger unvalidated conversion | Passed |
| Ambiguous decimal-comma values fail closed | Passed |
| Broken resource relationships are rejected | Passed |
| Same-source duplicate reports are detected | Passed |
| Invalid bundles create no partial record mutations | Passed |
| Python, TypeScript, all tests, and production build pass | Passed |

# Slice 2 acceptance evidence

| Criterion | Result |
|---|---|
| Original local report is visible beside the review form | Passed |
| Source-less extracted reports cannot be confirmed | Passed |
| Report metadata can be corrected before confirmation | Passed |
| Specimens can be added, edited, removed, and linked | Passed |
| Every result can be included, edited, excluded, or supplemented | Passed |
| Qualitative, comparator, textual, and absent results are reviewable | Passed |
| At least one included result is required | Passed |
| Broken diagnostic graphs block confirmation | Passed |
| Prior values for report, result, and specimen edits are retained | Passed |
| Excluded rows remain in report amendment history | Passed |
| Confirmation saves the complete graph atomically | Passed |
| Missing-source failure creates no partial resources | Passed |
| Source document receives the report relationship only after success | Passed |
| Legacy numeric-only modal and writer are removed | Passed |
| Review opening, confirmation, and cancellation are audited separately | Passed |
| TypeScript, all tests, and production build pass | Passed |

---

# Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-07-31 | Build Phase 4 as a stacked branch from Phase 3. | The report pipeline depends on document/OCR provenance and the candidate-review foundation. |
| 2026-07-31 | Treat `DiagnosticReport` as the report context and `Observation` as atomic results. | A report is more than a flat list of values and may include specimens, conclusions, documents, and panels. |
| 2026-07-31 | Keep `Specimen` separate from report and result resources. | Collection and received times, type, body site, method, and identifiers belong to the sample rather than every result row. |
| 2026-07-31 | Extend the report pipeline backward-compatibly before replacing the UI. | Existing local records and backups must continue to hydrate. |
| 2026-07-31 | Require atomic diagnostic graph writes. | A report without its referenced results or specimens is an invalid partial record. |
| 2026-07-31 | Preserve original result strings even when a structured value can be parsed. | Source truth must survive parsing and normalization. |
| 2026-07-31 | Treat `null` as explicitly unknown and `undefined` as eligible for report-context inheritance. | A reviewed unknown date must not silently become the report date. |
| 2026-07-31 | Keep reference ranges contextual and non-diagnostic. | A range can vary by laboratory, method, population, age, sex, specimen, and other context. |
| 2026-07-31 | Keep LOINC and UCUM optional evidence rather than inferred authority. | Coding or normalization must not replace the source report or create unsupported clinical meaning. |
| 2026-07-31 | Require the original patient-scoped source document before report confirmation. | The reviewer must be able to verify extraction and edits against the authoritative report. |
| 2026-07-31 | Preserve excluded extracted rows in report amendment history. | Exclusion is a review decision and must not erase the original extraction evidence. |
| 2026-07-31 | Retire the compatibility observation-store write from report confirmation. | One reviewed report must have one structured source of truth rather than two independently mutated stores. |
| 2026-07-31 | Allow source review and atomic confirmation without an AI provider after extraction. | Human review and local record management must not depend on an active cloud key. |

---

# Progress log

| Date | Slice | Work completed | Validation |
|---|---|---|---|
| 2026-07-31 | Slice 1 | Branch, plan, reviewed-report drafts, value parsing, diagnostic graph construction, graph validation, atomic persistence, duplicate protection, source-document linking, explicit-unknown date policy, tests, and architecture note. | 24/24 Python tests; 38/38 TypeScript files; 165/165 TypeScript tests; build passed with 1046 modules. |
| 2026-07-31 | Slice 2 | Source-linked pending review, original report pane, report/specimen/result editing, inclusion/exclusion, amendment evidence, live graph validation, atomic confirmation, audit events, legacy modal retirement, tests, and architecture note. | 24/24 Python tests; 40/40 TypeScript files; 174/174 TypeScript tests; build passed with 1053 modules. |
