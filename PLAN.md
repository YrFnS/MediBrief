# MediBrief P0 — Safety Boundary

**Status:** Implemented on `agent/p0-safety-boundary`

**Objective:** Make the active product boundary truthful, visible, and enforceable before adding new medical functionality.

## P0.1 Product claims

- [x] Reframed MediBrief as a local personal health record and source-traceable review assistant.
- [x] Removed deployment-readiness and broad medical-grade/CDSS claims from the primary documentation.
- [x] Documented that diagnosis, prescribing, triage, patient-specific medication safety, autonomous orders, ambient audio, DICOM/PACS, and standards-conformant FHIR exchange are not active capabilities.
- [x] Added an in-app capability matrix with Available, Experimental, Disabled, and Planned states.

## P0.2 Cloud AI boundary

- [x] Cloud processing is disabled by default for each browser tab.
- [x] The general disclaimer does not double as cloud consent.
- [x] OpenRouter calls are intercepted immediately before transmission.
- [x] Requests enforce ZDR, deny provider data collection, disable fallback, and require parameter support.
- [x] Patient-record and medical document/image calls require an exact reviewed model/provider registry entry.
- [x] The production registry starts empty and therefore fails closed.
- [x] Blocked requests open the Safety & capabilities panel and state that no patient evidence was transmitted.

## P0.3 Local vault boundary

- [x] New vaults require a passphrase of at least 12 characters and reject numeric-only secrets.
- [x] New credentials use a higher PBKDF2 work factor and a versioned policy marker.
- [x] Repeated failures trigger exponential local retry delays.
- [x] Legacy PIN vaults remain accessible to avoid destructive migration and are visibly identified.
- [x] Recovery limitations and backup-before-migration guidance are explicit.

## P0.4 Production web boundary

- [x] Replaced Tailwind CDN with a local PostCSS/Tailwind build.
- [x] Removed external fonts, Iconify runtime assets, and ESM import maps.
- [x] Added a local application icon and manifest.
- [x] Added a same-origin application-shell service worker.
- [x] Added CSP and restrictive browser security headers.
- [x] Disabled camera and microphone permissions in production.

## P0.5 Governance

- [x] Added known limitations.
- [x] Added a clinical hazard register with owners, controls, and verification expectations.
- [x] Added clinical change-control rules.
- [x] Added the reviewed model/provider registry procedure.
- [x] Added P0 acceptance criteria.

## Explicitly deferred

The following are not silently included in P0:

1. Strong-passphrase re-encryption of existing legacy vaults.
2. FHIR R4 / International Patient Summary conformance.
3. Terminology normalization through LOINC, UCUM, medication, and condition code systems.
4. Patient-specific medication-safety rules.
5. Diagnostic, treatment, or emergency-triage rules.
6. DICOMweb and diagnostic image viewing.
7. Prospective clinical validation and monitored clinical deployment.

These items remain gated by the roadmap and change-control process.
