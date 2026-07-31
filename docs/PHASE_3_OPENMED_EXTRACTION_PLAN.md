# MediBrief Phase 3 — OpenMed Extraction Integration

> Living implementation plan for replacing the narrow cloud-only entity extractor with a local-first, source-linked clinical extraction pipeline.
>
> **Branch:** `agent/phase-3-openmed-extraction`  
> **Base:** `agent/phase-2-personal-health-record`  
> **Started:** 2026-07-31  
> **Current focus:** Slice 3 — local PDF text extraction, OCR, page provenance, and extraction status

## Product goal

Phase 3 integrates OpenMed as a local clinical extraction layer while preserving the safety boundaries established in Phases 1 and 2:

- extraction output is always a candidate;
- no extracted diagnosis, medication, allergy, result, or status becomes confirmed automatically;
- source text, offsets, model, confidence, and extraction time remain attached to every candidate;
- assertion context is evidence-backed and reviewable;
- OpenMed defaults are not treated as positive clinical evidence;
- unsupported files and unavailable local services are reported accurately;
- the existing Gemini extractor remains an explicit compatibility fallback during migration, not a hidden second source of truth.

## Verified OpenMed integration surface

The integration follows OpenMed 2.0.0 and its local interfaces:

- `GET /health` for service reachability;
- `POST /analyze` for local named-entity recognition;
- entity text, label, confidence, start offset, and end offset;
- disease and pharmaceutical model aliases;
- Python clinical helpers for context, sections, experiencer, and medication sigs;
- exact-origin CORS and trusted-host configuration;
- local deployment under Apache-2.0.

The generic `/analyze` response does not include negation, certainty, temporality, experiencer, or medication-sig relationships. MediBrief exposes those Python helpers through its own local bridge rather than attributing context output to the NER endpoint.

---

# Architecture principles

- OpenMed runs on the same device or a trusted local endpoint selected by the user.
- The default endpoint is loopback-only: `http://127.0.0.1:8080`.
- OpenMed settings are independent from the chat provider.
- A healthy service is not evidence that a model is loaded or clinically suitable.
- Every service response is runtime-validated before mapping.
- Invalid offsets, confidence values, entities, cues, and labels fail closed or are ignored explicitly.
- Duplicate candidates use the existing conservative source-aware record-store policy.
- Source offsets refer to the exact decoded text submitted to OpenMed.
- PDF and image content is never represented as text without a real extraction or OCR step.
- Candidate creation remains patient-scoped and document-scoped.
- The local record remains usable when OpenMed or its optional context bridge is stopped.
- OpenMed NER, OpenMed context, and Gemini output retain separate provenance.
- Default affirmed/certain/recent/patient axes remain unknown in the MediBrief candidate until supported by evidence or human review.

---

# Workstreams

## P3.0 — Baseline, branch, and architecture

Status: `[x] Complete`

- [x] Create the dedicated Phase 3 branch from the accepted Phase 2 head.
- [x] Add this living Phase 3 plan.
- [x] Verify the OpenMed REST, model, context-helper, CORS, and trusted-host surfaces.
- [x] Inventory the existing Gemini extraction, upload, candidate, and provenance boundaries.
- [x] Add Slice 1 and Slice 2 architecture notes.
- [x] Add and update the local OpenMed setup guide.
- [x] Record explicit non-goals, unsupported-file behavior, and fallback policy.
- [x] Open stacked draft PR #3.

## P3.1 — Local OpenMed client and settings

Status: `[x] Complete for current Phase 3 scope`

- [x] Add typed health, entity, analysis, service-status, settings, and error contracts.
- [x] Add strict Zod response validation.
- [x] Normalize and validate the configured HTTP/HTTPS base URL.
- [x] Reject credentials embedded in the endpoint URL.
- [x] Add configurable request timeout and caller cancellation.
- [x] Distinguish timeout, cancellation, HTTP failure, service unavailability, and invalid response.
- [x] Add `GET /health` and `POST /analyze` support.
- [x] Add disease and pharmaceutical model settings.
- [x] Add confidence-threshold, timeout, and model keep-alive settings.
- [x] Add Auto, OpenMed-only, and Gemini-only extraction modes.
- [x] Show reachability without claiming model readiness or clinical validation.
- [x] Keep OpenMed settings independent from chat-provider settings.
- [x] Persist settings in the existing local settings store.
- [x] Add a separate context-bridge health check.

## P3.2 — Text intake and NER candidate mapping

Status: `[x] Complete for text sources`

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
- [x] Preserve document ID, filename, offsets, confidence, model, engine version, and extraction time.
- [x] Keep clinical dates explicitly unknown.
- [x] Preserve candidate review, source preview, encrypted persistence, backup, and export behavior.
- [x] Reuse conservative same-source deduplication.
- [x] Keep candidates excluded from confirmed timelines until reviewed.

## P3.3 — Assertion context and medication relationships

Status: `[x] Complete for the verified Slice 2 scope`

- [x] Add `openmed_bridge.app`, preserving upstream `/health` and `/analyze` while adding `/medibrief/context/health` and `/medibrief/context`.
- [x] Add scoped negation evidence.
- [x] Add uncertainty and hypothetical-context evidence.
- [x] Add historical temporality from scoped cues and section priors.
- [x] Add patient/family/other experiencer evidence.
- [x] Add clinical section detection and offsets.
- [x] Add medication dose, form, route, frequency, PRN condition, and duration parsing where recognized.
- [x] Preserve context-engine provenance separately from NER provenance.
- [x] Preserve raw context, cues, sections, and medication sig in candidate amendment history.
- [x] Copy only evidence-backed axes to candidate assertion fields.
- [x] Keep default affirmed/certain/recent/patient values unknown in the candidate.
- [x] Keep condition clinical status unknown until review.
- [x] Add a dedicated context-evidence review UI without adding a second confirm/reject workflow.
- [x] Preserve prior assertion values and audit context corrections.
- [x] Retain NER candidates with unknown context when the optional bridge is unavailable.
- [x] Prevent context-only failure from triggering Gemini fallback.
- [x] Require human review before confirmation.
- [!] Allergy relationship extraction deferred: no dedicated verified relationship endpoint with measured evidence was found.
- [!] Code-status extraction deferred: generic NER/context is not an authoritative advance-directive path.

## P3.4 — Document text and OCR pipeline

Status: `[ ] Not started — next`

- [ ] Add local PDF text extraction with page boundaries.
- [ ] Detect text-bearing versus scanned PDF pages.
- [ ] Add local OCR for scanned PDFs and images.
- [ ] Preserve page numbers, sections, offsets, and raw derived text.
- [ ] Distinguish embedded PDF text from OCR text.
- [ ] Record extraction/OCR engine, version, and confidence.
- [ ] Add extraction status for queued, running, completed, partial, unsupported, cancelled, and failed work.
- [ ] Add retry and recovery without duplicating candidates.
- [ ] Keep the original file as the authoritative source.
- [ ] Never use import time as the document or clinical date.

## P3.5 — Language, evaluation, and fallback policy

Status: `[-] In progress`

- [x] Add conservative language routing that prevents the English context layer from running on non-Latin clinical text.
- [x] Build a PHI-free synthetic English assertion-context corpus.
- [x] Measure the synthetic corpus at the axis and exact-case level.
- [x] Add a medication-sig field evaluation.
- [x] Document the difference between English clinical context and Arabic PII support.
- [x] Make fallback behavior explicit in settings and user-facing copy.
- [x] Prevent Gemini fallback results from being attributed to OpenMed.
- [x] Prevent successful empty OpenMed output from triggering cloud fallback.
- [x] Prevent OpenMed-only mode from using cloud fallback.
- [x] Prevent context-bridge failure from causing cloud fallback.
- [x] Add extraction diagnostics without persisting unnecessary source-text copies.
- [ ] Build synthetic Arabic clinical NER and context fixtures.
- [ ] Select or reject an Arabic clinical extraction path based on measured evidence.
- [ ] Measure NER precision, recall, span correctness, and candidate usability on broader English fixtures.
- [ ] Compare OpenMed output with the compatibility Gemini path without mixing provenance.

## P3.6 — Acceptance evidence

Status: `[-] In progress`

- [x] Add repository-integrated tests for NER client, routing, mapping, and fallback boundaries.
- [x] Add malformed-response, source-mismatch, timeout, and cancellation tests.
- [x] Add offset, confidence, model, version, excerpt, source-link, and cue-offset tests.
- [x] Add candidate-only and same-source deduplication tests.
- [x] Add unsupported-file, empty-file, binary-file, and service-unavailable tests.
- [x] Add Python bridge tests and route smoke tests.
- [x] Add context-unavailable and non-Latin skip tests.
- [x] Add evidence-backed candidate-axis tests.
- [x] Extend GitHub Actions with Python, synthetic evaluation, TypeScript, tests, and production build.
- [x] Record Slice 1 and Slice 2 validation evidence.
- [ ] Add PDF/OCR validation evidence.
- [ ] Add broader English and Arabic measured evaluation evidence.
- [ ] Record final Phase 3 acceptance evidence after every Phase 3 slice is complete.

---

# Implementation slices

## Slice 1 — Local OpenMed foundation

Status: `[x] Complete`

Delivered:

- strict local REST client;
- independent extraction settings and health status;
- supported local text intake;
- disease and medication NER candidate mapping;
- exact source offsets and provenance;
- explicit Gemini compatibility fallback;
- candidate-review integration;
- setup and architecture documentation.

Validation:

- TypeScript passed.
- **29 / 29** test files passed.
- **125 / 125** TypeScript tests passed.
- Production build passed with **1031** modules transformed.

Documentation:

- `docs/architecture/PHASE_3_OPENMED_FOUNDATION.md`
- `docs/OPENMED_LOCAL_SETUP.md`

## Slice 2 — Assertion context and medication evidence

Status: `[x] Complete`

Delivered:

- local context bridge over OpenMed 2.0.0 Python helpers;
- scoped negation, uncertainty, temporality, experiencer, and section evidence;
- medication-sig parsing;
- strict bridge/client response validation;
- separate NER and context provenance;
- conservative evidence-backed candidate mapping;
- default positive axes retained as evidence but not copied as facts;
- context review and correction UI;
- bridge and language failure degradation;
- English-only routing boundary;
- PHI-free synthetic evaluation gate.

Validation at the completed Slice 2 code head:

- Python bridge tests: **7 / 7 passed**.
- Synthetic assertion cases: **6 / 6 exact**.
- Synthetic assertion axes: **24 / 24 correct**.
- Synthetic medication-sig fields: **5 / 5 correct**.
- TypeScript: `tsc --noEmit` passed.
- TypeScript test files: **30 / 30 passed**.
- TypeScript tests: **134 / 134 passed**.
- Production build: passed.
- Production modules transformed: **1037**.

Limitations:

- synthetic English regression evidence is not a real-document clinical validation;
- Arabic and other non-Latin context remains unsupported and explicitly unknown;
- allergy and code-status paths remain deferred;
- all output remains candidate-only and requires review.

Documentation:

- `docs/architecture/PHASE_3_ASSERTION_CONTEXT.md`
- `docs/OPENMED_LOCAL_SETUP.md`

## Slice 3 — Local document text and OCR

Status: `[ ] Not started — next`

- PDF text extraction
- scanned PDF and image OCR
- page and section provenance
- extraction status and recovery
- derived-text source review
- candidate idempotency across retries

## Slice 4 — Language evaluation and final acceptance

Status: `[ ] Not started`

- broader English synthetic corpus
- Arabic clinical NER/context decision
- measured entity quality
- explicit language and fallback policy
- final Phase 3 acceptance evidence

---

# Slice 2 acceptance evidence

| Criterion | Result |
|---|---|
| Standard OpenMed REST remains available | Passed |
| Context bridge health is independently testable | Passed |
| Context request and response preserve exact source spans | Passed |
| Invalid source, cue, or span offsets fail closed | Passed |
| Negation evidence is scoped | Passed on synthetic gate |
| Uncertainty and hypothetical evidence are preserved | Passed on synthetic gate |
| Historical and family context are preserved | Passed on synthetic gate |
| Medication sig fields remain advisory candidates | Passed |
| Raw context and NER provenance remain separate | Passed |
| Default positive axes remain unknown in candidates | Passed |
| Context panel cannot confirm or reject a candidate | Passed |
| Bridge failure retains NER with unknown context | Passed |
| Context failure does not trigger Gemini fallback | Passed |
| Non-Latin text skips the English context layer | Passed |
| Python tests, TypeScript, all tests, and build pass | Passed |

---

# Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-07-31 | Build Phase 3 as a stacked branch from the completed Phase 2 head. | OpenMed candidates depend on the versioned record, review queue, provenance, and source preview completed in Phases 1–2. |
| 2026-07-31 | Start with a local REST sidecar rather than browser model weights. | Avoid further bundle growth and support multiple local inference backends. |
| 2026-07-31 | Treat `/analyze` as NER rather than full assertion understanding. | Entity spans alone do not establish assertion context. |
| 2026-07-31 | Limit early extraction to files that already contain text. | PDF and image processing requires page-aware extraction/OCR provenance. |
| 2026-07-31 | Keep Gemini as an explicit compatibility fallback. | Preserve existing document support without concealing the processing engine. |
| 2026-07-31 | Do not fall back after a successful empty OpenMed response. | No entity found is a valid result, not a local-service failure. |
| 2026-07-31 | Add `openmed_bridge.app` instead of claiming upstream REST returns context. | OpenMed context capabilities are Python helpers, not generic `/analyze` fields. |
| 2026-07-31 | Store context evidence in candidate amendment history. | Preserve separate engine provenance without silently changing the clinical-record schema. |
| 2026-07-31 | Keep default affirmed/certain/recent/patient axes unknown in the candidate. | OpenMed defaults are not positive evidence and could otherwise become confirmed too easily. |
| 2026-07-31 | Keep context review separate from confirm/reject. | Correcting extraction evidence must not become a second clinical confirmation workflow. |
| 2026-07-31 | Skip non-Latin context until measured. | Do not apply an English context layer to Arabic or other unsupported clinical text. |
| 2026-07-31 | Defer allergy and code-status extraction. | Neither domain has an authoritative, measured relationship path in the verified integration surface. |

---

# Progress log

| Date | Slice | Work completed | Validation |
|---|---|---|---|
| 2026-07-31 | Slice 1 | Local client, settings, text intake, NER candidates, provenance, fallback, tests, setup docs, and draft PR. | 29/29 files, 125/125 tests, build passed. |
| 2026-07-31 | Slice 2 | Context bridge, assertion evidence, medication sig, conservative mapping, review UI, language gate, Python tests, and synthetic evaluation. | 7/7 Python tests; 24/24 axes; 6/6 cases; 5/5 sig fields; 30/30 TS files; 134/134 TS tests; build passed. |

---

# Current deferred choices

- Whether desktop packaging will start and supervise the OpenMed bridge automatically.
- Whether a later browser/WebGPU mode will use OpenMed-compatible ONNX exports directly.
- Which disease and medication models become validated defaults after broader evaluation.
- Whether Arabic clinical NER uses an OpenMed model, another local model, or remains unsupported.
- Whether derived PDF/OCR text is persisted as a local derived document or regenerated on demand.
- Which local PDF text and OCR engines best preserve page geometry without making the desktop package unreasonably heavy.
- Whether allergy and code-status extraction should remain manual indefinitely unless stronger source-specific models exist.
