# MediBrief

MediBrief is a **local personal health record and source-traceable medical-document review assistant**. It helps a user organize records, preserve provenance and uncertainty, review extracted candidates, and create deterministic summaries from locally confirmed information.

MediBrief is **not** a certified medical device, electronic prescribing system, diagnostic workstation, emergency-triage system, or autonomous clinical decision maker.

## Current product boundary

MediBrief may:

- keep a structured local patient record in an encrypted browser vault;
- preserve source documents, excerpts, dates, uncertainty, assertion context, and amendments;
- separate extracted candidates from confirmed, rejected, and entered-in-error records;
- create deterministic summaries and an emergency information view from confirmed local records;
- support medication-record reconciliation and documentation-quality review;
- provide limited educational cloud assistance after explicit per-tab acknowledgement.

MediBrief does not:

- diagnose, prescribe, recommend dose changes, or perform emergency triage;
- declare a medication or regimen safe for a patient;
- place orders, transmit prescriptions, book external appointments, or record proposals as completed care;
- provide a diagnostic DICOM/PACS viewer;
- guarantee that a FHIR/IPS file is clinically complete, semantically equivalent to every source, authentic, or accepted by every receiving system;
- treat automated tests or synthetic fixtures as clinical certification.

The in-app **Safety & capabilities** panel is the authoritative user-facing status matrix.

## Safety architecture

### Confirmed facts are different from extracted candidates

Clinical resources use explicit verification states:

- `candidate`
- `confirmed`
- `rejected`
- `entered-in-error`

The record also preserves negation, uncertainty, temporality, experiencer, original values, normalized values, unknown dates, source-document references, extraction metadata, and amendment history. Confirmation records a local human decision; it does not independently prove that the source is correct.

### Deterministic local summaries

Patient summaries can be built from confirmed, patient-applicable local evidence without calling a cloud model. Missing information remains missing. Upload, storage, extraction, and review timestamps are not silently substituted for unknown clinical dates.

### Clinical rules fail closed

Legacy threshold rules that could create treatment-style conclusions are disabled. The active validated rule registry is limited to reviewed low-risk workflow and data-quality advisories. Orders are not generated; review actions create local proposal/reminder tasks only.

### Cloud processing is off by default

Accepting the general disclaimer does not enable cloud AI. A user must separately enable cloud processing for the current browser tab.

Every OpenRouter chat request is intercepted immediately before transmission and rewritten to request:

- zero-data-retention endpoints;
- denial of provider data collection;
- no provider fallback;
- providers that support the requested parameters.

General cloud assistance may run after acknowledgement. Patient-record and medical document/image requests require an exact task-specific entry in the reviewed model/provider registry. The production registry is intentionally empty until a review package exists, so these requests fail closed and no patient evidence is sent.

See `docs/APPROVED_MODEL_REGISTRY.md`.

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
| Diagnosis, treatment, triage, dose checking | Disabled | Requires formal intended use and clinical validation |
| Autonomous orders and completed-care actions | Disabled | Local tasks remain proposals/reminders |
| Ambient audio | Disabled | Production permissions policy disables microphone access |
| FHIR R4 / IPS exchange | Experimental | Confirmed-record IPS export and candidate-only import; identity and semantic review remain required |
| DICOMweb | Planned | Current image preview is non-diagnostic |
| Prospective clinical validation | Planned | Engineering CI is not clinical evidence |


## FHIR R4 and International Patient Summary

MediBrief can export supported, confirmed, patient-applicable local records as a FHIR R4 document `Bundle` declaring the International Patient Summary 2.0.1 profiles. The document includes a `Composition` as its first entry, resolvable Patient and software-author references, required Problems/Allergies/Medication sections, generated section narrative, and a separate validation and exclusion report.

When a required section has no confirmed local information, MediBrief marks the section as unavailable and explicitly states that this does not prove clinical absence. Candidate, rejected, entered-in-error, negated, family-history, hypothetical, unsupported, and unsafe-to-map records are excluded rather than being promoted into the summary.

A received IPS may be previewed and structurally validated. Supported clinical resources are converted into local candidates only. The IPS Patient resource is displayed for identity comparison and never overwrites the selected local patient automatically.

The dedicated P1 workflow generates a PHI-free fixture and runs the official HL7 validator against FHIR R4 `4.0.1` and `hl7.fhir.uv.ips#2.0.1`. Passing validation establishes structure for the tested fixture; it does not establish patient identity, source authenticity, clinical correctness, complete terminology equivalence, or universal receiver acceptance.

See `docs/P1_FHIR_IPS_ACCEPTANCE.md`.

## Local vault

New vaults require a passphrase of at least 12 characters and reject numeric-only secrets. PBKDF2 derives a non-extractable AES-GCM key that remains in memory while unlocked. Local retry delays begin after repeated failures.

Existing legacy PIN vaults remain unlockable to avoid destructive migration. The UI clearly identifies them and recommends creating a validated backup before moving the record into a new strong-passphrase vault.

The local retry delay is a browser-side control. It does not protect a compromised device or replace operating-system account security, full-disk encryption, backups, or physical access controls.

## Production web boundary

The production shell bundles its JavaScript, CSS, typography, and icon assets locally. It does not depend on Tailwind CDN, external font hosts, Iconify, or ESM import maps at runtime.

Vercel headers define a restrictive Content Security Policy and disable camera, microphone, geolocation, payment, USB, serial, Bluetooth, and interest-cohort permissions. The service worker caches only same-origin application-shell assets. Patient records remain in the encrypted IndexedDB vault and API responses are not cached by the service worker.

A custom OpenMed endpoint must be explicitly allowed in the deployment CSP before the browser can connect to it. The default localhost endpoints are allowed for local bridge use.

## Main record areas

- patient roster and patient profile;
- conditions and allergies;
- medications and medication-record reconciliation;
- observations, laboratory results, diagnostic reports, and trends;
- visits, procedures, immunizations, appointments, tasks, care plans, and notes;
- source documents and candidate review;
- search, history, corrections, backups, complete confirmed-record export, and FHIR R4 IPS exchange;
- deterministic emergency summary;
- low-risk rules and audit review.

## Technology

- React 18 and TypeScript
- Vite
- Zustand
- IndexedDB through `idb-keyval`
- Web Crypto API: PBKDF2 and AES-GCM
- Zod validation
- Vitest
- OpenMed local bridge support
- Optional browser-to-OpenRouter BYOK transport under the cloud policy guard
- Deterministic FHIR R4 / IPS 2.0.1 document generation and candidate-only import

## Development

Requirements:

- Node.js 18 or newer
- Python 3.12 for the OpenMed bridge validation workflow

Install and run:

```bash
npm install
npm run dev
```

Run the complete validation suite:

```bash
npm run validate
python -m pytest -q openmed_bridge/tests
```

The GitHub workflows additionally evaluate the synthetic extraction corpora, run TypeScript and Vitest validation, build the production app, generate a PHI-free IPS fixture, and validate it with the official HL7 FHIR validator.

## Governance documents

- `docs/KNOWN_LIMITATIONS.md`
- `docs/CLINICAL_HAZARD_REGISTER.md`
- `docs/CLINICAL_CHANGE_CONTROL.md`
- `docs/APPROVED_MODEL_REGISTRY.md`
- `docs/P0_SAFETY_BOUNDARY_ACCEPTANCE.md`
- `docs/P1_FHIR_IPS_ACCEPTANCE.md`

Older phase documents are implementation history. When an older document conflicts with the active code, this README, the governance documents above, and the in-app capability matrix take precedence.
