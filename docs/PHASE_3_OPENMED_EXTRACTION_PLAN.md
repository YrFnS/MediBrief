# MediBrief Phase 3 — OpenMed Extraction Integration

> Living implementation plan for replacing the narrow cloud-only entity extractor with a local-first, source-linked clinical extraction pipeline.
>
> **Branch:** `agent/phase-3-openmed-extraction`  
> **Base:** `agent/phase-2-personal-health-record`  
> **Started:** 2026-07-31  
> **Current focus:** Slice 2 — evaluated assertion context and richer clinical relationships

## Product goal

Phase 3 integrates OpenMed as a local clinical extraction layer while preserving the safety boundaries established in Phases 1 and 2:

- extraction output is always a candidate;
- no extracted diagnosis, medication, allergy, result, or status becomes confirmed automatically;
- source text, offsets, model, confidence, and extraction time remain attached to every candidate;
- unknown assertion context remains unknown rather than being invented;
- unsupported files and unavailable local services are reported accurately;
- the existing Gemini extractor remains an explicit compatibility fallback during migration, not a hidden second source of truth.

## Verified OpenMed integration surface

The integration follows the current OpenMed 2.x local-service contract:

- local REST service through `openmed.service.app:app`;
- `GET /health` for service reachability;
- `POST /analyze` for text entity extraction;
- entity spans with text, label, confidence, start offset, and end offset;
- specialized disease and pharmaceutical model aliases;
- exact-origin CORS and trusted-host configuration for browser clients;
- local and on-device deployment under Apache-2.0.

MediBrief does not assume that generic `/analyze` output determines negation, certainty, temporality, experiencer, allergy relationships, or code-status meaning. Those fields remain unknown until a dedicated context layer is integrated and evaluated.

---

# Architecture principles

- OpenMed runs on the same device or a trusted local endpoint selected by the user.
- The default endpoint is loopback-only: `http://127.0.0.1:8080`.
- OpenMed settings are independent from the chat provider.
- A healthy service is not evidence that a model is loaded or clinically suitable.
- Every service response is runtime-validated before mapping.
- Invalid offsets, confidence values, entities, and labels are rejected or ignored explicitly.
- Duplicate candidates use the existing conservative source-aware record-store policy.
- Source offsets refer to the exact decoded text submitted to OpenMed.
- PDF and image content is never represented as text without a real extraction or OCR step.
- Candidate creation remains patient-scoped and document-scoped.
- The local record remains usable when OpenMed is stopped.
- OpenMed and Gemini output always retain different provenance.

---

# Workstreams

## P3.0 — Baseline, branch, and architecture

Status: `[x] Complete`

- [x] Create the dedicated Phase 3 branch from the accepted Phase 2 head.
- [x] Add this living Phase 3 plan.
- [x] Verify the current OpenMed REST, model, CORS, and trusted-host surface.
- [x] Inventory the existing Gemini extraction, upload, candidate, and provenance boundaries.
- [x] Add the Slice 1 architecture note.
- [x] Add a local OpenMed setup guide.
- [x] Record explicit non-goals, unsupported-file behavior, and fallback policy.
- [x] Open stacked draft PR #3.

## P3.1 — Local OpenMed client and settings

Status: `[x] Complete for Slice 1`

- [x] Add typed health, entity, analysis, service-status, settings, and error contracts.
- [x] Add strict Zod response validation.
- [x] Normalize and validate the configured HTTP/HTTPS base URL.
- [x] Reject credentials embedded in the endpoint URL.
- [x] Add configurable request timeout and caller cancellation.
- [x] Distinguish timeout, cancellation, HTTP failure, service unavailability, and invalid response.
- [x] Add `GET /health` service checking.
- [x] Add `POST /analyze` support using the documented request fields.
- [x] Add disease and pharmaceutical model settings.
- [x] Add confidence-threshold, timeout, and model keep-alive settings.
- [x] Add Auto, OpenMed-only, and Gemini-only extraction modes.
- [x] Show reachability without claiming model readiness or clinical validation.
- [x] Keep OpenMed settings independent from chat-provider settings.
- [x] Persist settings in the existing local settings store.

## P3.2 — Text intake and candidate mapping

Status: `[x] Complete for Slice 1`

- [x] Decode supported text files locally from the existing upload payload.
- [x] Support TXT, Markdown, CSV, TSV, JSON, XML, and HTML-as-text intake.
- [x] Infer common text, PDF, and image MIME types when browsers omit them.
- [x] Reject empty, binary, oversized, malformed, and unsupported inputs explicitly.
- [x] Keep PDF and image uploads in the source-document workflow without calling the text endpoint.
- [x] Run configured disease and medication models independently.
- [x] Map recognized disease labels to candidate `ConditionRecord` resources.
- [x] Map recognized pharmaceutical labels to candidate `MedicationRecord` resources.
- [x] Ignore unsupported labels and retain diagnostics.
- [x] Reject invalid spans and source-text mismatches.
- [x] Derive excerpts from the submitted source text.
- [x] Preserve document ID, filename, character offsets, confidence, model, engine version, and extraction time.
- [x] Keep polarity, certainty, temporality, and experiencer unknown.
- [x] Keep clinical dates explicitly unknown.
- [x] Preserve existing candidate review, source preview, encrypted persistence, backup, and export behavior.
- [x] Reuse conservative same-source deduplication.
- [x] Keep OpenMed candidates excluded from confirmed timelines until reviewed.

## P3.3 — Assertion and relationship context

Status: `[ ] Not started — next`

- [ ] Introduce an evaluated context adapter for negation.
- [ ] Introduce certainty and hypothetical-context handling.
- [ ] Introduce historical/current temporality handling.
- [ ] Introduce patient/family/other experiencer handling.
- [ ] Add medication attributes and relationships where supported.
- [ ] Add allergy relationship extraction only after dedicated validation.
- [ ] Add code-status extraction only from an authoritative, evaluated path.
- [ ] Preserve context-engine provenance separately from NER provenance.
- [ ] Extend candidate review to explain and edit context evidence.
- [ ] Require human review before confirmation.

## P3.4 — Document text and OCR pipeline

Status: `[ ] Not started`

- [ ] Add PDF text extraction with page boundaries.
- [ ] Add OCR for scanned PDFs and images through a local pipeline.
- [ ] Preserve page numbers, sections, offsets, and raw extracted text.
- [ ] Distinguish embedded PDF text from OCR text.
- [ ] Record OCR engine and confidence.
- [ ] Add extraction status for running, completed, partial, unsupported, cancelled, and failed work.
- [ ] Keep the original file as the authoritative source.
- [ ] Never use import time as the document or clinical date.

## P3.5 — Language, evaluation, and fallback policy

Status: `[-] In progress`

- [ ] Add deterministic language routing for supported extraction paths.
- [ ] Build synthetic English clinical extraction fixtures.
- [ ] Build synthetic Arabic clinical extraction fixtures.
- [ ] Measure entity precision, recall, span correctness, and candidate usability.
- [ ] Compare OpenMed output with the compatibility Gemini path.
- [ ] Document Arabic clinical-NER support separately from Arabic PII support.
- [x] Make fallback behavior explicit in settings and user-facing copy.
- [x] Prevent Gemini fallback results from being attributed to OpenMed.
- [x] Prevent successful empty OpenMed output from triggering cloud fallback.
- [x] Prevent OpenMed-only mode from using cloud fallback.
- [x] Add extraction diagnostics without persisting extra source-text copies.

## P3.6 — Migration and acceptance evidence

Status: `[-] In progress`

- [x] Add repository-integrated tests for client, routing, mapping, and fallback boundaries.
- [x] Add malformed-response, source-mismatch, timeout, and cancellation tests.
- [x] Add offset, confidence, model, engine-version, excerpt, and source-link tests.
- [x] Add candidate-only and same-source deduplication tests.
- [x] Add unsupported-file, empty-file, binary-file, and service-unavailable behavior tests.
- [x] Extend GitHub Actions to the Phase 3 branch and stacked PR.
- [x] Run TypeScript validation, the complete automated suite, and production build for Slice 1.
- [ ] Add English and Arabic measured evaluation evidence.
- [ ] Record final Phase 3 acceptance evidence after every Phase 3 slice is complete.

---

# Implementation slices

## Slice 1 — Local OpenMed foundation

Status: `[x] Complete`

- [x] Dedicated Phase 3 branch
- [x] Living implementation plan
- [x] Local REST client
- [x] OpenMed settings and health status
- [x] Supported local text intake
- [x] Disease and medication candidate mapping
- [x] Explicit Gemini compatibility fallback
- [x] Separate OpenMed and Gemini provenance
- [x] Exact offsets, excerpts, confidence, model, and engine metadata
- [x] Unknown assertion-context and clinical-date preservation
- [x] Existing candidate-review integration
- [x] Expanded text upload support and MIME inference
- [x] Local service setup guide
- [x] Focused regression coverage
- [x] Repository type-check, tests, and production build
- [x] Architecture note and draft PR #3

### Slice 1 validation

The repository-integrated Node.js 24 workflow passed:

- TypeScript: `tsc --noEmit` passed.
- Test files: **29 of 29 passed**.
- Tests: **125 of 125 passed**.
- Production build: `vite build` passed.
- Production modules transformed: **1031**.

The build continues to report the existing non-blocking large-chunk, mixed-import, and runtime stylesheet warnings. The main bundle remains a separate frontend-performance workstream.

See:

- `docs/architecture/PHASE_3_OPENMED_FOUNDATION.md`
- `docs/OPENMED_LOCAL_SETUP.md`

## Slice 2 — Assertion context and richer clinical mapping

Status: `[ ] Not started — next`

- Negation evidence and scope
- Certainty and hypothetical context
- Historical/current temporality
- Patient/family/other experiencer
- Medication attributes and relationships
- Evaluated allergy and code-status paths
- Context provenance and review UI
- Synthetic evaluation fixtures

## Slice 3 — Local document text and OCR

Status: `[ ] Not started`

- PDF text extraction
- Scanned PDF and image OCR
- Page and section provenance
- Extraction status and failure recovery
- Source-text review

## Slice 4 — Language evaluation and final acceptance

Status: `[ ] Not started`

- English and Arabic synthetic corpora
- Measured extraction quality
- Explicit language and fallback policy
- Final migration and acceptance evidence

---

# Slice 1 acceptance evidence

| Criterion | Result |
|---|---|
| OpenMed settings do not change the chat provider | Passed |
| Health check is cancellable, timed out, and accurately labelled | Passed |
| Supported text is decoded locally | Passed |
| Binary files are not sent to the text analyze endpoint | Passed |
| PDFs and images are not represented as OCR-complete | Passed |
| Disease and medication output creates candidates only | Passed |
| Exact source offsets and excerpts are preserved | Passed |
| Confidence, model, engine, and extraction time are preserved | Passed |
| Assertion context remains unknown | Passed |
| Clinical date remains unknown | Passed |
| Stopped or malformed service creates no invented fact | Passed |
| Auto fallback is explicit and correctly attributed | Passed |
| OpenMed-only mode prevents cloud fallback | Passed |
| Successful empty OpenMed output prevents cloud fallback | Passed |
| Type-check, all tests, and production build pass | Passed |

---

# Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-07-31 | Build Phase 3 as a stacked branch from the completed Phase 2 head. | OpenMed candidates depend on the versioned record, review queue, provenance, source preview, and module UI completed in Phases 1–2. |
| 2026-07-31 | Start with a local REST sidecar rather than bundling model weights into the main web bundle. | The documented service supports multiple inference backends while avoiding further browser-bundle growth and tight runtime coupling. |
| 2026-07-31 | Treat `/analyze` as named-entity recognition, not complete clinical assertion understanding. | Disease and medication spans do not establish negation, certainty, temporality, experiencer, allergy status, or code status. |
| 2026-07-31 | Limit Slice 1 to files that already contain text. | PDF and image processing needs a real local extraction or OCR pipeline with page-level provenance. |
| 2026-07-31 | Keep Gemini as an explicit compatibility fallback during migration. | Existing document support remains available without concealing which engine processed the source. |
| 2026-07-31 | Run disease and medication models independently. | One model alias is not assumed to cover every clinical entity family. |
| 2026-07-31 | Do not fall back after a successful empty OpenMed response. | No entity found is a valid extraction outcome, not evidence that the local service failed. |
| 2026-07-31 | Keep all OpenMed assertion dimensions unknown in Slice 1. | NER spans alone do not justify patient attribution or assertion-state claims. |
| 2026-07-31 | Derive excerpts from source offsets instead of trusting response text. | The exact submitted source remains authoritative for review provenance. |

---

# Progress log

| Date | Slice | Work completed | Validation | Commit label |
|---|---|---|---|---|
| 2026-07-31 | P3.0 / Slice 1 | Created the Phase 3 branch and living implementation plan from the accepted Phase 2 head. | Branch and plan created. | `docs: add Phase 3 OpenMed extraction plan` |
| 2026-07-31 | P3.1 / Slice 1 | Added strict REST contracts, health checking, timeouts, cancellation, response validation, and independent persisted settings. | Included in repository pipeline. | `feat: add cancellable OpenMed REST client` |
| 2026-07-31 | P3.2 / Slice 1 | Added local text decoding, two-model extraction, candidate mapping, exact offsets, provenance, and explicit fallback routing. | Included in repository pipeline. | `feat: route document candidates through local OpenMed` |
| 2026-07-31 | P3.6 / Slice 1 | Added client, intake, mapping, service-failure, deduplication, provenance, settings, and fallback regression tests. | 29/29 files, 125/125 tests, build passed with 1031 modules. | `test: cover OpenMed routing and safety boundaries` |
| 2026-07-31 | P3.0 / Slice 1 | Added architecture and local-service setup documentation and opened draft PR #3. | PR workflow passed. | `docs: complete Phase 3 OpenMed Slice 1` |

---

# Current deferred choices

- Whether desktop packaging will start and supervise the OpenMed sidecar automatically.
- Whether a later browser/WebGPU mode will use OpenMed-compatible ONNX exports directly.
- Which disease and medication models become validated defaults after measured evaluation.
- Whether Arabic clinical NER uses an OpenMed model, another local model, or remains unsupported until measured.
- Whether derived PDF/OCR text is persisted as a local document or regenerated on demand.
- Whether the context layer is OpenMed-native, rule-assisted, or a separate evaluated local model.
- How to represent multiple context engines without collapsing provenance.
