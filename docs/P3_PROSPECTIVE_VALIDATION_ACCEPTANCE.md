# P3 Prospective Medical-Document Validation Acceptance

## Scope

P3 evaluates named extraction, OCR, and medication-reconciliation
configurations against frozen, legally usable test sets with clinician-authored
gold labels and blinded review. It does not enable diagnosis, treatment,
patient-specific medication safety, emergency triage, or autonomous actions.

## P3.0 Protocol and evidence foundation

- [x] Separate synthetic contract fixtures from measured prospective evidence.
- [x] Require a study identifier, protocol version, intended use, tasks,
  languages, document types, and frozen case-inventory hash.
- [x] Require named model or engine, explicit version, source revision,
  parameters, runtime environment, and locked configuration.
- [x] Reject measured configurations labelled `latest`, `unknown`, or
  unversioned.
- [x] Keep route changes outside the evaluator.
- [x] Keep `clinical_validation_established=false` for every report.

## P3.1 Data and gold-label governance

- [x] Require legally usable data, independent-test-set status,
  training-overlap assessment, and preprocessing frozen before scoring.
- [x] Forbid committed source documents and raw patient/source fields in
  derived result and review files.
- [x] Require a content hash for the frozen case inventory and gold labels.
- [x] Require clinician-authored, independently annotated, adjudicated gold
  labels before measured evidence can enter the release gate.
- [ ] Acquire the first representative legally usable document set.
- [ ] Complete clinician-authored gold labels for that set.
- [ ] Document site, population, acquisition, and exclusion characteristics.

## P3.2 Stratified measured evaluation

- [x] Support discharge summaries, laboratory reports, medication lists,
  prescriptions, imaging reports, clinical notes, and poor-quality scans.
- [x] Stratify by task, language, document type, and combined stratum.
- [x] Aggregate exact facts, unsupported additions, omissions, assertion
  context, dates, quantities, OCR character/word errors, page accuracy, and
  medication-reconciliation attributes.
- [x] Record runtime failures, identity mismatches, and critical errors as
  explicit stop-ship inputs.
- [ ] Capture measured outputs from the first approved locked configuration.
- [ ] Produce per-site and clinically relevant subgroup analyses.

## P3.3 Blinded clinician review

- [x] Require independent reviewers for high-risk and boundary results.
- [x] Require reviewers to remain blinded to runtime configuration.
- [x] Track exact-verdict and safety-class agreement separately.
- [x] Require adjudication when safety classifications disagree.
- [x] Stop-ship missing review, unresolved disagreement, unsafe final verdict,
  or reviewer-reported critical error according to policy.
- [ ] Recruit and credential the clinical review panel.
- [ ] Run the first blinded review and adjudication round.

## P3.4 Release and regression gates

- [x] Support task-specific approved threshold policies.
- [x] Support minimum case counts overall and by document type, language, and
  task.
- [x] Add zero-tolerance gates for critical errors, patient-identity mismatch,
  and runtime failure.
- [x] Support accepted-baseline regression checks with direction-aware
  tolerances.
- [x] Return only `contract-only`, `stop-ship`, or
  `engineering-release-candidate`.
- [x] Keep an engineering candidate from authorizing an application route.
- [ ] Approve final clinical and statistical thresholds for the first intended
  use and deployment population.
- [ ] Establish the first accepted measured baseline.

## P3.5 Automation and evidence retention

- [x] Add Python contract and failure-mode tests.
- [x] Add a permanent P3 GitHub Actions workflow.
- [x] Retain the PHI-free synthetic contract report as a CI artifact.
- [ ] Run and retain approved derived measured evidence outside public source
  control.
- [ ] Add model/version comparison and change-control review for the first
  measured update.

## P3.6 Medication reconciliation boundary

- [x] Add medication-reconciliation precision, recall, F1, unsupported
  additions, omissions, and attribute-accuracy gates.
- [x] Keep medication safety disabled regardless of reconciliation score.
- [ ] Validate medication reconciliation on representative medication lists
  and prescriptions before considering any additional medication capability.

## Evidence boundary

Passing the P3 contract workflow proves only that the protocol, derived-data,
review, threshold, regression, and stop-ship plumbing behaves as designed.

A later measured `engineering-release-candidate` would remain limited to the
exact frozen intended use, population, sites, document types, languages,
runtime versions, and thresholds. It would still not establish source
authenticity, patient identity, clinical truth, improved patient outcomes,
regulatory clearance, or medication-safety capability.
