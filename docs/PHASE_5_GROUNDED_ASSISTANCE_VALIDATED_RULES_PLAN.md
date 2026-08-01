# Phase 5 — Grounded assistance and validated rules

Branch: `agent/phase-5-grounded-assistance`  
Base: accepted Phase 4 head `7dcc74d61bc4aec3bcc7effd6bd9496ccff83e88`  
Status: in progress  
Next: medication reconciliation

## Safety boundary

Patient-specific assistance uses confirmed, patient-applicable, source-linked evidence. Candidates, rejected or entered-in-error resources, negated or hypothetical assertions, non-patient evidence, and superseded diagnostic evidence do not silently become current patient facts. Original values remain authoritative, unknown dates remain unknown, and citation membership is not semantic or clinical validation.

## Completed

### Slice 1 — Grounding and fail-closed rules

- [x] Versioned patient grounding bundles.
- [x] Current, planning, and historical evidence scopes.
- [x] Stable `MB:<ResourceType>:<resourceId>` citation IDs.
- [x] Source labels, pages, original values, normalized secondary views, and date precision.
- [x] Citation syntax and selected-bundle membership validation.
- [x] Fail-closed validated-rule executor.
- [x] Empty validated-rule registry by default.

### Slice 2 — Deterministic summaries and grounded Assistant

- [x] No-AI confirmed-record summary.
- [x] Separate profile, current problems, allergies, medications, recent results/reports, visits, plans, tasks, history, and missing information.
- [x] Candidate and conflict counts without presenting candidates as facts.
- [x] Cautious empty states and explicit unknown dates.
- [x] No-key summary panel.
- [x] Deterministic routing for summary commands and patient-record questions.
- [x] Fresh patient evidence with no prior chat used as patient fact.
- [x] Relevant resource selection and explicit history opt-in.
- [x] Required exact local citations and standardized insufficient-evidence response.
- [x] Buffered patient-record output.
- [x] Entire model answer withheld for missing or invented citations.
- [x] General chat and document analysis remain separate.
- [x] Grounded output excluded from legacy lab ingestion.
- [x] Audit events and regression coverage.

Validated implementation head: `dd880f138e39f4d7fdaaf8ba9b7125ab8b40e56e`

GitHub Actions run **630** (`30675265526`) passed:

- Python OpenMed tests: **24 / 24**
- TypeScript type-check
- Test files: **46 / 46**
- Tests: **203 / 203**
- Slice 2 tests: **6 / 6**
- Existing Phase 5 foundation tests: **6 / 6**
- Production build
- Modules transformed: **1062**
- Main chunk: approximately **2.10 MB minified / 569 kB gzip**

Synthetic fixtures validate software contracts and routing, not clinical accuracy or sentence-level entailment.

## Next — Slice 3 medication reconciliation

- [ ] Dedicated human-review workspace.
- [ ] Compare statements, requests, and administrations without automatic authority.
- [ ] Detect exact duplicates, status and direction conflicts, missing directions/dates, uncertain active status, and source disagreements.
- [ ] Preserve all sources and amendment history.
- [ ] Name every compared record and source.
- [ ] Require reviewed decisions and reasons before record changes.
- [ ] Keep label retrieval separate from regimen conclusions.
- [ ] Never infer adherence, prescribing intent, discontinuation, appropriateness, interaction safety, organ adjustment, pregnancy suitability, or indication from incomplete records.

## Later slices

- [ ] Conservative trend explanations using only Phase 4-eligible points.
- [ ] Explicit reminders derived only from durable records and known dates.
- [ ] Low-risk validated workflow/data-quality rules with full review packages.
- [ ] Evidence drawer, audit review, PHI-free corpora, and final acceptance.

Diagnosis, prescribing, treatment, dose adjustment, emergency triage, drug-interaction safety, and protocol-state rules remain disabled unless separately validated.
