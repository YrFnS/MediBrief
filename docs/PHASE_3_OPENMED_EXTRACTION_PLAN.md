# MediBrief Phase 3 — OpenMed Extraction Integration

> Living implementation plan for replacing the narrow cloud-only entity extractor with a local-first, source-linked clinical extraction pipeline.
>
> **Branch:** `agent/phase-3-openmed-extraction`  
> **Base:** `agent/phase-2-personal-health-record`  
> **Started:** 2026-07-31  
> **Current focus:** Slice 1 — local OpenMed service contract, settings, text intake, and reviewable candidates

## Product goal

Phase 3 integrates OpenMed as a local clinical named-entity-recognition layer while preserving the safety boundaries established in Phases 1 and 2:

- extraction output is always a candidate;
- no extracted diagnosis, medication, allergy, result, or status becomes confirmed automatically;
- source text, offsets, model, confidence, and extraction time remain attached to every candidate;
- unknown assertion context remains unknown rather than being invented;
- unsupported files and unavailable local services are reported accurately;
- the existing Gemini extractor remains an explicit compatibility fallback during migration, not a hidden second source of truth.

## Verified OpenMed integration surface

The integration is based on the current OpenMed 2.x public repository and its documented local service surface:

- local REST service started with `uvicorn openmed.service.app:app`;
- `GET /health` for service availability;
- `POST /analyze` for local text entity extraction;
- entity results carrying text, label, confidence, start offset, and end offset;
- specialized disease and pharmaceutical model aliases;
- Apache-2.0 local/on-device deployment.

MediBrief does not assume that the generic public `/analyze` endpoint determines negation, certainty, temporality, experiencer, allergy relationships, or code-status meaning. Those fields remain unknown until a dedicated context layer is integrated and evaluated.

---

# Architecture principles

- OpenMed runs on the same device or trusted local network selected by the user.
- The default endpoint is loopback-only: `http://127.0.0.1:8080`.
- OpenMed is configured separately from the chat provider.
- A healthy OpenMed service is not evidence that a particular model is loaded or clinically suitable.
- Every response is schema-validated before mapping.
- Invalid offsets, invalid confidence values, malformed entities, and unsupported labels are rejected or ignored explicitly.
- Duplicate candidates are deduplicated only through the existing conservative source-aware record-store policy.
- Source offsets refer to the exact extracted text passed to OpenMed.
- Text extraction never substitutes OCR text that was not actually obtained.
- PDF and image OCR are separate work; Slice 1 does not pretend those files are text.
- Candidate creation remains patient-scoped and document-scoped.
- The local record remains usable when OpenMed is stopped.

---

# Workstreams

## P3.0 — Baseline, branch, and architecture

Status: `[-] In progress`

- [x] Create the dedicated Phase 3 branch from the accepted Phase 2 head.
- [x] Add this living Phase 3 plan.
- [x] Verify the current OpenMed local REST and model surface against the upstream repository.
- [ ] Add the Slice 1 architecture note.
- [ ] Inventory the current Gemini extraction and upload boundaries.
- [ ] Record explicit non-goals and fallback behavior.

## P3.1 — Local OpenMed client and settings

Status: `[ ] Not started`

- [ ] Add typed OpenMed health, entity, analysis, and error contracts.
- [ ] Add strict runtime response validation.
- [ ] Normalize and validate the configured base URL.
- [ ] Add request timeout and abort support.
- [ ] Add `GET /health` service checking.
- [ ] Add `POST /analyze` support.
- [ ] Add disease-model and pharmaceutical-model settings.
- [ ] Add confidence-threshold settings.
- [ ] Add extraction mode: Auto, OpenMed only, or Gemini only.
- [ ] Show service status without claiming model readiness.
- [ ] Keep OpenMed settings independent from chat-provider settings.

## P3.2 — Text intake and candidate mapping

Status: `[ ] Not started`

- [ ] Decode supported local text files without uploading them.
- [ ] Support plain text, Markdown, CSV, JSON, XML, and HTML-as-text intake.
- [ ] Reject empty, binary, oversized, or unsupported inputs explicitly.
- [ ] Run disease and medication extraction independently.
- [ ] Map disease labels to candidate `ConditionRecord` resources.
- [ ] Map pharmaceutical labels to candidate `MedicationRecord` resources.
- [ ] Preserve exact excerpt, character offsets, confidence, model, and engine version.
- [ ] Keep polarity, certainty, temporality, and experiencer unknown in Slice 1.
- [ ] Keep clinical dates explicitly unknown.
- [ ] Preserve existing candidate-review and source-preview behavior.
- [ ] Use existing conservative same-source deduplication.

## P3.3 — Assertion and relationship context

Status: `[ ] Not started`

- [ ] Introduce an evaluated context adapter for negation.
- [ ] Introduce certainty and hypothetical-context handling.
- [ ] Introduce historical/current temporality handling.
- [ ] Introduce patient/family/other experiencer handling.
- [ ] Add medication attribute and relationship extraction where supported.
- [ ] Add allergy relationship extraction only after dedicated validation.
- [ ] Add code-status extraction only from an authoritative, evaluated path.
- [ ] Preserve context-engine provenance separately from NER provenance.
- [ ] Require human review before confirmation.

## P3.4 — Document text and OCR pipeline

Status: `[ ] Not started`

- [ ] Add PDF text extraction with page boundaries.
- [ ] Add OCR for scanned PDFs and images through a local pipeline.
- [ ] Preserve page numbers, sections, offsets, and raw extracted text.
- [ ] Distinguish embedded PDF text from OCR text.
- [ ] Record OCR engine and confidence.
- [ ] Add extraction-status UI for queued, running, completed, partial, unsupported, and failed states.
- [ ] Keep the original file as the authoritative source.
- [ ] Never use import time as the document or clinical date.

## P3.5 — Language, evaluation, and fallback policy

Status: `[ ] Not started`

- [ ] Add deterministic language routing for supported extraction paths.
- [ ] Build synthetic English evaluation fixtures.
- [ ] Build synthetic Arabic evaluation fixtures.
- [ ] Measure entity precision, recall, span correctness, and candidate usability.
- [ ] Compare OpenMed output with the compatibility Gemini path.
- [ ] Document unsupported Arabic clinical-NER behavior separately from Arabic PII support.
- [ ] Make fallback behavior explicit in settings and provenance.
- [ ] Prevent fallback results from being attributed to OpenMed.
- [ ] Add extraction diagnostics without retaining unneeded patient text.

## P3.6 — Migration and acceptance evidence

Status: `[ ] Not started`

- [ ] Add repository-integrated tests for client, routing, mapping, and fallback.
- [ ] Add malformed-response and timeout tests.
- [ ] Add offset, confidence, and source-link tests.
- [ ] Add duplicate and cross-document separation tests.
- [ ] Add unsupported-file and service-unavailable tests.
- [ ] Add English and Arabic synthetic evaluation evidence.
- [ ] Run TypeScript validation, full tests, and production build.
- [ ] Record final Phase 3 acceptance evidence.
- [ ] Update the stacked draft pull request.

---

# Implementation slices

## Slice 1 — Local OpenMed foundation

Status: `[-] In progress`

- [x] Dedicated Phase 3 branch
- [x] Living implementation plan
- [ ] Local service client
- [ ] OpenMed settings and health status
- [ ] Supported text-file intake
- [ ] Disease and medication candidate mapping
- [ ] Explicit Gemini compatibility fallback
- [ ] Provenance, offsets, confidence, and unknown-context preservation
- [ ] Focused regression coverage
- [ ] Type-check, tests, and production build
- [ ] Architecture note and draft PR

## Slice 2 — Assertion context and richer clinical mapping

Status: `[ ] Not started`

- Negation, certainty, temporality, and experiencer
- Medication attributes and relationships
- Evaluated allergy and code-status paths
- Context-specific review UI
- Regression and evaluation fixtures

## Slice 3 — Local document text and OCR

Status: `[ ] Not started`

- PDF text extraction
- Scanned document OCR
- Page and section provenance
- Extraction status and failure recovery
- Source-text review

## Slice 4 — Language evaluation and final acceptance

Status: `[ ] Not started`

- English and Arabic synthetic corpora
- Measured extraction quality
- Explicit fallback policy
- Final migration and acceptance evidence

---

# Slice 1 acceptance criteria

Slice 1 is accepted only when:

1. OpenMed settings can be changed without changing the chat provider.
2. The service health check is cancellable, timed out, and accurately labelled.
3. Supported text files are decoded locally and never uploaded to OpenMed as binary data.
4. Unsupported PDFs and images are not represented as successfully processed by OpenMed.
5. Disease and medication entities produce candidate resources only.
6. Every OpenMed candidate retains document ID, file name, exact excerpt, valid offsets, confidence, model, engine, and extraction time.
7. Assertion context and clinical date remain unknown unless another evaluated layer supplies them.
8. A stopped or malformed OpenMed service does not corrupt the patient record.
9. Auto mode can use the existing Gemini compatibility path only when explicitly allowed and attributes that output correctly.
10. Repository type-check, all automated tests, and the production build pass.

---

# Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-07-31 | Build Phase 3 as a stacked branch from the completed Phase 2 head. | OpenMed candidates depend on the versioned record, review queue, provenance, source preview, and module UI completed in Phases 1–2. |
| 2026-07-31 | Start with a local REST sidecar rather than bundling model weights into the main web bundle. | The REST surface is documented, keeps the browser bundle smaller, and supports CPU/GPU runtimes without coupling the UI to one inference backend. |
| 2026-07-31 | Treat OpenMed’s public analyze path as NER, not full clinical assertion understanding. | Disease and medication spans do not by themselves establish negation, certainty, temporality, experiencer, allergy status, or code status. |
| 2026-07-31 | Limit Slice 1 to files that are already text. | PDF/image processing requires a real extraction or OCR pipeline with page-level provenance; guessing or silently using binary content would be unsafe. |
| 2026-07-31 | Keep Gemini only as an explicit compatibility fallback during migration. | Existing users should not lose document support, but fallback output must remain distinguishable in provenance and removable later. |

---

# Current deferred choices

- Whether the production desktop packaging will start and supervise the OpenMed sidecar automatically.
- Whether a later browser/WebGPU mode should use OpenMed-compatible ONNX exports directly.
- Which exact disease and medication models will become the validated defaults after local evaluation.
- Whether Arabic clinical NER will use an OpenMed model, a separate local model, or remain unsupported until measured.
- Whether PDF/OCR text should be persisted as a derived local document or regenerated on demand.
- Whether the context layer will be OpenMed-native, rule-assisted, or a separate evaluated local model.
