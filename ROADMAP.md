# MediBrief Roadmap

## Product direction

MediBrief should become a private, longitudinal, source-faithful personal health record that makes it easy to see:

- where each fact came from;
- whether it is a candidate or confirmed record;
- what remains uncertain or unknown;
- what changed and why;
- what requires human review;
- what can and cannot safely be sent to an external service.

The roadmap does not treat additional AI output as progress unless the underlying record, interoperability, validation, and governance boundaries improve with it.

## P0 — Safety boundary

**Status: Complete**

- truthful product language and capability matrix;
- session-scoped cloud acknowledgement;
- fail-closed reviewed clinical model registry;
- OpenRouter ZDR/no-collection routing;
- strong new-vault passphrases and local retry delays;
- legacy-vault warning without destructive migration;
- locally bundled production shell, CSP, and offline app shell;
- hazard, limitations, change-control, and model-registry documents.

## P1 — Interoperable record foundation

**Status: Next**

1. Define supported FHIR R4 profiles and implementation-guide versions.
2. Build validated FHIR import with quarantine for invalid or unsupported resources.
3. Generate a conformant International Patient Summary document bundle.
4. Preserve MediBrief provenance and original source evidence beside normalized resources.
5. Add terminology mappings for laboratory observations, units, medications, conditions, procedures, and allergies.
6. Add validation reports that explain every rejected, downgraded, or partially mapped field.
7. Create encrypted, consent-controlled sharing with expiry and revocation semantics.
8. Add integration tests against external FHIR validators.

## P2 — Medical-document validation

**Status: Planned after P1 contracts are stable**

1. Build representative English, Arabic, and bilingual datasets.
2. Separate evaluation by discharge summary, laboratory report, medication list, prescription, imaging report, clinical note, and poor-quality scan.
3. Measure exact and relaxed extraction accuracy, omission rate, unsupported-addition rate, negation, uncertainty, temporality, family-history attribution, dates, and units.
4. Add blinded clinician review for high-risk and boundary cases.
5. Define release thresholds and stop-ship thresholds for each task.
6. Add model/version regression gates and retained evaluation artifacts.
7. Validate medication-record reconciliation before any medication-safety advice is considered.

## P3 — Product simplification and accessibility

**Status: Planned**

Group the record around user jobs rather than exposing every resource type as a first-level destination:

- Today
- Health record
- Medications
- Results
- Care
- Documents
- Share and manage

Add task-oriented onboarding, mobile navigation, keyboard and screen-reader verification, empty-state education, review queues, and usability studies with representative users.

## P4 — Carefully bounded clinical assistance

**Status: Gated**

A clinical function may only enter this phase after it has:

- a precise intended use and intended population;
- named clinical and engineering owners;
- required inputs and explicit exclusions;
- evidence and version metadata;
- a reviewed model/provider or deterministic rule package;
- representative positive, negative, missing-data, and adversarial tests;
- human factors review;
- monitoring, rollback, incident, and retirement procedures.

Patient-specific medication safety, diagnosis, treatment, emergency triage, autonomous actions, and diagnostic imaging remain disabled until their individual packages satisfy these conditions.
