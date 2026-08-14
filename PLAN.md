# MediBrief P3 — Prospective Medical-Document Validation

**Branch:** `agent/p3-prospective-validation-foundation`

**Status:** In progress — protocol and fail-closed release-gate foundation implemented.

**Objective:** Replace synthetic-only confidence with governed measured
evidence from named, locked extraction and OCR configurations, while keeping
all outputs candidate-only and preventing incomplete evidence from enabling a
clinical route.

## P3.0 Protocol and evidence classes

- [x] Define `contract-fixture` and `measured-prospective-run` evidence classes.
- [x] Require a frozen intended use, population boundary, task list, language
  list, document strata, and case-inventory hash.
- [x] Require named runtime configurations with explicit version, source
  revision, parameters, environment, and lock status.
- [x] Prevent a contract fixture from producing a release candidate.
- [x] Keep route authorization and clinical-validation claims outside the
  evaluator.

## P3.1 Data and gold-label governance

- [x] Require legally usable, independent test data with documented
  training-overlap assessment.
- [x] Require preprocessing to be frozen before scoring.
- [x] Require clinician-authored independent gold labels and completed
  adjudication for measured release evaluation.
- [x] Forbid committed source documents and raw patient/source fields in
  derived evidence.
- [ ] Acquire the first representative legally usable dataset.
- [ ] Complete clinician-authored gold labels and adjudication.

## P3.2 Stratified runtime evaluation

- [x] Support the seven roadmap document strata.
- [x] Stratify results by task, language, document type, and combined stratum.
- [x] Aggregate extraction, OCR, and medication-reconciliation metrics.
- [x] Treat runtime failures, identity mismatch, and critical errors as
  explicit stop-ship inputs.
- [ ] Capture measured output from the first approved extraction configuration.
- [ ] Capture measured output from the first approved OCR configuration.
- [ ] Add site and clinically relevant subgroup analyses after the dataset is
  approved.

## P3.3 Blinded clinician review

- [x] Require independent blinded review of high-risk and boundary results.
- [x] Track exact-verdict agreement and safety-class agreement.
- [x] Require adjudication on safety disagreement.
- [x] Stop-ship missing review, unresolved disagreement, unsafe adjudication,
  or reviewer-reported critical error according to policy.
- [ ] Recruit and credential the clinical review panel.
- [ ] Complete the first blinded review round.

## P3.4 Release and regression policy

- [x] Add task-specific threshold contracts.
- [x] Add minimum case counts by task, language, and document type.
- [x] Add zero-tolerance critical-error, identity-mismatch, and runtime-failure
  gates.
- [x] Add accepted-baseline regression comparisons.
- [x] Return `contract-only`, `stop-ship`, or
  `engineering-release-candidate`.
- [x] Keep route changes and medication safety disabled regardless of result.
- [ ] Approve the first clinical/statistical release policy.
- [ ] Establish the first accepted measured baseline.

## P3.5 Automation and evidence retention

- [x] Add prospective-validation unit tests.
- [x] Add a permanent P3 GitHub workflow.
- [x] Retain the PHI-free contract report as CI evidence.
- [ ] Retain approved derived measured reports in the controlled evidence
  location.
- [ ] Add change-control review for model, engine, threshold, or preprocessing
  updates.

## P3.6 Medication reconciliation

- [x] Add precision, recall, F1, unsupported-addition, omission, and
  attribute-accuracy gates.
- [x] Keep medication-safety capability disabled.
- [ ] Validate reconciliation on representative medication lists and
  prescriptions.
- [ ] Complete blinded review of medication additions, omissions, status,
  route, dose, frequency, and timing errors.

## Deliberately blocked

- Enabling Arabic or mixed-script clinical extraction from synthetic or
  contract evidence.
- Automatic provider selection or combining provider predictions.
- Committing source medical documents or raw patient text to the repository.
- Treating engineering thresholds as clinical validation.
- Patient-specific medication interactions, dosing, contraindication, or
  treatment recommendations.
- Any route change without separate reviewed change control.

## Safety boundary

A passing P3 report can identify an engineering release candidate for one
exact, frozen configuration and evaluation scope. It does not authorize a
MediBrief route change, establish clinical truth or patient identity, prove
improved outcomes, provide regulatory clearance, or enable medication safety.
