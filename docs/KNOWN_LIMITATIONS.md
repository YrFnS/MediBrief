# MediBrief Known Limitations

This document describes limitations of the active implementation. It is intentionally conservative. An empty section in the record or a successful automated test must not be interpreted as proof of clinical completeness or safety.

## Intended use boundary

MediBrief is intended to help a user organize and review a local personal health record. It is not intended to diagnose disease, recommend treatment, perform emergency triage, prescribe medication, validate a regimen, place orders, provide a diagnostic imaging workstation, or replace an authoritative clinical record.

## Record completeness

- The local record contains only information entered, imported, extracted, and confirmed on this device.
- No entry means “not present in this local record,” not “the patient does not have this history.”
- A confirmed record means a local user accepted it; confirmation does not independently authenticate the source.
- External corrections may not be reflected locally.
- Unknown clinical dates remain unknown. Storage and upload timestamps are not clinical-event dates.

## Extraction and OCR

- OCR can misread names, dates, decimal separators, units, reference ranges, negation, and handwritten content.
- Entity extraction can omit facts, split one fact into several candidates, merge unrelated statements, or assign the wrong experiencer or temporality.
- Arabic, English, mixed-language, abbreviated, and poor-quality documents require separate validation.
- Extracted content remains a candidate until human review.

## Cloud assistance

- Cloud processing is disabled by default for each tab.
- General cloud assistance requires an explicit acknowledgement and may still be inaccurate or incomplete.
- Patient-record and medical document/image requests are blocked unless their exact model/provider profile appears in the reviewed registry.
- The production reviewed registry currently contains no entries.
- ZDR and data-collection routing preferences reduce exposure but do not establish legal, institutional, contractual, or regulatory permission to disclose health information.
- Provider terms, endpoint policies, geographic routing, abuse monitoring, metadata handling, and account settings can change outside MediBrief.
- Citation membership proves only that an identifier exists in the selected local evidence bundle; it does not prove semantic or clinical correctness.

## Medication functions

- Medication reconciliation compares records and documentation; it does not decide whether a regimen is appropriate or safe.
- FDA label lookup does not validate dose, route, frequency, duration, formulation, total daily exposure, indication, age, weight, kidney/liver function, pregnancy, allergies, interactions, or monitoring requirements.
- No patient-specific dose, interaction, contraindication, or adjustment rules are enabled.

## Clinical rules

- Legacy treatment-style threshold rules are disabled.
- Active validated rules are limited to reviewed low-risk workflow and data-quality advisories.
- Rule metadata and regression tests do not equal clinical validation in a real care environment.
- Local tasks created from an advisory are reminders/proposals, not orders or completed care.

## Imaging

- The image component is a basic preview for ordinary image files.
- It does not implement DICOMweb, modality-specific metadata, calibrated display, hanging protocols, measurements, series navigation, window/level presets, or diagnostic-quality rendering.
- It must not be used to exclude abnormalities or make a diagnosis.

## Interoperability

- The internal record is FHIR-inspired but is not a complete or validated FHIR implementation.
- Current exports are MediBrief-specific JSON/HTML formats.
- No claim of FHIR R4, International Patient Summary, SMART App Launch, DICOM, PACS, or EHR conformance is made.
- Terminology mapping is partial and must preserve original source text and mapping uncertainty.

## Security and privacy

- Local encryption protects stored application values while the vault is locked, but it cannot protect a compromised browser, operating system, extension, device, or unlocked session.
- Browser-side retry delays can be bypassed by an attacker with device or developer-tool access.
- Legacy PIN vaults remain accessible to avoid destructive migration and retain their original work factor.
- MediBrief cannot recover a forgotten passphrase.
- Audit events are encrypted locally but are not cryptographically append-only or independently notarized.
- User-created exports may contain sensitive information and are outside the encrypted vault after download.
- Offline caching covers the application shell only; it is not a backup of the clinical record.

## Availability and recovery

- Browser storage can be deleted by the user, browser cleanup, profile reset, storage pressure, corruption, or device failure.
- A service worker does not guarantee permanent offline availability.
- Users must create and verify backups appropriate to their use case.
- Migration failures are designed to preserve legacy data, but recovery has not been validated across every browser and historical application version.

## Accessibility and usability

- Keyboard and screen-reader patterns exist in several workflows, but full assistive-technology and human-factors validation is incomplete.
- The number of record modules can create discovery and navigation burden, especially on small screens.
- Clinical importance, urgency, and workflow priority are not comprehensively ranked.

## Validation status

- GitHub CI, unit tests, synthetic fixtures, and extraction metrics provide engineering evidence.
- Representative prospective clinical validation, clinician usability studies, multilingual field studies, monitored deployment, and post-market-style surveillance have not been completed.
