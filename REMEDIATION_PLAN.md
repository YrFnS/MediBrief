# MediBrief Remediation and Governance Status

This document replaces earlier statements that MediBrief was broadly “medical-grade,” “feature complete,” or ready for clinical deployment.

## Authoritative current status

MediBrief is a local personal health record and source-traceable review assistant. Its strongest active controls are provenance, candidate review, uncertainty preservation, deterministic summaries, low-risk workflow/data-quality advisories, and fail-closed patient-specific cloud processing.

It is not a certified medical device and is not ready for unsupervised or clinical deployment.

## Completed remediation

- versioned structured clinical record with source and amendment history;
- explicit candidate, confirmed, rejected, and entered-in-error states;
- assertion context for polarity, certainty, temporality, and experiencer;
- encrypted local IndexedDB persistence;
- local audit events and review history;
- deterministic confirmed-record summaries;
- grounded patient-answer citation membership checks;
- retirement of unsafe legacy clinical threshold conclusions;
- reviewed low-risk data-quality/workflow rule framework;
- medication-record reconciliation without regimen-safety claims;
- P0 safety-boundary UI, cloud policy, strong new-vault policy, CSP, and governance documents.

## Active limitations

- local audit data is not cryptographically tamper-evident;
- legacy PIN vaults are not automatically re-encrypted;
- cloud acknowledgement does not establish legal or institutional permission to disclose health data;
- the reviewed patient-specific cloud-model registry is empty;
- OpenMed extraction remains experimental;
- terminology normalization is incomplete;
- exports are MediBrief-specific rather than validated FHIR/IPS exchange;
- image preview is non-diagnostic;
- no prospective clinical validation has been completed.

## Stop-ship boundaries

A release must not describe or enable any of the following without an approved change package:

- patient-specific dose, interaction, contraindication, renal/hepatic, pregnancy, or allergy safety conclusions;
- diagnosis, treatment recommendations, emergency triage, or protocol-state conclusions;
- autonomous ordering, prescribing, referral, booking, or completed-care recording;
- diagnostic interpretation of medical images;
- FHIR, IPS, DICOM, PACS, regulatory, compliance, or clinical-validation claims not demonstrated by retained evidence.

See `docs/CLINICAL_CHANGE_CONTROL.md` for the required package.
