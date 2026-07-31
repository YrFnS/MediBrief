# MediBrief Phase 3 — OpenMed Extraction Integration

> Living implementation plan for replacing the narrow cloud-only entity extractor with a local-first, source-linked clinical extraction pipeline.
>
> **Branch:** `agent/phase-3-openmed-extraction`  
> **Base:** `agent/phase-2-personal-health-record`  
> **Started:** 2026-07-31  
> **Current focus:** Slice 4 — broader English/Arabic evaluation and final Phase 3 acceptance

## Product goal

Phase 3 integrates OpenMed as a local clinical extraction layer while preserving the safety boundaries established in Phases 1 and 2:

- every extracted clinical statement remains a candidate;
- no diagnosis, medication, allergy, result, or status is confirmed automatically;
- the original uploaded file remains authoritative;
- direct text, PDF-derived text, OCR text, NER, assertion context, and cloud fallback retain separate provenance;
- page numbers, offsets, bounding boxes, hashes, engines, confidence, and timestamps remain reviewable;
- OpenMed defaults are not treated as positive clinical evidence;
- unsupported, invalid, partial, cancelled, and unavailable outcomes remain explicit;
- retries do not silently duplicate same-source candidates;
- Gemini remains an explicit compatibility fallback, not a hidden second source of truth.

## Verified integration surface

The implementation is built against the pinned OpenMed runtime:

```text
openmed[hf,service,multimodal]==2.0.0
```

The upstream OpenMed application provides:

```text
GET  /health
POST /analyze
```

MediBrief's local bridge preserves those routes and adds:

```text
GET  /medibrief/context/health
POST /medibrief/context
GET  /medibrief/documents/health
POST /medibrief/documents/extract
```

The generic `/analyze` response remains NER output. MediBrief does not attribute context or document/OCR evidence to the NER model.

---

# Architecture principles

- The recommended service binds to `127.0.0.1`.
- OpenMed settings remain independent from the assistant/chat provider.
- A healthy endpoint is not proof that models or OCR engines are loaded, suitable, or clinically validated.
- Every bridge response is runtime-validated before mapping.
- Invalid offsets, page intervals, confidence values, hashes, cues, or identities fail closed.
- Source offsets always refer to the exact text submitted to NER.
- The original upload remains authoritative over derived text.
- PDF and image content is never represented as text without a real local extraction or OCR step.
- Candidate creation remains patient-scoped and document-scoped.
- The record remains usable when OpenMed, context, or OCR is unavailable.
- Default `affirmed`, `certain`, `recent`, and `patient` context stays unknown in the candidate unless supported by evidence or human review.
- Candidate confirmation remains centralized in the existing Clinical Candidate Review.

---

# Workstreams

## P3.0 — Baseline, branch, and architecture

Status: `[x] Complete`

- [x] Create the dedicated Phase 3 branch from the accepted Phase 2 head.
- [x] Add and maintain this living implementation plan.
- [x] Inventory the existing Gemini upload, candidate, provenance, persistence, backup, and review boundaries.
- [x] Verify the OpenMed REST, model, context-helper, multimodal, CORS, and trusted-host surfaces used by MediBrief.
- [x] Add Slice 1, Slice 2, and Slice 3 architecture notes.
- [x] Maintain one local setup guide for NER, context, PDF text, and OCR.
- [x] Record explicit non-goals, unsupported behavior, and fallback policy.
- [x] Open and maintain stacked draft PR #3.

## P3.1 — Local OpenMed client and settings

Status: `[x] Complete for current Phase 3 scope`

- [x] Add typed service, health, entity, context, document, status, settings, and error contracts.
- [x] Add strict Zod validation for NER, context, and document responses.
- [x] Normalize and validate the configured HTTP/HTTPS endpoint.
- [x] Reject credentials embedded in the endpoint URL.
- [x] Add configurable request timeout and cancellation.
- [x] Distinguish timeout, cancellation, HTTP failure, unavailable service, invalid response, unsupported source, partial result, and empty result.
- [x] Add Auto, OpenMed-only, and Gemini-only extraction modes.
- [x] Add disease and medication model settings.
- [x] Add confidence threshold, timeout, and model keep-alive settings.
- [x] Add local document extraction enable/disable.
- [x] Add OCR policy, engine, languages, and rendering-resolution settings.
- [x] Add independent health checks for base OpenMed, context, and documents/OCR.
- [x] Persist settings in the existing local encrypted settings store.

## P3.2 — Direct text intake and NER candidate mapping

Status: `[x] Complete`

- [x] Decode TXT, Markdown, CSV, TSV, JSON, XML, and HTML source text locally.
- [x] Infer common MIME types when browsers omit them.
- [x] Reject empty, binary, oversized, malformed, or unsupported direct text.
- [x] Run configured disease and medication models independently.
- [x] Map recognized condition labels to candidate `ConditionRecord` resources.
- [x] Map recognized medication labels to candidate `MedicationRecord` resources.
- [x] Ignore unsupported labels while retaining diagnostics.
- [x] Reject invalid spans and source-text mismatches.
- [x] Derive excerpts from the exact submitted text.
- [x] Preserve document ID, filename, offsets, confidence, model, engine version, and extraction time.
- [x] Keep clinical dates explicitly unknown.
- [x] Preserve candidate review, source preview, encrypted persistence, backup, and export behavior.
- [x] Reuse conservative same-source deduplication.
- [x] Keep all candidates out of confirmed timelines until reviewed.

## P3.3 — Assertion context and medication evidence

Status: `[x] Complete for the verified Slice 2 scope`

- [x] Add `/medibrief/context/health` and `/medibrief/context` without replacing upstream `/health` or `/analyze`.
- [x] Add scoped negation evidence.
- [x] Add uncertainty and hypothetical evidence.
- [x] Add historical temporality from scoped cues and section priors.
- [x] Add patient/family/other experiencer evidence.
- [x] Add clinical section detection and offsets.
- [x] Add medication dose, form, route, frequency, PRN condition, and duration where parseable.
- [x] Preserve context-engine provenance separately from NER provenance.
- [x] Preserve raw context, cues, sections, and medication sigs in amendment history.
- [x] Copy only evidence-backed signals to candidate assertion fields.
- [x] Keep default positive context values unknown in the candidate.
- [x] Keep condition clinical status unknown until review.
- [x] Add dedicated context-evidence review without creating a second confirmation workflow.
- [x] Retain NER candidates with unknown context when the optional context bridge fails.
- [x] Prevent context-only failure from triggering Gemini fallback.
- [!] Allergy relationship extraction remains deferred: no dedicated measured relationship path has been accepted.
- [!] Code-status extraction remains deferred: generic NER/context is not an authoritative advance-directive path.

## P3.4 — Page-aware PDF text and OCR pipeline

Status: `[x] Complete for the verified Slice 3 scope`

- [x] Add `/medibrief/documents/health` and `/medibrief/documents/extract`.
- [x] Pin the validated OpenMed multimodal runtime.
- [x] Add local embedded PDF text extraction with page boundaries.
- [x] Detect pages with usable embedded text.
- [x] Add scanned-PDF OCR through OpenMed's multimodal interface.
- [x] Add image OCR for supported formats.
- [x] Support embedded-text, OCR, hybrid, and empty document methods.
- [x] Preserve page numbers, page intervals, word spans, bounding boxes, and OCR confidence where available.
- [x] Preserve source-file and derived-text SHA-256 hashes.
- [x] Preserve extraction engine, bridge version, OCR engine, languages, and extraction time.
- [x] Add strict response validation before NER.
- [x] Enforce conservative source-size, page-count, base64, and rendering-resolution limits.
- [x] Add queued, running, completed, partial, empty, unsupported, failed, and cancelled states.
- [x] Add durable status in the Documents module.
- [x] Add retry controls with attempt counts and warnings.
- [x] Report created and skipped same-source duplicate candidates.
- [x] Keep document, NER, context, and Gemini provenance separate.
- [x] Keep the original file authoritative.
- [x] Keep upload/import time separate from authored and clinical dates.
- [x] Keep invalid or oversized sources ineligible for cloud fallback.

## P3.5 — Language, quality evaluation, and fallback policy

Status: `[-] In progress — current focus`

- [x] Add conservative routing that prevents the evaluated English context layer from running on non-Latin text.
- [x] Build a PHI-free synthetic English assertion-context corpus.
- [x] Measure assertion axes and exact cases.
- [x] Add medication-sig field evaluation.
- [x] Document the difference between OCR language support, clinical NER, clinical context, and Arabic PII support.
- [x] Make cloud fallback explicit in settings and user-facing copy.
- [x] Prevent Gemini results from being attributed to OpenMed.
- [x] Prevent successful empty local extraction from triggering cloud fallback.
- [x] Prevent OpenMed-only mode from using cloud fallback.
- [x] Prevent context-only failure from triggering cloud fallback.
- [x] Limit fallback eligibility to unsupported or unavailable local document/NER extraction.
- [ ] Build a broader PHI-free English NER and document corpus.
- [ ] Build representative PDF/image OCR fixtures with measured character and span accuracy.
- [ ] Build synthetic Arabic clinical NER fixtures.
- [ ] Evaluate Arabic OCR separately from Arabic clinical NER/context.
- [ ] Select, reject, or explicitly defer an Arabic clinical extraction path based on evidence.
- [ ] Measure entity precision, recall, span correctness, page attribution, and candidate usability.
- [ ] Compare OpenMed and Gemini compatibility output without mixing provenance.
- [ ] Define final per-language routing and fallback policy.

## P3.6 — Acceptance evidence

Status: `[-] In progress`

- [x] Add NER client, routing, mapping, and fallback tests.
- [x] Add malformed-response, source-mismatch, timeout, and cancellation tests.
- [x] Add candidate-only and same-source deduplication tests.
- [x] Add context bridge tests and route smoke tests.
- [x] Add evidence-backed assertion mapping tests.
- [x] Add embedded-PDF page/offset tests.
- [x] Add scanned-PDF OCR tests.
- [x] Add hybrid PDF tests.
- [x] Add image OCR tests.
- [x] Add document client schema, hash, identity, page, bbox, and confidence tests.
- [x] Add document status lifecycle and retry tests.
- [x] Add page-aware NER/context orchestration tests.
- [x] Add invalid base64, unsupported source, unavailable bridge, and disabled-document-extraction tests.
- [x] Extend GitHub Actions across Python, synthetic context evaluation, TypeScript, tests, and production build.
- [x] Record Slice 1, Slice 2, and Slice 3 validation evidence.
- [ ] Add broader English and Arabic measured quality evidence.
- [ ] Add representative real-engine OCR deployment checks without PHI.
- [ ] Record final Phase 3 acceptance evidence after Slice 4.

---

# Implementation slices

## Slice 1 — Local OpenMed NER foundation

Status: `[x] Complete`

Delivered:

- strict local REST client;
- independent extraction settings;
- direct local text intake;
- disease and medication candidate mapping;
- exact source offsets and provenance;
- explicit Gemini compatibility fallback;
- existing candidate-review integration.

Validation at the completed Slice 1 head:

- TypeScript test files: **29 / 29**;
- TypeScript tests: **125 / 125**;
- TypeScript type-check: passed;
- production build: passed;
- modules transformed: **1031**.

Documentation:

- `docs/architecture/PHASE_3_OPENMED_FOUNDATION.md`
- `docs/OPENMED_LOCAL_SETUP.md`

## Slice 2 — Assertion context and medication evidence

Status: `[x] Complete`

Delivered:

- local OpenMed context bridge;
- scoped negation, uncertainty, temporality, experiencer, and section evidence;
- medication-sig parsing;
- strict bridge/client validation;
- separate NER and context provenance;
- conservative evidence-backed candidate mapping;
- context review and correction UI;
- English-only evaluated context boundary;
- PHI-free synthetic context gate.

Validation at the completed Slice 2 head:

- Python bridge tests: **7 / 7**;
- synthetic assertion cases: **6 / 6 exact**;
- synthetic assertion axes: **24 / 24 correct**;
- synthetic medication-sig fields: **5 / 5 correct**;
- TypeScript test files: **30 / 30**;
- TypeScript tests: **134 / 134**;
- TypeScript type-check: passed;
- production build: passed;
- modules transformed: **1037**.

Documentation:

- `docs/architecture/PHASE_3_ASSERTION_CONTEXT.md`
- `docs/OPENMED_LOCAL_SETUP.md`

## Slice 3 — Page-aware PDF text and OCR

Status: `[x] Complete`

Delivered:

- local document bridge and health endpoint;
- pinned OpenMed multimodal runtime;
- embedded PDF text by page;
- scanned-PDF and image OCR;
- hybrid PDF handling;
- page intervals and word spans;
- bounding boxes and OCR confidence;
- source and derived-text hashes;
- strict TypeScript document validation;
- durable extraction status and retry UI;
- candidate counts and duplicate counts;
- page-aware candidate provenance;
- unchanged candidate-only confirmation boundary;
- updated local setup and architecture evidence.

Validation at the completed Slice 3 head:

- Python bridge tests: **12 / 12**;
- synthetic assertion cases: **6 / 6 exact**;
- synthetic assertion axes: **24 / 24 correct**;
- synthetic medication-sig fields: **5 / 5 correct**;
- TypeScript test files: **34 / 34**;
- TypeScript tests: **144 / 144**;
- TypeScript type-check: passed;
- production build: passed;
- modules transformed: **1045**.

Limitations:

- document tests use deterministic synthetic extractors and OCR engines;
- deployment OCR availability remains environment-specific;
- OCR accuracy on real medical documents has not yet been measured;
- handwriting and complex table reconstruction are not validated;
- Arabic clinical NER/context remains undecided;
- all extracted statements remain candidates.

Documentation:

- `docs/architecture/PHASE_3_DOCUMENT_EXTRACTION.md`
- `docs/OPENMED_LOCAL_SETUP.md`

## Slice 4 — Language evaluation and final acceptance

Status: `[-] Next`

Planned:

- broader PHI-free English NER fixtures;
- representative PDF/image OCR fixtures;
- measured character, span, page-attribution, precision, and recall evidence;
- Arabic OCR versus clinical-NER/context decision;
- explicit per-language routing;
- OpenMed versus Gemini comparison with separate provenance;
- final Phase 3 acceptance report and roadmap transition.

---

# Slice 3 acceptance evidence

| Criterion | Result |
|---|---|
| Upstream `/health` and `/analyze` remain available | Passed |
| Document bridge health is independently testable | Passed |
| Embedded PDF text preserves page and character offsets | Passed |
| Scanned PDF pages can use OCR | Passed with deterministic injected engine |
| Embedded and OCR pages can form a hybrid document | Passed |
| Supported images produce page-aware OCR spans | Passed with deterministic injected engine |
| Bounding boxes and OCR confidence remain reviewable | Passed |
| Source and derived-text hashes remain distinct | Passed |
| Malformed base64 and unsupported sources fail closed | Passed |
| Strict page/span/identity response validation runs before NER | Passed |
| Document extraction status persists independently of clinical facts | Passed |
| Retry increments attempts and reports duplicates | Passed |
| Same-source retry does not duplicate candidate facts | Passed |
| Page-aware evidence remains separate from NER/context evidence | Passed |
| Original upload remains authoritative | Passed |
| Default positive context remains unknown without evidence | Passed |
| Context failure does not trigger Gemini fallback | Passed |
| Invalid/oversized input is not eligible for cloud fallback | Passed |
| Python, TypeScript, all tests, and production build pass | Passed |

---

# Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-07-31 | Build Phase 3 as a stacked branch from Phase 2. | Extraction depends on the versioned record, source preview, review queue, persistence, backup, and confirmed-only selectors. |
| 2026-07-31 | Use a local REST sidecar rather than browser model weights. | Avoid further web-bundle growth and support multiple local inference/OCR backends. |
| 2026-07-31 | Treat `/analyze` as NER, not full assertion understanding. | Entity spans alone do not establish assertion context. |
| 2026-07-31 | Keep Gemini as an explicit compatibility fallback. | Preserve legacy document coverage without concealing the processing engine. |
| 2026-07-31 | Do not fall back after successful empty extraction. | No entity/text found is a valid outcome, not proof of local failure. |
| 2026-07-31 | Add `openmed_bridge.app` instead of pretending upstream REST returns context/document evidence. | Context and multimodal APIs are separate OpenMed interfaces. |
| 2026-07-31 | Store context and document evidence in separate candidate amendments. | Preserve engine provenance without silently replacing the clinical-record schema. |
| 2026-07-31 | Keep default positive context axes unknown. | OpenMed defaults are not affirmative patient evidence. |
| 2026-07-31 | Keep context correction separate from confirm/reject. | Evidence correction must not become a second confirmation workflow. |
| 2026-07-31 | Auto-OCR only pages without usable embedded text. | Preserve native text when available while recovering scanned pages. |
| 2026-07-31 | Separate PDF pages with two newlines in the derived stream. | Produce deterministic page intervals and source offsets. |
| 2026-07-31 | Hash both original bytes and derived text. | Distinguish source identity from extraction output and make retries traceable. |
| 2026-07-31 | Keep the original file authoritative. | Derived text, geometry, and OCR confidence can be wrong. |
| 2026-07-31 | Track extraction status outside clinical resources. | Operational failure/retry state is not a clinical fact. |
| 2026-07-31 | Use source-aware deduplication on retry. | Recovery should not create duplicate patient facts. |
| 2026-07-31 | Pin OpenMed 2.0.0 for the bridge runtime. | Reproduce the version validated by the repository pipeline. |
| 2026-07-31 | Defer allergy and code-status extraction. | Neither domain has an accepted authoritative measured path in this integration. |
| 2026-07-31 | Defer Arabic clinical context until measured. | OCR character support does not establish clinical assertion accuracy. |

---

# Progress log

| Date | Slice | Work completed | Validation |
|---|---|---|---|
| 2026-07-31 | Slice 1 | Local client, settings, direct text, NER candidates, provenance, fallback, tests, and setup docs. | 29/29 files; 125/125 tests; build passed. |
| 2026-07-31 | Slice 2 | Context bridge, assertion evidence, medication sig, review UI, language gate, Python tests, and synthetic evaluation. | 7/7 Python; 24/24 axes; 6/6 cases; 5/5 sig fields; 30/30 TS files; 134/134 TS tests; build passed. |
| 2026-07-31 | Slice 3 | PDF/image bridge, embedded text, OCR, hybrid pages, page evidence, hashes, status, retries, deduplication, settings, Documents UI, tests, and documentation. | 12/12 Python; 34/34 TS files; 144/144 TS tests; type-check and build passed; 1045 modules. |

---

# Current deferred choices

- Whether desktop packaging will automatically install and supervise the OpenMed bridge.
- Whether a later browser/WebGPU mode will use compatible ONNX models directly.
- Which disease and medication models become accepted defaults after broader evaluation.
- Which OCR engine becomes the recommended packaged default per operating system.
- Whether derived PDF/OCR text should be persisted as a local derived document or regenerated on demand.
- How to measure table, handwriting, rotation, and low-quality scan behavior without PHI.
- Whether Arabic clinical NER uses OpenMed, another local model, or remains unsupported.
- Whether allergy and code-status extraction should remain manual unless stronger source-specific models exist.
