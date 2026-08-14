# MediBrief P3 Prospective Validation

This directory is the governance and release-gate layer for the roadmap P3
prospective medical-document validation phase.

The older `evaluation/phase3` directory contains extraction and OCR metric
contracts created before the roadmap was renumbered. P3 consumes measured,
case-level outputs from those tools, but adds the controls needed to prevent a
synthetic or incomplete run from being treated as clinical evidence.

## Evidence classes

### `contract-fixture`

The committed JSON files in this directory are PHI-free synthetic fixtures.
They validate:

- protocol and runtime-configuration schemas;
- document-type, language, and task stratification;
- blinded independent review accounting;
- disagreement and adjudication rules;
- threshold and zero-tolerance stop-ship gates;
- release-decision and regression plumbing.

A perfect contract fixture always returns:

```text
decision: contract-only
route_change_authorized: false
clinical_validation_established: false
```

### `measured-prospective-run`

A measured run must identify the exact locked model or OCR engine, version,
source revision, parameters, runtime environment, case-inventory hash, and
derived prediction hashes.

Measured evidence additionally requires:

- a legally usable, independent test set;
- documented training-overlap assessment;
- preprocessing frozen before scoring;
- clinician-authored independently annotated gold labels;
- completed gold-label adjudication;
- protocol registration before execution;
- clinical, statistical, and engineering approval;
- blinded independent clinician review of high-risk and boundary results;
- adjudication of reviewer safety disagreement;
- an approved task-specific release policy;
- no committed source documents or raw patient text.

Even when every engineering gate passes, the evaluator returns only
`engineering-release-candidate`. It never changes a MediBrief application
route and never establishes clinical validation.

## Committed fixtures

| File | Purpose |
|---|---|
| `protocol_contract_fixture.json` | Synthetic frozen protocol and named runtime configurations |
| `runtime_results_contract_fixture.json` | Derived case-level counts for all seven document strata |
| `clinician_reviews_contract_fixture.json` | Synthetic blinded-review accounting |
| `release_policy_contract_fixture.json` | Threshold and stop-ship contract; cannot approve release |

## Run the contract gate

```bash
python -m openmed_bridge.evaluate_prospective_validation \
  --protocol evaluation/p3/protocol_contract_fixture.json \
  --results evaluation/p3/runtime_results_contract_fixture.json \
  --reviews evaluation/p3/clinician_reviews_contract_fixture.json \
  --policy evaluation/p3/release_policy_contract_fixture.json \
  --require-contract-fixture \
  --output p3-evidence/prospective-validation-contract-report.json
```

The command succeeds only when the fixture remains explicitly synthetic and
the result remains `contract-only`.

## Measured-run command

Measured files must stay outside the repository when they contain or could
reveal protected health information. Only approved, derived evidence may be
passed to the evaluator.

```bash
python -m openmed_bridge.evaluate_prospective_validation \
  --protocol /approved/p3/protocol.json \
  --results /approved/p3/derived-results.json \
  --reviews /approved/p3/derived-clinician-reviews.json \
  --policy /approved/p3/release-policy.json \
  --baseline-report /approved/p3/accepted-baseline-report.json \
  --require-measured-evidence \
  --require-release-candidate \
  --output /approved/p3/release-gate-report.json
```

A nonzero exit means the run is malformed, incomplete, synthetic, or
stop-shipped by at least one approved gate.

## Decision states

| Decision | Meaning |
|---|---|
| `contract-only` | Schema and gate plumbing are valid; no measured release decision exists |
| `stop-ship` | Measured evidence exists but at least one required gate failed |
| `engineering-release-candidate` | Approved engineering gates passed for the exact named configuration; separate change control and clinical approval are still required |

## Current boundary

This foundation does not provide a legally usable medical-document dataset,
clinician-authored gold labels, approved clinical thresholds, a prospective
workflow study, Arabic clinical NER approval, mixed-script clinical NER
approval, or medication-safety capability.

## Design references

- IMDRF/AIML WG/N88 FINAL:2025, *Good machine learning practice for medical
  device development: Guiding principles*:
  https://www.imdrf.org/documents/good-machine-learning-practice-medical-device-development-guiding-principles
- IMDRF/SaMD WG/N41FINAL:2017, *Software as a Medical Device: Clinical
  Evaluation*:
  https://www.imdrf.org/documents/software-medical-device-samd-clinical-evaluation
- DECIDE-AI early-stage clinical evaluation reporting guideline:
  https://doi.org/10.1038/s41591-022-01772-9
- FDA draft guidance, *Artificial Intelligence-Enabled Device Software
  Functions: Lifecycle Management and Marketing Submission Recommendations*.
  This document is draft and not for implementation:
  https://www.fda.gov/regulatory-information/search-fda-guidance-documents/artificial-intelligence-enabled-device-software-functions-lifecycle-management-and-marketing
