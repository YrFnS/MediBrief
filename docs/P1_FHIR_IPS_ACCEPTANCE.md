# P1 FHIR R4 / IPS Interoperability Acceptance

## Standards target

- FHIR R4 version `4.0.1`.
- International Patient Summary package `hl7.fhir.uv.ips#2.0.1`.
- IPS document `Bundle` with `type = document` and a `Composition` as the first entry.

## Export boundary

- [x] Export uses deterministic document-local UUID references.
- [x] Bundle and Composition identifiers contain system and value.
- [x] Patient and software-author resources are included and references resolve.
- [x] Required Problems, Allergies, and Medication Summary sections are always present.
- [x] Empty required sections use `emptyReason = unavailable` and narrative that does not claim clinical absence.
- [x] Every included section has generated XHTML narrative.
- [x] Only confirmed, patient-applicable resources are eligible.
- [x] Candidate, rejected, entered-in-error, negated, family-history, and hypothetical assertions are excluded.
- [x] Original quantity values are retained; non-UCUM machine coding is not silently treated as UCUM.
- [x] Unsupported or unsafe-to-map records appear in the exclusion report.
- [x] Laboratory/radiology results without recorded performer attribution are excluded rather than assigned an invented performer.
- [x] Confirmed vital signs remain visible in section narrative but are not emitted as ambiguous structured entries under the overlapping IPS 2.0.1 Bundle Observation slices.

## Import boundary

- [x] IPS JSON is structurally validated before conversion.
- [x] Patient identity is previewed for comparison and never overwrites the active local profile automatically.
- [x] Supported Condition, AllergyIntolerance, MedicationStatement/Request, Procedure, Immunization, Observation, DiagnosticReport, and Specimen resources become local candidates.
- [x] Imported resources never become confirmed automatically.
- [x] Unsupported resources are reported rather than silently converted.
- [x] Failed validation leaves the local record unchanged.

## User experience

- [x] A visible FHIR & IPS center is available inside the unlocked application.
- [x] Users can download `application/fhir+json` and a separate validation/exclusion report.
- [x] Users can preview an IPS file before creating candidates.
- [x] The interface states that standards validation does not establish identity, source authenticity, clinical truth, semantic completeness, or receiver acceptance.

## Automated validation completed before merge

- [x] TypeScript application type-check.
- [x] Full MediBrief clinical validation and regression suite.
- [x] Dedicated Vitest export/import and negative tests.
- [x] Production Vite build.
- [x] Official HL7 validator against FHIR R4 and `hl7.fhir.uv.ips#2.0.1`: zero profile errors for the PHI-free synthetic fixture.
- [x] Chromium acceptance: malformed IPS files create no candidates.
- [x] Chromium acceptance: incoming Patient identity is shown before import.
- [x] Chromium acceptance: a supported incoming Condition becomes a pending candidate only.
- [x] Chromium acceptance: imported content remains subject to source review and explicit confirmation.
- [x] Pull-request merge-ref clinical validation passed.
- [x] Pull-request merge-ref IPS conformance validation passed and uploaded the PHI-free fixture.
- [x] Vercel preview deployed successfully.
- [x] Netlify preview deployed successfully with CSP, permissions, framing, MIME, referrer, and service-worker headers verified.

## Evidence boundary

Passing these checks establishes syntactic and declared-profile conformance for the generated fixture and verifies the local safety workflow. It does not constitute clinical certification, regulatory clearance, terminology validation for every source code, patient-identity matching, source authentication, semantic completeness, or guaranteed interoperability with every receiving implementation.
