# MediBrief P1 — FHIR R4 / International Patient Summary

**Branch:** `agent/p1-fhir-ips-interoperability`

**Standards target:** FHIR R4 `4.0.1` and `hl7.fhir.uv.ips#2.0.1`.

**Objective:** Add a standards-based document exchange foundation without weakening MediBrief's provenance, uncertainty, patient-identity, or human-review boundaries.

## P1.1 IPS document export

- [x] Generate a FHIR document `Bundle` with `type = document`.
- [x] Place the IPS `Composition` first and include resolvable Patient and software-author references.
- [x] Include persistent Bundle and Composition identifiers.
- [x] Declare the IPS 2.0.1 Bundle, Composition, Patient, and supported resource profiles.
- [x] Include required Problems, Allergies, and Medication Summary sections.
- [x] Use `emptyReason = unavailable` for empty required sections without asserting clinical absence.
- [x] Generate XHTML narrative for every included section.
- [x] Include supported conditions, allergies, medications, procedures, immunizations, observations, diagnostic reports, and specimens.
- [x] Keep original quantities and omit unsafe non-UCUM machine coding rather than silently normalizing it.
- [x] Produce a separate inclusion, exclusion, warning, and validation report.

## P1.2 Safe import

- [x] Parse and structurally validate an IPS JSON document before conversion.
- [x] Preview the IPS Patient identity without overwriting the selected local patient.
- [x] Convert supported resources into local `candidate` records only.
- [x] Preserve import provenance and document-local references.
- [x] Report unsupported and skipped resource types.
- [x] Leave the local record unchanged when validation fails.

## P1.3 User interface

- [x] Add an unlocked-app FHIR & IPS center.
- [x] Download `application/fhir+json` and the validation/exclusion report.
- [x] Preview a selected IPS before import.
- [x] Show candidate counts, identity comparison, validation errors, exclusions, and limitations.
- [x] Audit exports and candidate imports.

## P1.4 Validation gates

- [x] Add deterministic export, empty-section, round-trip import, and malformed-document tests.
- [x] Add a dedicated P1 GitHub workflow.
- [x] Generate a synthetic PHI-free IPS fixture during CI.
- [x] Run the official HL7 validator against FHIR R4 and `hl7.fhir.uv.ips#2.0.1`.
- [ ] Resolve every HL7 validator error and complete branch validation.
- [ ] Run deployment/browser acceptance and merge through a reviewed PR.

## P1.5 Deliberately deferred to the next P1 slice

- Broad terminology service integration and governed mappings for LOINC, UCUM, medication, condition, procedure, and allergy concepts.
- Import/export of every optional IPS section and resource profile.
- SMART App Launch and live EHR connection flows.
- Encrypted sharing links, expiry, revocation, and recipient audit semantics.
- Digital signatures and source-authenticity verification.
- National or jurisdiction-specific IPS derivatives.

## Safety boundary

FHIR/IPS validation verifies structure and declared profiles for the tested document. It does not establish patient identity, source authenticity, clinical truth, semantic completeness, terminology equivalence, regulatory status, or acceptance by every receiving system. Imported facts remain candidates until a person reviews and confirms them.
