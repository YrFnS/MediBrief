# MediBrief Roadmap

## Product direction

MediBrief is a private, longitudinal, source-faithful personal health record that makes it clear where each fact came from, whether it is a candidate or confirmed record, what remains uncertain, what changed, and what requires review. Additional AI output is not progress unless the record, interoperability, validation, and governance boundaries improve with it.

## P0 — Safety boundary

**Status: Complete**

- truthful product language and capability matrix;
- session-scoped cloud acknowledgement;
- fail-closed reviewed model/provider registry;
- privacy-restricted OpenRouter routing;
- strong new-vault passphrases and retry delays;
- locally bundled production shell, CSP, and offline app shell;
- hazard, limitations, change-control, and model-registry documents.

## P1 — FHIR R4 / International Patient Summary

**Status: Complete**

- deterministic FHIR R4 document Bundle targeting IPS 2.0.1;
- required Problems, Allergies, and Medication Summary sections;
- unavailable empty sections that do not claim clinical absence;
- confirmed, patient-applicable export eligibility;
- candidate-only import with patient-identity preview;
- local validation, inclusion/exclusion reports, and audit events;
- official HL7 validator and Chromium acceptance gates.

## P2 — Governed terminology and multilingual validation

**Status: Complete**

1. Reviewed exact-alias LOINC candidates for a deliberately small observation subset.
2. Case-sensitive UCUM unit coding with original-value preservation.
3. Explicit analyte/code/unit conversion profiles only; no generic conversion guesses.
4. Source-provided medication terminology coding with no automatic search or selection.
5. Externally licensed SNOMED CT attachment only; no bundled content or automated search.
6. Human-reviewed amendment and audit workflow for every applied terminology mapping.
7. PHI-free English, Arabic, and mixed-script document corpus across seven document types.
8. Metrics for additions, omissions, exact facts, assertion context, dates, quantities, languages, and document types.
9. Permanent CI gate that distinguishes contract fixtures from measured runtime output.
10. Arabic and mixed-script clinical extraction remain blocked pending named measured routes and review.
11. Six-test Chromium acceptance plus built-shell and live deployment/header-contract checks.
12. Hosting preview quota failures are recorded as infrastructure limits; fresh previews remain mandatory whenever deployment/header configuration changes.

## P3 — Prospective medical-document validation

**Status: Next**

1. Capture measured runtime output from named extraction and OCR configurations.
2. Build representative, legally usable document sets with clinician-authored gold labels.
3. Separate evaluation by discharge summary, laboratory report, medication list, prescription, imaging report, clinical note, and poor-quality scan.
4. Add blinded clinician review for high-risk and boundary cases.
5. Define release and stop-ship thresholds per task and language.
6. Add model/version regression gates and retained evaluation artifacts.
7. Validate medication-record reconciliation before considering any medication-safety capability.

## P4 — Product simplification and accessibility

**Status: Planned**

Group the record around user jobs:

- Today
- Health record
- Medications
- Results
- Care
- Documents
- Share and manage

Add task-oriented onboarding, mobile navigation, keyboard and screen-reader verification, empty-state education, review queues, and usability studies with representative users.

## P5 — Carefully bounded clinical assistance

**Status: Gated**

A clinical function may enter this phase only after it has a precise intended use and population, named clinical and engineering owners, explicit inputs and exclusions, evidence/version metadata, representative positive/negative/missing-data/adversarial tests, human-factors review, and monitoring/rollback/incident procedures.

Patient-specific medication safety, diagnosis, treatment, emergency triage, autonomous actions, and diagnostic imaging remain disabled until their individual packages satisfy these conditions.
