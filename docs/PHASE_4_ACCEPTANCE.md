# Phase 4 acceptance — Laboratory and diagnostic report pipeline

Phase 4 is accepted when all four slices pass the repository validation pipeline.

## Accepted capabilities

1. Source-linked `DocumentReference → DiagnosticReport → Observation / Specimen` graph.
2. Report-level human review with original document preview, edits, exclusions, amendment evidence, and atomic confirmation.
3. Explicit panel membership, source-preserving normalization, result-family presentation, and conservative trends.
4. Corrected/amended/replacement lineage, cross-source duplicate detection, reviewed conflict resolution, immutable superseded history, and duplicate-without-write handling.

## Safety invariants

- Original source values are never overwritten by normalized values.
- Unknown clinical dates remain unknown.
- Extraction output cannot bypass human review.
- Comparator, qualitative, narrative, absent, uncertain, incompatible, and superseded results are not converted into misleading numeric trend points.
- Exact duplicates create no second clinical graph.
- Corrections create new versions; prior reports and observations remain source-reviewable.
- Invalid graphs and unresolved blocking conflicts write nothing.

## Validation evidence

The acceptance run must include:

- Python OpenMed bridge and evaluation tests;
- TypeScript type-check;
- all Vitest suites, including diagnostic conflict and workspace contracts;
- production Vite build.

The PR description is the release record for the immutable validated head, workflow run, test totals, and remaining non-blocking dependency or bundle observations. Acceptance evidence must describe what was measured and must not turn synthetic fixtures into claims of real-world clinical accuracy.

Bundle-size, dependency-maintenance, mixed-import, and runtime stylesheet warnings remain separate performance/dependency workstreams and do not weaken the clinical correctness boundary above.