# All-Branches Consolidation — 2026-08-15

## Status

This record documents the final repository-wide branch consolidation requested
for MediBrief.

- Source `main` head audited: `f5eb8e1b1b56219f6990d6a3e7112e88200e1afd`
- Branches audited: **23**, including `main`
- Substantive implementation changes missing from `main`: **0**
- Consolidation strategy: retain the validated `main` tree, add this evidence
  record, and attach every remaining non-ancestor branch head as an explicit
  merge parent.

This avoids replaying obsolete intermediate implementations over newer,
validated replacements while making every branch history reachable from the
resulting `main` history.

## Product-roadmap status

The original five-phase clinical rebuild is complete in the repository:

1. Clinical foundation
2. Personal health record interface
3. Local OpenMed extraction
4. Laboratory and diagnostic-report pipeline
5. Grounded assistance and low-risk validated-rule workflow

The current root `PLAN.md` is a newer **P3 prospective medical-document
validation plan**. It is not complete because it still requires work that cannot
be manufactured from repository code alone, including:

- a representative legally usable validation dataset;
- clinician-authored gold labels and completed adjudication;
- captured measured output from approved extraction and OCR configurations;
- a credentialed blinded clinical-review panel;
- an approved clinical/statistical release policy;
- an accepted measured baseline and governed change control.

Therefore the software consolidation can be complete while prospective clinical
validation remains intentionally incomplete and fail-closed.

## Branches already contained by ancestry

The following heads were already ancestors of the audited `main` head and had no
unmerged commits:

- `agent/p1-3-fhir-import-candidates`
- `agent/p1-5-closeout-evidence`
- `agent/p1-5-hapi-named-receiver`
- `agent/p1-fhir-ips-foundation`
- `agent/phase-1-clinical-foundation`
- `agent/phase-2-personal-health-record`
- `agent/phase-3-openmed-extraction`
- `agent/phase-4-diagnostic-report-pipeline`
- `agent/phase-4-diagnostic-reports`
- `agent/phase-5-grounded-assistance`
- `agent/phase-5-slice-5-staging`
- `integration/all-branches-20260804`

The two Phase 4 generations were previously reconciled in
`integration/all-branches-20260804`. The later diagnostic-report pipeline was
kept as the active implementation, while compatible work from the earlier
branch was preserved. Replaying the retired implementation would reintroduce
incompatible types and removed review paths.

## Squash-merged or superseded branch histories attached here

The following branch heads were not Git ancestors of `main` because their work
had been squash-merged, or because they were an intermediate staging lineage.
Their validated content is already present in `main` as the same or a newer
superset. They are attached as merge parents without replacing the current
validated tree:

- `agent/p0-safety-boundary` — `379cb6b0e8b33a5b2d06ce92aebbeb1a11849e14`
- `agent/p1-3-acceptance-closure` — `2f450ff69f6c5828641beedc18a0b79963d333fd`
- `agent/p1-3-atomic-source-preserving-ips-import` — `3d9be9c5ce8608f89eecf6f3c014abf5150083ab`
- `agent/p1-4-receiver-validation-terminology-adapters` — `4e55d21d52c97b26fb33920e2fa8607dfd8bf935`
- `agent/p1-6-exchange-governance` — `77282b3f04ac29e5b88bbafdf9dbd95339664f63`
- `agent/p1-fhir-ips-interoperability` — `0a9b4935d021a640628acb4e2c70ae3886826945`
- `agent/p2-terminology-multilingual-validation` — `a0446f964cfb5468023a0ee385fe823f777069bd`
- `agent/p3-prospective-validation-foundation` — `b609ddc92c6483572eda15896868c4af133d3acf`
- `agent/p4-workspace-information-hierarchy` — `f873cb3839ad9f8b93d147576b2c9fba48dab7d6`
- `staging/p1-fhir-ips-upload` — `d4d42ecbfb19428d4b11d924da36e9ddf382ac4d`

The staging FHIR branch contains only an early subset of the later accepted FHIR
R4 / IPS implementation and is deliberately not allowed to replace the newer
atomic import, receiver validation, terminology, and governance work.

## Stale pull requests

The old stacked Phase 2–5 pull requests were left open even though their branch
heads were integrated into the August 4 consolidation and are ancestors of
`main`. They should be closed as already integrated rather than merged again:

- PR #2 — Phase 2 personal health record
- PR #3 — Phase 3 OpenMed extraction
- PR #4 — Phase 4 diagnostic-report pipeline
- PR #5 — Phase 5 grounded assistance and validated rules

## Acceptance boundary

This consolidation proves repository ancestry and branch-content accounting. It
does not turn prospective validation fixtures into measured clinical evidence,
authenticate external medical sources or receivers, establish patient identity
or consent, authorize disclosure, provide regulatory clearance, or enable any
currently blocked clinical capability.
