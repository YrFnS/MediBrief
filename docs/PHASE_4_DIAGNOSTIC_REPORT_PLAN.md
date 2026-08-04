# MediBrief Phase 4 — Laboratory and Diagnostic Report Pipeline

> Living implementation tracker for turning reviewed report content into connected, source-linked diagnostic records.
>
> **Branch:** `agent/phase-4-diagnostic-reports`  
> **Base:** `agent/phase-3-openmed-extraction`  
> **Started:** 2026-07-31  
> **Current focus:** Slice 1 — report-level intake, linked candidates, and human review

## Product goal

Phase 4 replaces row-only lab handling with a durable report-level workflow:

```text
Original report document
        ↓
Local text/OCR evidence
        ↓
Report-level draft with specimens and result rows
        ↓
Human review and correction
        ↓
Candidate DiagnosticReport + Observation[] + Specimen[]
        ↓
Report-level confirmation or rejection
        ↓
Confirmed connected record and trends
```

The original uploaded document remains authoritative. Extracted values, units, dates, ranges, flags, specimens, and report metadata remain reviewable evidence until the user confirms them.

## Non-negotiable boundaries

- No report, result, specimen, date, value, unit, range, or interpretation is confirmed automatically.
- Missing collection, result, authored, and issued dates remain unknown.
- Upload/import time is never substituted for a clinical date.
- Original values and units are preserved even when normalized values exist.
- Qualitative results remain qualitative; they are not forced into numbers.
- Comparator results such as `<5`, `>200`, `<=10`, and `>=1.2` retain the comparator.
- Reference ranges remain source-specific and can include text plus low/high bounds.
- Report, observation, specimen, and source-document relationships are validated before persistence.
- A report-level review action must not partially confirm a broken resource graph.
- Corrected and amended reports preserve prior values and history.
- A flag or out-of-range marker is not a diagnosis or treatment recommendation.

## Overall workstreams

| Workstream | Status |
|---|---|
| P4.0 — Branch, architecture, and tracker | In progress |
| P4.1 — Report-level intake contracts | In progress |
| P4.2 — Candidate graph persistence and review | In progress |
| P4.3 — Expanded value, range, specimen, and date support | Pending |
| P4.4 — Report modules, trends, and source navigation | Pending |
| P4.5 — Corrections, duplicates, and report lifecycle | Pending |
| P4.6 — Evaluation, migration, and final acceptance | Pending |

---

# P4.0 — Branch, architecture, and baseline

Status: `[-] In progress`

- [x] Create `agent/phase-4-diagnostic-reports` from the accepted Phase 3 head.
- [x] Add this living implementation tracker.
- [ ] Inventory the existing numeric lab verification flow, report module, clinical schema, store actions, backup, export, and source preview.
- [ ] Add the Slice 1 architecture note.
- [ ] Open stacked draft PR #4 against `agent/phase-3-openmed-extraction`.
- [ ] Record the current validation baseline.

# P4.1 — Report-level intake contracts

Status: `[-] In progress`

- [ ] Add strict report-draft, specimen-draft, result-draft, range, date, and source contracts.
- [ ] Support quantity, string, boolean, integer, and codeable-concept result values.
- [ ] Support comparators without stripping them from the original value.
- [ ] Preserve original value text and original unit.
- [ ] Keep normalized values separate and optional.
- [ ] Support textual and bounded reference ranges.
- [ ] Separate collection date, report effective date, result effective date, and issue timestamp.
- [ ] Preserve source page, section, offsets, and excerpt for each result.
- [ ] Validate report/result/specimen identifiers and relationships.
- [ ] Fail closed on duplicate IDs, cross-patient references, invalid dates, invalid numbers, and malformed ranges.

# P4.2 — Candidate graph persistence and review

Status: `[-] In progress`

- [ ] Build a deterministic candidate graph for one report, its observations, and its specimens.
- [ ] Persist every graph node with candidate verification status.
- [ ] Use one graph identity so retries remain idempotent.
- [ ] Add report-level review that can edit metadata, specimens, and result rows.
- [ ] Confirm all valid graph nodes atomically at the application level.
- [ ] Reject the report and its unreviewed child candidates together when requested.
- [ ] Prevent partial confirmation when a required relationship is missing or invalid.
- [ ] Keep the existing general candidate review available for individual history inspection.
- [ ] Record graph creation, correction, confirmation, and rejection audit events.

# P4.3 — Expanded clinical content

Status: `[ ] Pending`

- [ ] Add qualitative results such as positive, negative, reactive, detected, and not detected.
- [ ] Add titers, ratios, narrative values, and coded results.
- [ ] Add age-, sex-, pregnancy-, method-, and population-specific reference range context.
- [ ] Preserve performer, laboratory organization, accession number, and report identifiers.
- [ ] Preserve specimen type, body site, collection method, collection time, and received time.
- [ ] Distinguish preliminary, final, amended, corrected, cancelled, and entered-in-error states.
- [ ] Preserve report conclusions and source narratives without turning them into diagnoses.
- [ ] Keep unknown dates explicit.

# P4.4 — Report workspace and trends

Status: `[ ] Pending`

- [ ] Add a report inbox for drafts and candidates.
- [ ] Add report-level source preview with page navigation.
- [ ] Show report → result → specimen relationships clearly.
- [ ] Add panel grouping such as CBC, renal, liver, thyroid, and lipid profiles where source evidence supports it.
- [ ] Add trend eligibility rules based on code, compatible unit, value type, and known date.
- [ ] Exclude qualitative, incomparable, undated, rejected, and entered-in-error values from numeric trends by default.
- [ ] Preserve original and normalized values in trend detail.
- [ ] Add clinically honest empty and uncertainty states.

# P4.5 — Corrections, duplicates, and lifecycle

Status: `[ ] Pending`

- [ ] Detect duplicate reports using source hash, report identifiers, dates, performer, and result graph evidence.
- [ ] Keep similar reports from different documents as separate assertions unless identity is strong.
- [ ] Support corrected and amended reports without deleting prior content.
- [ ] Link replacement observations to their corrected predecessors.
- [ ] Handle cancelled reports and entered-in-error graphs non-destructively.
- [ ] Validate backup v2, export, migration, and restore compatibility.

# P4.6 — Evaluation and acceptance

Status: `[ ] Pending`

- [ ] Add schema and graph-validation tests.
- [ ] Add quantity, comparator, qualitative, coded, range, and unknown-date tests.
- [ ] Add report-level confirm/reject tests.
- [ ] Add rollback tests for invalid or partial graph writes.
- [ ] Add retry/deduplication tests.
- [ ] Add correction and amended-report tests.
- [ ] Add source-page and relationship tests.
- [ ] Run Python, TypeScript, all tests, and production build.
- [ ] Record final Phase 4 acceptance evidence.

---

# Implementation slices

## Slice 1 — Report-level intake and candidate graph

Status: `[-] In progress`

Planned delivery:

- strict report/specimen/result draft contracts;
- quantity, qualitative, comparator, original-unit, normalized-value, range, and unknown-date support;
- deterministic candidate graph creation;
- graph-level validation;
- report-level review surface;
- application-level all-or-nothing confirmation/rejection semantics;
- source-document and page evidence;
- regression tests and architecture evidence.

## Slice 2 — Rich report content and module integration

Status: `[ ] Pending`

Planned delivery:

- expanded qualitative, coded, narrative, titer, and ratio results;
- richer specimen and laboratory metadata;
- report inbox and detailed source-linked review;
- panel relationships and improved results module.

## Slice 3 — Trends, corrections, and duplicate handling

Status: `[ ] Pending`

Planned delivery:

- trend eligibility and compatible-unit grouping;
- corrected/amended report workflow;
- duplicate report evidence;
- replacement observation history;
- backup/export/migration checks.

## Slice 4 — Evaluation and final acceptance

Status: `[ ] Pending`

Planned delivery:

- broader PHI-free report fixtures;
- parser and graph-quality evidence;
- complete integrated validation;
- final acceptance report;
- Phase 5 handoff.

---

# Initial acceptance criteria for Slice 1

| Criterion | Required result |
|---|---|
| Report, observations, specimens, and document remain linked | Pass |
| Every extracted node starts as a candidate | Pass |
| Missing clinical dates remain unknown | Pass |
| Original values and units are preserved | Pass |
| Comparator values retain `<`, `<=`, `>=`, or `>` | Pass |
| Qualitative values are not forced into numbers | Pass |
| Normalized values never replace originals | Pass |
| Invalid graph relationships fail before persistence | Pass |
| Report-level confirmation cannot leave a partial graph | Pass |
| Source page and excerpt remain reviewable | Pass |
| Same-source retry does not duplicate graph nodes | Pass |
| Full repository validation passes | Pass |

---

# Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-07-31 | Stack Phase 4 on the accepted Phase 3 branch. | Report intake depends on Phase 3 local document/OCR provenance and the Phase 1–2 clinical record/review foundation. |
| 2026-07-31 | Use the existing `DiagnosticReport`, `Observation`, and `Specimen` resource types for the first slice. | Avoid an unnecessary schema-version change while the current model already supports the core relationship graph. |
| 2026-07-31 | Make report-level review an orchestration layer over the existing clinical store. | Preserve one clinical source of truth and one candidate lifecycle. |
| 2026-07-31 | Keep extracted report graphs candidate-only until explicit human review. | A correct value still may be attached to the wrong patient, date, specimen, panel, or source location. |

---

# Deferred choices

- Whether a later schema version should add explicit accession, laboratory organization, method, result-replacement, and panel-component fields.
- Whether derived report drafts should persist independently from clinical candidate resources.
- Which local parser or model should extract structured laboratory rows from OpenMed-derived text.
- How Arabic laboratory names, units, and qualitative values should be normalized without weakening source preservation.
- Which unit-conversion library and UCUM subset should be accepted for trends.
