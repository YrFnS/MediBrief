# MediBrief

MediBrief is a **local personal health record and source-traceable medical-document review assistant**. It helps a user organize records, preserve provenance and uncertainty, review extracted candidates, create deterministic summaries from locally confirmed information, and exchange a carefully bounded International Patient Summary.

MediBrief is **not** a certified medical device, electronic prescribing system, diagnostic workstation, emergency-triage system, or autonomous clinical decision maker.

## Current product boundary

MediBrief may:

- keep a structured patient record in an encrypted local browser vault;
- preserve source documents, excerpts, dates, uncertainty, assertion context, and amendments;
- separate extracted candidates from confirmed, rejected, and entered-in-error records;
- create deterministic summaries and an emergency information view from confirmed local records;
- support medication-record reconciliation and documentation-quality review;
- export and safely preview/import a bounded FHIR R4 International Patient Summary;
- offer human-reviewed terminology candidates for a small governed subset;
- provide limited educational cloud assistance after explicit per-tab acknowledgement.

MediBrief does not:

- diagnose, prescribe, recommend dose changes, or perform emergency triage;
- declare a medication or regimen safe for a patient;
- place orders, transmit prescriptions, book external appointments, or record proposals as completed care;
- provide a diagnostic DICOM/PACS viewer;
- automatically code free text into a broad clinical terminology;
- guarantee that a FHIR/IPS file is clinically complete, authentic, semantically equivalent to every source, or accepted by every receiving system;
- treat automated tests, terminology matches, or synthetic fixtures as clinical certification.

The in-app **Safety & capabilities** panel is the authoritative user-facing status matrix.

## Safety architecture

### Confirmed facts are different from extracted candidates

Clinical resources use explicit verification states:

- `candidate`
- `confirmed`
- `rejected`
- `entered-in-error`

The record preserves negation, uncertainty, temporality, experiencer, original and normalized values, unknown dates, source-document references, extraction metadata, and amendment history. Confirmation records a local human decision; it does not independently prove that the source is correct.

### Deterministic local summaries

Patient summaries can be built from confirmed, patient-applicable evidence without calling a cloud model. Missing information remains missing. Upload, storage, extraction, and review timestamps are not substituted for unknown clinical dates.

### Clinical rules fail closed

Legacy threshold rules that could create treatment-style conclusions are disabled. The active validated registry is limited to reviewed low-risk workflow and data-quality advisories. Orders are not generated; review actions create local proposal or reminder tasks only.

### Cloud processing is off by default

Accepting the general disclaimer does not enable cloud AI. A user must separately enable cloud processing for the current browser tab. General cloud assistance may run after acknowledgement. Patient-record and medical document/image requests require an exact task-specific reviewed model/provider entry. The production registry remains intentionally empty, so those requests fail closed and no patient evidence is sent.

## Capability status

| Capability | Status | Important boundary |
|---|---|---|
| Local structured personal health record | Available | May be incomplete compared with external clinical records |
| Candidate/source review and provenance | Available | Human confirmation is not independent source verification |
| Deterministic summaries and emergency view | Available | No diagnosis or triage |
| Medication-record reconciliation | Available | No patient-specific medication-safety verdict |
| OpenMed extraction | Experimental | OCR/entity candidates require human review |
| General cloud educational assistance | Experimental | Explicit per-tab acknowledgement required |
| Basic image preview | Experimental | Not diagnostic imaging or PACS |
| FHIR R4 / IPS exchange | Experimental | Confirmed-record export and candidate-only import; identity and semantic review remain required |
| Governed terminology review | Experimental | Small reviewed subset; no automatic coding and no proof of clinical truth |
| Multilingual document evaluation | Experimental | PHI-free engineering corpus; Arabic and mixed-script clinical extraction remain blocked |
| Diagnosis, treatment, triage, dose checking | Disabled | Requires formal intended use and clinical validation |
| Autonomous orders and completed-care actions | Disabled | Local tasks remain proposals/reminders |
| Ambient audio | Disabled | Production permissions policy disables microphone access |
| DICOMweb | Planned | Current image preview is non-diagnostic |
| Prospective clinical validation | Planned | Engineering CI is not clinical evidence |

## FHIR R4 and International Patient Summary

MediBrief exports supported, confirmed, patient-applicable records as a FHIR R4 document `Bundle` declaring the International Patient Summary 2.0.1 profiles. The document includes a `Composition` first, resolvable Patient and software-author references, required Problems/Allergies/Medication sections, generated section narrative, and a validation/exclusion report.

When a required section has no confirmed local information, MediBrief marks it unavailable and states that this does not prove clinical absence. Candidate, rejected, entered-in-error, negated, family-history, hypothetical, unsupported, and unsafe-to-map records are excluded rather than promoted into the summary.

A received IPS is previewed and structurally validated. Supported resources become local candidates only. The incoming Patient resource is displayed for identity comparison and never overwrites the selected patient automatically.

The permanent P1 workflow generates a PHI-free fixture and runs the official HL7 validator against FHIR R4 `4.0.1` and `hl7.fhir.uv.ips#2.0.1`. Passing establishes structure for the tested fixture, not patient identity, source authenticity, clinical correctness, complete terminology equivalence, or universal receiver acceptance.

See `docs/P1_FHIR_IPS_ACCEPTANCE.md`.

## Governed terminology review

The unlocked application includes a **Terminology review center**.

### LOINC

MediBrief bundles only a small reviewed exact-alias subset for precisely described common observations. Generic labels such as bare “glucose” or “creatinine” remain uncoded because specimen, property, and method context are missing. A candidate must be reviewed before it amends the record.

### UCUM

Reviewed unit aliases are mapped to case-sensitive UCUM codes. Original values and units are preserved. Conversion occurs only when the observation code and source unit match an explicit governed profile. The previous hard-coded adult physiological plausibility table has been removed; terminology normalization does not issue safety or diagnosis conclusions.

### Medication terminology

A user may attach an identifier only when it is already present in a reviewed clinical source, imported record, or separately governed terminology workflow. MediBrief requires the identifier, display, source description, and explicit review acknowledgement. It does not search for medication concepts or perform interaction, dose, or medication-safety checking.

### SNOMED CT

MediBrief does not bundle, search, or automatically map SNOMED CT content. A user may attach a code only when it comes from a separately licensed source and an edition/version URI and licensing acknowledgement are supplied. MediBrief does not verify the code, edition, clinical appropriateness, or deployment license.

Every applied mapping is a human-reviewed amendment and audit event. Original source truth remains visible.

See `docs/P2_TERMINOLOGY_MULTILINGUAL_ACCEPTANCE.md`.

## Multilingual document-evaluation gate

P2 adds a PHI-free engineering corpus covering English, Arabic, and mixed-script examples across discharge summaries, laboratory reports, medication lists, prescriptions, imaging reports, clinical notes, and degraded scan-derived text.

The evaluator reports exact fact precision/recall/F1, unsupported additions, omissions, route accuracy, assertion-context accuracy, dates, and quantities, overall and by language/document type. The committed prediction file is a deterministic contract fixture; its perfect score validates metric plumbing only. It is not model accuracy and cannot enable an Arabic or mixed-script clinical route.

Measured runtime output must name the actual engine, model/version, thresholds, corpus, and capture conditions and must pass a separate measured-evidence gate. Arabic OCR capability remains separate from Arabic clinical NER and assertion-context capability.

See `evaluation/p2/README.md`.

## Local vault and production boundary

New vaults require a passphrase of at least 12 characters and reject numeric-only secrets. PBKDF2 derives a non-extractable AES-GCM key that remains in memory while unlocked. Existing legacy PIN vaults remain unlockable with clear migration warnings.

The production shell bundles application assets locally. A restrictive Content Security Policy, permissions policy, framing protection, MIME protection, and no-referrer policy are applied. The service worker caches only same-origin shell assets; patient records and terminology/API responses are not placed in the service-worker cache.

External cloud or terminology calls occur only through explicit user actions and allowed endpoints. Opening a review center does not trigger an external request.

## Main record areas

- patient roster and profile;
- conditions and allergies;
- medications and medication-record reconciliation;
- observations, laboratory results, reports, and trends;
- visits, procedures, immunizations, appointments, tasks, care plans, and notes;
- source documents and candidate review;
- search, history, corrections, backups, confirmed-record export, and FHIR R4 IPS exchange;
- deterministic emergency summary;
- terminology review, low-risk rules, and audit review.

## Technology

- React 18, TypeScript, and Vite
- Zustand and encrypted IndexedDB storage
- Web Crypto API: PBKDF2 and AES-GCM
- Zod validation
- Vitest and Playwright
- Python/OpenMed bridge evaluation tools
- Optional guarded browser-to-cloud educational transport
- Deterministic FHIR R4 / IPS 2.0.1 generation and candidate-only import
- Governed LOINC/UCUM subset, source-provided medication identifiers, and externally licensed SNOMED CT attachment

## Development

Requirements:

- Node.js 18 or newer
- Python 3.12 for bridge and evaluation workflows

```bash
npm install
npm run dev
```

Run the repository checks:

```bash
npm run validate
python -m pytest -q openmed_bridge/tests
python -m openmed_bridge.evaluate_multilingual_documents \
  --gold evaluation/p2/multilingual_clinical_documents_gold.json \
  --predictions evaluation/p2/multilingual_contract_predictions.json \
  --require-contract-fixture
```

GitHub Actions additionally validates the synthetic extraction corpora, TypeScript, Vitest, Playwright, production build, FHIR/IPS fixture, official HL7 profile conformance, terminology governance, and retained PHI-free multilingual evidence.

## Governance documents

- `docs/KNOWN_LIMITATIONS.md`
- `docs/CLINICAL_HAZARD_REGISTER.md`
- `docs/CLINICAL_CHANGE_CONTROL.md`
- `docs/APPROVED_MODEL_REGISTRY.md`
- `docs/P0_SAFETY_BOUNDARY_ACCEPTANCE.md`
- `docs/P1_FHIR_IPS_ACCEPTANCE.md`
- `docs/P2_TERMINOLOGY_MULTILINGUAL_ACCEPTANCE.md`

Older phase documents are implementation history. When an older document conflicts with active code, this README, the governance documents above, and the in-app capability matrix take precedence.
